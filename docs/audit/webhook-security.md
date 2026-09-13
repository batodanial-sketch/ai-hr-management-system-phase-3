# Webhook Security Evidence — 2026-09-13

## Finding disposition

n8n and Python bridge tenant-binding/replay findings were **CONFIRMED** in source. A valid global HMAC previously authenticated possession of a shared secret but did not independently bind the caller to the organization/resource. Replay was not persisted atomically.

## Remediation

Added `lib/security/webhook-replay.ts` and migration `20260913000100_webhook_replay_nonces.sql`.

The new machine webhook contract requires:

- `x-fluxentiq-event-id`;
- `x-fluxentiq-timestamp` within a five-minute clock window;
- HMAC over `timestamp.rawBody`;
- an atomic unique `(provider, event_id)` claim before mutation.

Updated `/api/webhooks/n8n-trigger`:

- requires `workflows:write` external API key whose organization matches the payload;
- verifies the workflow belongs to that organization;
- claims event id before creating the run/audit rows;
- returns a duplicate success without repeating side effects.

Updated `/api/webhooks/python-bridge` and its callback alias:

- requires `bridge:write` external API key whose organization matches the payload;
- verifies organization, workflow, workflow run, employee, candidate and application resources against that organization;
- bounds persisted payload snapshots;
- claims event id before writes;
- returns duplicate success without repeating side effects.

Updated the session/HMAC outbound broadcast route to require a tenant-scoped `webhooks:write` API key on the machine path. Session broadcasts continue to use canonical RBAC and session organization equality.

## Tests and status

`tests/unit/securityRemediation.test.ts` proves fresh timestamped HMAC acceptance, stale timestamp rejection, and wrong-secret rejection. Migration and route behavior requiring Supabase are not live tested.

Status: `TEST-VERIFIED` for signature/time primitives; `CODE-VERIFIED` for source tenant/resource checks and idempotency claim path; `BLOCKED_EXTERNAL` until the migration is applied and duplicate, wrong-tenant, expired, invalid-signature and provider callback cases run against a disposable database.

## Compatibility note

The machine webhook contract intentionally changes from raw-body HMAC/shared-secret-only to timestamped HMAC plus tenant-scoped API key. Integrations must be updated before activation; legacy headers are not accepted as a bypass.
