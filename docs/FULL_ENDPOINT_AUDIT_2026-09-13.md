# Full Endpoint Audit — 2026-09-13

## Scope and evidence standard

Repository checkpoint audited: `53e7ce9`, branch `arena/01a07c94-ai-hr-management-system`. Working tree was clean before audit; audit artifacts are the only current changes. This report covers Next.js route handlers, route methods, server-action-backed API paths, GraphQL, AI/bridge proxies, webhooks, SCIM, cron, health/metrics, uploads/downloads, and workflow paths.

Statuses mean: `VERIFIED` = executed against a live target; `CODE-VERIFIED` = supported by source/static analysis or automated tests; `BLOCKED_EXTERNAL` = requires unavailable live infrastructure; `NOT_TESTED` = no evidence collected; `FAIL` = reproducible validation failure; `UNKNOWN` = evidence is insufficient. No live Supabase, deployment, authenticated browser, provider, scheduler, or external webhook verification was available.

## Complete inventory

The machine-generated complete method matrix is [`docs/audit/audit-endpoints.md`](audit/audit-endpoints.md), with structured evidence in [`docs/audit/audit-endpoints.json`](audit/audit-endpoints.json). It contains every discovered `app/api/**/route.ts` method:

| Inventory result | Count | Status |
|---|---:|---|
| Route files | 112 | CODE-VERIFIED |
| Exported methods | 147 | CODE-VERIFIED |
| GET | 51 | CODE-VERIFIED |
| POST | 78 | CODE-VERIFIED |
| PATCH | 12 | CODE-VERIFIED |
| DELETE | 5 | CODE-VERIFIED |
| PUT | 1 | CODE-VERIFIED |
| HEAD / OPTIONS | 0 | CODE-VERIFIED |

The matrix records source, discovered auth/RBAC tokens, referenced tables, mutation/external-call indicators, candidate test references, and live status. Test references are heuristic text matches and are not proof of endpoint coverage.

## High-risk endpoint trace

| Path / family | Validation | Auth/RBAC / tenant evidence | Mutation / PII / integration | Status and finding |
|---|---|---|---|---|
| `/api/ai/*` bridge proxies and `/api/ai/engine/*` | Proxy forwards request body; feature-specific handlers add schemas where present. | `proxyToBridge()` resolves canonical `getRbacContext()` and forwards canonical organization; rate limit and pilot gate are present. | Python AI bridge, usage/telemetry, candidate/employee data possible. | CODE-VERIFIED. Live bridge and PII redaction remain BLOCKED_EXTERNAL. |
| `/api/ai/test-connection` | Zod provider/model/base URL validation. | Remediated: canonical RBAC context and HR_ADMIN+ gate before provider test. | Makes outbound bridge/provider connection test; custom endpoint passes shared HTTPS/private-destination policy. | TEST-VERIFIED policy primitives; live provider/egress verification BLOCKED_EXTERNAL. Previous P1 is CODE-VERIFIED remediated. |
| `/api/graphql` | GraphQL schema validation. | Remediated: both methods call `requireGraphqlContext()` before Yoga; canonical RBAC and HR_ADMIN/SUPER_ADMIN gate. | Exposes employee, candidate, lead, payroll, expense, benefit, equity, document, audit and screening query fields. | TEST-VERIFIED mocked trust boundary; live anonymous/cross-tenant resolver test BLOCKED_EXTERNAL. Previous P0 is CODE-VERIFIED remediated. |
| `/api/employees`, `/api/employees/[id]` | Zod route schemas; action layer validates/authorizes. | Server actions are the authorization boundary; source inspection shows this is not visible in route file. | Employee PII and compensation mutations. | CODE-VERIFIED for route-to-action delegation; IDOR and tenant behavior BLOCKED_EXTERNAL. |
| Module CRUD families (`benefits`, `equity`, `expenses`, `surveys`, `planning`, `contractors`, `offboarding`, `assets`, `documents`, `screening`) | Shared `handleModule*` plus Zod schemas. | Shared handler resolves RBAC, applies role/employee scope, then RLS-bound client. | HR/financial/PII mutations and reads. | CODE-VERIFIED defense-in-depth design; live tenant/RLS proof BLOCKED_EXTERNAL. |
| Document upload/content/file/download | Shared RBAC context in file handlers; module route uses shared CRUD. | HR/admin gates are present in source paths examined. | Storage keys, files, document content. | CODE-VERIFIED source controls; storage bucket policy and cross-tenant download NOT_TESTED. |
| `/api/scim/v2/[tenantId]/[...segments]` | Segment parsing and SCIM handler validation. | Bearer token and tenant path checks are present. | Provision/deprovision membership and user data. | CODE-VERIFIED token gate; live SCIM identity/tenant binding BLOCKED_EXTERNAL. |
| `/api/webhooks/external/inbound-lead` | Zod payload; API-key hash, expiry and scope lookup. | Organization comes from resolved API key, not request body. | Service-role upserts candidate/application and writes webhook log; candidate PII. | CODE-VERIFIED source; duplicate/idempotency and live key behavior BLOCKED_EXTERNAL. |
| `/api/webhooks/n8n-trigger` | Timestamped HMAC; Zod payload; bounded payload snapshot; atomic replay claim. | Tenant-scoped `workflows:write` API key must match organization; workflow ownership is checked before service-role writes. | Workflow run and audit writes. | CODE-VERIFIED remediation; live migration, duplicate, wrong-tenant and scheduler tests BLOCKED_EXTERNAL. |
| `/api/webhooks/python-bridge` and alias callback | Timestamped HMAC; Zod payload; bounded payload snapshot; atomic replay claim. | Tenant-scoped `bridge:write` API key plus organization/resource ownership checks. | Notifications, workflow runs, audit logs; payload is bounded before persistence. | CODE-VERIFIED remediation; live duplicate/provider callback tests BLOCKED_EXTERNAL. |
| `/api/webhooks/outbound` and external outbound trigger | Payload validation; HMAC/API key for machine path; shared safe outbound fetch. | Canonical session RBAC or tenant-scoped `webhooks:write` API key; external trigger uses admin organization context. | User-supplied URL is HTTPS/private-destination validated; redirects are not followed; raw secret is not persisted. | TEST-VERIFIED URL policy and CODE-VERIFIED integration; live egress verification BLOCKED_EXTERNAL. Previous P1 is CODE-VERIFIED remediated. |
| `/api/cron/*`, `/api/system/cron` | Secret comparison and fail-closed missing-secret behavior. | Cron secret, service role, per-org filtering in daily workflow path. | Scheduled workflow mutations and audit logs. | CODE-VERIFIED protection; scheduler activation and replay/concurrency behavior BLOCKED_EXTERNAL. |
| `/api/account/delete` | Authenticated user lookup. | Service-role deletion after current-user check. | Deletes employee/membership/profile/user records; irreversible PII mutation. | CODE-VERIFIED source boundary; cascade completeness and live authorization BLOCKED_EXTERNAL. |
| `/api/metrics` | Bearer token constant-time compare. | Metrics backend must be enabled plus token. | Bounded metrics only. | CODE-VERIFIED; live exposure/config NOT_TESTED. |
| `/api/health`, `/api/system/health`, `/api/system/ready` | None / dependency probes. | Health is intentionally public; readiness uses service role. | Operational state. | CODE-VERIFIED semantics; deployment probe behavior BLOCKED_EXTERNAL. |

## Authentication, RBAC, IDOR, anonymous fallback

- The canonical application boundary is `lib/auth.ts`, `lib/rbac.ts`, `lib/authz/`, `app/actions/_shared.ts`; `memberships` is the canonical membership table in the final migration.
- AI proxy authorization inherits canonical RBAC rather than trusting `X-Organization-Id`; this is CODE-VERIFIED.
- Shared module CRUD documents app-layer role/employee scope plus RLS-bound access; this is CODE-VERIFIED, not live verified.
- Demo/seed fallback code exists in domain/data paths. Anonymous fallback behavior is not uniformly live-tested. GraphQL now has an explicit HR_ADMIN/SUPER_ADMIN route gate; local demo-mode behavior remains distinct from configured production auth.
- IDOR attempts across employee, document, workflow, SCIM tenant, webhook and organization IDs were not run: BLOCKED_EXTERNAL.
- Ordinary employee versus HR-admin matrices were covered by selected unit/RBAC tests, but not by authenticated endpoint execution: CODE-VERIFIED tests / BLOCKED_EXTERNAL runtime.

## Errors, limits, idempotency, audit logging

- Zod validation, bounded AI bridge timeout, rate limits, payload limits, constant-time secret checks, and audit writes are present in the inspected shared paths: CODE-VERIFIED.
- The complete matrix identifies mutations and external calls but cannot establish transaction atomicity, retry safety, database constraints under real schema, or webhook replay behavior: BLOCKED_EXTERNAL.
- Every mutation's live audit-log outcome, including failure/partial-failure paths, is NOT_TESTED.

## Validation executed

- Jest: 34 suites, 311 tests passed — CODE-VERIFIED; 3 security/remediation suites were added.
- TypeScript: `npm run typecheck` passed — CODE-VERIFIED.
- ESLint: passed with no warnings/errors; Next.js deprecation notice only — CODE-VERIFIED.
- Python compileall and Electron typecheck passed — CODE-VERIFIED.
- Production build: passed (`next build`, Next.js 15.5.25; Supabase Node 20 deprecation warnings only) — CODE-VERIFIED.
- Live endpoint/auth matrix: BLOCKED_EXTERNAL; build success does not establish live endpoint behavior.

## Remediation conclusions

1. **GraphQL P0:** confirmed and remediated with a canonical HR_ADMIN/SUPER_ADMIN trust-boundary gate; mocked regression tests pass. Live anonymous/cross-tenant resolver verification remains BLOCKED_EXTERNAL.
2. **AI connection P1:** confirmed and remediated with canonical RBAC plus shared HTTPS/private-destination egress policy; URL policy tests pass. Live provider/egress verification remains BLOCKED_EXTERNAL.
3. **Outbound webhook P1:** confirmed and remediated with shared safe outbound fetch, redirect blocking, HTTPS/host/IP policy, and no raw-secret persistence. Live DNS-rebinding/firewall verification remains BLOCKED_EXTERNAL.
4. **n8n/Python bridge P1:** confirmed and remediated with timestamped signatures, tenant-scoped API keys, resource ownership checks, bounded payloads and atomic replay claims. Migration and live callback verification remain BLOCKED_EXTERNAL.
5. Remaining runtime claims are not fabricated; see `docs/audit/*.md` and the production readiness report.

## H5 live verification update — 2026-09-13

H5 attempted to convert blocked claims into live evidence. No deployed target, Supabase/Postgres URL, provider credentials, or local Node dependency installation was available. Therefore H5 produced **0 LIVE-VERIFIED** results. Deterministic GraphQL, AI authorization, SSRF, outbound webhook-policy and existing Copilot evidence remains TEST-VERIFIED. See [`docs/audit/H5_LIVE_VERIFICATION_MATRIX.md`](audit/H5_LIVE_VERIFICATION_MATRIX.md) and the H5 result artifacts. The prior remediation remains code/test verified; no live endpoint claim has been upgraded.
