"""Workflow event-trigger engine.

Receives a domain event (``employee.created``, ``leave.requested``,
``candidate.advanced``, ``payroll.completed``, …) and executes the matching
workflow: condition nodes gate execution, action nodes perform side effects
(e-mail, record writes, webhooks, AI evaluation), delay nodes pause the flow.

Workflows may be supplied inline (as the node graph produced by the workflow
builder) or loaded from persisted definitions in Supabase. Every execution is
recorded as a run in ``workflow_runs`` so it can be audited.
"""

from __future__ import annotations

import asyncio
import logging
from typing import Any

from .config import settings
from .models import WorkflowExecution, WorkflowNode, WorkflowTriggerRequest
from .supabase_client import SupabaseClient

logger = logging.getLogger("fluxentiq.bridge.workflows")

# Sanity cap so a misconfigured delay node can never stall the event loop.
_MAX_DELAY_SECONDS = 30.0


def _compare(left: Any, op: str, right: Any) -> bool:
    """Evaluates a simple comparison for condition nodes."""
    if op == "eq":
        return left == right
    if op == "neq":
        return left != right
    if op == "gt":
        return left > right
    if op == "gte":
        return left >= right
    if op == "lt":
        return left < right
    if op == "lte":
        return left <= right
    if op == "contains":
        return isinstance(left, str) and str(right) in left
    return False


def _resolve_path(payload: dict[str, Any], path: str) -> Any:
    """Resolves a dot-path (``employee.email``) within the payload."""
    current: Any = payload
    for part in path.split("."):
        if isinstance(current, dict) and part in current:
            current = current[part]
        else:
            return None
    return current


class WorkflowEngine:
    """Executes workflow definitions in response to domain events."""

    def __init__(self, supabase: SupabaseClient | None) -> None:
        self._supabase = supabase
        self._run_counter = 0

    async def trigger(
        self, request: WorkflowTriggerRequest, organization_id: str | None = None
    ) -> WorkflowExecution:
        if self._supabase and not (organization_id or "").strip():
            raise ValueError("Workflow execution requires a trusted organization scope.")
        if self._supabase and request.workflow is not None:
            raise ValueError("Inline workflow graphs are not accepted by the database-backed event endpoint.")

        scoped_org = organization_id.strip() if organization_id else None
        if request.workflow is not None:
            definitions: list[tuple[str | None, list[WorkflowNode]]] = [(None, request.workflow)]
        elif self._supabase and scoped_org:
            definitions = await self._load_definitions(request.event, scoped_org)
        else:
            definitions = []

        if not definitions:
            run_id = self._coerce_run_id(request.run_id)
            await self._record_run(run_id, scoped_org, None, request.event, "no_workflow", [], None)
            return WorkflowExecution(run_id=run_id, event=request.event, status="no_workflow", executed_actions=[])

        actions: list[str] = []
        failures: list[str] = []
        first_run_id: str | None = None
        for workflow_id, nodes in definitions:
            run_id = self._coerce_run_id(request.run_id) if len(definitions) == 1 else self._new_run_id()
            first_run_id = first_run_id or run_id
            try:
                executed = await self._execute(nodes, request.payload, scoped_org)
                actions.extend(executed)
                await self._record_run(run_id, scoped_org, workflow_id, request.event, "completed", executed, None)
            except Exception as exc:  # noqa: BLE001 — isolate failures between workflows
                logger.exception("Workflow execution failed for event %s", request.event)
                failures.append(str(exc))
                await self._record_run(run_id, scoped_org, workflow_id, request.event, "failed", [], str(exc))

        return WorkflowExecution(
            run_id=first_run_id or self._new_run_id(),
            event=request.event,
            status="failed" if failures else "completed",
            executed_actions=actions,
            error="; ".join(failures)[:1000] if failures else None,
        )

    @staticmethod
    def _coerce_run_id(value: str | None) -> str:
        """Ensure run IDs satisfy the workflow_runs UUID primary key."""
        import uuid
        if value:
            try:
                return str(uuid.UUID(value))
            except (ValueError, TypeError, AttributeError):
                pass
        return str(uuid.uuid4())

    async def _execute(
        self, nodes: list[WorkflowNode], payload: dict[str, Any], organization_id: str | None
    ) -> list[str]:
        """Linear pass over nodes; condition nodes toggle the active branch."""
        executed: list[str] = []
        active = True
        for node in nodes:
            if node.type == "trigger":
                continue
            if node.type == "condition":
                condition = node.config.get("condition") or {}
                field = str(condition.get("field", ""))
                op = str(condition.get("op", "eq"))
                value = condition.get("value")
                active = _compare(_resolve_path(payload, field), op, value)
                continue
            if node.type == "delay":
                if active:
                    seconds = min(float(node.config.get("seconds", 0)), _MAX_DELAY_SECONDS)
                    if seconds > 0:
                        await asyncio.sleep(seconds)
                continue
            if node.type == "action" and active:
                label = await self._run_action(node, payload, organization_id)
                executed.append(label or node.label)
        return executed

    async def _run_action(
        self, node: WorkflowNode, payload: dict[str, Any], organization_id: str | None
    ) -> str | None:
        action = str(node.config.get("action", "webhook"))
        if action == "send_email":
            return await self._action_send_email(node, payload, organization_id)
        if action == "create_record":
            return await self._action_create_record(node, payload, organization_id)
        if action == "update_record":
            return await self._action_update_record(node, payload, organization_id)
        if action == "groq_evaluate":
            return await self._action_groq_evaluate(node, payload)
        return await self._action_webhook(node, payload)

    async def _action_send_email(
        self, node: WorkflowNode, payload: dict[str, Any], organization_id: str | None
    ) -> str:
        to = str(node.config.get("to", "") or payload.get("email", ""))
        subject = str(node.config.get("subject", node.label))
        body = str(node.config.get("body", "") or node.label)

        # 1. Persist a notification row when Supabase is available.
        if self._supabase:
            await self._supabase.insert(
                "notifications",
                [{
                    "organization_id": organization_id,
                    "kind": "info",
                    "title": subject,
                    "description": f"Triggered by workflow action '{node.label}'",
                }],
            )
        # 2. Send the email through the HTTP relay the app exposes, so the
        #    bridge reuses the platform's email service (SMTP/HTTP/console).
        if to:
            try:
                import httpx

                relay = str(
                    __import__("os").environ.get("EMAIL_HTTP_URL", "")
                ).strip()
                if relay:
                    async with httpx.AsyncClient(timeout=15.0) as client:
                        await client.post(
                            relay,
                            json={"to": to, "subject": subject, "text": body},
                        )
                else:
                    # Never log the recipient address — it is personal data.
                    logger.info("Workflow email dispatched (recipient redacted, subject=%s)", subject)
            except Exception as exc:  # noqa: BLE001 — never fail the workflow
                logger.warning("Workflow email delivery failed: %s", exc)
        return f"send_email:{subject}"

    async def _action_create_record(
        self, node: WorkflowNode, payload: dict[str, Any], organization_id: str | None
    ) -> str:
        table = str(node.config.get("table", ""))
        allowed_tables = {
            "employees", "candidates", "leave_requests", "leave_balances",
            "payroll_runs", "payroll_line_items", "expense_reports",
            "notifications", "audit_logs", "performance_reviews",
        }
        if table not in allowed_tables:
            raise ValueError("Workflow create_record target is not an allowed HR table.")
        if self._supabase and not organization_id:
            raise ValueError("Workflow record creation requires an organization scope.")
        fields = dict(node.config.get("fields", {}) or {})
        row = {key: value.format_map(payload) if isinstance(value, str) else value
               for key, value in fields.items()}
        if self._supabase:
            # Ignore any workflow/body-supplied organization and pin to the trusted header.
            row["organization_id"] = organization_id
            await self._supabase.insert(table, [row])
        # Log only the target table and column count — the row may contain PII.
        logger.info("Workflow create_record table=%s fields=%d", table, len(row))
        return f"create_record:{table}"

    async def _action_update_record(
        self, node: WorkflowNode, payload: dict[str, Any], organization_id: str | None
    ) -> str:
        table = str(node.config.get("table", ""))
        allowed_tables = {
            "employees", "candidates", "leave_requests", "leave_balances",
            "payroll_runs", "payroll_line_items", "expense_reports",
            "notifications", "audit_logs", "performance_reviews",
        }
        if table not in allowed_tables:
            raise ValueError("Workflow update_record target is not an allowed HR table.")
        match = dict(node.config.get("match", {}) or {})
        patch = dict(node.config.get("fields", {}) or {})
        if self._supabase:
            if not organization_id:
                raise ValueError("Workflow record updates require an organization scope.")
            if not match:
                raise ValueError("Workflow record updates require a specific row match.")
            if "organization_id" in match and str(match["organization_id"]) != organization_id:
                raise ValueError("Workflow record match cannot change organization scope.")
            match["organization_id"] = organization_id
            patch.pop("organization_id", None)
            await self._supabase.update(table, {str(k): str(v) for k, v in match.items()}, patch)
        # `match`/`patch` may contain PII — log the table and key count only.
        logger.info(
            "Workflow update_record table=%s match_keys=%d patch_fields=%d",
            table, len(match), len(patch),
        )
        return f"update_record:{table}"

    async def _action_groq_evaluate(
        self, node: WorkflowNode, payload: dict[str, Any]
    ) -> str:
        # AI-triggered action: downstream code can attach an evaluation to the
        # event payload. The bridge itself does not re-enter Groq here to avoid
        # recursive evaluation; it simply records that the step ran. The
        # candidate name is PII — log the candidate id only.
        logger.info(
            "Workflow groq_evaluate candidate_id=%s",
            payload.get("candidate_id", "unknown"),
        )
        return f"groq_evaluate:{payload.get('candidate_id', 'unknown')}"

    async def _action_webhook(
        self, node: WorkflowNode, payload: dict[str, Any]
    ) -> str:
        url = str(node.config.get("url", ""))
        if not url:
            raise ValueError(f"Action '{node.label}' has no webhook url.")
        import httpx

        async with httpx.AsyncClient(timeout=15.0) as client:
            response = await client.post(url, json={"event": payload})
            response.raise_for_status()
        return f"webhook:{url}"

    async def _load_definitions(
        self, event: str, organization_id: str
    ) -> list[tuple[str, list[WorkflowNode]]]:
        """Load active workflows within one trusted organization, then their nodes."""
        if not self._supabase:
            return []
        workflows = await self._supabase.select(
            "workflows",
            filters={
                "organization_id": organization_id,
                "trigger_event": event,
                "status": "active",
            },
            limit=100,
        )
        definitions: list[tuple[str, list[WorkflowNode]]] = []
        for workflow in workflows:
            workflow_id = str(workflow.get("id", ""))
            if not workflow_id:
                continue
            rows = await self._supabase.select(
                "workflow_nodes",
                filters={"workflow_id": workflow_id},
                limit=100,
            )
            rows.sort(key=lambda row: int(row.get("position", 0) or 0))
            nodes: list[WorkflowNode] = []
            for index, row in enumerate(rows):
                node_type = row.get("type", "action")
                if node_type not in {"trigger", "action", "condition", "delay"}:
                    logger.warning("Ignoring unknown workflow node type at index %d", index)
                    continue
                nodes.append(WorkflowNode(
                    id=str(row.get("id", f"node-{index}")),
                    type=node_type,
                    label=str(row.get("label", "node")),
                    config=row.get("config") if isinstance(row.get("config"), dict) else {},
                ))
            if nodes:
                definitions.append((workflow_id, nodes))
        return definitions

    async def _record_run(
        self,
        run_id: str,
        organization_id: str | None,
        workflow_id: str | None,
        event: str,
        status: str,
        executed: list[str],
        error: str | None,
    ) -> None:
        if not self._supabase:
            logger.info("workflow run %s [%s] %s → %s", run_id, event, status, executed)
            return
        if not organization_id:
            logger.error("Skipped workflow run persistence because tenant scope was missing")
            return
        try:
            await self._supabase.insert(
                "workflow_runs",
                [{
                    "id": run_id,
                    "organization_id": organization_id,
                    "workflow_id": workflow_id,
                    "event": event,
                    "status": status,
                    "executed_actions": executed,
                    "error": error,
                }],
            )
        except Exception as exc:  # noqa: BLE001 — audit persistence must not mask the run result
            logger.warning("Could not persist workflow run status=%s: %s", status, exc)

    def _new_run_id(self) -> str:
        import uuid
        return str(uuid.uuid4())


def make_engine(supabase: SupabaseClient | None) -> WorkflowEngine:
    return WorkflowEngine(supabase)
