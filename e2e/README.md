# Fluxentiq AI HR — E2E Testing Guide

Playwright end-to-end suite for the Fluxentiq AI HR Management System
(Supabase PostgreSQL → Next.js App Router → Python `server.py` bridge).

## 1. Prerequisites

| Tool | Version |
|------|---------|
| Node.js | 20+ |
| Supabase CLI | latest (`npm i -g supabase`) |
| Python | 3.10+ (for `server.py`) |
| Playwright browsers | `npx playwright install --with-deps` |

The Playwright global setup can use a local Supabase stack, or a dedicated
test project supplied via environment variables. GitHub Actions uses the local
stack and creates disposable test credentials itself; no repository secrets
or production project are required for CI. Before the server starts, CI also
runs `E2E_PREPARE_LICENSE=1 node scripts/prepare-e2e-settings.mjs` so protected
browser routes are accessible under a temporary trial license.

For a local run, start Supabase and inspect its local connection values:

```bash
supabase start
supabase db reset
supabase status -o env
```

Set `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
(or the legacy anon key), `SUPABASE_SECRET_KEY` (or service-role key),
`SUPABASE_PROJECT_REF=127` for the local API URL `http://127.0.0.1:54321`,
`E2E_TEST_USER_EMAIL`, `E2E_TEST_USER_PASSWORD`, and `BRIDGE_SECRET_KEY`.
Keep local credentials outside source control.

## 2. Local run

```bash
# one-shot: migrate, boot bridge + Next.js, launch Playwright UI
./scripts/run-e2e-local.sh ui

# or manually
supabase start
supabase db reset          # applies ALL migrations including 000300 & 000400
npm run dev &              # Next.js (Playwright also auto-starts it)
python3 server.py &        # bridge
npx playwright test
```

Scripts:

| Command | Purpose |
|---------|---------|
| `npm run test:e2e` | headless run |
| `npm run test:e2e:ui` | interactive UI mode |
| `npm run test:e2e:debug` | inspector / step-through |
| `npm run test:e2e:headed` | headed browser |
| `npm run test:e2e:update-snapshots` | (re)generate visual baselines |

## 3. Migration application

The suite expects these migrations applied to local Supabase before any run:

- `000300_…` — leave + payroll schema (attendance-leave, payroll-run suites).
- `000400_…` — Google Workspace provisioning + access requests
  (`20260815000400_google_workspace_access_requests.sql`).

`supabase db reset` applies every migration in order plus `supabase/seed.sql`,
which is the canonical path used by both the shell script and CI.

## 4. Google Workspace SSO & access requests

The six provisioning decision paths are encoded in
`e2e/utils/google-workspace.ts` (`WorkspaceDecisionPath`) and seeded in
`e2e/utils/domain-seed.ts`:

1. `existing_membership_allowed`
2. `invited_membership_activated`
3. `membership_required` → triggers the pending access-request state via
   `POST /api/auth/request-access`
4. `domain_not_provisioned`
5. `personal_account_blocked`
6. `ambiguous_domain_blocked`

The external Google OAuth round-trip is mocked with `page.route()` on
`/api/auth/sso-callback`; the **internal** rules are exercised against the real
Supabase instance (`access_requests`, `workspace_domains`, `workspace_memberships`,
`workspace_invites`). Signed-token completion is tested through
`POST /api/auth/complete-access-request` (valid token → `activated`, invalid →
`invalid`).

The `auth.spec.ts` suite starts **unauthenticated** (it clears the global
`storageState`), while every other suite runs against the session created by
`e2e/global-setup.ts`.

## 5. Page-object rules

- All page objects extend `e2e/page-objects/BasePage.ts` and interact **only**
  through `data-testid` markers documented in each file's header.
- Fixtures are registered in `e2e/fixtures/customTest.ts`; add new POMs there.
- Every locator is typed; no `any`, no placeholders, no `// TODO`.
- `data-value` attributes carry raw numeric/metric values for assertion
  (avoiding locale/formatting parsing).

## 6. Seeding & cleanup

- `global-setup.ts` seeds baseline employees/candidates and the E2E user.
- Domain-specific suites seed their own data in `beforeAll` and clean up in
  `afterAll` via `e2e/utils/domain-seed.ts` (`seedLeaveData`, `seedPayrollData`,
  `seedWorkspaceData` + matching `cleanup*`).
- `global-teardown.ts` removes every `source_tag = 'e2e'` row and the test user.

## 7. Mock assets

`e2e/data/mock-resume.ts` and `e2e/data/mock-receipt.ts` generate valid PDF/JPEG
buffers in-memory (no binary fixtures committed) for upload/OCR flows.

## 8. Visual regression

`visual-regression.spec.ts` uses Playwright's `toHaveScreenshot`. Baselines
are committed under `e2e/specs/visual-regression.spec.ts-snapshots/` and run
against deterministic demo-mode data. If they are absent, CI temporarily
bootstraps them and uploads a `visual-regression-baselines` artifact for review;
commit the reviewed PNGs so later runs perform real pixel-diff comparisons.

To deliberately refresh baselines, dispatch the CI workflow manually with
`update_visual_snapshots=true`, review the uploaded artifact, and commit the
resulting PNGs. Avoid routine auto-updates because they can hide regressions.
`maxDiffPixelRatio` is 0.02.

## 9. CI and troubleshooting

The CI workflow provisions a disposable local Supabase instance using the
checked-in migrations and `supabase/seed.sql`. It generates a random E2E user
password and bridge secret at run time and writes an ephemeral trial-license
settings file before the test server starts. The file lives in the gitignored
`data/` directory and is never committed. Do not connect test teardown or seed
scripts to a production Supabase project.

- **`supabase start` fails** — ensure the Docker daemon is available and ports
  54321–54329 are free.
- **Missing env locally** — `global-setup.ts` requires a URL, admin key,
  project ref, test-user email, and password. In CI these values are generated
  from `supabase status -o env`.
- **Visual diffs** — review actual/expected screenshots and update baselines
  only when the UI change is intentional.
- **Shared seeded data** — tests inside each Playwright spec file run serially
  because their `beforeAll`/`afterAll` hooks own deterministic fixture rows.
  Independent spec files still run in separate workers.
