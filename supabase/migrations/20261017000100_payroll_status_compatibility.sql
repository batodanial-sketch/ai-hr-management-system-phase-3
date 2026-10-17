-- Compatibility for the canonical legacy payroll_runs table.
-- The original schema uses payroll_status, while newer app migrations use
-- payroll_run_status and the dashboard seed needs completed/processing/failed.
-- Add the values without removing or renaming the existing enum labels.
ALTER TYPE public.payroll_status ADD VALUE IF NOT EXISTS 'processing';
ALTER TYPE public.payroll_status ADD VALUE IF NOT EXISTS 'completed';
ALTER TYPE public.payroll_status ADD VALUE IF NOT EXISTS 'failed';
