-- Reconcile the app-facing HR model with the legacy tables defined by
-- 20250811000100_fluxentiq_initial.sql. These changes are additive and keep
-- the original identifiers/foreign keys available to older modules.
alter table public.candidates add column if not exists role text;

-- The legacy leave tables retain leave_type_id / total_days / balance_year,
-- while the newer HR API expects type / balance_days / year.
alter table public.leave_balances
  add column if not exists type public.leave_type not null default 'pto';
alter table public.leave_balances
  add column if not exists balance_days numeric not null default 0;
alter table public.leave_balances
  add column if not exists year integer not null default 2026;

alter table public.leave_requests
  add column if not exists type public.leave_type not null default 'pto';
alter table public.leave_requests
  add column if not exists employee_name text;
alter table public.leave_requests
  add column if not exists source_tag text;

-- The original payroll_line_items table belongs to payroll_entries and makes
-- those legacy fields NOT NULL. The app-facing model associates rows to payroll_runs.
alter table public.payroll_line_items
  add column if not exists payroll_run_id uuid references public.payroll_runs(id) on delete cascade;
alter table public.payroll_line_items
  add column if not exists employee_id uuid references public.employees(id) on delete cascade;
alter table public.payroll_line_items
  add column if not exists currency text not null default 'USD';
alter table public.payroll_line_items
  add column if not exists employee_name text;
alter table public.payroll_line_items
  add column if not exists gross_pay numeric not null default 0;
alter table public.payroll_line_items
  add column if not exists deductions numeric not null default 0;
alter table public.payroll_line_items
  add column if not exists net_pay numeric not null default 0;
alter table public.payroll_line_items
  add column if not exists source_tag text;

alter table public.payroll_line_items alter column payroll_entry_id drop not null;
alter table public.payroll_line_items alter column line_type set default 'earning';
alter table public.payroll_line_items alter column code set default 'base';
alter table public.payroll_line_items alter column label set default 'Base pay';
alter table public.payroll_line_items alter column amount set default 0;
