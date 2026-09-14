import { hasAny, hasSupabaseClientConfig, hasSupabaseServerConfig } from "./environment";
import { statusForConfiguration } from "./status";
import type { InfrastructureCheck, InfrastructureService } from "./types";

const now = () => new Date().toISOString();
function configCheck(service: InfrastructureService, configured: boolean, evidence: string): InfrastructureCheck {
  return { service: service.name, check: "configuration", timestamp: now(), status: statusForConfiguration(configured), evidence };
}

export const infrastructureServices: InfrastructureService[] = [
  {
    id: "supabase", name: "Supabase/PostgreSQL", criticality: "critical",
    requiredEnv: ["NEXT_PUBLIC_SUPABASE_URL", "SUPABASE_SECRET_KEY"], documentation: "docs/INFRASTRUCTURE_ACTIVATION_AUDIT.md",
    checkConfiguration: (env = process.env) => configCheck(infrastructureServices[0], hasSupabaseServerConfig(env), hasSupabaseServerConfig(env) ? "Supabase URL and server key are present." : "Supabase URL and server key are missing."),
  },
  {
    id: "auth", name: "Supabase Auth", criticality: "critical",
    requiredEnv: ["NEXT_PUBLIC_SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY"], documentation: "docs/GOOGLE_SSO_SETUP.md",
    checkConfiguration: (env = process.env) => configCheck(infrastructureServices[1], hasSupabaseClientConfig(env), hasSupabaseClientConfig(env) ? "Client Supabase configuration is present." : "Client Supabase configuration is missing."),
  },
  {
    id: "rls", name: "PostgreSQL RLS / tenant isolation", criticality: "critical",
    requiredEnv: ["NEXT_PUBLIC_SUPABASE_URL", "SUPABASE_SECRET_KEY"], documentation: "docs/INFRASTRUCTURE_ACTIVATION_AUDIT.md",
    checkConfiguration: (env = process.env) => configCheck(infrastructureServices[2], hasSupabaseServerConfig(env), "Configuration alone never certifies RLS; live authenticated-user tests are required."),
  },
  {
    id: "ai", name: "AI provider", criticality: "high",
    requiredEnv: ["LLM_API_KEY"], documentation: "docs/EXTERNAL_SERVICE_SETUP.md",
    checkConfiguration: (env = process.env) => configCheck(infrastructureServices[3], hasAny(env, "LLM_API_KEY", "GROQ_API_KEY", "OPENAI_API_KEY", "ANTHROPIC_API_KEY", "OPENROUTER_API_KEY"), "Provider key presence is not live provider verification."),
  },
  {
    id: "embeddings", name: "Embeddings / knowledge", criticality: "medium",
    requiredEnv: ["LLM_API_KEY"], documentation: "docs/EXTERNAL_SERVICE_SETUP.md",
    checkConfiguration: (env = process.env) => configCheck(infrastructureServices[4], hasAny(env, "LLM_API_KEY", "OPENAI_API_KEY", "OPENROUTER_API_KEY"), "Embedding credential presence is not ingestion/retrieval verification."),
  },
  {
    id: "storage", name: "Supabase Storage", criticality: "high",
    requiredEnv: ["STORAGE_PROVIDER", "STORAGE_BUCKET"], documentation: "supabase/storage/README.md",
    checkConfiguration: (env = process.env) => configCheck(infrastructureServices[5], env.STORAGE_PROVIDER === "supabase" && hasSupabaseServerConfig(env), "Private bucket upload/download/cross-tenant tests remain required."),
  },
  {
    id: "email", name: "Email delivery", criticality: "high",
    requiredEnv: ["EMAIL_PROVIDER"], documentation: "docs/EXTERNAL_SERVICE_SETUP.md",
    checkConfiguration: (env = process.env) => configCheck(infrastructureServices[6], env.EMAIL_PROVIDER === "http" && Boolean(env.EMAIL_HTTP_URL), "Provider acknowledgment is not delivery evidence."),
  },
  {
    id: "scheduler", name: "Scheduler / background jobs", criticality: "high",
    requiredEnv: ["CRON_SECRET"], documentation: "docs/DEPLOYMENT_RUNBOOK.md",
    checkConfiguration: (env = process.env) => configCheck(infrastructureServices[7], Boolean(env.CRON_SECRET), "A real scheduler invocation and idempotent mutation are required."),
  },
  {
    id: "n8n", name: "n8n automation", criticality: "medium",
    requiredEnv: ["N8N_WEBHOOK_URL", "N8N_WEBHOOK_SECRET"], documentation: "docs/EXTERNAL_SERVICE_SETUP.md",
    checkConfiguration: (env = process.env) => configCheck(infrastructureServices[8], Boolean(env.N8N_WEBHOOK_URL && env.N8N_WEBHOOK_SECRET), "Signed workflow and callback execution remain to be observed."),
  },
  {
    id: "scim", name: "SCIM enterprise provisioning", criticality: "enterprise",
    requiredEnv: ["SCIM_BEARER_TOKEN"], documentation: "docs/EXTERNAL_SERVICE_SETUP.md",
    checkConfiguration: (env = process.env) => configCheck(infrastructureServices[9], Boolean(env.SCIM_BEARER_TOKEN), "Protocol tests are local; IdP certification requires live access."),
  },
  {
    id: "deployment", name: "Production deployment", criticality: "critical",
    requiredEnv: ["PRODUCTION_URL"], documentation: "docs/DEPLOYMENT_RUNBOOK.md",
    checkConfiguration: (env = process.env) => configCheck(infrastructureServices[10], hasAny(env, "PRODUCTION_URL", "DEPLOYMENT_URL", "VERCEL_URL"), "A local build is not deployment verification."),
  },
  {
    id: "telemetry", name: "Telemetry / observability", criticality: "high",
    requiredEnv: ["ERROR_TRACKING_DSN"], documentation: "docs/EXTERNAL_SERVICE_SETUP.md",
    checkConfiguration: (env = process.env) => configCheck(infrastructureServices[11], hasAny(env, "ERROR_TRACKING_DSN", "ERROR_TRACKING_WEBHOOK", "OTEL_EXPORTER_OTLP_ENDPOINT"), "A live event must be observed in the configured backend."),
  },
  {
    id: "backups", name: "Backups / recovery", criticality: "operational",
    requiredEnv: [], documentation: "docs/BACKUP_RECOVERY_RUNBOOK.md",
    checkConfiguration: () => configCheck(infrastructureServices[12], false, "Managed backup configuration and restore evidence require the production project."),
  },
];

export function configurationChecks(env = process.env): InfrastructureCheck[] {
  return infrastructureServices.map((service) => service.checkConfiguration(env));
}
