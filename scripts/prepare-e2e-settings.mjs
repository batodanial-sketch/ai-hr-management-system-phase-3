#!/usr/bin/env node
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

if (process.env.E2E_PREPARE_LICENSE !== "1" || process.env.CI !== "true") {
  throw new Error(
    "This helper is CI-only. Set CI=true and E2E_PREPARE_LICENSE=1 to create disposable test license settings.",
  );
}

const now = new Date();
const expiresAt = new Date(now.getTime() + 15 * 24 * 60 * 60 * 1000);
const iso = (date) => date.toISOString();

const license = {
  tier: "TRIAL",
  ownerEmail: "",
  organizationName: "Fluxentiq E2E",
  maxUsers: 50,
  issuedAt: iso(now),
  expiresAt: iso(expiresAt),
  allowedFeatures: [],
  perpetual: false,
  key: null,
  activatedAt: iso(now),
  trialStartedAt: iso(now),
  trialEndsAt: iso(expiresAt),
};

const filePath = path.join(process.cwd(), "data", "settings.json");
await mkdir(path.dirname(filePath), { recursive: true });

let existing = {};
try {
  existing = JSON.parse(await readFile(filePath, "utf8"));
} catch (error) {
  if (error?.code !== "ENOENT") {
    throw new Error("Unable to read existing E2E settings file safely.", { cause: error });
  }
}

await writeFile(filePath, JSON.stringify({ ...existing, license }, null, 2), {
  encoding: "utf8",
  mode: 0o600,
});
console.log("Prepared disposable 15-day trial settings for the E2E process.");
