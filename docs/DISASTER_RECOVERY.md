# Disaster Recovery

**Current state:** code-side runbook; live RPO/RTO values require the selected hosting and Supabase plan.

## Targets to agree before launch

- RPO: define maximum tolerable data loss with the owner; default proposal is 24 hours until managed backup evidence is supplied.
- RTO: define maximum recovery time; default proposal is 4 hours until restore testing is completed.

## Failure scenarios

- **Database outage:** keep writes fail-closed, display dependency-unavailable status, do not fabricate records, restore service only after `/api/health/db` succeeds.
- **Bad migration:** stop deployment, inspect migration history, use a tested corrective migration or restore isolated backup, then rerun schema verification.
- **AI outage:** core HR operations continue; AI routes return controlled provider errors and remain governed by the kill switch.
- **Storage outage:** reject or quarantine uploads; do not expose local fallback in production.
- **Email/n8n outage:** preserve the primary transaction and record retryable notification/webhook intent where supported.
- **Telemetry outage:** application continues; local structured logs remain scrubbed.
- **Credential compromise:** revoke at provider, inject replacement through the secret manager, invalidate sessions/tokens where applicable, and retain audit evidence.
- **Deployment failure:** roll back the immutable application artifact and verify liveness/readiness before reopening traffic.

## Restore procedure

1. Declare the incident and freeze destructive migrations.
2. Identify the last known-good backup and its timestamp.
3. Restore into an isolated project first.
4. Run schema, constraint, RLS, Auth, and application smoke tests.
5. Compare recovery evidence with the approved RPO/RTO.
6. Promote only after security and tenant-isolation checks pass.
7. Record the restore event and update the runbook.

A controlled non-production restore test is mandatory before production certification.
