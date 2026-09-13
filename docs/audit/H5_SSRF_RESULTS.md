# H5 SSRF Results

## Deterministic evidence

Status: `TEST-VERIFIED`

`tests/unit/securityRemediation.test.ts` covers loopback, RFC1918, link-local, metadata, IPv6 loopback/ULA, HTTP, FTP, URL credentials, unexpected ports and a valid HTTPS URL. No real attack request was made.

## Live controlled evidence

Status: `BLOCKED-EXTERNAL`

No controlled local DNS/redirect server or deployed outbound environment was available. DNS rebinding, redirect handling, response-size behavior, provider egress, and network firewall behavior remain unexecuted.

Known limitation: the code performs DNS resolution before fetch and disables automatic redirects, but DNS pre-resolution alone cannot guarantee protection against every rebinding race. Production should enforce egress through a locked-down proxy or network policy.
