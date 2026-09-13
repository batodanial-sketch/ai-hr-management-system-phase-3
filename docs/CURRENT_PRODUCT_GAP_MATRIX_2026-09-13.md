# FLUXENTIQ AI — Current Product Gap Matrix

**Inventory date:** 2026-09-13  
**Inspected commit:** `195dceaf133765a58df6655fef9b8c9aa1d55230`  
**Method:** source inspection plus local unit/type/lint gates; no external infrastructure assumed.

Legend: **COMPLETE** = present and tested; **PARTIAL** = useful implementation with bounded gaps; **NEEDS_HARDENING** = works but has an integrity/operability weakness; **BLOCKED_EXTERNAL** = requires infrastructure unavailable in this environment; **NOT_IMPLEMENTED** = intentionally absent.

## P0 — highest-value engineering

| Capability | Status | Evidence / next action |
|---|---|---|
| Tenant isolation, RBAC, RLS, audit, proposal controls | COMPLETE | `lib/authz/`, `lib/rbac.ts`, `lib/tenant.ts`, migrations, Copilot proposal lifecycle, workflow approval SoD tests. Preserve; run live RLS verification when external staging exists. |
| Workforce intelligence envelope and derived signals | PARTIAL | `lib/intelligence/{signals,aggregator,briefing,alerts}.ts` exists. Expand coverage/quality for attendance, leave, recruitment bottlenecks, documents, workflow failures; keep evidence/freshness/confidence explicit. |
| Proactive command center | PARTIAL | `/command-center` is real and role-aware. Extend attention queue and data freshness, without fabricated metrics. |
| Recruitment explainable matching/fairness | PARTIAL | Recruitment and matching code exists. Continue deterministic requirement coverage/missing evidence and protected-characteristic exclusion; keep hiring decisions advisory and approval-gated. |
| Agent routing/evaluation | PARTIAL | `lib/agents/router.ts`, policies and taxonomy exist; Copilot tools are bounded. Add deterministic evaluation cases for routing, grounding, injection resistance, no-data honesty, tenant safety, and loop termination. |

## P1 — major user value

| Capability | Status | Evidence / next action |
|---|---|---|
| Workflow lifecycle | COMPLETE for Phase F scope | `lib/workflows/*`, 14 workflow routes, approvals UI, versioning, retries, webhooks and 284-test suite. Do not create a second engine. |
| Workflow worker / automatic retry | BLOCKED_EXTERNAL / NOT_IMPLEMENTED | Operator-driven retry exists. Automatic cron retry and event waits need a worker/session design; do not claim production automation without it. |
| Outbound webhook workflow step | NOT_IMPLEMENTED | Deliberately deferred until an integration allowlist and secret store exist; do not add arbitrary URL execution. |
| Onboarding/offboarding/recruitment workflow templates | PARTIAL | Generic engine and a small allowlisted template set exist. Add templates only through validated, audited step graphs. |
| Knowledge grounding | COMPLETE for current foundation | `company_knowledge` migration/RLS, retrieval, answer envelope, API and Copilot tool exist. Expand document-backed retrieval only with strict authorization and PII minimization. |
| Global search / command palette | COMPLETE for current foundation | `lib/search/dispatch.ts`, `/api/search`, `CommandPalette`; extend entities only by reusing authorization-aware dispatch. |
| Provider failover and AI operations | PARTIAL | Multi-provider/retry/cost/usage infrastructure exists. Execution failover, provider-level aggregates and fallback observability remain a focused improvement. |
| Notifications | PARTIAL | Authorization-aware center and workflow notifications exist. Improve severity/source/action fields and streaming only if a real consumer requires it. |

## P2 — polish/commercial

| Capability | Status | Evidence / next action |
|---|---|---|
| Billing | NOT_IMPLEMENTED | Correctly not faked. Add only a disabled entitlement abstraction when commercial infrastructure is selected. |
| Enterprise settings completeness | PARTIAL | Settings, seats/license/AI usage/audit surfaces exist; retention, notification preferences, webhook configuration and seat-management UX can be expanded. |
| Responsive/accessibility consistency | PARTIAL | Core surfaces exist, but quality varies by module. Improve incrementally with loading/empty/error/focus states and keyboard/a11y tests. |
| Desktop shell | PARTIAL | Electron shell is present; treat as optional and keep browser/server security canonical. |

## External activation boundary

The following remain **BLOCKED_EXTERNAL** in this workspace and must not be represented as production evidence: configured Supabase project, deployed HTTPS host/domain, AI provider credentials, deployed bridge, email delivery, scheduler/worker, observability backends, backups, and live RLS semantics. Local PASS results do not become PRODUCTION_PASS.

## Recommended next slice

1. Preserve the green baseline and add agent/intelligence evaluation fixtures.
2. Improve the command center's actionable attention queue using existing authorized signals.
3. Add provider failure/fallback telemetry without fabricating outputs.
4. Design a worker-session boundary for automatic retry/event waits before implementing them.
5. Run live RLS and end-to-end verification only after operator-access infrastructure is provided.
