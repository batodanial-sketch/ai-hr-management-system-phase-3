# H5 Live Schema Verification

Status: `BLOCKED-EXTERNAL`

Expected migration count: **39**. Static inventory currently reports 124 parsed table declarations, 90 RLS-enabled table names, and 174 policy declarations. These are not live database counts.

The executable collector is:

```bash
DATABASE_URL=<approved-disposable-db> node scripts/verify_rls_catalog.mjs
```

It queries `pg_class`, `pg_policies`, `pg_proc`, `pg_constraint`, `pg_indexes`, and foreign keys. The Step 13 attempt returned `{"status":"BLOCKED_EXTERNAL","reason":"DATABASE_URL is not configured"}`. The `pg` runtime dependency has since been restored, but no approved disposable PostgreSQL/Supabase environment is available.

No live schema, migration-application, RLS, function, constraint, or index claim is made. See `H5_LIVE_SCHEMA_VERIFICATION.json` for machine-readable evidence.
