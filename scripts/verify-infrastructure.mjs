#!/usr/bin/env node
/**
 * Master infrastructure gate. It reports evidence, never upgrades a service to
 * VERIFIED from configuration alone, and exits non-zero when critical external
 * dependencies are unavailable or unverified.
 */
import { mkdir, writeFile } from "node:fs/promises";
import { spawn } from "node:child_process";

const started = new Date().toISOString();
const env = process.env;
const has = (...names) => names.some((name) => Boolean(env[name]?.trim()));
const rows = [];
const add = (service, implemented, configured, reachable, functional, liveVerified, status, evidence) => rows.push({ service, implemented, configured, reachable, functional, liveVerified, status, evidence });

add("Supabase DB", true, has("NEXT_PUBLIC_SUPABASE_URL", "SUPABASE_SECRET_KEY", "SUPABASE_SERVICE_ROLE_KEY"), false, false, false, "BLOCKED-EXTERNAL", "No Supabase credentials are present in the execution environment.");
add("Supabase Auth", true, has("NEXT_PUBLIC_SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "NEXT_PUBLIC_SUPABASE_ANON_KEY"), false, false, false, "BLOCKED-EXTERNAL", "Real sign-up, sign-in, refresh, and invalid-session flows require a configured Supabase project.");
add("PostgreSQL RLS", true, has("NEXT_PUBLIC_SUPABASE_URL", "SUPABASE_SECRET_KEY", "SUPABASE_SERVICE_ROLE_KEY"), false, false, false, "BLOCKED-EXTERNAL", "RLS cannot be certified without two live authenticated tenant identities and direct database evidence.");
add("AI provider", true, has("LLM_API_KEY", "GROQ_API_KEY", "OPENAI_API_KEY", "ANTHROPIC_API_KEY", "OPENROUTER_API_KEY"), false, false, false, "BLOCKED-EXTERNAL", "No provider credential is present; mocked Copilot tests are not live provider evidence.");
add("Embeddings", true, has("LLM_API_KEY", "OPENAI_API_KEY", "OPENROUTER_API_KEY"), false, false, false, "BLOCKED-EXTERNAL", "No embedding provider credential or live knowledge-ingestion run is available.");
add("Supabase Storage", true, has("NEXT_PUBLIC_SUPABASE_URL", "SUPABASE_SECRET_KEY", "SUPABASE_SERVICE_ROLE_KEY") && (env.STORAGE_PROVIDER ?? "").toLowerCase() === "supabase", false, false, false, "BLOCKED-EXTERNAL", "Private-bucket upload/download/cross-tenant verification requires a live Supabase project.");
add("Scheduler", true, Boolean(env.CRON_SECRET), false, false, false, "BLOCKED-EXTERNAL", "Cron code is fail-closed, but no real scheduler invocation and mutation evidence is available.");
add("SCIM", true, has("SCIM_BEARER_TOKEN"), false, false, false, "BLOCKED-EXTERNAL", "SCIM endpoints exist, but no configured enterprise IdP or live provisioning test is available.");
add("n8n", true, has("N8N_WEBHOOK_URL", "N8N_WEBHOOK_SECRET"), false, false, false, "BLOCKED-EXTERNAL", "No n8n endpoint/secret is present and no workflow callback has been observed.");
add("Email", true, has("RESEND_API_KEY", "SMTP_HOST", "SMTP_PASSWORD"), false, false, false, "BLOCKED-EXTERNAL", "No transactional email credentials or real delivery evidence is available.");
add("Deployment", true, has("VERCEL_URL", "DEPLOYMENT_URL", "PRODUCTION_URL"), false, false, false, "BLOCKED-EXTERNAL", "No deployment target URL is present; local build is not deployment verification.");
add("Telemetry", true, has("ERROR_TRACKING_DSN", "SENTRY_DSN", "OTEL_EXPORTER_OTLP_ENDPOINT"), false, false, false, "BLOCKED-EXTERNAL", "No telemetry endpoint/DSN is present and no live event has been observed.");
add("Backups", false, false, false, false, false, "BLOCKED-EXTERNAL", "Managed backup configuration and a controlled restore test require access to the production project.");

await mkdir("artifacts/live", { recursive: true });
await mkdir("artifacts", { recursive: true });
const report = { service: "infrastructure", timestamp: started, status: "NOT PRODUCTION READY", results: rows, localChecks: { typecheck: "run separately", lint: "run separately", unit: "run separately", build: "run separately" } };
await writeFile("artifacts/infrastructure-verification.json", JSON.stringify(report, null, 2) + "\n", "utf8");
const md = ["# Infrastructure Verification", "", `Generated: ${started}`, "", "| Infrastructure | Implemented | Configured | Reachable | Functional | Live Verified | Status |", "|---|---:|---:|---:|---:|---:|---|", ...rows.map((r) => `| ${r.service} | ${r.implemented ? "YES" : "NO"} | ${r.configured ? "YES" : "NO"} | ${r.reachable ? "YES" : "NO"} | ${r.functional ? "YES" : "NO"} | ${r.liveVerified ? "YES" : "NO"} | ${r.status} |`), "", "## Evidence", ...rows.map((r) => `- **${r.service}:** ${r.evidence}`), ""].join("\n");
await writeFile("artifacts/infrastructure-verification.md", md, "utf8");
console.log("Infrastructure verification written to artifacts/infrastructure-verification.json and artifacts/infrastructure-verification.md");
console.log("VERDICT: NOT PRODUCTION READY — external credentials and live access are unavailable.");
process.exitCode = 1;
