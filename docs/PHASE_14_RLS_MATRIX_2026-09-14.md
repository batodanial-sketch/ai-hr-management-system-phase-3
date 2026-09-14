# FLUXENTIQ AI — PHASE 14 RLS MATRIX

Date: 2026-09-14  
Status: `BLOCKED-EXTERNAL`

## Infrastructure blocker

No approved disposable PostgreSQL/Supabase environment was available.

Executed commands:

```bash
node scripts/verify_rls_catalog.mjs
node scripts/db/authz-rls-suite.mjs
```

Results:

```json
{"status":"BLOCKED_EXTERNAL","reason":"DATABASE_URL is not configured"}
```

```text
Error: DATABASE_URL is required
```

## Intended synthetic fixture

The following fixture was not created because no database was available:

```text
ORG_A
ORG_B

ORG_A employee
ORG_A manager
ORG_A HR_ADMIN
ORG_A owner

ORG_B employee
ORG_B manager
ORG_B HR_ADMIN
ORG_B owner
```

Only synthetic identities/data may be used when infrastructure becomes available.

## Required matrix

| Domain | ORG_A same tenant | ORG_A → ORG_B | ORG_B same tenant | ORG_B → ORG_A | Live status |
|---|---|---|---|---|---|
| employees | SELECT/INSERT/UPDATE/DELETE by role | SELECT/INSERT/UPDATE/DELETE denied | SELECT/INSERT/UPDATE/DELETE by role | SELECT/INSERT/UPDATE/DELETE denied | BLOCKED-EXTERNAL |
| attendance | role-scoped | denied | role-scoped | denied | BLOCKED-EXTERNAL |
| leave | employee request; manager/admin decision | denied | employee request; manager/admin decision | denied | BLOCKED-EXTERNAL |
| goals/performance | role-scoped | denied | role-scoped | denied | BLOCKED-EXTERNAL |
| pulse/offboarding | role-scoped | denied | role-scoped | denied | BLOCKED-EXTERNAL |
| documents | ownership/role-scoped | denied | ownership/role-scoped | denied | BLOCKED-EXTERNAL |
| expenses/payroll | role-scoped | denied | role-scoped | denied | BLOCKED-EXTERNAL |
| jobs/candidates/applications/interviews | role-scoped | denied | role-scoped | denied | BLOCKED-EXTERNAL |
| tasks/knowledge | tenant-scoped | denied | tenant-scoped | denied | BLOCKED-EXTERNAL |
| workflows/runs/approvals | owner/role-scoped | denied | owner/role-scoped | denied | BLOCKED-EXTERNAL |
| integrations/API keys | tenant-scoped | denied | tenant-scoped | denied | BLOCKED-EXTERNAL |
| storage metadata | tenant/owner-scoped | denied | tenant/owner-scoped | denied | BLOCKED-EXTERNAL |
| memberships | canonical role rules | denied | canonical role rules | denied | BLOCKED-EXTERNAL |

## Adversarial cases required

- organization ID replacement;
- resource UUID replacement;
- parent ID replacement;
- membership ID replacement;
- nested child-record access;
- role escalation;
- revoked membership;
- deleted/disabled user;
- legacy `organization_memberships` visibility;
- service-role tenant substitution;
- knowledge and AI context substitution;
- cross-tenant storage object access.

Expected live result for every unauthorized case: `DENIED` or zero rows.

No live result is claimed in this artifact.
