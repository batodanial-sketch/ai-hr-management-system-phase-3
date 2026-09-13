# RLS Verification Evidence — 2026-09-13

## Static evidence

The canonical membership architecture remains `public.memberships`; the final canonical migration redefines membership predicates and keeps legacy `organization_memberships`/`roles` non-authoritative. Existing RLS migration text covers core HR, recruiting, payroll, documents, workflows, knowledge, AI telemetry, webhooks and audit tables.

The static inventory remains an inventory only: 39 migration files, 124 parsed table declarations (including parser artifact `IF`), 90 RLS-enabled table names and 174 policy declarations. It does not establish a live schema.

## Code-level verification harness status

`scripts/verify_rls_catalog.mjs` is now an executable live catalog collector. It exits with `BLOCKED_EXTERNAL` when `DATABASE_URL` is absent and, when configured, queries `pg_class`, `pg_policies`, `pg_proc`, `pg_constraint`, `pg_indexes` and foreign keys. This remediation adds the replay migration but does not claim it has been applied. The current local run returned `BLOCKED_EXTERNAL` because no `DATABASE_URL` was configured.

Required matrix: anonymous, employee, manager, HR_ADMIN, owner, cross-tenant user, and service-role; SELECT/INSERT/UPDATE/DELETE across employees, payroll, candidates, applications, documents, leave, attendance, workflows, AI telemetry, knowledge and audit logs.

Status: `CODE-VERIFIED` for source/migration intent; `BLOCKED_EXTERNAL` for runtime RLS.

## Service-role inventory

Approved service-role factories remain `lib/supabase/server.ts` and compatibility `src/lib/supabase.ts`; no third factory was introduced. Caller classes are:

- account deletion: current authenticated account, irreversible cleanup;
- signup/bootstrap: server signup flow;
- readiness: health probe only;
- cron: fail-closed cron secret and per-organization scheduled processing;
- SCIM: authenticated per-tenant SCIM token path;
- inbound/provider webhooks: provider signatures/API keys plus resource/tenant checks where applicable;
- n8n/Python bridge: timestamped HMAC, tenant API key, resource checks and replay claim after remediation;
- workflows: trusted server workflow execution;
- storage: server storage provider, caller authorization upstream;
- intelligence/audit: approved internal service paths with tenant pinning requirements.

Each caller still requires live review of deployed credentials and caller context; service role bypasses RLS by design.
