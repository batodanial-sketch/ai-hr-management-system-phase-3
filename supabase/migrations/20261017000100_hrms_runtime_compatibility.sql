-- Fluxentiq HRMS — runtime compatibility for canonical + module-facing records
-- The initial schema normalizes several tables; later app modules also read and
-- write flattened legacy columns. Keep those shapes compatible without removing
-- the canonical foreign keys that protect tenant and payroll integrity.

-- Candidate creation currently writes the candidate's target role directly.
ALTER TABLE public.candidates
  ADD COLUMN IF NOT EXISTS role TEXT;

-- Module-facing leave shape. The canonical leave_type_id / total_days columns
-- remain authoritative and are populated by a BEFORE INSERT trigger below.
ALTER TABLE public.leave_requests
  ADD COLUMN IF NOT EXISTS type public.leave_type NOT NULL DEFAULT 'pto';

ALTER TABLE public.leave_balances
  ADD COLUMN IF NOT EXISTS type public.leave_type NOT NULL DEFAULT 'pto',
  ADD COLUMN IF NOT EXISTS balance_days NUMERIC NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS year INTEGER NOT NULL DEFAULT EXTRACT(YEAR FROM CURRENT_DATE)::INTEGER;

-- Backfill the display shape for pre-existing canonical leave rows.
UPDATE public.leave_requests lr
SET type = CASE lower(lt.code)
  WHEN 'sick' THEN 'sick'::public.leave_type
  WHEN 'unpaid' THEN 'unpaid'::public.leave_type
  ELSE 'pto'::public.leave_type
END
FROM public.leave_types lt
WHERE lt.id = lr.leave_type_id;

UPDATE public.leave_balances lb
SET type = CASE lower(lt.code)
  WHEN 'sick' THEN 'sick'::public.leave_type
  WHEN 'unpaid' THEN 'unpaid'::public.leave_type
  ELSE 'pto'::public.leave_type
END,
balance_days = COALESCE(lb.opening_days, 0) + COALESCE(lb.accrued_days, 0) + COALESCE(lb.carried_days, 0),
year = lb.balance_year
FROM public.leave_types lt
WHERE lt.id = lb.leave_type_id;

CREATE OR REPLACE FUNCTION public.ensure_legacy_leave_type(
  p_organization_id UUID,
  p_type TEXT
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  normalized_type TEXT := lower(trim(COALESCE(p_type, 'pto')));
  leave_type_id UUID;
BEGIN
  IF normalized_type NOT IN ('pto', 'sick', 'unpaid') THEN
    normalized_type := 'pto';
  END IF;

  SELECT id INTO leave_type_id
  FROM public.leave_types
  WHERE organization_id = p_organization_id
    AND lower(code) = normalized_type
  LIMIT 1;

  IF leave_type_id IS NULL THEN
    INSERT INTO public.leave_types (organization_id, name, code, paid)
    VALUES (
      p_organization_id,
      CASE normalized_type
        WHEN 'pto' THEN 'Paid Time Off'
        WHEN 'sick' THEN 'Sick Leave'
        ELSE 'Unpaid Leave'
      END,
      normalized_type,
      normalized_type <> 'unpaid'
    )
    ON CONFLICT (organization_id, code)
    DO UPDATE SET name = EXCLUDED.name
    RETURNING id INTO leave_type_id;
  END IF;

  RETURN leave_type_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.prepare_legacy_leave_request()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.leave_type_id IS NULL THEN
    NEW.leave_type_id := public.ensure_legacy_leave_type(NEW.organization_id, NEW.type::TEXT);
  END IF;

  IF NEW.total_days IS NULL OR NEW.total_days <= 0 THEN
    NEW.total_days := GREATEST(1, (NEW.end_date - NEW.start_date + 1)::NUMERIC);
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS legacy_leave_request_compat ON public.leave_requests;
CREATE TRIGGER legacy_leave_request_compat
BEFORE INSERT ON public.leave_requests
FOR EACH ROW EXECUTE FUNCTION public.prepare_legacy_leave_request();

CREATE OR REPLACE FUNCTION public.prepare_legacy_leave_balance()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  employee_org_id UUID;
BEGIN
  IF NEW.organization_id IS NULL THEN
    SELECT organization_id INTO employee_org_id
    FROM public.employees
    WHERE id = NEW.employee_id;
    NEW.organization_id := employee_org_id;
  END IF;

  IF NEW.organization_id IS NULL THEN
    RAISE EXCEPTION 'Cannot resolve organization for leave balance employee %', NEW.employee_id;
  END IF;

  IF NEW.leave_type_id IS NULL THEN
    NEW.leave_type_id := public.ensure_legacy_leave_type(NEW.organization_id, NEW.type::TEXT);
  END IF;

  IF NEW.balance_year IS NULL THEN
    NEW.balance_year := COALESCE(NEW.year, EXTRACT(YEAR FROM CURRENT_DATE)::INTEGER);
  END IF;

  IF COALESCE(NEW.opening_days, 0) = 0 AND COALESCE(NEW.accrued_days, 0) = 0 THEN
    NEW.opening_days := COALESCE(NEW.balance_days, 0);
  END IF;

  IF NEW.balance_days IS NULL OR NEW.balance_days = 0 THEN
    NEW.balance_days := COALESCE(NEW.opening_days, 0) + COALESCE(NEW.accrued_days, 0) + COALESCE(NEW.carried_days, 0);
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS legacy_leave_balance_compat ON public.leave_balances;
CREATE TRIGGER legacy_leave_balance_compat
BEFORE INSERT ON public.leave_balances
FOR EACH ROW EXECUTE FUNCTION public.prepare_legacy_leave_balance();

-- The legacy payroll UI stores totals under payroll_run_id / gross_pay /
-- deductions / net_pay. The canonical line item schema still requires a
-- payroll_entries foreign key and categorized line values. Create/link the
-- canonical entry before the NOT NULL / FK checks run.
ALTER TABLE public.payroll_line_items
  ADD COLUMN IF NOT EXISTS payroll_run_id UUID REFERENCES public.payroll_runs(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS employee_id UUID REFERENCES public.employees(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS currency TEXT NOT NULL DEFAULT 'USD';

CREATE OR REPLACE FUNCTION public.prepare_legacy_payroll_line_item()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  run_row RECORD;
  cycle_id UUID;
  entry_id UUID;
  employee_org_id UUID;
  employee_row_org_id UUID;
  entry_employee_id UUID;
  currency_value CHAR(3);
BEGIN
  IF NEW.payroll_run_id IS NOT NULL THEN
    SELECT id, organization_id, period_start, period_end, currency
    INTO run_row
    FROM public.payroll_runs
    WHERE id = NEW.payroll_run_id;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Payroll run % does not exist', NEW.payroll_run_id;
    END IF;

    NEW.organization_id := COALESCE(NEW.organization_id, run_row.organization_id);
    IF NEW.employee_id IS NULL AND NEW.payroll_entry_id IS NOT NULL THEN
      SELECT employee_id INTO NEW.employee_id
      FROM public.payroll_entries
      WHERE id = NEW.payroll_entry_id;
    END IF;

    IF NEW.employee_id IS NULL THEN
      RAISE EXCEPTION 'Payroll line item must include employee_id';
    END IF;

    IF NEW.payroll_entry_id IS NULL THEN
      SELECT id INTO cycle_id
      FROM public.payroll_cycles
      WHERE organization_id = run_row.organization_id
        AND name = 'Compatibility run ' || run_row.id::TEXT
      LIMIT 1;

      IF cycle_id IS NULL THEN
        INSERT INTO public.payroll_cycles (
          organization_id, name, period_start, period_end, pay_date, currency_code
        )
        VALUES (
          run_row.organization_id,
          'Compatibility run ' || run_row.id::TEXT,
          run_row.period_start,
          run_row.period_end,
          run_row.period_end,
          upper(substr(COALESCE(NEW.currency, run_row.currency, 'USD'), 1, 3))
        )
        RETURNING id INTO cycle_id;
      END IF;

      currency_value := upper(substr(COALESCE(NEW.currency, run_row.currency, 'USD'), 1, 3));

      INSERT INTO public.payroll_entries (
        organization_id, payroll_cycle_id, employee_id,
        gross_pay, total_deductions, net_pay, currency_code
      )
      VALUES (
        run_row.organization_id, cycle_id, NEW.employee_id,
        COALESCE(NEW.gross_pay, 0), COALESCE(NEW.deductions, 0),
        COALESCE(NEW.net_pay, 0), currency_value
      )
      ON CONFLICT (payroll_cycle_id, employee_id)
      DO UPDATE SET
        gross_pay = EXCLUDED.gross_pay,
        total_deductions = EXCLUDED.total_deductions,
        net_pay = EXCLUDED.net_pay,
        currency_code = EXCLUDED.currency_code
      RETURNING id INTO entry_id;

      NEW.payroll_entry_id := entry_id;
    END IF;
  END IF;

  IF NEW.payroll_entry_id IS NOT NULL THEN
    SELECT organization_id, employee_id
    INTO employee_row_org_id, entry_employee_id
    FROM public.payroll_entries
    WHERE id = NEW.payroll_entry_id;

    NEW.employee_id := COALESCE(NEW.employee_id, entry_employee_id);
    NEW.organization_id := COALESCE(NEW.organization_id, employee_row_org_id);
  END IF;

  IF NEW.line_type IS NULL THEN NEW.line_type := 'earning'; END IF;
  IF NEW.code IS NULL THEN NEW.code := 'PAYROLL-SUMMARY'; END IF;
  IF NEW.label IS NULL THEN NEW.label := COALESCE(NEW.employee_name, 'Employee') || ' payroll summary'; END IF;
  IF NEW.amount IS NULL THEN NEW.amount := COALESCE(NEW.gross_pay, NEW.net_pay, 0); END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS legacy_payroll_line_item_compat ON public.payroll_line_items;
CREATE TRIGGER legacy_payroll_line_item_compat
BEFORE INSERT ON public.payroll_line_items
FOR EACH ROW EXECUTE FUNCTION public.prepare_legacy_payroll_line_item();

CREATE OR REPLACE FUNCTION public.recalculate_legacy_payroll_run_totals()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  affected_run_id UUID;
BEGIN
  IF TG_OP = 'DELETE' THEN
    affected_run_id := OLD.payroll_run_id;
  ELSE
    affected_run_id := NEW.payroll_run_id;
  END IF;

  IF affected_run_id IS NOT NULL THEN
    UPDATE public.payroll_runs
    SET total_gross = COALESCE((SELECT SUM(gross_pay) FROM public.payroll_line_items WHERE payroll_run_id = affected_run_id), 0),
        total_deductions = COALESCE((SELECT SUM(deductions) FROM public.payroll_line_items WHERE payroll_run_id = affected_run_id), 0),
        total_net = COALESCE((SELECT SUM(net_pay) FROM public.payroll_line_items WHERE payroll_run_id = affected_run_id), 0)
    WHERE id = affected_run_id;
  END IF;
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS legacy_payroll_run_totals_compat ON public.payroll_line_items;
CREATE TRIGGER legacy_payroll_run_totals_compat
AFTER INSERT OR UPDATE OR DELETE ON public.payroll_line_items
FOR EACH ROW EXECUTE FUNCTION public.recalculate_legacy_payroll_run_totals();
