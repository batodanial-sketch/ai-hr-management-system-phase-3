-- Preserve the legacy workflow-run schema while supporting the Python bridge.
-- Earlier installs create workflow_runs before the module-facing definition, so
-- CREATE TABLE IF NOT EXISTS cannot add the columns expected by the bridge.

ALTER TYPE public.workflow_run_status ADD VALUE IF NOT EXISTS 'completed';
ALTER TYPE public.workflow_run_status ADD VALUE IF NOT EXISTS 'no_workflow';

ALTER TABLE public.workflow_runs
  ADD COLUMN IF NOT EXISTS event TEXT,
  ADD COLUMN IF NOT EXISTS executed_actions JSONB NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS error TEXT;

-- Legacy runs required a workflow FK; the bridge also records unmatched events
-- (workflow_id = NULL) to make "no workflow matched" outcomes auditable.
ALTER TABLE public.workflow_runs
  ALTER COLUMN workflow_id DROP NOT NULL;

-- Backfill the event name from the older trigger payload where it is available.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'workflow_runs'
      AND column_name = 'trigger_payload'
  ) THEN
    UPDATE public.workflow_runs
    SET event = COALESCE(
      NULLIF(event, ''),
      NULLIF(trigger_payload ->> 'event', ''),
      NULLIF(trigger_payload ->> 'type', ''),
      'legacy'
    )
    WHERE event IS NULL OR event = '';
  ELSE
    UPDATE public.workflow_runs
    SET event = 'legacy'
    WHERE event IS NULL OR event = '';
  END IF;
END;
$$;

ALTER TABLE public.workflow_runs
  ALTER COLUMN event SET DEFAULT 'legacy',
  ALTER COLUMN event SET NOT NULL;

CREATE INDEX IF NOT EXISTS idx_workflow_runs_org_event_created
  ON public.workflow_runs (organization_id, event, created_at DESC);
