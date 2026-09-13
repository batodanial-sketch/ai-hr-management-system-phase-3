# Full Data, Tenant Isolation, PII and Integrity Audit — 2026-09-13

## Evidence boundary

This is a source/migration/test audit of checkpoint `53e7ce9`. No live Supabase project, production database, RLS session matrix, production data, or authenticated deployment was available. Therefore database behavior is `CODE-VERIFIED` or `BLOCKED_EXTERNAL`, never claimed `VERIFIED` from SQL text alone.

Structured migration inventory: [`docs/audit/audit-schema.json`](audit/audit-schema.json). It parsed 38 migration files, 123 table declarations (including one parser artifact `IF`), 89 RLS-enabled table names, and 174 policy declarations. These counts are static inventory counts, not a live schema census.

## Tenant model

| Control | Evidence | Status |
|---|---|---|
| Canonical membership table | `public.memberships(user_id, organization_id, role)` and final canonical migration | CODE-VERIFIED |
| App authentication context | `lib/auth.ts`, `lib/rbac.ts`, `lib/authz/` | CODE-VERIFIED |
| Service-role boundary | `lib/supabase/server.ts` plus legacy-compatible `src/lib/supabase.ts` | CODE-VERIFIED / review required |
| Tenant predicate | final migration redefines `is_organization_member` and `is_org_member` from `memberships` | CODE-VERIFIED |
| Live RLS enforcement | No Supabase connection in this audit | BLOCKED_EXTERNAL |
| Cross-tenant read/write attempt | Not executed | BLOCKED_EXTERNAL |

## Schema and migration findings

### Canonical/legacy reconciliation

The migration history contains both `memberships` and legacy `organization_memberships`/`roles` references. Migration `20260906000100_canonical_membership_authz.sql` explicitly makes `memberships` authoritative, redefines membership predicates, makes SCIM/bootstrap write canonical memberships, and marks legacy tables read-only for non-service roles. This is CODE-VERIFIED as source intent.

Historical migrations still contain legacy references and older policy/function assumptions. Migration ordering, idempotent application to an actual Supabase database, and whether all deployed environments have the final reconciliation migration are BLOCKED_EXTERNAL. Do not delete legacy tables without proving no deployed references.

### Policy coverage

The parsed inventory reports 89 RLS-enabled tables and 174 policy declarations. The SQL contains tenant policies across core HR, recruiting, payroll, workflow, documents, knowledge, AI usage, webhooks and operational tables. The final canonical migration adds a restrictive leave-decision role guard. This is CODE-VERIFIED from migration text.

Potential policy risks requiring live checks:

- Several historical policies use `is_organization_member`; final function replacement is intended to redirect them to `memberships`, but this must be tested with anonymous, member, manager, HR-admin, cross-tenant, and service-role sessions.
- Service-role writes bypass RLS by design. Every service-role caller must prove trusted caller authentication and tenant binding; source review identified account deletion, readiness, cron, inbound webhooks, SCIM/workflow paths, and intelligence-related paths.
- RLS enablement does not prove policies are restrictive enough, nor that child tables join tenant ownership correctly.
- Migration parser output is a discovery aid; SQL parsing can misread compact DDL and is not a substitute for `pg_catalog` inspection.

## High-value data domains

| Domain | Tables/paths | PII / integrity concerns | Status |
|---|---|---|---|
| Identity/membership | `profiles`, `users`, `memberships`, legacy membership tables | Role ambiguity, account deletion cascades, cross-org profile reads | CODE-VERIFIED design; live RLS BLOCKED_EXTERNAL |
| Employees/payroll | employees, payroll runs/entries/line items, compensation | Salary, email, personal contacts, tax forms; mutation authorization and export leakage | CODE-VERIFIED route/schema evidence; live BLOCKED_EXTERNAL |
| Recruiting | candidates, applications, resumes, assessments, interviews | Candidate PII and AI-derived decisions; tenant scope and retention | CODE-VERIFIED source/RLS text; live BLOCKED_EXTERNAL |
| Documents/storage | documents, document files, employee files, upload/download routes | Storage key IDOR, content exposure, signed URL policy | CODE-VERIFIED app gates; bucket/live tests BLOCKED_EXTERNAL |
| Benefits/equity/expenses | benefit dependents/enrollments, equity grants, expense reports | Financial/dependent PII, approval lifecycle, duplicate writes | CODE-VERIFIED schema/source; live BLOCKED_EXTERNAL |
| Attendance/leave | attendance records/events, leave requests/balances | Employee self-scope versus manager approval; decision transition | CODE-VERIFIED including final restrictive leave guard; live BLOCKED_EXTERNAL |
| Workflow/audit | workflow runs/executions/approvals, audit logs | Trusted machine writes, payload PII, replay/partial writes | CODE-VERIFIED bounded payload in selected webhook; live BLOCKED_EXTERNAL |
| AI telemetry | ai usage/token usage/budget/assistant tables | Prompt/response leakage, per-org metering, provider data transfer | CODE-VERIFIED adapter/proxy paths; provider/runtime BLOCKED_EXTERNAL |

## PII controls

Positive evidence: explicit projections and bounded reads in H3 intelligence paths; bridge timeouts/rate limits; bounded n8n payload snapshot; no API key acceptance in the AI connection test body; server-side service-role keys; document and module RBAC helpers. These are CODE-VERIFIED.

Unproven or failing gates: GraphQL has broad resolver getters without a visible auth boundary (P0 endpoint finding); live provider redaction/retention is not tested; outbound webhook payload policy is not live tested; audit logs may receive bounded but still sensitive payload previews; storage bucket policy and signed URL expiry are unknown. Statuses: CODE-VERIFIED findings / BLOCKED_EXTERNAL runtime.

## Data integrity and mutation review

- Zod schemas cover many route payloads and UUID/date/enum/size constraints.
- Unique constraints appear for memberships, employee organization/email, candidate organization/email, and selected workflow/data records.
- Multi-step operations such as candidate + application upserts, webhook log writes, account deletion, workflow run + audit writes, and payroll operations were not executed against a database. Atomicity, retry/idempotency, FK consistency, and partial-failure recovery are BLOCKED_EXTERNAL.
- Global webhook secrets and caller-supplied organization/workflow IDs require runtime tests for replay, cross-tenant misuse, and foreign-key mismatch.
- No production-data findings are asserted.

## H3 intelligence data path

`lib/intelligence/data.ts` is the shared adapter; `lib/intelligence/service.ts` pins organization context; source reads are bounded at 500 rows with explicit projections; deterministic detectors are shared rather than duplicated. Selected Jest suites cover service/signals/sweep/routes. This is CODE-VERIFIED. Supabase tenant filtering, row-limit implications, data freshness, and live PII behavior are BLOCKED_EXTERNAL.

## Required live data verification before H4

1. Apply migrations to a disposable Supabase project and inspect `pg_class`, `pg_policies`, functions, constraints and foreign keys.
2. Run anonymous, member, manager, HR-admin, owner and cross-tenant RLS read/write matrix.
3. Verify service-role callers have authenticated machine identity and cannot accept arbitrary tenant IDs.
4. Attempt storage/document IDOR and signed URL expiry tests.
5. Replay webhook payloads and retry every multi-write path.
6. Verify deletion/cascade and retention behavior with synthetic PII fixtures.

Overall data isolation gate: **BLOCKED_EXTERNAL**. The GraphQL P0 source finding prevents a conditional H4 readiness decision even before live RLS verification.
