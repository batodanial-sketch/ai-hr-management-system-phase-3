import "server-only";

import { detectExpenseAnomalies } from "@/lib/analytics/predictive";
import { createSessionIntelligenceDataAdapter, type IntelligenceDataAdapter } from "./data";
import { sortInsights, type Insight } from "./types";
import {
  attendanceSignals,
  documentSignals,
  engagementSignals,
  expenseAnomalySignals,
  headcountSignals,
  interviewSignals,
  leaveSignals,
  offboardingSignals,
  performanceSignals,
  recruitmentSignals,
  taskHealthSignals,
  type SignalContext,
} from "./signals";

export interface InsightSource {
  name: string;
  ok: boolean;
  count: number;
  seedFallback: boolean;
}

export interface InsightSet {
  insights: Insight[];
  sources: InsightSource[];
  generatedAt: string;
}

/**
 * Canonical deterministic intelligence aggregation.
 *
 * The detector layer is deliberately unaware of authentication or execution
 * mode. The default adapter preserves the existing authenticated user path;
 * H3's tenant adapter can be injected by trusted infrastructure callers.
 */
export async function getInsightSet(options: {
  adapter?: IntelligenceDataAdapter;
  generatedAt?: string;
} = {}): Promise<InsightSet> {
  const generatedAt = options.generatedAt ?? new Date().toISOString();
  const adapter = options.adapter ?? createSessionIntelligenceDataAdapter();
  const data = await adapter.load();
  const ctxFor = (source: string): SignalContext => ({
    now: generatedAt,
    source,
    seedFallback: data.sources.find((item) => item.name === source)?.seedFallback,
  });

  const insights: Insight[] = [
    ...attendanceSignals(data.attendance, ctxFor("attendance_records")),
    ...leaveSignals(data.leave, ctxFor("leave_requests")),
    ...recruitmentSignals(data.pipeline, ctxFor("applications")),
    ...interviewSignals(data.interviews, ctxFor("interviews")),
    ...headcountSignals(data.employees, ctxFor("employees")),
    ...performanceSignals(data.goals, ctxFor("goals")),
    ...engagementSignals(data.surveys, ctxFor("pulse_surveys")),
    ...offboardingSignals(data.offboarding, ctxFor("offboarding_cases")),
    ...documentSignals(data.documents, ctxFor("documents")),
    ...expenseAnomalySignals(detectExpenseAnomalies(data.expenses), ctxFor("expense_reports")),
    ...taskHealthSignals(data.workflowTasks, "workflows", ctxFor("daily_tasks"), "/automations"),
    ...taskHealthSignals(data.onboardingTasks, "onboarding", ctxFor("daily_tasks"), "/onboarding"),
  ];

  return { insights: sortInsights(insights), sources: data.sources, generatedAt };
}
