# Deployment Runbook

## Pre-deploy

1. Inject production secrets through the target secret manager.
2. Set `APP_ENV=production`, `APP_BUILD_ID`, and a production URL.
3. Run `npm ci --ignore-scripts`, `npm run typecheck`, `npm run lint`, `npm test -- --runInBand`, and `npm run build`.
4. Run migration review using expand/contract changes; never run destructive resets against production.
5. Run `npm run verify:environment` and confirm no required group is missing.

## Deploy

Use the target's immutable build artifact. Keep server-only keys out of browser variables and bundles. Start the Next.js standalone server with the injected environment. Configure the Python bridge separately with its shared secret and allowed scrape hosts.

## Smoke test

- `GET /api/health` verifies process liveness.
- `GET /api/health/readiness` reports safe infrastructure inventory.
- `GET /api/health/db` verifies the database dependency.
- Execute authenticated login, tenant access, one read-only HR request, AI status, Storage authorization, webhook authentication, and cron authentication checks.

## Rollback

Roll back the immutable application artifact first. For database changes, use the documented expand/contract rollback or a forward corrective migration. Do not restore a database snapshot over production without an approved recovery window.

## Scheduler and webhooks

Configure the scheduler with `x-cron-secret`, set deployment timeouts above the job timeout, and monitor failed job rows. Configure webhook URLs only over HTTPS; rotate HMAC secrets independently.

## Post-deploy evidence

Retain deployment ID, build ID, migration output, smoke-test output, infrastructure artifacts, and telemetry event ID. A successful build alone is not production verification.
