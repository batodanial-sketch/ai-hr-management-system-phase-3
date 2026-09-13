# Outbound SSRF Security Evidence — 2026-09-13

## Finding disposition

Previous findings were **CONFIRMED** in source: `/api/ai/test-connection` lacked a visible authorization gate and custom endpoints had only protocol parsing; external outbound webhook and subscription delivery fetched database/request URLs without a shared destination policy.

## Remediation

Added the single server-only utility `lib/security/outbound.ts`:

- HTTPS only;
- rejects URL credentials;
- rejects non-default ports;
- rejects localhost, local/internal/lan/corp hostnames;
- rejects loopback, RFC1918, link-local, metadata, shared/private, multicast and mapped private IPs;
- resolves all DNS answers before request;
- disables implicit redirects;
- exposes a common `safeOutboundFetch` and `assertSafeOutboundUrl` path.

Integrated into:

- `/api/ai/test-connection` custom provider validation;
- external outbound webhook trigger;
- database-configured webhook subscription creation and delivery;
- custom memory/PostgREST adapter requests.

The AI connection test now requires canonical `getRbacContext()` and `HR_ADMIN` or higher before any provider test is sent. It does not accept provider API keys from the body or return secrets.

## Tests

`tests/unit/securityRemediation.test.ts` covers loopback, private IPv4, link-local, metadata, IPv6 ULA/loopback, HTTP, FTP, credentials, unexpected ports, and a valid HTTPS URL. Tests inspect validation only; no attack request is made.

Status: `TEST-VERIFIED` for pure URL policy; `CODE-VERIFIED` for call-site integration; live DNS-rebinding, redirect, provider egress and deployment firewall behavior: `BLOCKED_EXTERNAL`.

## Production caveat

DNS lookup before fetch is defense in depth, not a complete anti-rebinding control. Production must also enforce network egress restrictions or a locked-down outbound proxy. Redirects are intentionally not followed; clients must allowlist a final destination if that behavior is required.
