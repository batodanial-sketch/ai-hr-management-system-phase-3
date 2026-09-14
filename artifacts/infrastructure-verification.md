# Infrastructure Verification

Generated: 2026-09-14T15:24:27.642Z

| Infrastructure | Implemented | Configured | Reachable | Functional | Live Verified | Status |
|---|---:|---:|---:|---:|---:|---|
| Supabase DB | YES | NO | NO | NO | NO | BLOCKED-EXTERNAL |
| Supabase Auth | YES | NO | NO | NO | NO | BLOCKED-EXTERNAL |
| PostgreSQL RLS | YES | NO | NO | NO | NO | BLOCKED-EXTERNAL |
| AI provider | YES | NO | NO | NO | NO | BLOCKED-EXTERNAL |
| Embeddings | YES | NO | NO | NO | NO | BLOCKED-EXTERNAL |
| Supabase Storage | YES | NO | NO | NO | NO | BLOCKED-EXTERNAL |
| Scheduler | YES | NO | NO | NO | NO | BLOCKED-EXTERNAL |
| SCIM | YES | NO | NO | NO | NO | BLOCKED-EXTERNAL |
| n8n | YES | NO | NO | NO | NO | BLOCKED-EXTERNAL |
| Email | YES | NO | NO | NO | NO | BLOCKED-EXTERNAL |
| Deployment | YES | NO | NO | NO | NO | BLOCKED-EXTERNAL |
| Telemetry | YES | NO | NO | NO | NO | BLOCKED-EXTERNAL |
| Backups | NO | NO | NO | NO | NO | BLOCKED-EXTERNAL |

## Evidence
- **Supabase DB:** No Supabase credentials are present in the execution environment.
- **Supabase Auth:** Real sign-up, sign-in, refresh, and invalid-session flows require a configured Supabase project.
- **PostgreSQL RLS:** RLS cannot be certified without two live authenticated tenant identities and direct database evidence.
- **AI provider:** No provider credential is present; mocked Copilot tests are not live provider evidence.
- **Embeddings:** No embedding provider credential or live knowledge-ingestion run is available.
- **Supabase Storage:** Private-bucket upload/download/cross-tenant verification requires a live Supabase project.
- **Scheduler:** Cron code is fail-closed, but no real scheduler invocation and mutation evidence is available.
- **SCIM:** SCIM endpoints exist, but no configured enterprise IdP or live provisioning test is available.
- **n8n:** No n8n endpoint/secret is present and no workflow callback has been observed.
- **Email:** No transactional email credentials or real delivery evidence is available.
- **Deployment:** No deployment target URL is present; local build is not deployment verification.
- **Telemetry:** No telemetry endpoint/DSN is present and no live event has been observed.
- **Backups:** Managed backup configuration and a controlled restore test require access to the production project.
