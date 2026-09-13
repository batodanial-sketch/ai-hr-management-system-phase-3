# H5 RLS Results

Status: `BLOCKED-EXTERNAL`

No Supabase/Postgres URL or credentials were available. The existing `scripts/db/authz-rls-suite.mjs` is the intended adversarial harness and covers canonical membership, same-tenant reads, cross-tenant reads/writes, role escalation, legacy membership visibility, revocation, leave lifecycle, concurrency, and storage RLS.

Attempted command:

```bash
node scripts/db/authz-rls-suite.mjs
```

Observed blocker: local `pg` dependency was unavailable. The harness also requires `DATABASE_URL` and refuses unsafe remote destructive execution unless explicitly approved.

Required live run:

```bash
DATABASE_URL=<approved-disposable-db> node scripts/db/local-pg.mjs reset --tolerant
DATABASE_URL=<approved-disposable-db> node scripts/db/authz-rls-suite.mjs
```

For hosted Supabase, use the approved pooler/connection and real JWT-backed sessions rather than treating a local PostgreSQL shim as hosted Supabase evidence.
