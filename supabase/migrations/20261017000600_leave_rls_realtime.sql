-- Avoid selecting auth.users from a caller-facing RLS policy. The
-- auth.jwt() email claim is already verified by Supabase and prevents the
-- permission-denied failure of the legacy policy.
DROP POLICY IF EXISTS leave_requests_update ON public.leave_requests;
CREATE POLICY leave_requests_update ON public.leave_requests
  FOR UPDATE
  USING (
    public.is_org_member(organization_id)
    AND (
      public.current_org_role(organization_id)::TEXT IN ('owner', 'admin', 'manager')
      OR employee_id = (
        SELECT e.id
        FROM public.employees AS e
        WHERE e.organization_id = leave_requests.organization_id
          AND lower(e.email) = lower(COALESCE(auth.jwt() ->> 'email', ''))
        LIMIT 1
      )
    )
  )
  WITH CHECK (
    public.is_org_member(organization_id)
    AND (
      public.current_org_role(organization_id)::TEXT IN ('owner', 'admin', 'manager')
      OR (
        status::TEXT = 'pending'
        AND employee_id = (
          SELECT e.id
          FROM public.employees AS e
          WHERE e.organization_id = leave_requests.organization_id
            AND lower(e.email) = lower(COALESCE(auth.jwt() ->> 'email', ''))
          LIMIT 1
        )
      )
    )
  );

-- Publish expenses to Supabase Realtime so inserts from automations and
-- integrations can refresh the tenant-scoped expenses feed.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime')
     AND NOT EXISTS (
       SELECT 1 FROM pg_publication_tables
       WHERE pubname = 'supabase_realtime'
         AND schemaname = 'public'
         AND tablename = 'expense_reports'
     ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.expense_reports;
  END IF;
END
$$;
ALTER TABLE public.expense_reports REPLICA IDENTITY FULL;
