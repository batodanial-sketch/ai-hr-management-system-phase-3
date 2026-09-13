#!/usr/bin/env node
/**
 * Live catalog evidence collector. It never invents a schema: without
 * DATABASE_URL it exits 2 with BLOCKED_EXTERNAL. Run only against a disposable
 * or explicitly approved Postgres/Supabase project.
 */
import pg from "pg";

const { Pool } = pg;
const url = process.env.DATABASE_URL;
if (!url) {
  console.error(JSON.stringify({ status: "BLOCKED_EXTERNAL", reason: "DATABASE_URL is not configured" }));
  process.exit(2);
}

const pool = new Pool({ connectionString: url, ssl: process.env.DATABASE_SSL === "disable" ? false : { rejectUnauthorized: false } });
const query = async (text, values = []) => (await pool.query(text, values)).rows;
try {
  const [tables, policies, functions, constraints, indexes, foreignKeys] = await Promise.all([
    query(`select n.nspname as schema, c.relname as table, c.relrowsecurity as rls_enabled, c.relforcerowsecurity as force_rls from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relkind='r' order by c.relname`),
    query(`select schemaname as schema, tablename as table, policyname, permissive, roles, cmd, qual, with_check from pg_policies where schemaname='public' order by tablename, policyname`),
    query(`select n.nspname as schema, p.proname as function, pg_get_function_identity_arguments(p.oid) as arguments, p.prosecdef as security_definer, pg_get_functiondef(p.oid) as definition from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname in ('is_org_member','is_organization_member','current_org_role','user_role','scim_assign_membership','scim_list_memberships') order by p.proname`),
    query(`select tc.table_name as table, tc.constraint_name, tc.constraint_type, kcu.column_name from information_schema.table_constraints tc left join information_schema.key_column_usage kcu on kcu.constraint_name=tc.constraint_name and kcu.table_schema=tc.table_schema where tc.table_schema='public' order by tc.table_name, tc.constraint_name`),
    query(`select schemaname as schema, tablename as table, indexname, indexdef from pg_indexes where schemaname='public' order by tablename, indexname`),
    query(`select tc.table_name as table, tc.constraint_name, kcu.column_name, ccu.table_name as references_table, ccu.column_name as references_column from information_schema.table_constraints tc join information_schema.key_column_usage kcu on kcu.constraint_name=tc.constraint_name and kcu.table_schema=tc.table_schema join information_schema.constraint_column_usage ccu on ccu.constraint_name=tc.constraint_name and ccu.table_schema=tc.table_schema where tc.constraint_type='FOREIGN KEY' and tc.table_schema='public' order by tc.table_name, tc.constraint_name`),
  ]);
  console.log(JSON.stringify({ status: "LIVE-VERIFIED", capturedAt: new Date().toISOString(), tables, policies, functions, constraints, indexes, foreignKeys }, null, 2));
} catch (error) {
  console.error(JSON.stringify({ status: "FAIL", error: error instanceof Error ? error.message : String(error) }));
  process.exitCode = 1;
} finally {
  await pool.end();
}
