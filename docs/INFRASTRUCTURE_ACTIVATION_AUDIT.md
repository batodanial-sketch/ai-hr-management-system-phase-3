# FLUXENTIQ AI — Infrastructure Activation Audit

**Date:** 2026-09-14  
**Execution mode:** local repository inspection; no external credentials were available.  
**Rule:** configuration is not treated as verification. No service is marked `VERIFIED` without executable live evidence.

## Status model

`NOT_IMPLEMENTED` · `IMPLEMENTED_UNCONFIGURED` · `CONFIGURED` · `REACHABILITY_FAILED` · `AUTHENTICATION_FAILED` · `FUNCTIONAL` · `VERIFIED` · `DEGRADED` · `BLOCKED-EXTERNAL`

## Matrix

| Service | Current implementation | Required credentials | Configured? | Reachable? | Authenticated? | Functional? | Tested? | Remaining blocker |
|---|---|---|---:|---:|---:|---:|---:|---|
| Supabase/PostgreSQL | Canonical `@supabase/ssr` and admin clients; 39 migrations; `/api/health/db`; live verifier added | `NEXT_PUBLIC_SUPABASE_URL`, publishable key, server secret key | NO | NO | NO | NO | LOCAL ONLY | Live project access and migration execution |
| Supabase Auth | Canonical cookie/session auth, login/signup/callback routes, middleware | Supabase URL + publishable key + Auth project settings | NO | NO | NO | NO | LOCAL ONLY | Controlled real-user auth flows |
| PostgreSQL RLS / tenant isolation | Migration policies, canonical membership authorization, RLS catalog verifier | Live Supabase project and two tenant identities | NO | NO | NO | NO | LOCAL ONLY | Direct live SELECT/INSERT/UPDATE/DELETE certification |
| AI providers | Python bridge provider abstraction for Groq/OpenAI-compatible and Anthropic paths; Copilot proxy | Provider key, model, bridge secret | NO | NO | NO | NO | MOCKED/LOCAL ONLY | Real provider request and failure-mode tests |
| Embeddings / knowledge | Knowledge store and semantic-search routes; provider bridge | Embedding-capable provider credential | NO | NO | NO | NO | LOCAL ONLY | Live ingestion, embedding, ranking, tenant-isolation run |
| Supabase Storage | Private storage provider, tenant-prefixed keys, signed URLs, scanner gate | Supabase URL + server secret + private bucket + scanner | NO | NO | NO | NO | LOCAL ONLY | Bucket creation, upload/download and cross-tenant live test |
| Scheduler/background jobs | Fail-closed cron routes, due-job runner, idempotency controls | `CRON_SECRET` and deployment scheduler | NO | NO | NO | NO | LOCAL ONLY | Real scheduler trigger and mutation evidence |
| SCIM | SCIM 2.0 Users/Groups routes, bearer authentication, audit path | Tenant SCIM bearer token + enterprise IdP | NO | NO | NO | NO | LOCAL ONLY | Live IdP provisioning/deprovisioning |
| n8n | Signed inbound/outbound webhook boundaries, replay protection, retries | n8n URL and HMAC secret | NO | NO | NO | NO | LOCAL ONLY | Real workflow execution and callback |
| Email/notifications | Notification and email adapter boundaries | Resend/SMTP credentials and verified sender | NO | NO | NO | NO | LOCAL ONLY | Actual delivery receipt |
| Deployment | Docker/Next deployment configuration, readiness endpoint | Production target URL and deployment credentials | NO | NO | NO | NO | LOCAL BUILD ONLY | Real deployment and smoke test |
| Telemetry | Metrics registry, OTLP/Sentry-compatible error adapter, redaction | OTLP endpoint or error-tracking DSN | NO | NO | NO | NO | LOCAL ONLY | Observed live error/metric event |
| Backup/recovery | Operational documentation and migration tooling | Provider backup access and non-production restore target | NO | NO | NO | NO | NOT RUN | Controlled restore test |

## Local changes completed in this activation pass

- Added a fail-closed Supabase verifier at `scripts/verify-supabase.mjs` with the requested TypeScript contract at `scripts/verify-supabase.ts`.
- Added `npm run verify:supabase` and the master `npm run verify:infrastructure` command.
- Added machine-readable and human-readable evidence output under `artifacts/`.
- Preserved the existing external-blocker classification rather than fabricating live results.

## Exact activation checklist

1. Populate server-side deployment secrets through the deployment secret manager; do not commit `.env.local`.
2. Link the Supabase project and run `bash scripts/apply-migrations.sh` from a trusted operator environment.
3. Run `npm run verify:supabase`; resolve every table/function/index/policy failure.
4. Create controlled Organization A/B identities and execute the live RLS suite.
5. Configure the provider, Storage private bucket, malware scanner, transactional email, scheduler, SCIM IdP, n8n workflow, deployment URL, telemetry sink, and backup policy.
6. Run the corresponding live verification commands and retain their artifacts.
7. Only then update the certification report from `BLOCKED-EXTERNAL` to a service-specific live status.
