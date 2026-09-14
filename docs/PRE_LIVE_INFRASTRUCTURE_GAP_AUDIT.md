# Pre-Live Infrastructure Gap Audit

**Date:** 2026-09-14  
**Branch:** `arena/01a07c94-ai-hr-management-system`  
**Local verdict:** **PRE-LIVE READY — EXTERNAL ACTIVATION REQUIRED**  
**Production verdict:** **NOT PRODUCTION READY**

## Scope

This audit traced the actual Supabase, Auth/RLS, AI bridge, Storage, email, scheduler, webhook/n8n, SCIM, telemetry, deployment, and recovery paths. It did not call external services because no real credentials or endpoints are configured.

## Code-side defects found and fixed

1. **Production email could silently treat console logging as delivery.** Production console mode now fails closed. SMTP mode also fails when its relay is absent instead of falling back to console.
2. **Production Storage could silently select the local filesystem provider.** Production now requires Supabase Storage and fails closed when it is not configured.
3. **Production scheduler enqueue could silently drop jobs when Supabase was absent.** Production now raises a dependency error; the development no-op is explicitly labeled and confined to non-production.
4. **Privileged `SECURITY DEFINER` provisioning and legacy candidate RPCs inherited PostgreSQL's default public execute grant.** A forward migration revokes public/anonymous/authenticated execution and grants service-role execution only.
5. **The readiness alias returned a configuration inventory with HTTP 200 even when critical dependencies were absent.** It now delegates to the dependency readiness route and returns failure semantics when required dependencies are unavailable.
6. **The authorization duplicate-check tool reported two audited false positives.** Its allowlist now explicitly records the service-role membership existence oracle and least-privilege SCIM role normalization.
7. **The environment contract omitted several runtime/operator variables.** `.env.example` now documents project reference, direct DB verification URLs, email, SCIM, n8n, and public application URL variables.

## Local evidence

| Check | Result |
|---|---|
| TypeScript | PASS |
| ESLint | PASS |
| Jest | PASS — 38 suites / 329 tests |
| Production build | PASS |
| Security scan | PASS |
| Authorization duplicate check | PASS |
| Python compilation | PASS |
| Production dependency audit | PASS — no vulnerabilities reported |
| Git diff check | PASS |

## External blockers

The following remain `BLOCKED-EXTERNAL` and were not simulated:

- Supabase/PostgreSQL and migration history
- Real Supabase Auth sessions
- Authenticated two-tenant RLS certification
- AI provider requests and provider failure behavior
- Embedding generation and retrieval
- Private Storage bucket and scanner
- Email provider delivery receipt
- Scheduler execution in the deployment environment
- n8n execution/callback
- Enterprise SCIM IdP
- Production deployment smoke test
- Telemetry event arrival
- Managed backup/PITR and isolated restore

## RLS readiness

Static migration review found explicit `search_path` settings on reviewed `SECURITY DEFINER` functions. A forward migration now restricts privileged SCIM and legacy candidate mutation RPC execution to `service_role`. Real authenticated-user RLS evidence remains required before certification.

## Backup/recovery readiness

The runbooks are complete for operator activation, but RPO/RTO remain unmeasured. Managed backup configuration, PITR retention, storage retention/versioning, and isolated restore evidence require the real provider environment.

## Next activation sequence

1. Inject Supabase project URL, publishable key, server Secret key, and project reference.
2. Apply migrations without destructive production reset.
3. Run `npm run verify:supabase` and `npm run db:verify`.
4. Create isolated Organization A/B test users and execute live RLS/Auth tests.
5. Activate AI, Storage/scanner, email, scheduler, deployment, telemetry, n8n/SCIM as applicable.
6. Run `npm run verify:production` and retain live artifacts.
7. Perform isolated backup restore and re-run schema, Auth, RLS, Storage, and smoke tests.

Machine-readable evidence is stored in:

```text
artifacts/pre-live-infrastructure-gap-audit.json
```
