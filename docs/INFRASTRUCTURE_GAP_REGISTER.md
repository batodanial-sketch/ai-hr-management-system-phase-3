# Infrastructure Gap Register

**Date:** 2026-09-14  
**Verdict:** `NOT PRODUCTION READY` until critical services have live evidence.

| Service | Code Ready | Config Ready | Health Check | Live Test | Security Test | Failure Handling | Remaining Work |
|---|---:|---:|---:|---:|---:|---:|---|
| Supabase | PASS | PARTIAL | PASS | BLOCKED-EXTERNAL | PASS locally | PASS | Supply project credentials, apply migrations, inspect live schema |
| Auth | PASS | PARTIAL | PASS | BLOCKED-EXTERNAL | PASS locally | PASS | Test real sign-up/sign-in/session refresh |
| RLS | PASS | PARTIAL | PASS | BLOCKED-EXTERNAL | PASS locally/static | PASS | Run two-tenant authenticated SELECT/INSERT/UPDATE/DELETE suite |
| AI | PASS | PARTIAL | PARTIAL | BLOCKED-EXTERNAL | PASS locally | PASS | Provider credential, live completion, structured output and failure tests |
| Embeddings | PASS | PARTIAL | PARTIAL | BLOCKED-EXTERNAL | PASS locally | PASS | Verify dimensions, ingestion, retrieval and tenant isolation |
| Storage | PASS | PARTIAL | PASS | BLOCKED-EXTERNAL | PASS locally | PASS | Create private bucket, scanner, signed URL and cross-tenant tests |
| Email | PASS | PARTIAL | PARTIAL | BLOCKED-EXTERNAL | PASS locally | DEGRADED | Configure real relay/provider and observe delivery |
| Scheduler | PASS | PARTIAL | PASS | BLOCKED-EXTERNAL | PASS locally | PASS | Invoke deployed scheduler and verify idempotent mutation |
| n8n | PASS | PARTIAL | PARTIAL | BLOCKED-EXTERNAL | PASS locally | PASS | Execute signed workflow/callback with replay test |
| SCIM | PASS | PARTIAL | PARTIAL | BLOCKED-EXTERNAL | PASS locally | PASS | Run protocol suite and enterprise IdP test |
| Deployment | PASS | NO | PASS | BLOCKED-EXTERNAL | PASS locally | PASS | Deploy and execute production smoke tests |
| Telemetry | PASS | PARTIAL | PASS | BLOCKED-EXTERNAL | PASS locally | DEGRADED | Configure sink and observe redacted event |
| Backups | PARTIAL | NO | PARTIAL | BLOCKED-EXTERNAL | NOT RUN | DOCUMENTED | Verify retention and restore in isolated environment |

The control-plane registry is in `lib/infrastructure/`. The canonical machine-readable runner is `npm run verify:infrastructure`.
