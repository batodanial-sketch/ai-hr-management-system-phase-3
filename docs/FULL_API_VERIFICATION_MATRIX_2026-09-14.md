# FLUXENTIQ AI — FULL API VERIFICATION MATRIX

Generated 2026-09-14. Static source inventory only; live behavior is never inferred.

| Route | Methods | Auth signals | Tenant signals | Validation | DB | External | Evidence |
|---|---|---|---|---|---|---|---|
| `/api/account/delete` | POST | adminClient | memberships | yes | yes | no | CODE-VERIFIED |
| `/api/ai/admin-copilot` | POST | requireRole | organizationId, X-Organization-Id | yes | yes | yes | CODE-VERIFIED |
| `/api/ai/copilot` | POST | getRbacContext | organizationId, organization_id, X-Organization-Id | yes | no | yes | CODE-VERIFIED |
| `/api/ai/engine/[...path]` | POST, GET | none observed | none observed | not observed | no | no | CODE-VERIFIED |
| `/api/ai/evaluate-candidate` | POST | none observed | none observed | not observed | no | no | CODE-VERIFIED |
| `/api/ai/evaluate-pto` | POST | none observed | none observed | not observed | no | no | CODE-VERIFIED |
| `/api/ai/insights` | POST | none observed | none observed | not observed | no | no | CODE-VERIFIED |
| `/api/ai/interview-report` | POST | none observed | none observed | not observed | no | no | CODE-VERIFIED |
| `/api/ai/jobs/[jobId]` | GET | none observed | none observed | not observed | no | yes | CODE-VERIFIED |
| `/api/ai/match-candidate` | POST | none observed | none observed | yes | no | no | CODE-VERIFIED |
| `/api/ai/parse-resume` | POST | none observed | none observed | not observed | no | no | CODE-VERIFIED |
| `/api/ai/rank-candidates` | POST | none observed | none observed | not observed | no | no | CODE-VERIFIED |
| `/api/ai/semantic-search` | POST | none observed | none observed | yes | no | no | CODE-VERIFIED |
| `/api/ai/status` | GET | getRbacContext | organizationId | not observed | no | yes | CODE-VERIFIED |
| `/api/ai/test` | POST | none observed | none observed | not observed | no | no | CODE-VERIFIED |
| `/api/ai/test-connection` | POST | getRbacContext | none observed | yes | no | yes | CODE-VERIFIED |
| `/api/assets/assign` | POST, PATCH | none observed | none observed | yes | no | no | CODE-VERIFIED |
| `/api/assets` | GET, POST | none observed | none observed | yes | no | no | CODE-VERIFIED |
| `/api/attendance/check-in` | POST | none observed | none observed | yes | no | no | CODE-VERIFIED |
| `/api/attendance/check-out` | POST | none observed | none observed | yes | no | no | CODE-VERIFIED |
| `/api/auth/login` | POST | none observed | none observed | yes | yes | no | CODE-VERIFIED |
| `/api/auth/signup` | POST | adminClient | none observed | yes | yes | no | CODE-VERIFIED |
| `/api/auth/sso/callback` | GET | none observed | none observed | yes | no | no | CODE-VERIFIED |
| `/api/auth/sso/initiate` | POST | none observed | none observed | yes | no | no | CODE-VERIFIED |
| `/api/benefits/enroll` | POST | none observed | none observed | yes | no | no | CODE-VERIFIED |
| `/api/benefits` | GET, POST | none observed | none observed | yes | no | no | CODE-VERIFIED |
| `/api/candidates` | GET | none observed | none observed | yes | no | no | CODE-VERIFIED |
| `/api/contractors/invoices` | POST | none observed | organizationId, organization_id | yes | yes | no | CODE-VERIFIED |
| `/api/contractors` | GET, POST | none observed | none observed | yes | no | no | CODE-VERIFIED |
| `/api/cron/daily-workflows` | GET, POST | CRON_SECRET, adminClient | organizationId, organization_id | not observed | yes | no | CODE-VERIFIED |
| `/api/desktop/auth-sync` | POST | none observed | none observed | yes | yes | no | CODE-VERIFIED |
| `/api/documents/[id]/content` | GET | getRbacContext | organizationId | not observed | no | no | CODE-VERIFIED |
| `/api/documents/[id]/download` | GET | getRbacContext | none observed | not observed | no | no | CODE-VERIFIED |
| `/api/documents/[id]/file` | DELETE | getRbacContext | none observed | not observed | no | no | CODE-VERIFIED |
| `/api/documents` | GET, POST | none observed | none observed | yes | no | no | CODE-VERIFIED |
| `/api/documents/upload` | POST | getRbacContext | organizationId | yes | no | no | CODE-VERIFIED |
| `/api/employees/[id]` | PATCH | none observed | none observed | yes | no | no | CODE-VERIFIED |
| `/api/employees` | GET, POST | none observed | none observed | yes | no | no | CODE-VERIFIED |
| `/api/equity/grants` | POST | none observed | none observed | yes | no | no | CODE-VERIFIED |
| `/api/equity` | GET, POST | none observed | none observed | yes | no | no | CODE-VERIFIED |
| `/api/expenses/receipt-scan` | POST | none observed | none observed | not observed | no | no | CODE-VERIFIED |
| `/api/expenses` | GET, POST | none observed | organizationId | yes | no | no | CODE-VERIFIED |
| `/api/expenses/submit` | POST | none observed | none observed | yes | no | no | CODE-VERIFIED |
| `/api/graphql` | GET, POST | none observed | none observed | not observed | no | no | CODE-VERIFIED |
| `/api/health` | GET | none observed | none observed | not observed | no | no | CODE-VERIFIED |
| `/api/intelligence/alerts` | GET | none observed | none observed | not observed | no | no | CODE-VERIFIED |
| `/api/intelligence/briefing` | GET | none observed | none observed | not observed | no | no | CODE-VERIFIED |
| `/api/intelligence/insights` | GET | none observed | none observed | not observed | no | no | CODE-VERIFIED |
| `/api/knowledge` | POST, DELETE | none observed | organizationId | yes | no | no | CODE-VERIFIED |
| `/api/knowledge/search` | GET | none observed | organizationId | yes | no | no | CODE-VERIFIED |
| `/api/leave/request` | POST, PATCH | none observed | none observed | yes | no | no | CODE-VERIFIED |
| `/api/license/activate` | POST | none observed | none observed | yes | no | no | CODE-VERIFIED |
| `/api/license/status` | GET | none observed | none observed | not observed | no | no | CODE-VERIFIED |
| `/api/license/sync` | POST | none observed | none observed | not observed | no | no | CODE-VERIFIED |
| `/api/license/trial` | POST | none observed | none observed | not observed | yes | no | CODE-VERIFIED |
| `/api/lms/certifications` | GET | none observed | none observed | not observed | no | no | CODE-VERIFIED |
| `/api/lms/courses` | GET, POST | none observed | none observed | yes | no | no | CODE-VERIFIED |
| `/api/metrics` | GET | none observed | none observed | not observed | yes | no | CODE-VERIFIED |
| `/api/notifications` | GET, POST | none observed | none observed | not observed | no | no | CODE-VERIFIED |
| `/api/notifications/stream` | GET | none observed | none observed | not observed | no | no | CODE-VERIFIED |
| `/api/offboarding` | GET, POST, PATCH | none observed | organizationId | yes | no | no | CODE-VERIFIED |
| `/api/onboarding/tasks` | GET, PATCH | none observed | none observed | yes | no | no | CODE-VERIFIED |
| `/api/payroll/calculate` | POST, PATCH | none observed | none observed | yes | no | no | CODE-VERIFIED |
| `/api/payroll/global-run` | POST | none observed | none observed | yes | no | no | CODE-VERIFIED |
| `/api/payroll/tax-forms` | POST | none observed | none observed | not observed | no | no | CODE-VERIFIED |
| `/api/performance/ai-summarize` | POST | none observed | none observed | yes | no | no | CODE-VERIFIED |
| `/api/performance/cycles` | GET, POST, PATCH | none observed | none observed | yes | no | no | CODE-VERIFIED |
| `/api/performance/reviews` | GET, POST | none observed | none observed | yes | no | no | CODE-VERIFIED |
| `/api/planning` | GET, POST | none observed | none observed | yes | no | no | CODE-VERIFIED |
| `/api/predictive/forecast` | POST | none observed | none observed | not observed | no | no | CODE-VERIFIED |
| `/api/recruitment/ai-screen` | POST | none observed | none observed | yes | no | no | CODE-VERIFIED |
| `/api/recruitment/match` | POST | none observed | organizationId | yes | no | no | CODE-VERIFIED |
| `/api/recruitment/update-stage` | PATCH | none observed | none observed | yes | no | no | CODE-VERIFIED |
| `/api/reports` | GET | none observed | none observed | not observed | no | no | CODE-VERIFIED |
| `/api/scim/v2/[tenantId]/[...segments]` | GET, POST, PATCH, DELETE | verifyScimBearer | tenantId, memberships | yes | no | no | CODE-VERIFIED |
| `/api/screening` | GET, POST | none observed | organizationId | yes | no | no | CODE-VERIFIED |
| `/api/search` | GET | getRbacContext | none observed | yes | no | no | CODE-VERIFIED |
| `/api/settings/ai-budget` | GET, PATCH | getRbacContext | organizationId | yes | no | no | CODE-VERIFIED |
| `/api/settings/memory/test` | POST | none observed | none observed | yes | yes | no | CODE-VERIFIED |
| `/api/settings` | GET, PUT | none observed | none observed | yes | no | no | CODE-VERIFIED |
| `/api/surveys/ai-analysis` | POST | none observed | none observed | not observed | no | no | CODE-VERIFIED |
| `/api/surveys` | GET, POST | none observed | none observed | yes | no | no | CODE-VERIFIED |
| `/api/surveys/submit` | POST | none observed | none observed | yes | no | no | CODE-VERIFIED |
| `/api/system/cron` | GET | CRON_SECRET | none observed | not observed | yes | no | CODE-VERIFIED |
| `/api/system/error-test` | POST | requireRole | organizationId | not observed | no | no | CODE-VERIFIED |
| `/api/system/health` | GET | none observed | none observed | not observed | no | no | CODE-VERIFIED |
| `/api/system/ready` | GET | adminClient | none observed | not observed | yes | yes | CODE-VERIFIED |
| `/api/team/capacity` | GET | none observed | none observed | not observed | no | no | CODE-VERIFIED |
| `/api/tenant/settings` | PATCH | none observed | none observed | yes | no | no | CODE-VERIFIED |
| `/api/webhooks/[id]` | DELETE | none observed | none observed | not observed | no | no | CODE-VERIFIED |
| `/api/webhooks/external/inbound-lead` | POST | resolveExternalApiKey | organization_id | yes | yes | no | CODE-VERIFIED |
| `/api/webhooks/external/outbound-trigger` | POST | none observed | organizationId, organization_id | yes | yes | yes | CODE-VERIFIED |
| `/api/webhooks/inbound/[provider]` | GET, POST | adminClient | organizationId, organization_id | yes | yes | no | CODE-VERIFIED |
| `/api/webhooks/n8n-trigger` | POST | verifyTimestampedHmac, resolveExternalApiKey | organizationId, organization_id | yes | yes | no | CODE-VERIFIED |
| `/api/webhooks/outbound` | POST | getRbacContext, resolveExternalApiKey | organizationId, organization_id | yes | no | no | CODE-VERIFIED |
| `/api/webhooks/python-bridge` | POST | verifyTimestampedHmac, resolveExternalApiKey | organizationId, organization_id | yes | yes | no | CODE-VERIFIED |
| `/api/webhooks/python-callback` | none | none observed | none observed | not observed | no | no | CODE-VERIFIED |
| `/api/webhooks` | GET, POST | none observed | none observed | yes | no | no | CODE-VERIFIED |
| `/api/webhooks/slack/events` | POST | none observed | none observed | not observed | yes | no | CODE-VERIFIED |
| `/api/workflows/[id]` | GET, PATCH, DELETE | requireRole | organizationId | yes | yes | no | CODE-VERIFIED |
| `/api/workflows/[id]/run` | POST | none observed | organizationId | yes | no | no | CODE-VERIFIED |
| `/api/workflows/[id]/versions` | POST | requireRole | organizationId | yes | yes | no | CODE-VERIFIED |
| `/api/workflows/approvals/[id]/approve` | POST | none observed | organizationId | not observed | no | no | CODE-VERIFIED |
| `/api/workflows/approvals/[id]/deny` | POST | none observed | organizationId | not observed | no | no | CODE-VERIFIED |
| `/api/workflows/approvals` | GET | requireRole | organizationId | yes | yes | no | CODE-VERIFIED |
| `/api/workflows` | GET, POST | requireRole | organizationId | yes | yes | no | CODE-VERIFIED |
| `/api/workflows/runs/[runId]/cancel` | POST | none observed | organizationId | not observed | no | no | CODE-VERIFIED |
| `/api/workflows/runs/[runId]/retry` | POST | none observed | organizationId | not observed | no | no | CODE-VERIFIED |
| `/api/workflows/runs/[runId]` | GET | none observed | organizationId | not observed | yes | no | CODE-VERIFIED |
| `/api/workflows/runs` | GET | none observed | organizationId | yes | yes | no | CODE-VERIFIED |
| `/api/workflows/trigger` | POST | none observed | none observed | not observed | no | no | CODE-VERIFIED |
| `/api/workflows/webhooks` | GET, POST | adminClient | organizationId, organization_id | yes | yes | no | CODE-VERIFIED |
