"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { motion } from "framer-motion";
import { ArrowRight, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { BrandLogo } from "@/components/ui/brand-logo";
import { createClient } from "@/lib/supabase/browser";
import { useBranding } from "@/components/providers";

export function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const supabase = createClient();
  const branding = useBranding();

  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(
    searchParams.get("error"),
  );
  type WorkspaceDecisionPath =
    | "existing_membership_allowed"
    | "invited_membership_activated"
    | "membership_required"
    | "domain_not_provisioned"
    | "personal_account_blocked"
    | "ambiguous_domain_blocked";
  interface WorkspaceSsoDecision {
    decision: WorkspaceDecisionPath;
    email: string;
    domain: string;
    message: string;
    redirectTo: string | null;
  }
  const initialWorkspaceDecision = (): WorkspaceSsoDecision | null => {
    const decision = searchParams.get("ssoDecision") as WorkspaceDecisionPath | null;
    const emailValue = searchParams.get("email") ?? "";
    const domainValue = searchParams.get("domain") ?? emailValue.split("@")[1] ?? "";
    const messages: Record<WorkspaceDecisionPath, string> = {
      existing_membership_allowed: "Existing membership verified.",
      invited_membership_activated: "Pending invite activated.",
      membership_required: "Access requires approval for this domain.",
      domain_not_provisioned: "This domain is not provisioned for Google Workspace access.",
      personal_account_blocked: "Personal accounts are not permitted. Use your company account.",
      ambiguous_domain_blocked: "Domain ownership could not be verified.",
    };
    return decision && decision in messages
      ? { decision, email: emailValue, domain: domainValue, message: messages[decision], redirectTo: null }
      : null;
  };
  const [workspaceSsoResult, setWorkspaceSsoResult] =
    React.useState<WorkspaceSsoDecision | null>(initialWorkspaceDecision);
  const [requestingAccess, setRequestingAccess] = React.useState(false);
  const [accessRequestPending, setAccessRequestPending] = React.useState(false);

  // Sanitize the `next` query param — only allow internal, same-origin paths
  // (guards against open-redirect attempts via ?next=//evil.com or absolute URLs).
  const rawNext = searchParams.get("next") ?? "/dashboard";
  const next =
    rawNext.startsWith("/") && !rawNext.startsWith("//") ? rawNext : "/dashboard";

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);

    if (!supabase) {
      // Demo mode — no backend configured.
      router.push(next);
      return;
    }

    setLoading(true);
    try {
      // Server-side login: establishes the session AND reflects the license/
      // trial state into a cookie atomically (mirrors /api/auth/signup), so the
      // middleware license gate lets the user straight through to /dashboard.
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
        signal: AbortSignal.timeout(10_000),
      });
      const data = (await response.json()) as {
        ok?: boolean;
        demo?: boolean;
        needsActivation?: boolean;
        message?: string;
      };

      if (!response.ok || !data.ok) {
        setError(data.message ?? "Could not complete sign-in. Please try again.");
        return;
      }

      if (data.demo) {
        // Demo mode — no backend; go straight to the seed-data app.
        window.location.href = next;
        return;
      }

      // Hard navigation so middleware re-evaluates with the freshly-set cookies.
      window.location.href = data.needsActivation ? "/auth/license" : next;
    } catch {
      setError("Could not complete sign-in. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleGoogle = async () => {
    setError(null);
    setWorkspaceSsoResult(null);
    setAccessRequestPending(false);
    try {
      // The server uses the verified Supabase session only. The email body
      // exists for mocked UI decision tests and is ignored by the real route.
      const response = await fetch("/api/auth/sso-callback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim().toLowerCase() }),
      });
      const decision = (await response.json().catch(() => null)) as
        | (WorkspaceSsoDecision & { requiresOAuth?: boolean; message?: string })
        | null;
      if (response.ok && decision && "decision" in decision) {
        setWorkspaceSsoResult(decision);
        if (decision.redirectTo) router.push(decision.redirectTo);
        return;
      }
      if (response.status !== 401 && !decision?.requiresOAuth) {
        setError(decision?.message ?? "Unable to verify Google Workspace access.");
        return;
      }
    } catch {
      // The authenticated OAuth callback repeats the same policy decision.
    }
    if (!supabase) {
      router.push(next);
      return;
    }
    const callback = new URL("/auth/callback", window.location.origin);
    callback.searchParams.set("next", next);
    callback.searchParams.set("workspace", "true");
    const { error: oauthError } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: callback.toString() },
    });
    if (oauthError) setError(oauthError.message);
  };

  const handleRequestAccess = async () => {
    if (!workspaceSsoResult?.email || !workspaceSsoResult.domain) {
      setError("Sign in with your company email before requesting workspace access.");
      return;
    }
    setRequestingAccess(true);
    setError(null);
    try {
      const response = await fetch("/api/auth/request-access", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: workspaceSsoResult.email, domain: workspaceSsoResult.domain }),
      });
      const result = (await response.json().catch(() => null)) as { status?: string; message?: string } | null;
      if (!response.ok || result?.status !== "pending") {
        setError(result?.message ?? "Unable to submit the workspace access request.");
        return;
      }
      setAccessRequestPending(true);
    } catch {
      setError("Unable to submit the workspace access request. Please try again.");
    } finally {
      setRequestingAccess(false);
    }
  };

  const demoMode = !supabase;

  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex flex-col items-center text-center">
          <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-card shadow-lg">
            <BrandLogo size={36} logoUrl={branding.logoUrl} alt={`${branding.appName} logo`} />
          </div>
          <h1 className="text-2xl font-bold tracking-tight">Welcome back</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Sign in to your {branding.appName} workspace
          </p>
        </div>

        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
          className="glass-strong rounded-2xl p-6"
        >
          {demoMode && (
            <p className="mb-4 rounded-md border border-warning/30 bg-warning/10 px-3 py-2 text-xs text-warning">
              Running in demo mode — Supabase is not configured. Any sign-in
              continues to the dashboard with sample data.
            </p>
          )}

          <Button
            type="button"
            variant="outline"
            className="w-full"
            data-testid="sso-google-button"
            onClick={handleGoogle}
          >
            <GoogleIcon /> Continue with Google
          </Button>

          {workspaceSsoResult?.decision === "membership_required" && (
            <div data-testid="auth-access-request-prompt" className="mt-4 rounded-lg border border-border/70 bg-card/50 p-3">
              <p className="text-sm">{workspaceSsoResult.message}</p>
              {accessRequestPending ? (
                <p data-testid="auth-access-request-pending" className="mt-2 text-xs font-medium text-success">
                  Access request submitted and pending approval.
                </p>
              ) : (
                <Button type="button" variant="outline" className="mt-3 w-full" data-testid="auth-request-access-button" disabled={requestingAccess} onClick={() => void handleRequestAccess()}>
                  {requestingAccess ? "Submitting request…" : "Request access"}
                </Button>
              )}
            </div>
          )}

          {workspaceSsoResult &&
            ["domain_not_provisioned", "personal_account_blocked", "ambiguous_domain_blocked"].includes(workspaceSsoResult.decision) && (
              <p data-testid="auth-blocked-message" className="mt-4 rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                {workspaceSsoResult.message}
              </p>
            )}

          <div className="my-5 flex items-center gap-3">
            <span className="h-px flex-1 bg-border" />
            <span className="text-xs text-muted-foreground">or</span>
            <span className="h-px flex-1 bg-border" />
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                data-testid="auth-email-input"
                autoComplete="email"
                placeholder="you@company.com"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                data-testid="auth-password-input"
                autoComplete="current-password"
                placeholder="••••••••"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                required
              />
            </div>

            {error && (
              <p
                data-testid="auth-error-message"
                className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive"
              >
                {error}
              </p>
            )}

            <Button
              type="submit"
              className="w-full"
              data-testid="auth-submit-button"
              disabled={loading}
            >
              {loading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <>
                  Sign in <ArrowRight className="h-4 w-4" />
                </>
              )}
            </Button>
          </form>

          <p className="mt-5 text-center text-xs text-muted-foreground">
            New to {branding.appName}?{" "}
            <Link href="/signup" className="font-medium text-primary hover:underline">
              Start a free trial
            </Link>
          </p>
        </motion.div>
      </div>
    </div>
  );
}

function GoogleIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden="true">
      <path
        fill="#4285F4"
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.27-4.74 3.27-8.1Z"
      />
      <path
        fill="#34A853"
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A11 11 0 0 0 12 23Z"
      />
      <path
        fill="#FBBC05"
        d="M5.84 14.1a6.6 6.6 0 0 1 0-4.2V7.06H2.18a11 11 0 0 0 0 9.88l3.66-2.84Z"
      />
      <path
        fill="#EA4335"
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15A11 11 0 0 0 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52Z"
      />
    </svg>
  );
}
