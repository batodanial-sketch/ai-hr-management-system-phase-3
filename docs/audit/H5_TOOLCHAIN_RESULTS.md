# H5 Toolchain Results

Date: 2026-09-13

## Environment restoration

| Item | Result | Evidence |
|---|---|---|
| Node | `RESTORED` | `v20.20.2` |
| npm | `RESTORED` | `10.8.2` |
| Package manager | `RESTORED` | npm selected from `package-lock.json` and `package.json` |
| Dependency install | `RESTORED` | `npm ci` completed; 868 packages added, 869 audited, 0 vulnerabilities |
| Lockfile changes | `PASSED` | `package-lock.json` unchanged |
| Engine warning | `BLOCKED` | Supabase packages report Node >=22 while repository declares Node >=20; no dependency upgrade or version change made |

## Regression results

| Check | Result | Evidence |
|---|---|---|
| Jest | `PASSED` | 34 suites / 311 tests |
| TypeScript | `PASSED` | `npm run typecheck` |
| ESLint | `PASSED` | `npm run lint`; no lint errors; deprecation notice only |
| Electron typecheck | `PASSED` | `tsc -p electron-app/tsconfig.typecheck.json` |
| Python compilation | `PASSED` | `python3 -m compileall -q server.py bridge python_engine` |
| Production build | `PASSED` | `npm run build`; Next.js 15.5.25; non-fatal Edge/Supabase deprecation warnings |
| `git diff --check` | `PASSED` | clean diff check |

## Database harness availability

The Node `pg` dependency is now restored. Live execution remains `BLOCKED-EXTERNAL` because `DATABASE_URL` is not configured.

- `node scripts/verify_rls_catalog.mjs` returned `BLOCKED_EXTERNAL`.
- `node scripts/db/authz-rls-suite.mjs` returned `DATABASE_URL is required`.

No credentials were printed, stored, or committed. The existing user modification to `scripts/zero-downtime-migrate.sh` was preserved and not staged.
