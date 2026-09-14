/**
 * TypeScript contract for the live Supabase verification command.
 *
 * The repository runs on Node 20, which does not execute TypeScript directly;
 * `npm run verify:supabase` invokes the dependency-free runtime twin
 * `scripts/verify-supabase.mjs`. Keep this file aligned with that executable
 * when extending the verification checks.
 */
export interface SupabaseVerificationCheck {
  test: string;
  status: string;
  evidence: string;
  error?: string | null;
}

export interface SupabaseVerificationResult {
  service: "supabase";
  timestamp: string;
  status: string;
  checks: SupabaseVerificationCheck[];
  error: string | null;
}
