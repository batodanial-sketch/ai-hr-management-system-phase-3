-- Populate the app-facing display name from the canonical employee FK.
CREATE OR REPLACE FUNCTION public.prepare_legacy_leave_request()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
BEGIN
  IF NEW.leave_type_id IS NULL THEN
    NEW.leave_type_id := public.ensure_legacy_leave_type(NEW.organization_id, NEW.type::TEXT);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.employees e
    WHERE e.id = NEW.employee_id AND e.organization_id = NEW.organization_id
  ) THEN
    RAISE EXCEPTION 'Leave request employee must belong to organization %', NEW.organization_id;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.leave_types lt
    WHERE lt.id = NEW.leave_type_id AND lt.organization_id = NEW.organization_id
  ) THEN
    RAISE EXCEPTION 'Leave type must belong to organization %', NEW.organization_id;
  END IF;

  IF NEW.employee_name IS NULL THEN
    SELECT concat_ws(' ', e.first_name, e.last_name)
      INTO NEW.employee_name
    FROM public.employees e
    WHERE e.id = NEW.employee_id AND e.organization_id = NEW.organization_id;
  END IF;

  IF NEW.total_days IS NULL OR NEW.total_days <= 0 THEN
    NEW.total_days := GREATEST(1, (NEW.end_date - NEW.start_date + 1)::NUMERIC);
  END IF;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.prepare_legacy_leave_request() FROM PUBLIC, anon, authenticated;
