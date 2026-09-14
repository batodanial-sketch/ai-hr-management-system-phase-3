#!/usr/bin/env node
import { readdir, readFile } from "node:fs/promises";
import { join, relative } from "node:path";

const roots = ["app", "components", "lib", "scripts", "middleware.ts", "next.config.mjs"];
const ignored = new Set(["node_modules", ".next", ".git", "test-results", "playwright-report", "artifacts"]);
const findings = [];
const patterns = [
  [/NEXT_PUBLIC_(?:SUPABASE_)?(?:SERVICE_ROLE|SECRET|PRIVATE|TOKEN|PASSWORD)/i, "server secret appears in a public environment variable name"],
  [/(?:sk-[A-Za-z0-9]{20,}|ghp_[A-Za-z0-9]{20,}|xox[baprs]-[A-Za-z0-9-]{20,})/, "credential-like literal"],
  [/SUPABASE_SERVICE_ROLE_KEY\s*=\s*["'](?!\$)[^"'\n]+["']/, "hard-coded service-role assignment"],
];
async function walk(path) {
  let stat;
  try { stat = await (await import("node:fs/promises")).stat(path); } catch { return; }
  if (stat.isDirectory()) {
    if (ignored.has(path.split("/").pop())) return;
    for (const item of await readdir(path)) await walk(join(path, item));
  } else {
    if (!/\.(ts|tsx|js|mjs|jsx|py|sh)$/.test(path)) return;
    const text = await readFile(path, "utf8");
    for (const [pattern, message] of patterns) if (pattern.test(text)) findings.push({ file: relative(process.cwd(), path), message });
  }
}
for (const root of roots) await walk(root);
if (findings.length) { console.error(JSON.stringify(findings, null, 2)); process.exitCode = 1; }
else console.log("Security scan: PASS — no credential literals or public server-secret variable names detected.");
