# H5 Live Schema Verification

Status: `BLOCKED-EXTERNAL`

Expected migration count: **39**. Static inventory currently reports 124 parsed table declarations, 90 RLS-enabled table names, and 174 policy declarations. These are not live database counts.

The executable collector is:

```bash
DATABASE_URL=<approved-disposable-db> node scripts/verify_rls_catalog.mjs
```

It queries `pg_class`, `pg_policies`, `pg_proc`, `pg_constraint`, `pg_indexes`, and foreign keys. The H5 attempt could not run because `DATABASE_URL` is not configured. The current sandbox also lacks the `pg` runtime dependency required by the existing database harness.

No live schema, migration-application, RLS, function, constraint, or index claim is made. See `H5_LIVE_SCHEMA_VERIFICATION.json` for machine-readable evidence.
