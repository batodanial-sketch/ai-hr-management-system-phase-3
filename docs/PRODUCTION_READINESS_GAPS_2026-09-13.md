# Production Readiness Gaps — 2026-09-13

## Release decision

**H4 STATUS: BLOCKED**

This is a source- and automated-validation audit, not a production certification. H4 cannot be conditionally ready because a P0 authorization gap is visible in `/api/graphql`, live tenant/RLS verification is unavailable, and external/provider/scheduler behavior has not been exercised.

## Git and validation evidence

| Check | Result | Status |
|---|---|---|
| Repository | `fluxentiq`, branch `arena/01a07c94-ai-hr-management-system`, HEAD `53e7ce9` | CODE-VERIFIED |
| Working tree at audit start | Clean | CODE-VERIFIED |
| Remote relation | Local branch ahead of origin by 4 commits; push credentials unavailable | CODE-VERIFIED / BLOCKED_EXTERNAL push |
| Jest | 31 suites, 292 tests passed | CODE-VERIFIED |
| TypeScript | `npm run typecheck` passed | CODE-VERIFIED |
| ESLint | No warnings/errors; Next.js deprecation notice | CODE-VERIFIED |
| Python compileall | Passed | CODE-VERIFIED |
| Electron typecheck | Passed | CODE-VERIFIED |
| Static inventory | 112 route files, 147 methods; 38 migrations parsed | CODE-VERIFIED |
| Live API/auth/RLS | Not available | BLOCKED_EXTERNAL |
| Live providers/bridge/SCIM/webhooks | Not available | BLOCKED_EXTERNAL |
| Scheduler activation | Not performed | BLOCKED_EXTERNAL |

## P0 blockers

### P0-1: GraphQL route lacks visible access control

`app/api/graphql/route.ts` creates Yoga handlers for GET and POST and delegates to resolvers. `lib/graphql/schema.ts` resolvers call broad domain getters for employees, candidates, leads, payroll, benefits, equity, expenses, documents, audits and screening without a visible canonical RBAC/membership gate. This is CODE-VERIFIED from source. Anonymous and cross-tenant runtime impact is BLOCKED_EXTERNAL, but the source gap is sufficient to block H4.

Required closure evidence: authenticated route gate or resolver authorization, tenant-scoped getters, anonymous denial test, employee/manager/HR-admin matrix, cross-tenant test, and no sensitive field leakage.

## P1 blockers / high-risk gaps

1. **AI provider test authorization and egress.** `/api/ai/test-connection` validates input and calls the bridge/provider but has no visible `getRbacContext`/role gate. Custom base URL input needs authenticated authorization, SSRF/private-network denial, DNS/rebind policy, timeout, and audit evidence.
2. **Outbound webhook SSRF and secret handling.** External outbound trigger accepts a destination URL and signing secret and performs server-side fetch. Prove allowlisting/private-network denial and never persist or expose raw secrets.
3. **Webhook tenant binding and replay.** n8n and bridge callbacks authenticate possession of global shared secrets while accepting organization/workflow IDs from signed payloads. Add/test tenant-specific credentials or trusted mapping, replay/idempotency, timestamp/nonce, and workflow/org consistency.
4. **Live RLS and service-role proof.** Verify all 89 statically RLS-enabled tables, policies, final canonical membership function, child-table joins, and every admin-client caller against real sessions.
5. **Storage/document IDOR.** Execute cross-tenant and expired signed URL tests for content/file/download/upload paths.
6. **Mutation atomicity/idempotency.** Test account deletion, candidate/application upserts, workflow run/audit writes, notifications, payroll, webhook logs and retries for partial failures and duplicates.
7. **Scheduler safety.** Before activation, add evidence for lock/concurrency, per-organization selection, secret rotation, retry/dead-letter behavior and audit identity. Do not activate cron as part of this audit.

## P2 / operational gaps

- Production build was re-run and passed; deployment artifact/environment configuration and live deployment remain unverified: CODE-VERIFIED build / BLOCKED_EXTERNAL deployment.
- Provider API key configuration, email delivery, observability scrape exposure, alert thresholds, backup/restore and migration rollback were not externally verified: BLOCKED_EXTERNAL.
- Migration history retains legacy tables/functions/references even though the final canonical migration marks `memberships` authoritative. Validate every deployed environment before cleanup: BLOCKED_EXTERNAL.
- Test names/references in the static endpoint inventory are heuristic and do not constitute route coverage. Add an executable endpoint coverage matrix.
- No production data was inspected; therefore no claim is made about actual PII records, orphan rates, duplicate rows, or tenant contamination.
- PII retention, deletion, export, provider logging and audit-log redaction require synthetic-fixture tests and policy evidence.

## H4 gate checklist

| Gate | Status |
|---|---|
| No P0 anonymous/IDOR/auth gap | FAIL — GraphQL source gap |
| Canonical membership and tenant RLS live-tested | BLOCKED_EXTERNAL |
| Service-role calls machine-authenticated and tenant-bound | BLOCKED_EXTERNAL |
| Every endpoint method authenticated/authorized or intentionally public | BLOCKED_EXTERNAL; GraphQL FAIL |
| AI H3 data source tenant pinning and 500-row implication proven | CODE-VERIFIED source/tests; live BLOCKED_EXTERNAL |
| PII restrictions and retention verified | BLOCKED_EXTERNAL |
| Webhook/provider/SCIM integration live verified | BLOCKED_EXTERNAL |
| Scheduler safe activation plan tested | BLOCKED_EXTERNAL |
| Build/type/lint/unit validation green | CODE-VERIFIED |

**Final decision: H4 BLOCKED.**

## Audit artifact change policy

No application architecture or security behavior was changed for this audit. Only audit artifacts and the static inventory generator were added. Do not treat this report as evidence that the listed gaps are fixed.
