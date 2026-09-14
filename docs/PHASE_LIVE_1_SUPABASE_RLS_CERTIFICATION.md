# FLUXENTIQ AI — PHASE LIVE-1 SUPABASE/RLS CERTIFICATION

**Date:** 2026-09-14  
**Branch:** `arena/01a07c94-ai-hr-management-system`  
**HEAD:** `6ee4ca7d866e71a2bb3098ab8b702c334c7b3793`  
**Environment classification:** local repository execution; no approved external Supabase environment configured.  
**Decision:** **BLOCKED-EXTERNAL**

## Executive result

A live activation attempt was made on 2026-09-14. The secure execution environment still reports all required Supabase and database credentials as missing. `npm run verify:environment` exited non-zero and `npm run verify:supabase` returned `BLOCKED-EXTERNAL`. `npm run db:verify` was not run after the missing-credential gate because it is the same verifier and cannot reach a target database without credentials.

LIVE-1 could not perform real Supabase activation or authenticated two-tenant RLS certification. No Tenant A/Tenant B live identities were created, and no live PASS evidence was generated.

## Sanitized certification matrix

| Gate | Status | Evidence / blocker |
|---|---|---|
| Supabase project connection | BLOCKED-EXTERNAL | `NEXT_PUBLIC_SUPABASE_URL` and server key are missing |
| Migration application | BLOCKED-EXTERNAL | No approved target database; destructive reset was not attempted |
| Migration history | BLOCKED-EXTERNAL | No `DATABASE_URL`/`POSTGRES_URL` |
| Schema | BLOCKED-EXTERNAL | No live database connection |
| Functions and grants | BLOCKED-EXTERNAL | Actual production grants cannot be inspected without PostgreSQL access |
| Auth | BLOCKED-EXTERNAL | No Supabase Auth project or live credentials |
| Tenant A | BLOCKED-EXTERNAL | No live tenant/user created |
| Tenant B | BLOCKED-EXTERNAL | No live tenant/user created |
| RLS | BLOCKED-EXTERNAL | Requires real authenticated sessions and direct database evidence |
| Two-tenant isolation | BLOCKED-EXTERNAL | No live sessions or tenant records |
| RPC security | BLOCKED-EXTERNAL | Actual database execute grants not inspected |
| Knowledge isolation | BLOCKED-EXTERNAL | No live knowledge records/search function execution |
| Copilot isolation | BLOCKED-EXTERNAL | No live authenticated Copilot session/provider |
| Storage isolation | BLOCKED-EXTERNAL | No Supabase Storage project/bucket |
| Audit | BLOCKED-EXTERNAL | No live tenant actions to inspect |

## Code-side preparation completed

- Node runtime target standardized to Node.js 22 in `.nvmrc`, CI, Docker runtime/build images, package engines, and lockfile root metadata.
- Privileged SCIM and legacy candidate `SECURITY DEFINER` functions are restricted to `service_role` by migration `20260914000100_security_definer_execution_hardening.sql`.
- AI usage logs are included in the incremental migration chain by `20260914000200_ai_usage_logs.sql`.
- Supabase verification now optionally performs direct PostgreSQL inspection when `DATABASE_URL` or `POSTGRES_URL` is available, including tables, migration history, policies, functions, and indexes.
- SCIM tenant lookup uses validated equality queries rather than interpolated PostgREST filter expressions.
- Production Storage, email, and scheduler paths fail closed when their dependencies are unavailable.

## Local validation

| Check | Result |
|---|---|
| `npm ci --ignore-scripts` | PASS; local runtime is Node 20 and reports expected Node 22 engine warnings |
| TypeScript | PASS |
| ESLint | PASS |
| Jest | PASS — 38 suites / 329 tests |
| Production build | PASS |
| Security scan | PASS |
| Authorization duplicate check | PASS — 21/21 |
| Python compilation | PASS |
| `npm audit --omit=dev` | PASS — 0 vulnerabilities |
| Shell syntax checks | PASS |
| `git diff --check` | PASS |

## Migration safety

The migration chain was statically inspected. No production reset, drop, truncate, or destructive recreation was executed. The new migrations are ordered after the existing migration chain and use idempotent table/index/policy patterns where appropriate.

Actual migration application remains unverified until an approved target database is supplied.

## Required operator actions

1. Inject, through a secure secret manager:
   ```text
   NEXT_PUBLIC_SUPABASE_URL
   NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
   SUPABASE_SECRET_KEY
   SUPABASE_PROJECT_REF
   DATABASE_URL or POSTGRES_URL
   APP_ENV
   APP_BUILD_ID
   ```
2. Confirm the target is a disposable/non-production certification project or an approved production-safe test boundary.
3. Confirm managed backup/PITR availability before creating live test records.
4. Run without database reset:
   ```bash
   npm run verify:environment
   npm run verify:supabase
   npm run db:verify
   ```
5. Apply migrations incrementally with the approved migration process.
6. Inspect actual PostgreSQL function owners, `search_path`, RLS policies, and EXECUTE grants.
7. Create sanitized Tenant A/Tenant B test identities and execute the two-tenant attack matrix.
8. Produce a new live artifact only from real authenticated evidence.

## Production certification

```text
PRODUCTION CERTIFICATION: NOT PRODUCTION READY
```

LIVE-1 is not PASS. The correct current state is `BLOCKED-EXTERNAL`.

The canonical machine-readable artifact is:

```text
artifacts/phase-live-1-supabase-rlls-certification.json
```

The filename follows the requested `rlls` spelling; no duplicate alternate artifact was generated.
