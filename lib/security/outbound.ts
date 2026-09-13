import "server-only";

import { lookup } from "node:dns/promises";
import { isIP } from "node:net";

/**
 * Common egress guard for buyer- or database-configured HTTP destinations.
 *
 * This is deliberately conservative: HTTPS is required, credentials and
 * non-default ports are rejected, private/link-local/metadata destinations
 * are denied, and redirects are never followed automatically. DNS is checked
 * before the request as a defense-in-depth measure; callers must still use a
 * network egress policy in production to close DNS-rebinding races.
 */
export const OUTBOUND_MAX_RESPONSE_BYTES = 1_048_576;

export class UnsafeOutboundUrlError extends Error {
  readonly code = "UNSAFE_OUTBOUND_URL";
  constructor(message: string) {
    super(message);
    this.name = "UnsafeOutboundUrlError";
  }
}

function isBlockedIpv4(address: string): boolean {
  const octets = address.split(".").map(Number);
  if (octets.length !== 4 || octets.some((n) => !Number.isInteger(n) || n < 0 || n > 255)) return true;
  const [a, b] = octets;
  return (
    a === 0 ||
    a === 10 ||
    a === 127 ||
    (a === 100 && b >= 64 && b <= 127) ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 0) ||
    (a === 192 && b === 168) ||
    (a === 198 && (b === 18 || b === 19)) ||
    (a === 198 && b === 51) ||
    (a === 203 && b === 0) ||
    a >= 224
  );
}

function isBlockedIpv6(address: string): boolean {
  const value = address.toLowerCase().split("%", 1)[0];
  if (value === "::" || value === "::1" || value.startsWith("fc") || value.startsWith("fd") || value.startsWith("fe8") || value.startsWith("fe9") || value.startsWith("fea") || value.startsWith("feb")) return true;
  if (value.startsWith("::ffff:")) return isBlockedIpv4(value.slice(7));
  return false;
}

export function isBlockedIp(address: string): boolean {
  const version = isIP(address);
  return version === 4 ? isBlockedIpv4(address) : version === 6 ? isBlockedIpv6(address) : false;
}

function isBlockedHostname(hostname: string): boolean {
  const host = hostname.toLowerCase().replace(/\.$/, "");
  return (
    host === "localhost" ||
    host.endsWith(".localhost") ||
    host.endsWith(".local") ||
    host.endsWith(".internal") ||
    host.endsWith(".lan") ||
    host.endsWith(".corp") ||
    host === "metadata.google.internal" ||
    host === "instance-data.ec2.internal"
  );
}

export function parseSafeOutboundUrl(raw: string): URL {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new UnsafeOutboundUrlError("Outbound URL is invalid.");
  }
  if (url.protocol !== "https:") throw new UnsafeOutboundUrlError("Outbound URL must use HTTPS.");
  if (url.username || url.password) throw new UnsafeOutboundUrlError("Outbound URL may not contain credentials.");
  if (url.port && url.port !== "443") throw new UnsafeOutboundUrlError("Outbound URL uses an unsupported port.");
  if (isBlockedHostname(url.hostname) || isBlockedIp(url.hostname)) throw new UnsafeOutboundUrlError("Outbound URL targets a private or internal destination.");
  return url;
}

/** Validate URL and resolve all addresses before a request is made. */
export async function assertSafeOutboundUrl(raw: string): Promise<URL> {
  const url = parseSafeOutboundUrl(raw);
  let addresses: Array<{ address: string }>;
  try {
    addresses = await lookup(url.hostname, { all: true, verbatim: true });
  } catch {
    throw new UnsafeOutboundUrlError("Outbound hostname could not be resolved.");
  }
  if (addresses.length === 0 || addresses.some(({ address }) => isBlockedIp(address))) {
    throw new UnsafeOutboundUrlError("Outbound hostname resolves to a private or internal destination.");
  }
  return url;
}

/** Safe fetch wrapper: validates destination and disables implicit redirects. */
export async function safeOutboundFetch(raw: string, init: RequestInit = {}): Promise<Response> {
  const url = await assertSafeOutboundUrl(raw);
  return fetch(url, { ...init, redirect: "manual" });
}
