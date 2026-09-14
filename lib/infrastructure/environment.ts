const names = [
  "NEXT_PUBLIC_SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "NEXT_PUBLIC_SUPABASE_ANON_KEY",
  "SUPABASE_SECRET_KEY", "SUPABASE_SERVICE_ROLE_KEY", "LLM_API_KEY", "GROQ_API_KEY", "OPENAI_API_KEY",
  "ANTHROPIC_API_KEY", "OPENROUTER_API_KEY", "STORAGE_PROVIDER", "STORAGE_BUCKET", "MALWARE_SCANNER",
  "EMAIL_PROVIDER", "EMAIL_HTTP_URL", "CRON_SECRET", "N8N_WEBHOOK_URL", "N8N_WEBHOOK_SECRET",
  "SCIM_BEARER_TOKEN", "ERROR_TRACKING_DSN", "ERROR_TRACKING_WEBHOOK", "OTEL_EXPORTER_OTLP_ENDPOINT",
  "VERCEL_URL", "PRODUCTION_URL", "DEPLOYMENT_URL", "DATABASE_URL", "POSTGRES_URL",
] as const;

export type EnvironmentVariableName = (typeof names)[number];

export function environmentSnapshot(env: NodeJS.ProcessEnv = process.env): Record<EnvironmentVariableName, "PRESENT" | "MISSING"> {
  return Object.fromEntries(names.map((name) => [name, env[name]?.trim() ? "PRESENT" : "MISSING"])) as Record<EnvironmentVariableName, "PRESENT" | "MISSING">;
}

export function hasAny(env: NodeJS.ProcessEnv, ...keys: string[]): boolean {
  return keys.some((key) => Boolean(env[key]?.trim()));
}

export function hasSupabaseServerConfig(env: NodeJS.ProcessEnv = process.env): boolean {
  return hasAny(env, "NEXT_PUBLIC_SUPABASE_URL") && hasAny(env, "SUPABASE_SECRET_KEY", "SUPABASE_SERVICE_ROLE_KEY");
}

export function hasSupabaseClientConfig(env: NodeJS.ProcessEnv = process.env): boolean {
  return hasAny(env, "NEXT_PUBLIC_SUPABASE_URL") && hasAny(env, "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "NEXT_PUBLIC_SUPABASE_ANON_KEY");
}
