#!/usr/bin/env node
import { spawn } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";

const commands = [
  ["typecheck", "npm", ["run", "typecheck"]],
  ["lint", "npm", ["run", "lint"]],
  ["unit", "npm", ["test", "--", "--runInBand"]],
  ["security", "npm", ["run", "security:scan"]],
  ["build", "npm", ["run", "build"]],
  ["environment", "npm", ["run", "verify:environment"]],
  ["infrastructure", "npm", ["run", "verify:infrastructure"]],
];
const results = [];
function run(label, command, args) {
  return new Promise((resolve) => {
    const child = spawn(command, args, { stdio: "inherit", env: process.env });
    child.on("close", (code) => { results.push({ check: label, status: code === 0 ? "PASS" : "FAIL" }); resolve(code === 0); });
    child.on("error", (error) => { results.push({ check: label, status: "FAIL", error: error.message }); resolve(false); });
  });
}
for (const [label, command, args] of commands) {
  const passed = await run(label, command, args);
  // Infrastructure and environment failures are recorded; do not skip any
  // subsequent local quality checks when external access is absent.
  if (!passed) console.error(`[production-verification] ${label} failed; continuing to collect evidence.`);
}
await mkdir("artifacts", { recursive: true });
const report = { service: "production", timestamp: new Date().toISOString(), status: results.every((r) => r.status === "PASS") ? "VERIFIED" : "NOT PRODUCTION READY", checks: results };
await writeFile("artifacts/production-verification.json", JSON.stringify(report, null, 2) + "\n", "utf8");
console.log(JSON.stringify(report, null, 2));
if (report.status !== "VERIFIED") process.exitCode = 1;
