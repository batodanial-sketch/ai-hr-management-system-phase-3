# External Service Setup

All secrets must be injected through the deployment secret manager, CI secrets, Docker environment, or a local ignored `.env.local`. Never paste credentials into source control or chat.

## Supabase/PostgreSQL/Auth/RLS

Create a Supabase project, enable the required Auth providers, record the project URL, publishable key, and server Secret key, then set:

```text
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
SUPABASE_SECRET_KEY
SUPABASE_PROJECT_REF
```

Run `bash scripts/apply-migrations.sh`, then `npm run verify:supabase`. Create isolated test identities and retain the authenticated RLS evidence. Never put `SUPABASE_SECRET_KEY` or the legacy service-role key in a `NEXT_PUBLIC_*` variable.

## AI and embeddings

Choose the configured bridge provider and model. Set `LLM_PROVIDER`, `LLM_API_KEY`, `LLM_MODEL` as applicable, plus `BRIDGE_SECRET_KEY`, `AI_KILL_SWITCH=0`, and a deliberate `PILOT_ORG_ALLOWLIST`. Run the live provider and Copilot checks only with non-production test data.

## Storage and malware scanning

Create a private bucket, set `STORAGE_PROVIDER=supabase`, `STORAGE_BUCKET`, and configure a scanner with `MALWARE_SCANNER`, `MALWARE_SCANNER_URL`, and its token. Uploads remain fail-closed until the scanner returns an explicit clean verdict.

## Email

Configure the provider abstraction with `EMAIL_PROVIDER=http` and `EMAIL_HTTP_URL`, or the deployment's supported relay. A successful HTTP response is not delivery proof; capture a provider delivery receipt for certification.

## Scheduler

Set `CRON_SECRET` in the application and configure the deployment scheduler to call `/api/system/cron` with `x-cron-secret`. Verify a test job's mutation, audit record, retry, and duplicate protection.

## n8n

Set `N8N_WEBHOOK_URL` and `N8N_WEBHOOK_SECRET`. Use timestamped HMAC headers and event IDs. Verify the complete Fluxentiq → n8n → callback flow and duplicate handling.

## SCIM

Set a tenant-scoped `SCIM_TOKEN_<TENANT_ID>` or controlled `SCIM_BEARER_TOKEN`. Configure the IdP to use `/api/scim/v2/<tenant-id>/Users` and `/Groups`. Test provisioning, patch, disable, delete, and tenant isolation.

## Deployment and telemetry

Set `PRODUCTION_URL` (or the deployment-native URL), `APP_ENV=production`, `APP_BUILD_ID`, and the production-only secrets. Configure `ERROR_TRACKING_DSN` or `OTEL_EXPORTER_OTLP_ENDPOINT`; verify that a synthetic event arrives with redacted data.

## Rotation

Rotate each credential at its provider first, update the secret manager atomically, deploy, run the relevant verifier, and revoke the old credential. No normal credential rotation should require a source change.
