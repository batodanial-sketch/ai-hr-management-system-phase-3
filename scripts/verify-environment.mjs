#!/usr/bin/env node
/** Safe environment inventory. Values are never printed. */
const groups = [
  ["SUPABASE_URL", ["NEXT_PUBLIC_SUPABASE_URL"], true],
  ["SUPABASE_CLIENT_KEY", ["NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "NEXT_PUBLIC_SUPABASE_ANON_KEY"], true],
  ["SUPABASE_SERVER_KEY", ["SUPABASE_SECRET_KEY", "SUPABASE_SERVICE_ROLE_KEY"], true],
  ["AI_PROVIDER_KEY", ["LLM_API_KEY", "GROQ_API_KEY", "OPENAI_API_KEY", "ANTHROPIC_API_KEY", "OPENROUTER_API_KEY"], true],
  ["STORAGE_CONFIGURATION", ["STORAGE_PROVIDER", "STORAGE_BUCKET"], false],
  ["EMAIL_CONFIGURATION", ["EMAIL_PROVIDER", "EMAIL_HTTP_URL"], false],
  ["CRON_SECRET", ["CRON_SECRET"], false],
  ["N8N_CONFIGURATION", ["N8N_WEBHOOK_URL", "N8N_WEBHOOK_SECRET"], false],
  ["SCIM_BEARER_TOKEN", ["SCIM_BEARER_TOKEN"], false],
  ["TELEMETRY_CONFIGURATION", ["ERROR_TRACKING_DSN", "ERROR_TRACKING_WEBHOOK", "OTEL_EXPORTER_OTLP_ENDPOINT"], false],
  ["DEPLOYMENT_URL", ["PRODUCTION_URL", "DEPLOYMENT_URL", "VERCEL_URL"], true],
];
let missingRequired = 0;
for (const [label, keys, required] of groups) {
  const present = keys.some((key) => Boolean(process.env[key]?.trim()));
  const status = present ? "PRESENT" : required ? "MISSING" : "NOT_REQUIRED";
  if (status === "MISSING") missingRequired += 1;
  console.log(`${String(label).padEnd(28, ".")} ${status}`);
}
if (missingRequired) {
  console.error(`Environment verification failed: ${missingRequired} required configuration group(s) missing.`);
  process.exitCode = 1;
}
