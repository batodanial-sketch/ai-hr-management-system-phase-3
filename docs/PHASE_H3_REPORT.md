# FLUXENTIQ AI — Phase H3 Report

**Date:** 2026-09-13  
**Starting checkpoint:** `2d8dcbb`  
**Scope:** shared session/tenant-context intelligence data adapter

## Previous session dependency

The previous aggregator loaded HR data through functions such as `getEmployees`, `getCandidates`, `getLeaveRequests`, and domain loaders that derive organization scope from `getCurrentUser()` and cookie-aware adapters. Recruitment overview and daily-task actions also required a user session. The deterministic signal functions themselves had no session dependency.

## Shared adapter

Added:

```text
lib/intelligence/data.ts
```

It defines the narrow `IntelligenceDataAdapter` contract and normalized `IntelligenceDataSnapshot` consumed by the existing detectors. The adapter exposes only detector-required fields, not UI records or raw database rows.

Two implementations now exist:

- `createSessionIntelligenceDataAdapter()` — preserves existing authenticated loaders/actions, RLS, membership, and user-path behavior.
- `createTenantIntelligenceDataAdapter(context)` — reads only through the H2 pinned context capability and maps the same normalized data contract.

## User-context path

```text
Authenticated request
  → existing getCurrentUser()/RBAC/RLS loaders
  → session intelligence adapter
  → normalized IntelligenceDataSnapshot
  → existing deterministic detectors
  → canonical Insight
```

## Trusted-tenant path

```text
Trusted scheduler
  → H2 discovery and pinning
  → IntelligenceTenantContext.readRows()
  → tenant intelligence adapter
  → normalized IntelligenceDataSnapshot
  → same deterministic detectors
  → canonical Insight
```

## Recruitment adapter

The tenant adapter reads only proven fields from:

- `job_openings`: `id`, `title`
- `candidates`: `id`, `first_name`, `last_name`
- `applications`: candidate/job references, stage, stage timestamps
- `interviews`: application reference, scheduled time, status

It reconstructs the same `PipelineInput` and `InterviewInput` used by the existing recruitment detectors.

## Other domain adapters

The tenant adapter covers the sources currently consumed by the aggregator:

- attendance records
- leave requests
- employees
- goals
- pulse surveys
- offboarding cases
- documents
- expenses
- daily employee tasks

All tenant reads use explicit projections and bounded reads through the H2 context. The global 500-record service-read cap remains unchanged.

## Aggregator convergence

`lib/intelligence/aggregator.ts` now accepts an optional `IntelligenceDataAdapter` and continues to use the same detector functions and sorting semantics. The default remains the session adapter, so existing user-facing behavior is preserved.

`evaluateOrganizationIntelligence()` now runs the canonical aggregator through the tenant adapter. `runTrustedIntelligenceSweep()` defaults to this evaluator while retaining injectable evaluators for tests.

No detector copy was created. No business thresholds, severity rules, stable IDs, or recommendation semantics were changed.

## PII projection

The tenant capability rejects wildcard projections and explicitly forbidden candidate fields including:

```text
email
phone
resume_url
linkedin_url
portfolio_url
private_notes
```

Candidate intelligence receives names and pipeline fields only where required by existing deterministic explanations.

## Tenant enforcement and bounds

- Context organization ID is verified and frozen by H2.
- `readRows()` internally applies `organization_id = pinned organization`.
- Table names are allow-listed.
- Projections are explicit.
- Reads are capped at 500 records.
- No raw service-role client reaches detectors.
- No new database table or cron activation was added.

## Tests

Added/updated tests cover:

- service-role discovery and pinning
- tenant A/B isolation
- rejection of unknown organizations
- immutable tenant context
- bounded H1 integration
- PII projection rejection
- shared adapter-to-detector compilation and execution
- existing intelligence/recruitment/workflow/security regression behavior

Live RLS and production Supabase behavior remain unavailable.

## Known limitations

- The session adapter preserves existing domain behavior but still uses session-aware loaders by design.
- The tenant adapter currently caps each source at 500 records; larger organizations will require bounded pagination or database-side aggregation before production activation.
- Live service-role/RLS integration has not been run.
- Production cron remains intentionally inactive.

## H4 requirements

H4 can activate a cron path only after:

1. Live Supabase service-role and RLS verification.
2. Bounded pagination/aggregation for organizations exceeding source caps.
3. Timeout and operational metrics for adapter reads.
4. A production scheduler invocation that uses `runTrustedIntelligenceSweep()` without user cookies.
