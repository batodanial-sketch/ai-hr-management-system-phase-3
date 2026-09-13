# Fluxentiq AI — H5 Live Verification Matrix

Date: 2026-09-13  
Commit under verification: `0b7111e`  
Evidence rule: live infrastructure is never inferred from source or mocked tests.

## Environment discovery

| Required capability | Current result | Evidence |
|---|---|---|
| Working tree | `NOT-TESTED` as a clean-state claim; an existing user modification is present | `scripts/zero-downtime-migrate.sh` mode is `100644` versus committed `100755`; preserved and not changed |
| Supabase/Postgres URL | `BLOCKED-EXTERNAL` | `DATABASE_URL` is not configured |
| Node PostgreSQL runtime dependency | `RESTORED` | `npm ci` restored `pg`; live suite remains blocked only by missing `DATABASE_URL` |
| Hosted deployment URL | `BLOCKED-EXTERNAL` | No deployment target supplied |
| Provider/n8n/bridge/storage/SCIM credentials | `BLOCKED-EXTERNAL` | No relevant runtime credentials were available |

## Verification matrix

| Security domain | Test environment | Result | Evidence / exact next command |
|---|---|---|---|
| Migration application from clean database | Disposable PostgreSQL/Supabase | `BLOCKED-EXTERNAL` | `DATABASE_URL=... node scripts/db/local-pg.mjs reset --tolerant` or approved Supabase migration runner; current sandbox lacks URL/runtime dependency |
| Live schema catalog | Disposable PostgreSQL/Supabase | `BLOCKED-EXTERNAL` | `DATABASE_URL=... node scripts/verify_rls_catalog.mjs`; current invocation returned `{"status":"BLOCKED_EXTERNAL","reason":"DATABASE_URL is not configured"}` |
| Anonymous RLS | Supabase Auth/Postgres | `BLOCKED-EXTERNAL` | Run `scripts/db/authz-rls-suite.mjs` plus JWT-backed endpoint tests |
| Employee RLS | Supabase Auth/Postgres | `BLOCKED-EXTERNAL` | Same RLS suite with real authenticated JWT |
| Manager RLS | Supabase Auth/Postgres | `BLOCKED-EXTERNAL` | Same RLS suite with real authenticated JWT |
| HR admin RLS | Supabase Auth/Postgres | `BLOCKED-EXTERNAL` | Same RLS suite with real authenticated JWT |
| Owner RLS | Supabase Auth/Postgres | `BLOCKED-EXTERNAL` | Same RLS suite with real authenticated JWT |
| Cross-tenant RLS | Supabase Auth/Postgres | `BLOCKED-EXTERNAL` | Same RLS suite; must prove zero rows/denied writes |
| Service-role boundary | Disposable DB + app | `CODE-VERIFIED` | Approved factories/callers inventoried in `docs/audit/rls-verification.md`; live substitution test blocked |
| GraphQL anonymous | Deployed app | `BLOCKED-EXTERNAL` | `curl`/Playwright against `/api/graphql`; local trust-boundary test is `TEST-VERIFIED` |
| GraphQL cross-tenant | Deployed app + two tenants | `BLOCKED-EXTERNAL` | Authenticated two-tenant query matrix |
| GraphQL auth boundary | Jest mocks | `TEST-VERIFIED` | `tests/unit/graphqlRouteSecurity.test.ts`: 3 passing tests |
| AI connection unauthorized | Jest route mock | `TEST-VERIFIED` | `tests/unit/aiConnectionRouteSecurity.test.ts`: unauthorized request rejected before forwarding |
| AI connection live provider | Deployed app/provider | `BLOCKED-EXTERNAL` | Requires configured provider and deployment |
| SSRF private targets | Deterministic local policy tests | `TEST-VERIFIED` | `tests/unit/securityRemediation.test.ts`: private IP, metadata, credentials, protocol, port cases |
| SSRF DNS rebinding | Controlled DNS/egress lab | `BLOCKED-EXTERNAL` | Requires controlled resolver/proxy; code caveat documented in `docs/audit/ssrf-security.md` |
| Outbound webhook URL policy | Jest/source | `TEST-VERIFIED` | Shared `safeOutboundFetch` policy tests and call-site review |
| n8n valid signature | Live n8n + deployment | `BLOCKED-EXTERNAL` | Requires `N8N_WEBHOOK_SECRET`, tenant API key, endpoint |
| n8n replay | Live n8n + applied replay migration | `BLOCKED-EXTERNAL` | Duplicate `x-fluxentiq-event-id` delivery |
| n8n wrong tenant/workflow | Live n8n + two tenants | `BLOCKED-EXTERNAL` | Tenant API key/resource substitution matrix |
| Python bridge valid signature | Live bridge + deployment | `BLOCKED-EXTERNAL` | Requires bridge URL, secret, tenant `bridge:write` key |
| Python bridge replay/resource mismatch | Live bridge + applied migration | `BLOCKED-EXTERNAL` | Duplicate event and foreign resource matrix |
| Replay nonce schema | Static migration | `CODE-VERIFIED` | `supabase/migrations/20260913000100_webhook_replay_nonces.sql` |
| Storage cross-tenant | Supabase Storage/deployed app | `BLOCKED-EXTERNAL` | Two-tenant upload/download/signed URL matrix |
| Storage signed URL expiry | Supabase Storage | `BLOCKED-EXTERNAL` | Generate short-lived URL and verify after expiry |
| Scheduler lock/retry | Deployed scheduler | `BLOCKED-EXTERNAL` | Requires scheduler activation and `CRON_SECRET`; do not activate in audit sandbox |
| SCIM provisioning | Identity provider/deployment | `BLOCKED-EXTERNAL` | Requires SCIM bearer/provider and two tenants |
| Data integrity/atomicity | Disposable database | `BLOCKED-EXTERNAL` | Failure injection for candidate/application, workflow/audit, deletion, payroll |
| PII leakage | Synthetic live deployment/provider | `BLOCKED-EXTERNAL` | Synthetic PII response/log/provider/audit inspection |
| Copilot regression | Jest | `TEST-VERIFIED` | Existing agent/tool/authority suites remain part of full suite; no H5 bypass added |
| Migration repeatability | Clean disposable database | `BLOCKED-EXTERNAL` | Apply 39 migrations from zero and repeat supported migration command |
| Production build/regression | Local repository | `TEST-VERIFIED` | Toolchain restored with `npm ci`; 34 Jest suites/311 tests, TypeScript, ESLint, Electron typecheck, Python compilation, production build and diff check passed |

## H5 status counts

These counts describe this H5 execution, not production behavior:

- `LIVE-VERIFIED`: **0**
- `TEST-VERIFIED`: **6** matrix domains (GraphQL gate, AI auth, SSRF policy, outbound webhook policy, Copilot regression evidence, restored local regression)
- `CODE-VERIFIED`: **2** matrix domains (service-role inventory, replay migration schema)
- `BLOCKED-EXTERNAL`: **24** matrix domains
- `FAILED`: **0** security-control failures exercised live
- `NOT-TESTED`: **0**

No result is upgraded to `LIVE-VERIFIED` without an actual external target.
