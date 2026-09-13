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
| `/api/ai/test-connection` | Zod provider/model/base URL validation. | No route-level authenticated context was found before settings/provider test. | Makes outbound bridge/provider connection test; request can select custom endpoint. | CODE-VERIFIED finding: unauthenticated provider-test/possible SSRF or abuse surface; live exploitability NOT_TESTED. Treat as P1 until authenticated and egress-tested. |
| `/api/graphql` | GraphQL schema validation. | Route and resolvers contain no `getRbacContext`, membership, or role gate; resolvers call broad domain getters directly. | Exposes employee, candidate, lead, payroll, expense, benefit, equity, document, audit and screening query fields. | CODE-VERIFIED P0 access-control finding: anonymous/client access is not proven denied. Live response test BLOCKED_EXTERNAL. |
| `/api/employees`, `/api/employees/[id]` | Zod route schemas; action layer validates/authorizes. | Server actions are the authorization boundary; source inspection shows this is not visible in route file. | Employee PII and compensation mutations. | CODE-VERIFIED for route-to-action delegation; IDOR and tenant behavior BLOCKED_EXTERNAL. |
| Module CRUD families (`benefits`, `equity`, `expenses`, `surveys`, `planning`, `contractors`, `offboarding`, `assets`, `documents`, `screening`) | Shared `handleModule*` plus Zod schemas. | Shared handler resolves RBAC, applies role/employee scope, then RLS-bound client. | HR/financial/PII mutations and reads. | CODE-VERIFIED defense-in-depth design; live tenant/RLS proof BLOCKED_EXTERNAL. |
| Document upload/content/file/download | Shared RBAC context in file handlers; module route uses shared CRUD. | HR/admin gates are present in source paths examined. | Storage keys, files, document content. | CODE-VERIFIED source controls; storage bucket policy and cross-tenant download NOT_TESTED. |
| `/api/scim/v2/[tenantId]/[...segments]` | Segment parsing and SCIM handler validation. | Bearer token and tenant path checks are present. | Provision/deprovision membership and user data. | CODE-VERIFIED token gate; live SCIM identity/tenant binding BLOCKED_EXTERNAL. |
| `/api/webhooks/external/inbound-lead` | Zod payload; API-key hash, expiry and scope lookup. | Organization comes from resolved API key, not request body. | Service-role upserts candidate/application and writes webhook log; candidate PII. | CODE-VERIFIED source; duplicate/idempotency and live key behavior BLOCKED_EXTERNAL. |
| `/api/webhooks/n8n-trigger` | HMAC over raw body; Zod payload; bounded payload snapshot. | Shared secret authenticates sender; organization/workflow IDs are accepted from signed payload and written with service role. | Workflow run and audit writes. | CODE-VERIFIED. Secret is global in route design; cross-tenant sender authorization and workflow/org foreign-key consistency are NOT_TESTED; P1 review item. |
| `/api/webhooks/python-bridge` and alias callback | Constant-time shared-secret check; Zod payload. | Organization existence checked; service role used. | Notifications, workflow runs, audit logs; payload may contain PII. | CODE-VERIFIED source; replay/idempotency and event-to-org authorization BLOCKED_EXTERNAL. |
| `/api/webhooks/outbound` and external outbound trigger | Payload validation; HMAC for n8n path. | RBAC on outbound route; external-trigger route uses admin organization context. | User-supplied URL and secret are sent server-side. | CODE-VERIFIED P1 SSRF/secret-forwarding review finding: no visible destination allowlist/private-network denial in external-trigger path. Live exploitability NOT_TESTED. |
| `/api/cron/*`, `/api/system/cron` | Secret comparison and fail-closed missing-secret behavior. | Cron secret, service role, per-org filtering in daily workflow path. | Scheduled workflow mutations and audit logs. | CODE-VERIFIED protection; scheduler activation and replay/concurrency behavior BLOCKED_EXTERNAL. |
| `/api/account/delete` | Authenticated user lookup. | Service-role deletion after current-user check. | Deletes employee/membership/profile/user records; irreversible PII mutation. | CODE-VERIFIED source boundary; cascade completeness and live authorization BLOCKED_EXTERNAL. |
| `/api/metrics` | Bearer token constant-time compare. | Metrics backend must be enabled plus token. | Bounded metrics only. | CODE-VERIFIED; live exposure/config NOT_TESTED. |
| `/api/health`, `/api/system/health`, `/api/system/ready` | None / dependency probes. | Health is intentionally public; readiness uses service role. | Operational state. | CODE-VERIFIED semantics; deployment probe behavior BLOCKED_EXTERNAL. |

## Authentication, RBAC, IDOR, anonymous fallback

- The canonical application boundary is `lib/auth.ts`, `lib/rbac.ts`, `lib/authz/`, `app/actions/_shared.ts`; `memberships` is the canonical membership table in the final migration.
- AI proxy authorization inherits canonical RBAC rather than trusting `X-Organization-Id`; this is CODE-VERIFIED.
- Shared module CRUD documents app-layer role/employee scope plus RLS-bound access; this is CODE-VERIFIED, not live verified.
- Demo/seed fallback code exists in domain/data paths. Anonymous fallback behavior is not uniformly live-tested. The GraphQL route is an explicit P0 source finding because it bypasses the shared route gate.
- IDOR attempts across employee, document, workflow, SCIM tenant, webhook and organization IDs were not run: BLOCKED_EXTERNAL.
- Ordinary employee versus HR-admin matrices were covered by selected unit/RBAC tests, but not by authenticated endpoint execution: CODE-VERIFIED tests / BLOCKED_EXTERNAL runtime.

## Errors, limits, idempotency, audit logging

- Zod validation, bounded AI bridge timeout, rate limits, payload limits, constant-time secret checks, and audit writes are present in the inspected shared paths: CODE-VERIFIED.
- The complete matrix identifies mutations and external calls but cannot establish transaction atomicity, retry safety, database constraints under real schema, or webhook replay behavior: BLOCKED_EXTERNAL.
- Every mutation's live audit-log outcome, including failure/partial-failure paths, is NOT_TESTED.

## Validation executed

- Jest: 31 suites, 292 tests passed — CODE-VERIFIED.
- TypeScript: `npm run typecheck` passed — CODE-VERIFIED.
- ESLint: passed with no warnings/errors; Next.js deprecation notice only — CODE-VERIFIED.
- Python compileall and Electron typecheck passed — CODE-VERIFIED.
- Production build: passed (`next build`, Next.js 15.5.25; Supabase Node 20 deprecation warnings only) — CODE-VERIFIED.
- Live endpoint/auth matrix: BLOCKED_EXTERNAL; build success does not establish live endpoint behavior.

## Priority conclusions

1. **P0 — `/api/graphql` has no visible authentication/RBAC gate and exposes broad HR/financial/PII getters.** Must be denied or explicitly authorized before H4.
2. **P1 — `/api/ai/test-connection` is not visibly authenticated and accepts custom endpoint input.** Confirm authorization and egress policy before production.
3. **P1 — external outbound trigger accepts a user-supplied destination and secret.** Confirm SSRF controls and secret handling before production.
4. **P1 — globally signed n8n/bridge callbacks rely on sender secret for tenant authority.** Confirm per-tenant sender binding, replay protection, and workflow/org consistency.
5. All runtime claims above remain subject to authenticated live verification, which is BLOCKED_EXTERNAL.
