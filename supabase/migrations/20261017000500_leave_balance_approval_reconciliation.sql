-- Keep approved leave requests and available leave balances consistent.
-- This runs inside the transaction that changes request status, so concurrent
-- approvals cannot spend the same balance twice.
CREATE OR REPLACE FUNCTION public.reconcile_leave_balance_on_status_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  balance_id UUID;
  available_days NUMERIC;
  used_days_before NUMERIC;
  requested_days NUMERIC;
  request_year INTEGER;
BEGIN
  IF OLD.status IS NOT DISTINCT FROM NEW.status THEN
    RETURN NEW;
  END IF;

  -- Restore days when a previously approved request is revoked or rejected.
  IF OLD.status::TEXT = 'approved' AND OLD.type::TEXT <> 'unpaid' THEN
    requested_days := COALESCE(
      NULLIF(OLD.total_days, 0),
      GREATEST(1, (OLD.end_date - OLD.start_date + 1)::NUMERIC)
    );
    request_year := EXTRACT(YEAR FROM OLD.start_date)::INTEGER;

    SELECT id, balance_days, used_days
      INTO balance_id, available_days, used_days_before
    FROM public.leave_balances
    WHERE organization_id = OLD.organization_id
      AND employee_id = OLD.employee_id
      AND type::TEXT = OLD.type::TEXT
      AND year = request_year
    ORDER BY id
    LIMIT 1
    FOR UPDATE;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Cannot reverse approved leave: balance row is missing for employee %', OLD.employee_id;
    END IF;

    UPDATE public.leave_balances
    SET balance_days = COALESCE(available_days, 0) + requested_days,
        used_days = GREATEST(0, COALESCE(used_days_before, 0) - requested_days)
    WHERE id = balance_id;
  END IF;

  -- Spend balance only on a transition into approved. Unpaid leave does not
  -- consume a PTO/sick balance.
  IF NEW.status::TEXT = 'approved' AND NEW.type::TEXT <> 'unpaid' THEN
    requested_days := COALESCE(
      NULLIF(NEW.total_days, 0),
      GREATEST(1, (NEW.end_date - NEW.start_date + 1)::NUMERIC)
    );
    request_year := EXTRACT(YEAR FROM NEW.start_date)::INTEGER;

    SELECT id, balance_days, used_days
      INTO balance_id, available_days, used_days_before
    FROM public.leave_balances
    WHERE organization_id = NEW.organization_id
      AND employee_id = NEW.employee_id
      AND type::TEXT = NEW.type::TEXT
      AND year = request_year
    ORDER BY id
    LIMIT 1
    FOR UPDATE;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'No % leave balance is configured for employee % in %', NEW.type, NEW.employee_id, request_year;
    END IF;
    IF COALESCE(available_days, 0) < requested_days THEN
      RAISE EXCEPTION 'Insufficient % leave balance: requested %, available %', NEW.type, requested_days, COALESCE(available_days, 0);
    END IF;

    UPDATE public.leave_balances
    SET balance_days = COALESCE(available_days, 0) - requested_days,
        used_days = COALESCE(used_days_before, 0) + requested_days
    WHERE id = balance_id;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS leave_balance_approval_reconciliation ON public.leave_requests;
CREATE TRIGGER leave_balance_approval_reconciliation
AFTER UPDATE OF status ON public.leave_requests
FOR EACH ROW
EXECUTE FUNCTION public.reconcile_leave_balance_on_status_change();

REVOKE ALL ON FUNCTION public.reconcile_leave_balance_on_status_change() FROM PUBLIC, anon, authenticated;
