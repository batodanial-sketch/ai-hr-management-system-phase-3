-- Fluxentiq — security-definer execution hardening
-- Privileged provisioning/mutation helpers are called by the server-side
-- service-role client or authenticated application functions. PostgreSQL
-- grants EXECUTE to PUBLIC by default; revoke that default explicitly so a
-- browser/client cannot invoke these helpers directly through PostgREST.

REVOKE ALL ON FUNCTION public.scim_find_user_by_email(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.scim_find_user_by_email(text) TO service_role;

REVOKE ALL ON FUNCTION public.scim_assign_membership(uuid, uuid, text, boolean) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.scim_assign_membership(uuid, uuid, text, boolean) TO service_role;

REVOKE ALL ON FUNCTION public.scim_list_memberships(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.scim_list_memberships(uuid) TO service_role;

-- This legacy candidate mutation accepts an organization argument and has no
-- authenticated caller check. It is not a public RPC surface; keep it
-- service-role-only until it is replaced by a canonical tenant-aware action.
REVOKE ALL ON FUNCTION public.advance_candidate_stage(uuid, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.advance_candidate_stage(uuid, uuid) TO service_role;
