# H5 Webhook Results

## Source/test evidence

Status: `TEST-VERIFIED` for timestamp/HMAC primitives and `CODE-VERIFIED` for route integration.

The remediation adds:

- timestamped HMAC over `timestamp.rawBody`;
- five-minute freshness window;
- event IDs;
- unique replay claims via `webhook_replay_nonces`;
- tenant-scoped API key requirements;
- workflow/resource ownership checks;
- bounded payload snapshots.

## Live evidence

Status: `BLOCKED-EXTERNAL`

No n8n, Python bridge, Supabase migration, tenant API keys, or deployed callback target was available. Valid, invalid, expired, duplicate, wrong-tenant, wrong-workflow, oversized, timeout, and provider-failure cases remain unexecuted.

Required machine credentials:

- n8n: API key with `workflows:write`;
- Python bridge: API key with `bridge:write`;
- outbound broadcast: API key with `webhooks:write`;
- configured `N8N_WEBHOOK_SECRET` / `PYTHON_BRIDGE_WEBHOOK_SECRET`;
- applied replay migration.

## Step 13 recheck — 2026-09-14

Live n8n and Python bridge status remains `BLOCKED-EXTERNAL`: no deployed endpoints, tenant credentials, secrets, or replay-capable database were available. Prior primitive and source/test evidence remains unchanged.
