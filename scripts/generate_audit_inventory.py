#!/usr/bin/env python3
"""Static evidence inventory for the 2026-09-13 system audit.

This is intentionally heuristic: it inventories source references and never
labels runtime behavior as verified. Generated artifacts must be reviewed
alongside source code and tests.
"""
from __future__ import annotations
import json, re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "docs" / "audit"
OUT.mkdir(parents=True, exist_ok=True)

routes = []
method_re = re.compile(r"export\s+(?:async\s+)?function\s+(GET|POST|PUT|PATCH|DELETE|HEAD|OPTIONS)\b")
table_re = re.compile(r"\.from\(\s*[\"']([^\"']+)[\"']\s*\)")
external_re = re.compile(r"fetch\(|axios|createClient\(|adminClient\(|serverClient\(|enqueuePythonJob|bridgeUrl\(|sendEmail")
guard_terms = [
    "getRbacContext", "requireUser", "getCurrentUser", "requireOrganizationContext",
    "requireRole", "requireRecruitmentRole", "requireIntelligenceRole", "CRON_SECRET",
    "N8N_WEBHOOK_SECRET", "PYTHON_BRIDGE_WEBHOOK_SECRET", "WORKFLOW_WEBHOOK_SECRET",
    "requireWebhook", "verifySignature", "adminClient",
]
write_terms = [".insert(", ".update(", ".upsert(", ".delete(", ".rpc(", "createUser(", "fetch("]

for file in sorted((ROOT / "app" / "api").rglob("route.ts")):
    text = file.read_text(errors="replace")
    route = "/api/" + str(file.relative_to(ROOT / "app" / "api")).replace("/route.ts", "").replace("\\", "/")
    methods = method_re.findall(text)
    guards = [term for term in guard_terms if term in text]
    tables = sorted(set(table_re.findall(text)))
    writes = any(term in text for term in write_terms)
    externals = [term for term in ["fetch(", "axios", "adminClient(", "serverClient(", "enqueuePythonJob", "sendEmail"] if term in text]
    tests = []
    route_tokens = [part for part in route.split("/") if part and not part.startswith("[")]
    for test in sorted((ROOT / "tests").rglob("*")):
        if test.is_file() and test.suffix in {".ts", ".tsx", ".js", ".cjs"}:
            t = test.read_text(errors="replace")
            if any(token in t for token in route_tokens[-2:]):
                tests.append(str(test.relative_to(ROOT)))
    routes.append({
        "method": methods,
        "route": route,
        "source": str(file.relative_to(ROOT)),
        "purpose": "Requires source-specific review; static inventory only.",
        "authEvidence": guards,
        "organizationScopeEvidence": [t for t in ["organization_id", "organizationId", "getRbacContext", "requireOrganizationContext", "RLS"] if t in text],
        "tablesReferenced": tables,
        "mutationEvidence": writes,
        "externalEvidence": externals,
        "testReferences": tests,
        "status": "CODE-VERIFIED (static inventory only)",
        "liveStatus": "BLOCKED_EXTERNAL",
    })

migrations = sorted((ROOT / "supabase" / "migrations").glob("*.sql"))
all_text = "\n".join(p.read_text(errors="replace") for p in migrations)
table_pattern = re.compile(r"(?:create\s+table(?:\s+if\s+not\s+exists)?|CREATE TABLE(?: IF NOT EXISTS)?)\s+(?:public\.)?([\w]+)", re.I)
tables = sorted(set(table_pattern.findall(all_text)))
rls_tables = sorted(set(re.findall(r"alter\s+table\s+(?:public\.)?([\w]+)\s+enable\s+row\s+level\s+security", all_text, re.I)))
policies = re.findall(r"create\s+policy\s+([\w_]+)\s+on\s+(?:public\.)?([\w]+)", all_text, re.I)

schema = {
    "generatedFrom": "supabase/migrations/*.sql",
    "migrationCount": len(migrations),
    "tablesDeclared": tables,
    "rlsEnabledTables": rls_tables,
    "policyCount": len(policies),
    "policies": [{"policy": p, "table": t} for p, t in policies],
    "status": "CODE-VERIFIED (migration text parsed; live schema not connected)",
    "liveStatus": "BLOCKED_EXTERNAL",
}

integrations = {
    "supabase": {"code": True, "env": ["NEXT_PUBLIC_SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "SUPABASE_SECRET_KEY"], "live": "BLOCKED_EXTERNAL"},
    "pythonBridge": {"code": True, "env": ["AI_BRIDGE_URL", "BRIDGE_SECRET_KEY"], "live": "BLOCKED_EXTERNAL"},
    "llmProviders": {"code": True, "env": ["LLM_PROVIDER", "LLM_API_KEY", "GROQ_API_KEY"], "live": "BLOCKED_EXTERNAL"},
    "email": {"code": True, "env": ["EMAIL_PROVIDER", "RESEND_API_KEY", "SMTP_HOST"], "live": "BLOCKED_EXTERNAL"},
    "webhooks": {"code": True, "env": ["CRON_SECRET", "N8N_WEBHOOK_SECRET", "PYTHON_BRIDGE_WEBHOOK_SECRET", "WORKFLOW_WEBHOOK_SECRET"], "live": "BLOCKED_EXTERNAL"},
    "observability": {"code": True, "env": ["ERROR_TRACKING_DSN", "OTEL_EXPORTER_OTLP_ENDPOINT"], "live": "BLOCKED_EXTERNAL"},
    "billing": {"code": False, "env": [], "live": "NOT_IMPLEMENTED"},
}

(OUT / "audit-endpoints.json").write_text(json.dumps({"generated": "2026-09-13", "routeFileCount": len(routes), "methodCount": sum(len(r["method"]) for r in routes), "routes": routes}, indent=2) + "\n")
(OUT / "audit-schema.json").write_text(json.dumps(schema, indent=2) + "\n")
(OUT / "audit-integrations.json").write_text(json.dumps(integrations, indent=2) + "\n")

md = ["# Static Endpoint Inventory", "", f"Generated from `{len(routes)}` route files and `{sum(len(r['method']) for r in routes)}` exported methods. This is source inventory evidence, not live endpoint verification.", "", "| Method | Endpoint | Source | Auth/RBAC evidence | Tables | Mutates | External | Tests | Live |", "|---|---|---|---|---|---|---|---|---|"]
for r in routes:
    methods = ", ".join(r["method"]) or "NONE"
    guards = ", ".join(r["authEvidence"]) or "none observed"
    tables_s = ", ".join(r["tablesReferenced"]) or "none observed"
    ext = ", ".join(r["externalEvidence"]) or "none observed"
    tests = ", ".join(r["testReferences"]) or "none matched"
    md.append(f"| {methods} | `{r['route']}` | `{r['source']}` | {guards} | {tables_s} | {'yes' if r['mutationEvidence'] else 'no'} | {ext} | {tests} | BLOCKED_EXTERNAL |")
(OUT / "audit-endpoints.md").write_text("\n".join(md) + "\n")
print(json.dumps({"routeFiles": len(routes), "methods": sum(len(r["method"]) for r in routes), "tables": len(tables), "rlsTables": len(rls_tables), "policies": len(policies)}, indent=2))
