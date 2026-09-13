# GraphQL Security Evidence — 2026-09-13

## Finding disposition

Previous P0 finding: `/api/graphql` had no visible authentication/RBAC boundary. **CONFIRMED**, then remediated in source.

## Implemented trust boundary

`app/api/graphql/route.ts` now gates both GET and POST through `requireGraphqlContext()` before GraphQL Yoga handles the request. `lib/graphql/security.ts` reuses canonical `getRbacContext()` and existing `roleAtLeast`; only `HR_ADMIN` and `SUPER_ADMIN` can access the broad schema. No client-supplied organization identifier is accepted.

This is intentionally an admin boundary because the existing schema exposes broad employee, candidate, payroll, benefit, equity, document, audit and screening fields. Lower roles are denied rather than receiving a misleading partial schema. No resolver or persistence architecture was duplicated.

## Deterministic tests

`tests/unit/graphqlRouteSecurity.test.ts` proves:

- unauthenticated authorization failure returns 401 before Yoga executes;
- under-privileged authorization failure returns 403 before Yoga executes;
- Yoga executes only after authorization succeeds.

`tests/unit/securityRemediation.test.ts` proves the role decision: employee and manager denied; HR admin and super admin allowed.

Status: `TEST-VERIFIED` for the mocked trust-boundary behavior; `BLOCKED_EXTERNAL` for live anonymous, no-membership, cross-tenant, and real resolver/data tests.

## Remaining live verification

Against a disposable Supabase/deployment environment, run anonymous, no-membership, employee, manager, HR-admin, owner, and cross-tenant GraphQL queries for employees, payroll, candidates/applications, documents, audits and screening. Confirm resolver reads use the authenticated tenant-bound adapter and no custom backend bypass is enabled for this sensitive API.
