# FLUXENTIQ AI — Phase H2 Report

**Date:** 2026-09-13  
**Starting checkpoint:** `aa5bb01`  
**Scope:** secure sessionless organization discovery and tenant-pinned intelligence evaluation

## 1. Existing architecture discovered

- `lib/supabase/server.ts` already owns the approved `adminClient()` service-role factory.
- `lib/intelligence/sweep.ts` is the H1 bounded orchestration layer.
- Existing HR/recruitment loaders generally depend on `getCurrentUser()` and therefore cannot be called directly from sessionless cron.
- Existing memory adapters also use cookie-aware session clients; they are not suitable as an implicit cron identity.
- `organizations` is the tenant discovery table. Canonical user membership is stored in `memberships`.

## 2. Why a seam was necessary

The existing intelligence aggregator is request/session-oriented. Calling it from cron would either fail without cookies or tempt callers to introduce an unsafe implicit organization. H2 therefore adds a narrow infrastructure boundary that discovers minimal organization IDs, verifies one organization, creates an immutable tenant context, and exposes only bounded organization-filtered reads.

## 3. Service-role boundary

The existing `adminClient()` was reused; no second Supabase admin client was created.

Location:

```text
lib/supabase/server.ts
```

H2 callers:

```text
lib/intelligence/service.ts
```

The client is server-only, never returned from an API, and is not imported by client components. The H2 context exposes no raw Supabase client.

## 4. Organization discovery

`discoverOrganizationsForIntelligenceSweep()`:

- accepts only a bounded limit
- selects only `organizations.id`
- returns `{ organizationId }` only
- sorts deterministically
- does not accept browser/model input

## 5. Tenant pinning

`pinIntelligenceOrganization()`:

- rejects empty/non-canonical input
- independently verifies the organization exists through the trusted service client
- returns a frozen context
- identifies execution as infrastructure, not `HR_ADMIN`
- exposes an allow-listed `readRows()` function
- automatically applies `organization_id = pinned organization`
- caps every data read at 500 rows

Allowed data tables are explicitly enumerated in `IntelligenceTenantTable`.

## 6. User-session and scheduler convergence

The intended convergence is:

```text
user session → existing request loaders → deterministic detectors
trusted scheduler → H2 pinned context/read seam → deterministic detectors
```

H2 does not silently reuse `getCurrentUser()`. `runTrustedIntelligenceSweep()` supplies discovery and pinning to the existing H1 `runIntelligenceSweep()` orchestration layer.

The full aggregator still requires a follow-up adapter migration to consume `IntelligenceTenantContext` directly. H2 does not fake that migration or activate production cron.

## 7. Security guarantees

- Service-role access is confined to server-side infrastructure code.
- Organization IDs are discovered internally or verified before use.
- Tenant context is immutable for an evaluation.
- Raw admin clients are not exposed to evaluators.
- Reads use an allow-listed table set and mandatory organization filter.
- Read limits prevent unbounded detector queries.
- Infrastructure identity is not an HR role and has no approval capability.
- H1 retains per-organization failure isolation and tenant-qualified deduplication.

## 8. Tests

Added `tests/unit/intelligenceService.test.ts` covering:

- bounded minimal organization discovery
- missing/unknown organization rejection
- frozen context creation
- infrastructure actor identity
- organization-pinned reads
- H1 integration through discovery and pinning
- no tenant switching across bounded evaluation

Live RLS and service-role behavior remain unavailable without configured Supabase infrastructure.

## 9. Limitations

- The existing `getInsightSet()` aggregator still uses session-dependent loaders.
- H2 provides the secure boundary and adapter contract; it does not yet refactor every domain loader to accept the pinned context.
- No production cron activation was performed.
- No new persistence table was added.
- No AI calls or enrichment were added.

## 10. Before production cron activation

1. Refactor the aggregator/domain reads to consume the pinned context or a context-bound data adapter.
2. Prove each signal source uses the mandatory tenant filter and bounded limits.
3. Add live Supabase RLS/service-role integration verification.
4. Add operational sweep metrics and timeout controls.
5. Only then connect the seam to the existing cron endpoint.
