import { rm } from "node:fs/promises";
import path from "node:path";
import {
  cleanupBaselineData,
  createAdminClient,
  deleteTestUser,
} from "./utils/supabase-test-seed";

/**
 * Runs once after all tests complete. Removes every E2E-tagged row from the
 * canonical Supabase database, deletes the dedicated test user, and clears the
 * generated storageState file so no authenticated artifact lingers locally.
 */
export default async function globalTeardown(): Promise<void> {
  const hasSupabaseEnv = Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
      (process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY),
  );
  const email = process.env.E2E_TEST_USER_EMAIL;

  // Match global setup's hermetic mode: no credentials means no cleanup client
  // can be created. Never invent credentials just to make teardown succeed.
  if (hasSupabaseEnv) {
    const admin = createAdminClient();
    await cleanupBaselineData(admin);

    if (email) {
      await deleteTestUser(admin, email);
    }
  }

  await rm(path.join(process.cwd(), "e2e", ".auth"), {
    recursive: true,
    force: true,
  });
}
