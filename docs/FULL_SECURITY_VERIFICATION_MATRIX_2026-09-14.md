# FLUXENTIQ AI — Full Security Verification Matrix

Date: 2026-09-14  
HEAD under review: `6a81c41` before Step 14 changes  
Evidence rule: source and local tests are never represented as live verification.

| Control | Static/source | Local tests | Live result | Current status |
|---|---|---|---|---|
| Canonical `public.memberships` resolver | CODE-VERIFIED | TEST-VERIFIED | No database | BLOCKED-EXTERNAL live |
| Production demo-mode boundary | CODE-VERIFIED | TEST-VERIFIED after Step 14 fix | No deployment | BLOCKED-EXTERNAL live |
| RBAC hierarchy | CODE-VERIFIED | TEST-VERIFIED | No live sessions | BLOCKED-EXTERNAL live |
| Cross-tenant RLS | CODE-VERIFIED | Harness exists | No database | BLOCKED-EXTERNAL |
| GraphQL entry gate | CODE-VERIFIED | TEST-VERIFIED | No deployed endpoint | BLOCKED-EXTERNAL |
| SSRF TypeScript policy | CODE-VERIFIED | TEST-VERIFIED | No egress lab | BLOCKED-EXTERNAL |
| Python scraper host policy | CODE-VERIFIED | Python tests/static review | No egress lab | BLOCKED-EXTERNAL |
| Webhook HMAC/timestamp | CODE-VERIFIED | TEST-VERIFIED | No endpoints | BLOCKED-EXTERNAL |
| Webhook replay nonce | CODE-VERIFIED | No live concurrency | No database | BLOCKED-EXTERNAL |
| Storage quarantine/scanning | CODE-VERIFIED | TEST-VERIFIED | No Storage project | BLOCKED-EXTERNAL |
| Scheduler atomic claim | CODE-VERIFIED | No live scheduler | No scheduler | BLOCKED-EXTERNAL |
| SCIM bearer and tenant routing | CODE-VERIFIED | Role mapping regression added | No IdP/database | BLOCKED-EXTERNAL |
| SCIM deactivation role mapping | FIXED in source | TEST-VERIFIED mapping | No database | BLOCKED-EXTERNAL live |
| AI tenant header boundary | CODE-VERIFIED | TEST-VERIFIED related controls | No provider/deployment | BLOCKED-EXTERNAL |
| Secrets | No values committed/printed | Static inspection | No production logs | BLOCKED-EXTERNAL |

No `LIVE-VERIFIED` result is claimed.
