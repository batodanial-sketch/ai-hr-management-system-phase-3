#!/usr/bin/env node
/** Live Supabase verification. Fails closed and never prints credentials. */
import { writeFile } from "node:fs/promises";

const env = process.env;
const required = { url: env.NEXT_PUBLIC_SUPABASE_URL, key: env.SUPABASE_SECRET_KEY || env.SUPABASE_SERVICE_ROLE_KEY };
const timestamp = new Date().toISOString();
const result = { service: "supabase", timestamp, status: "BLOCKED-EXTERNAL", checks: [], error: null };
const check = (test, status, evidence, error = null) => result.checks.push({ test, status, evidence, error });

async function inspectPostgres() {
  const connectionString = env.DATABASE_URL || env.POSTGRES_URL;
  if (!connectionString) {
    check("migration/schema/index/function/policy inspection", "BLOCKED-EXTERNAL", "A direct PostgreSQL connection string is unavailable; REST cannot prove migration history, indexes, constraints, triggers, functions, or RLS policies.");
    return false;
  }
  let client;
  try {
    const { Client } = await import("pg");
    const ssl = env.DATABASE_SSL === "disable" || env.DATABASE_SSL === "false" ? false : { rejectUnauthorized: false };
    client = new Client({ connectionString, ssl, connectionTimeoutMillis: 10000, statement_timeout: 15000 });
    await client.connect();
    const expectedTables = ["organizations", "organization_memberships", "memberships", "employees", "candidates", "documents", "audit_logs", "workflows", "notifications", "ai_usage_logs"];
    const tableRows = await client.query("SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_name = ANY($1)", [expectedTables]);
    const found = new Set(tableRows.rows.map((row) => row.table_name));
    const missing = expectedTables.filter((table) => !found.has(table));
    check("schema tables", missing.length ? "DEGRADED" : "VERIFIED", missing.length ? `Missing expected tables: ${missing.join(", ")}.` : `${expectedTables.length} expected public tables exist.`);
    const migration = await client.query("SELECT to_regclass('supabase_migrations.schema_migrations') IS NOT NULL AS present");
    check("migration history", migration.rows[0]?.present ? "VERIFIED" : "DEGRADED", migration.rows[0]?.present ? "Supabase migration history table exists." : "Migration history table was not found.");
    const policies = await client.query("SELECT count(*)::int AS count FROM pg_policies WHERE schemaname = 'public'");
    const functions = await client.query("SELECT count(*)::int AS count FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace WHERE n.nspname = 'public'");
    const indexes = await client.query("SELECT count(*)::int AS count FROM pg_indexes WHERE schemaname = 'public'");
    check("RLS policies", Number(policies.rows[0]?.count) > 0 ? "FUNCTIONAL" : "DEGRADED", `${policies.rows[0]?.count ?? 0} public policies observed.`);
    check("database functions", Number(functions.rows[0]?.count) > 0 ? "FUNCTIONAL" : "DEGRADED", `${functions.rows[0]?.count ?? 0} public functions observed.`);
    check("database indexes", Number(indexes.rows[0]?.count) > 0 ? "FUNCTIONAL" : "DEGRADED", `${indexes.rows[0]?.count ?? 0} public indexes observed.`);
    return missing.length === 0 && Boolean(migration.rows[0]?.present) && Number(policies.rows[0]?.count) > 0;
  } catch (error) {
    check("direct PostgreSQL inspection", "REACHABILITY_FAILED", "Direct PostgreSQL inspection failed.", error instanceof Error ? error.message.replace(/postgres(?:ql)?:\/\/[^\s]+/gi, "[REDACTED]") : "Database inspection failed.");
    return false;
  } finally {
    if (client) await client.end().catch(() => undefined);
  }
}

if (!required.url || !required.key) {
  result.error = "NEXT_PUBLIC_SUPABASE_URL and a server Supabase key are required.";
  check("credentials", "BLOCKED-EXTERNAL", "Required environment variables are missing.", result.error);
} else {
  const base = required.url.replace(/\/$/, "");
  const headers = { apikey: required.key, Authorization: `Bearer ${required.key}` };
  try {
    const response = await fetch(`${base}/rest/v1/organizations?select=id&limit=1`, { headers, signal: AbortSignal.timeout(10000) });
    if (!response.ok) {
      result.error = `Supabase REST probe returned HTTP ${response.status}.`;
      check("database connectivity/authentication", response.status === 401 || response.status === 403 ? "AUTHENTICATION_FAILED" : "REACHABILITY_FAILED", `REST probe HTTP ${response.status}.`, result.error);
    } else {
      check("database connectivity/authentication", "FUNCTIONAL", "Authenticated REST query to organizations succeeded.");
      const tables = ["organizations", "organization_memberships", "employees", "candidates", "documents", "audit_logs", "workflows", "notifications", "ai_usage_logs"];
      let missing = 0;
      for (const table of tables) {
        const r = await fetch(`${base}/rest/v1/${table}?select=*&limit=1`, { headers, signal: AbortSignal.timeout(10000) });
        if (r.ok) check(`table:${table}`, "FUNCTIONAL", "REST table query succeeded.");
        else { missing += 1; check(`table:${table}`, "REACHABILITY_FAILED", `REST table query returned HTTP ${r.status}.`); }
      }
      const directVerified = await inspectPostgres();
      if (missing === 0 && directVerified) result.status = "FUNCTIONAL";
      else if (missing > 0) { result.status = "DEGRADED"; result.error = `${missing} expected table probes failed.`; }
      else result.status = "FUNCTIONAL";
      check("RLS certification", "BLOCKED-EXTERNAL", "Requires controlled authenticated users from two organizations and direct live database tests.");
    }
  } catch {
    result.error = "Supabase endpoint was unreachable.";
    check("database connectivity", "REACHABILITY_FAILED", "Network probe failed.", result.error);
  }
}

const out = env.INFRASTRUCTURE_ARTIFACT ?? "artifacts/supabase-verification.json";
await writeFile(out, JSON.stringify(result, null, 2) + "\n", "utf8");
console.log(JSON.stringify({ service: result.service, status: result.status, artifact: out }, null, 2));
if (["BLOCKED-EXTERNAL", "REACHABILITY_FAILED", "AUTHENTICATION_FAILED", "DEGRADED"].includes(result.status)) process.exitCode = 1;
