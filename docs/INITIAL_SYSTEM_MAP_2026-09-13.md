# FLUXENTIQ AI — Initial System Map

**Inventory date:** 2026-09-13 (Asia/Karachi)  
**Repository:** `batodanial-sketch/AI-HR-Management-system`  
**Branch:** `arena/01a07c94-ai-hr-management-system`  
**Inspected commit:** `195dceaf133765a58df6655fef9b8c9aa1d55230`  
**Working tree at clone:** clean

## Source and verification

The repository was freshly cloned from the canonical branch into `/home/user/fluxentiq`. The clone contains Git history, 783 tracked files, 38 Supabase migrations, 112 Next API route handlers, and the full frontend, backend, bridge, Python engine, tests, scripts, and documentation. Dependencies were installed with `npm ci`.

The prompt's referenced Phase E/release SHAs are historical references. The checked-out branch is newer and already contains Phase F commits:

- `2338e0b` — deterministic workflow engine, approvals, and Copilot bridge
- `195dcea` — Phase F acceptance report / decision gate
- `4368523` — audited release ancestor
- `353ee55` — evidence-chain ancestor

## Runtime topology

```text
Browser / Electron shell
        |
        v
Next.js App Router (React + TypeScript)
  - server actions
  - REST APIs
  - GraphQL endpoint
  - middleware/session gate
        |
        +--> Supabase/PostgreSQL (canonical tenant data + RLS)
        |
        +--> Python FastAPI bridge (AI orchestration / jobs / ML)
        |       +--> configured LLM providers
        |       +--> python_engine tasks
        |       +--> allow-listed scraping
        |
        +--> local/self-hosted PostgreSQL option via Docker
```

## Major code areas

| Area | Primary paths | Observed responsibility |
|---|---|---|
| UI shell | `app/`, `components/`, `styles/`, `src/` | Dashboard, HR modules, recruitment, Copilot, command center, workflows, approvals, settings, responsive UI |
| Identity/security | `middleware.ts`, `lib/auth.ts`, `lib/rbac.ts`, `lib/authz/`, `lib/tenant.ts`, `lib/supabase/` | Session validation, RBAC tiers, trusted organization context, tenant-scoped server access |
| HR domain | `app/actions/*`, `lib/domain.ts`, `types/*`, `app/(dashboard)/*` | Employees, attendance, leave, performance, payroll, documents, onboarding/offboarding and extended HR modules |
| Recruitment | `app/recruitment/`, `app/api/recruitment/`, `app/actions/recruitmentActions.ts`, `lib/recruitment/` | Jobs, candidates, pipeline, interviews, screening, matching, candidate actions |
| Intelligence | `lib/intelligence/`, `app/api/intelligence/`, `components/analytics/` | Signals, briefing, alerts, insight aggregation, workforce/operations intelligence surfaces |
| Knowledge/search | `lib/knowledge/`, `lib/search/`, `app/api/knowledge/`, `app/api/search/`, `components/search/` | Organization knowledge retrieval, KNOWN/UNKNOWN answers, authorization-aware global search, command palette |
| Copilot/agents | `lib/agents/`, `lib/copilot/`, `lib/ai-providers.ts`, `app/api/ai/copilot/` | Agent policy/taxonomy/router, tool catalog, proposal lifecycle, bounded execution, audit and telemetry |
| Workflows | `lib/workflows/`, `app/api/workflows/`, `app/actions/workflowActions.ts`, `components/workflow*` | Versioned definitions, deterministic executor, state machine, approvals, retries, webhooks, daily-task engine |
| AI bridge | `bridge/`, `server.py`, `python_engine/` | Provider calls, retry/rate limits, cost/usage, parsing, AI/ML jobs, workflow bridge |
| Data/security schema | `supabase/migrations/`, `supabase/*.sql`, `lib/database.types.ts` | Tables, indexes, constraints, RLS, tenant membership functions, audit/telemetry/workflow schema |
| Quality/operations | `tests/`, `e2e/`, `scripts/`, `.github/workflows/`, `docs/` | Unit/security/e2e tests, preflight, evidence, CI, deployment/runbooks |

## Implemented product surfaces confirmed by code

- HR core: employee records, attendance, leave, performance, documents, payroll and multiple extended HR modules.
- Recruitment CRUD and AI-assisted screening/matching proxies with HR authorization controls.
- Company knowledge with organization RLS, CRUD/search, ranked retrieval, and `KNOWN`/`UNKNOWN` answer handling.
- Authorization-aware global search and Cmd/Ctrl+K command palette.
- `/command-center` with briefing, recruitment/workflow/approval summaries and role-aware degradation.
- Copilot with bounded rounds, policy-filtered tools, proposal confirmation, audit logging, telemetry, and agent routing primitives.
- Workflow engine with version pinning, deterministic step execution, idempotent run creation, state transitions, human approvals/separation of duties, retry/cancel paths, verified webhook intake, and workflow Copilot tools.
- Python bridge/provider infrastructure and optional Electron shell.

## Trust boundaries preserved

1. Authenticated session resolves organization identity; request bodies, query parameters, AI output, and tool arguments do not select tenant context.
2. Supabase RLS is retained as the database enforcement layer, with explicit organization predicates in server stores.
3. Consequential Copilot/workflow operations use frozen proposals and human approval; the system actor cannot approve.
4. Workflow execution is deterministic and allow-listed; arbitrary model instructions and outbound webhooks are not executable primitives.
5. Audit, rate limiting, CSRF/request limits, SSRF/webhook verification, idempotency, and PII minimization are existing controls to preserve.

## Evidence status

| Gate | Result |
|---|---|
| Git branch / commit / clean checkout | PASS at clone |
| Dependency install | PASS (`npm ci`); Node 20.20.2 emits Supabase Node >=22 warnings |
| TypeScript | PASS (`npm run typecheck`) |
| ESLint | PASS (`npm run lint`), with the repository's existing Next lint deprecation notice |
| Jest unit suite | PASS: 29 suites / 284 tests |
| Production build | Not rerun during initial inventory |
| Live Supabase/RLS semantics | `BLOCKED_EXTERNAL` until a configured external/staging project is available |
| Production deployment / deployed SHA proof | `BLOCKED_EXTERNAL`; no deployment claimed |

## Inventory caveat

`docs/PRODUCT_EVOLUTION_GAP_MATRIX.md` predates the current Phase F/knowledge/search implementation and contains stale MISSING classifications. The current branch code and `docs/PHASE_F_REPORT.md` are the authoritative implementation evidence for this checkout. A current gap matrix is recorded separately.
