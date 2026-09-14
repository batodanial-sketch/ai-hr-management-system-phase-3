# FLUXENTIQ AI — Full Integration Verification Matrix

Date: 2026-09-14

| Integration | Intended path | Static result | Runtime result |
|---|---|---|---|
| Supabase Auth | Next.js server client → Auth → memberships | CODE-VERIFIED | BLOCKED-EXTERNAL: no project/session |
| PostgreSQL/RLS | 39 migrations → catalog/policies | CODE-VERIFIED | BLOCKED-EXTERNAL: no `DATABASE_URL` |
| Python bridge | Next.js proxy → shared bridge secret → FastAPI | CODE-VERIFIED | BLOCKED-EXTERNAL: no deployed bridge |
| LLM providers | bridge provider abstraction | CODE-VERIFIED | BLOCKED-EXTERNAL: no controlled provider |
| n8n | HMAC + API key + workflow ownership | CODE-VERIFIED | BLOCKED-EXTERNAL: no n8n endpoint |
| Python callbacks | HMAC + API key + resource ownership | CODE-VERIFIED | BLOCKED-EXTERNAL: no bridge deployment |
| Storage | quarantine → scan → clean → signed URL | CODE-VERIFIED | BLOCKED-EXTERNAL: no Storage project |
| Scheduler | cron secret → atomic scheduled job claim | CODE-VERIFIED | BLOCKED-EXTERNAL: no scheduler |
| SCIM | bearer → tenant resolution → canonical membership | CODE-VERIFIED | BLOCKED-EXTERNAL: no test IdP/database |
| GraphQL | auth/RBAC gate → Yoga/schema | TEST-VERIFIED locally | BLOCKED-EXTERNAL deployed |
| Electron | preload/API integration | CODE-VERIFIED | TEST-VERIFIED typecheck; no packaged runtime test |
| Observability | metrics/error tracking/AI telemetry | CODE-VERIFIED | BLOCKED-EXTERNAL live telemetry |

The matrix deliberately distinguishes internal wiring from external execution.
