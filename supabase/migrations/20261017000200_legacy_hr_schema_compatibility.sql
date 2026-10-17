-- Reconcile app-facing HR fields with the original, richer schema.
-- Keep legacy keys and relationships while backfilling new aliases from them.
ALTER TABLE public.candidates
  ADD COLUMN IF NOT EXISTS role TEXT;

-- Leave balances keep their canonical leave_type_id/balance_year FK fields,
-- while newer HR views read type/balance_days/year. Backfill aliases to avoid
-- converting existing balances to arbitrary defaults.
ALTER TABLE public.leave_balances ADD COLUMN IF NOT EXISTS type public.leave_type;
ALTER TABLE public.leave_balances ADD COLUMN IF NOT EXISTS balance_days NUMERIC;
ALTER TABLE public.leave_balances ADD COLUMN IF NOT EXISTS year INTEGER;

UPDATE public.leave_balances AS b
SET type = CASE
  WHEN lower(coalesce(t.code, t.name, '')) LIKE '%sick%' THEN 'sick'::public.leave_type
  WHEN lower(coalesce(t.code, t.name, '')) LIKE '%unpaid%' THEN 'unpaid'::public.leave_type
  ELSE 'pto'::public.leave_type
END
FROM public.leave_types AS t
WHERE t.id = b.leave_type_id AND b.type IS NULL;

UPDATE public.leave_balances
SET type = 'pto'::public.leave_type
WHERE type IS NULL;

UPDATE public.leave_balances
SET balance_days = GREATEST(
  0,
  coalesce(opening_days, 0) + coalesce(accrued_days, 0) +
  coalesce(carried_days, 0) - coalesce(used_days, 0)
)
WHERE balance_days IS NULL;

UPDATE public.leave_balances
SET year = balance_year
WHERE year IS NULL;

UPDATE public.leave_balances
SET year = EXTRACT(YEAR FROM CURRENT_DATE)::INTEGER
WHERE year IS NULL;

ALTER TABLE public.leave_balances
  ALTER COLUMN type SET DEFAULT 'pto',
  ALTER COLUMN type SET NOT NULL,
  ALTER COLUMN balance_days SET DEFAULT 0,
  ALTER COLUMN balance_days SET NOT NULL,
  ALTER COLUMN year SET DEFAULT 2026,
  ALTER COLUMN year SET NOT NULL;

ALTER TABLE public.leave_requests ADD COLUMN IF NOT EXISTS type public.leave_type;
ALTER TABLE public.leave_requests ADD COLUMN IF NOT EXISTS employee_name TEXT;
ALTER TABLE public.leave_requests ADD COLUMN IF NOT EXISTS source_tag TEXT;

UPDATE public.leave_requests AS r
SET type = CASE
  WHEN lower(coalesce(t.code, t.name, '')) LIKE '%sick%' THEN 'sick'::public.leave_type
  WHEN lower(coalesce(t.code, t.name, '')) LIKE '%unpaid%' THEN 'unpaid'::public.leave_type
  ELSE 'pto'::public.leave_type
END
FROM public.leave_types AS t
WHERE t.id = r.leave_type_id AND r.type IS NULL;

UPDATE public.leave_requests
SET type = 'pto'::public.leave_type
WHERE type IS NULL;

UPDATE public.leave_requests AS r
SET employee_name = concat_ws(' ', e.first_name, e.last_name)
FROM public.employees AS e
WHERE e.id = r.employee_id AND r.employee_name IS NULL;

ALTER TABLE public.leave_requests
  ALTER COLUMN type SET DEFAULT 'pto',
  ALTER COLUMN type SET NOT NULL;

-- The original payroll_line_items table belongs to payroll_entries; new UI
-- rows link to payroll_runs. Preserve the old relation for legacy records but
-- add nullable aliases and backfill what can be mapped.
ALTER TABLE public.payroll_line_items
  ADD COLUMN IF NOT EXISTS payroll_run_id UUID REFERENCES public.payroll_runs(id) ON DELETE CASCADE;
ALTER TABLE public.payroll_line_items
  ADD COLUMN IF NOT EXISTS employee_id UUID REFERENCES public.employees(id) ON DELETE CASCADE;
ALTER TABLE public.payroll_line_items ADD COLUMN IF NOT EXISTS currency TEXT;
ALTER TABLE public.payroll_line_items ADD COLUMN IF NOT EXISTS employee_name TEXT;
ALTER TABLE public.payroll_line_items ADD COLUMN IF NOT EXISTS gross_pay NUMERIC;
ALTER TABLE public.payroll_line_items ADD COLUMN IF NOT EXISTS deductions NUMERIC;
ALTER TABLE public.payroll_line_items ADD COLUMN IF NOT EXISTS net_pay NUMERIC;
ALTER TABLE public.payroll_line_items ADD COLUMN IF NOT EXISTS source_tag TEXT;

UPDATE public.payroll_line_items AS li
SET employee_id = pe.employee_id
FROM public.payroll_entries AS pe
WHERE pe.id = li.payroll_entry_id AND li.employee_id IS NULL;

UPDATE public.payroll_line_items AS li
SET employee_name = concat_ws(' ', e.first_name, e.last_name)
FROM public.employees AS e
WHERE e.id = li.employee_id AND li.employee_name IS NULL;

UPDATE public.payroll_line_items AS li
SET currency = pe.currency_code::TEXT
FROM public.payroll_entries AS pe
WHERE pe.id = li.payroll_entry_id AND li.currency IS NULL;

UPDATE public.payroll_line_items AS li
SET gross_pay = pe.gross_pay
FROM public.payroll_entries AS pe
WHERE pe.id = li.payroll_entry_id AND (li.gross_pay IS NULL OR li.gross_pay = 0);

UPDATE public.payroll_line_items AS li
SET deductions = pe.total_deductions
FROM public.payroll_entries AS pe
WHERE pe.id = li.payroll_entry_id AND (li.deductions IS NULL OR li.deductions = 0);

UPDATE public.payroll_line_items AS li
SET net_pay = pe.net_pay
FROM public.payroll_entries AS pe
WHERE pe.id = li.payroll_entry_id AND (li.net_pay IS NULL OR li.net_pay = 0);

UPDATE public.payroll_line_items
SET currency = 'USD'
WHERE currency IS NULL;

UPDATE public.payroll_line_items
SET gross_pay = 0
WHERE gross_pay IS NULL;
UPDATE public.payroll_line_items
SET deductions = 0
WHERE deductions IS NULL;
UPDATE public.payroll_line_items
SET net_pay = 0
WHERE net_pay IS NULL;

ALTER TABLE public.payroll_line_items
  ALTER COLUMN currency SET DEFAULT 'USD',
  ALTER COLUMN currency SET NOT NULL,
  ALTER COLUMN gross_pay SET DEFAULT 0,
  ALTER COLUMN gross_pay SET NOT NULL,
  ALTER COLUMN deductions SET DEFAULT 0,
  ALTER COLUMN deductions SET NOT NULL,
  ALTER COLUMN net_pay SET DEFAULT 0,
  ALTER COLUMN net_pay SET NOT NULL;

-- Newer inserts don't have a payroll_entries parent; old line_type/code/label/
-- amount remain populated with valid defaults so the old constraints still hold.
ALTER TABLE public.payroll_line_items ALTER COLUMN payroll_entry_id DROP NOT NULL;
ALTER TABLE public.payroll_line_items ALTER COLUMN line_type SET DEFAULT 'earning';
ALTER TABLE public.payroll_line_items ALTER COLUMN code SET DEFAULT 'base';
ALTER TABLE public.payroll_line_items ALTER COLUMN label SET DEFAULT 'Base pay';
ALTER TABLE public.payroll_line_items ALTER COLUMN amount SET DEFAULT 0;
