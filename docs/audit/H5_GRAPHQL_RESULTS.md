# H5 GraphQL Results

## Deterministic evidence

Status: `TEST-VERIFIED`

`tests/unit/graphqlRouteSecurity.test.ts` passed in the previous validated repository toolchain run with three cases:

- unauthenticated request rejected before Yoga;
- under-privileged request rejected before Yoga;
- authorized request reaches Yoga.

`lib/graphql/security.ts` reuses canonical RBAC and restricts the broad schema to HR_ADMIN/SUPER_ADMIN.

## Live evidence

Status: `BLOCKED-EXTERNAL`

No deployed application URL or real Supabase sessions were available. The following remain unexecuted:

- anonymous query/mutation;
- authenticated user without membership;
- employee, manager, HR admin and owner queries;
- cross-tenant queries for employees, payroll, candidates, documents, audit and screening;
- production introspection behavior.

Required command/target: authenticated Playwright or HTTP requests against the deployed `/api/graphql` endpoint with two synthetic organizations.
