# Integration Audit — 2026-09-13

## Status legend

`CODE-VERIFIED` means the repository contains the described wiring/control. `VERIFIED` is reserved for a live successful integration test; none was available here. `BLOCKED_EXTERNAL` means credentials, deployed target, provider, scheduler, or Supabase infrastructure is required. `NOT_TESTED` means no evidence was collected. No integration is declared operational from imports alone.

## Integration matrix

| Integration | Repository evidence | Security / tenant boundary | Runtime status |
|---|---|---|---|
| Supabase Auth + database | `lib/supabase/server.ts`, `src/lib/supabase.ts`, migrations, auth/RBAC helpers | Publishable/session client for RLS; admin client only server-side trusted paths; canonical `memberships` | CODE-VERIFIED source; BLOCKED_EXTERNAL live auth/RLS |
| Python AI bridge | `lib/ai-proxy.ts`, AI routes, bridge callback routes, `BRIDGE_SECRET_KEY` / callback secret | Canonical RBAC org forwarded by server; timeout, rate limit, usage/telemetry; callbacks use constant-time secret | CODE-VERIFIED; BLOCKED_EXTERNAL bridge/provider |
| Configurable LLM providers | AI provider config and `/api/ai/test-connection` | Server-side API-key resolution; custom base URL accepted after normalization; route lacks visible auth gate | CODE-VERIFIED P1 review finding; BLOCKED_EXTERNAL provider/egress |
| Email / outbound notifications | Repository fetch/provider configuration and notification paths | Organization-scoped writes where visible; provider credentials/config not live verified | BLOCKED_EXTERNAL |
| Inbound external leads | `/api/webhooks/external/inbound-lead`, API key hash/expiry/scope, candidate/application upserts | Org resolved from API key; service-role client; webhook log | CODE-VERIFIED; BLOCKED_EXTERNAL live key/idempotency |
| Generic inbound provider webhooks | `/api/webhooks/inbound/[provider]`, provider secret/HMAC branches | Provider signature checks and service-role event persistence | CODE-VERIFIED source; BLOCKED_EXTERNAL provider signatures/replay |
| n8n | `/api/webhooks/n8n-trigger`, outbound routes, `N8N_WEBHOOK_SECRET` | HMAC; payload organization/workflow IDs are trusted after global secret; bounded persisted payload | CODE-VERIFIED; P1 tenant-binding/replay review; BLOCKED_EXTERNAL live n8n |
| Python bridge callbacks | `/api/webhooks/python-bridge`, alias `/python-callback` | Shared secret, org existence check, service-role notification/run/audit writes | CODE-VERIFIED; BLOCKED_EXTERNAL replay/idempotency |
| Slack events | `/api/webhooks/slack/events`, signing-secret comparison | Constant-time comparison present; implementation returns receipt rather than full event processing | CODE-VERIFIED source; BLOCKED_EXTERNAL Slack delivery |
| SCIM | `/api/scim/v2/[tenantId]/[...segments]`, migration SCIM helpers | Bearer token and tenant path handling; canonical migration redirects provisioning to `memberships` | CODE-VERIFIED source; BLOCKED_EXTERNAL identity-provider test |
| Storage/documents | document upload/content/file/download routes and storage pipeline tests | RBAC helpers and storage keys; bucket policies/signed URLs need live validation | CODE-VERIFIED source/tests; BLOCKED_EXTERNAL storage |
| Observability/metrics | `/api/metrics`, metrics backend, bounded labels | Bearer token and disabled-by-default Prometheus path; no identifiers intended | CODE-VERIFIED; BLOCKED_EXTERNAL deployment exposure |
| Scheduler/cron | `/api/cron/daily-workflows`, `/api/system/cron`, `CRON_SECRET` | Fail closed when secret absent; service-role scheduled writes; per-org filtering in daily workflow | CODE-VERIFIED; scheduler inactive/not exercised: BLOCKED_EXTERNAL |
| GraphQL clients | `/api/graphql`, `graphql-yoga`, domain resolvers | No visible auth/RBAC at route or resolver layer; broad HR/financial getters | CODE-VERIFIED P0 gap; live anonymous query BLOCKED_EXTERNAL |

## Boundary review

### Service-role clients

The approved `adminClient()` / `createAdminSupabaseClient()` boundary is preserved in source; no audit change created a second service-role client. However, both `lib/supabase/server.ts` and compatibility `src/lib/supabase.ts` expose service-role factories, so import/caller review remains required. Every caller must be machine-authenticated or server-trusted and must derive tenant identity from trusted context. Source findings include GraphQL-adjacent data paths, readiness, account deletion, cron, SCIM, inbound webhooks, workflow webhooks, and bridge callbacks.

Status: CODE-VERIFIED boundary; BLOCKED_EXTERNAL enforcement and secret deployment.

### Webhook and scheduler identity

HMAC/timing-safe comparisons and fail-closed missing-secret behavior are present in inspected routes. They establish authentication of a holder of a shared secret, not per-tenant authorization, replay prevention, or delivery ordering. Those remain BLOCKED_EXTERNAL / NOT_TESTED. Production cron is not activated by this audit.

### Provider and SSRF risk

The external outbound trigger accepts a URL and secret from an authenticated admin request and performs a server-side fetch. Source inspection did not show a private-network/destination allowlist in that path. The AI connection test also accepts a custom base URL and lacks a visible route-level authentication gate. These are CODE-VERIFIED review findings; no exploit was run.

## Integration test plan blocked by infrastructure

- Supabase authenticated session and RLS matrix: BLOCKED_EXTERNAL.
- Python bridge secret, organization header, timeout, streaming and callback loop: BLOCKED_EXTERNAL.
- Groq/custom provider success, failure, timeout, key non-disclosure and egress restrictions: BLOCKED_EXTERNAL.
- n8n/Slack/provider HMAC signatures, timestamp/replay behavior: BLOCKED_EXTERNAL.
- SCIM create/update/deprovision and canonical membership effect: BLOCKED_EXTERNAL.
- Storage upload/download cross-tenant and expiration behavior: BLOCKED_EXTERNAL.
- Cron scheduler identity, lock/concurrency, retry and dead-letter behavior: BLOCKED_EXTERNAL.

## Integration conclusion

Integration code is present and several controls are CODE-VERIFIED, but no external system is operationally verified. The GraphQL authorization gap is a P0 release blocker. The custom endpoint/SSRF and globally signed webhook tenant-binding items are P1 release blockers until explicitly tested and controlled.
