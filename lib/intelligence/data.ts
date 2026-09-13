import "server-only";

import { getCandidates, getEmployees, getLeaveRequests } from "@/lib/api";
import {
  getAttendanceRecords,
  getDocuments,
  getExpenses,
  getOffboardingCases,
  getOkrGoals,
  getPulseSurveys,
} from "@/lib/domain";
import { hasSupabaseEnv } from "@/lib/supabase/server";
import { getRecruitmentOverviewAction } from "@/app/actions/recruitmentActions";
import { listDailyTasksAction } from "@/app/actions/workflowActions";
import type { Expense } from "@/lib/domain";
import type { IntelligenceTenantContext, IntelligenceTenantTable } from "./service";
import type {
  AttendanceInput,
  DocumentInput,
  EngagementInput,
  GoalInput,
  HeadcountInput,
  InterviewInput,
  LeaveInput,
  OffboardingInput,
  PipelineInput,
  TaskInput,
} from "./signals";

export interface IntelligenceSourceStatus {
  name: string;
  ok: boolean;
  count: number;
  seedFallback: boolean;
}

export interface IntelligenceDataSnapshot {
  attendance: AttendanceInput[];
  leave: LeaveInput[];
  pipeline: PipelineInput[];
  interviews: InterviewInput[];
  employees: HeadcountInput[];
  goals: GoalInput[];
  surveys: EngagementInput[];
  offboarding: OffboardingInput[];
  documents: DocumentInput[];
  expenses: Expense[];
  workflowTasks: TaskInput[];
  onboardingTasks: TaskInput[];
  sources: IntelligenceSourceStatus[];
}

export interface IntelligenceDataAdapter {
  load(): Promise<IntelligenceDataSnapshot>;
}

async function settle<T>(
  name: string,
  seedFallback: boolean,
  loader: () => Promise<T[]>,
): Promise<{ source: IntelligenceSourceStatus; rows: T[] }> {
  try {
    const rows = await loader();
    return { source: { name, ok: true, count: rows.length, seedFallback }, rows };
  } catch {
    return { source: { name, ok: false, count: 0, seedFallback }, rows: [] };
  }
}

/** Session adapter: preserves existing auth/RLS/domain loader behavior. */
export function createSessionIntelligenceDataAdapter(): IntelligenceDataAdapter {
  return {
    async load() {
      const seedFallback = !hasSupabaseEnv();
      const [attendance, leave, employees, goals, surveys, offboarding, documents, expenses] = await Promise.all([
        settle("attendance_records", seedFallback, getAttendanceRecords),
        settle("leave_requests", seedFallback, getLeaveRequests),
        settle("employees", seedFallback, getEmployees),
        settle("goals", seedFallback, getOkrGoals),
        settle("pulse_surveys", seedFallback, getPulseSurveys),
        settle("offboarding_cases", seedFallback, getOffboardingCases),
        settle("documents", seedFallback, getDocuments),
        settle("expense_reports", seedFallback, getExpenses),
      ]);

      let pipeline: PipelineInput[] = [];
      let interviews: InterviewInput[] = [];
      let recruitmentOk = false;
      try {
        const overview = await getRecruitmentOverviewAction();
        if (overview.success) {
          recruitmentOk = true;
          const jobs = new Map(overview.data.jobs.map((job) => [job.id, job.title]));
          const candidates = new Map(overview.data.candidates.map((candidate) => [candidate.id, `${candidate.first_name} ${candidate.last_name}`.trim()]));
          pipeline = overview.data.applications.map((application) => ({
            jobId: application.job_opening_id,
            jobTitle: jobs.get(application.job_opening_id) ?? "Unknown role",
            stage: application.stage,
            stageChangedAt: application.stage_changed_at ?? application.applied_at ?? new Date().toISOString(),
            candidateName: candidates.get(application.candidate_id) ?? "Unknown candidate",
          }));
          const applications = new Map(overview.data.applications.map((application) => [application.id, application]));
          interviews = overview.data.interviews.map((interview) => {
            const application = applications.get(interview.application_id);
            return {
              candidateName: application ? (candidates.get(application.candidate_id) ?? "Unknown candidate") : "Unknown candidate",
              jobTitle: application ? (jobs.get(application.job_opening_id) ?? "Unknown role") : "Unknown role",
              scheduledStart: interview.scheduled_start,
              status: interview.status,
            };
          });
        }
      } catch {
        recruitmentOk = false;
      }

      let workflowTasks: TaskInput[] = [];
      let onboardingTasks: TaskInput[] = [];
      let tasksOk = false;
      try {
        const tasks = await listDailyTasksAction({ pageSize: 200 });
        if (tasks.success) {
          tasksOk = true;
          for (const task of tasks.data.rows) {
            const row = { status: task.status, taskDate: task.taskDate, templateTitle: task.templateTitle ?? undefined };
            if ((task.templateTitle ?? "").toLowerCase().includes("onboard")) onboardingTasks.push(row);
            else workflowTasks.push(row);
          }
        }
      } catch {
        tasksOk = false;
      }

      if (!recruitmentOk) {
        try {
          const candidates = await getCandidates();
          pipeline = candidates.map((candidate) => ({
            jobId: candidate.jobPostingId,
            jobTitle: candidate.role,
            stage: candidate.stage,
            stageChangedAt: new Date().toISOString(),
            candidateName: `${candidate.firstName} ${candidate.lastName}`.trim(),
          }));
        } catch {
          pipeline = [];
        }
      }

      return {
        attendance: attendance.rows.map((row) => ({ employeeName: row.employeeName, workDate: row.workDate, status: row.status })),
        leave: leave.rows.map((row) => ({ employeeName: row.employeeName, type: row.type, startDate: row.startDate, endDate: row.endDate, status: row.status })),
        pipeline,
        interviews,
        employees: employees.rows.map((row) => ({ department: row.department, employmentStatus: row.employmentStatus, startDate: row.startDate })),
        goals: goals.rows.map((row) => ({ employeeName: row.employeeName, title: row.title, status: row.status, dueDate: row.dueDate })),
        surveys: surveys.rows.map((row) => ({ eNPS: row.eNPS, responses: row.responses, status: row.status })),
        offboarding: offboarding.rows.map((row) => ({ employeeName: row.employeeName, exitDate: row.exitDate, status: row.status, tasksDone: row.tasksDone, tasksTotal: row.tasksTotal })),
        documents: documents.rows.map((row) => ({ name: row.name, kind: row.kind, uploadedAt: row.uploadedAt })),
        expenses: expenses.rows,
        workflowTasks,
        onboardingTasks,
        sources: [
          attendance.source,
          leave.source,
          employees.source,
          goals.source,
          surveys.source,
          offboarding.source,
          documents.source,
          expenses.source,
          { name: "applications", ok: recruitmentOk, count: pipeline.length, seedFallback },
          { name: "interviews", ok: recruitmentOk, count: interviews.length, seedFallback },
          { name: "daily_tasks", ok: tasksOk, count: workflowTasks.length + onboardingTasks.length, seedFallback },
        ],
      };
    },
  };
}

function text(row: Record<string, unknown>, key: string, fallback = ""): string {
  return typeof row[key] === "string" ? row[key] as string : fallback;
}

function rowsToTenantSnapshot(rows: Record<IntelligenceTenantTable, Record<string, unknown>[]>, seedFallback = false): IntelligenceDataSnapshot {
  const jobs = new Map(rows.job_openings.map((row) => [text(row, "id"), text(row, "title", "Unknown role")]));
  const candidates = new Map(rows.candidates.map((row) => [text(row, "id"), `${text(row, "first_name")} ${text(row, "last_name")}`.trim() || "Unknown candidate"]));
  const applications = new Map(rows.applications.map((row) => [text(row, "id"), row]));

  const pipeline = rows.applications.map((row) => ({
    jobId: text(row, "job_opening_id"),
    jobTitle: jobs.get(text(row, "job_opening_id")) ?? "Unknown role",
    stage: text(row, "stage", "applied"),
    stageChangedAt: text(row, "stage_changed_at", text(row, "applied_at")),
    candidateName: candidates.get(text(row, "candidate_id")) ?? "Unknown candidate",
  }));
  const interviews = rows.interviews.map((row) => {
    const application = applications.get(text(row, "application_id"));
    return {
      candidateName: application ? (candidates.get(text(application, "candidate_id")) ?? "Unknown candidate") : "Unknown candidate",
      jobTitle: application ? (jobs.get(text(application, "job_opening_id")) ?? "Unknown role") : "Unknown role",
      scheduledStart: text(row, "scheduled_start"),
      status: text(row, "status"),
    };
  });

  const tasks = rows.daily_employee_tasks.map((row) => ({ status: text(row, "status"), taskDate: text(row, "task_date"), templateTitle: text(row, "template_title") || undefined }));
  const onboardingTasks = tasks.filter((task) => (task.templateTitle ?? "").toLowerCase().includes("onboard"));

  const source = (name: string, count: number): IntelligenceSourceStatus => ({ name, ok: true, count, seedFallback });
  return {
    attendance: rows.attendance_records.map((row) => ({ employeeName: text(row, "employee_name"), workDate: text(row, "work_date"), status: text(row, "status", "present") as AttendanceInput["status"] })),
    leave: rows.leave_requests.map((row) => ({ employeeName: text(row, "employee_name", "Unknown"), type: text(row, "type", "pto"), startDate: text(row, "start_date"), endDate: text(row, "end_date"), status: text(row, "status", "pending") as LeaveInput["status"] })),
    pipeline,
    interviews,
    employees: rows.employees.map((row) => ({ department: text(row, "department", "—"), employmentStatus: text(row, "employment_status", text(row, "status", "active")), startDate: text(row, "start_date") })),
    goals: rows.goals.map((row) => ({ employeeName: text(row, "employee_name"), title: text(row, "title"), status: text(row, "status", "not_started"), dueDate: text(row, "due_date") })),
    surveys: rows.pulse_surveys.map((row) => ({ eNPS: typeof row.enps === "number" ? row.enps : null, responses: Number(row.responses ?? 0), status: text(row, "status", "draft") })),
    offboarding: rows.offboarding_cases.map((row) => ({ employeeName: text(row, "employee_name"), exitDate: text(row, "exit_date"), status: text(row, "status", "planned"), tasksDone: Number(row.tasks_done ?? 0), tasksTotal: Number(row.tasks_total ?? 0) })),
    documents: rows.documents.map((row) => ({ name: text(row, "name"), kind: text(row, "kind"), uploadedAt: text(row, "uploaded_at") })),
    expenses: rows.expense_reports.map((row) => ({
      id: text(row, "id"), employeeName: text(row, "employee_name"), merchant: text(row, "merchant"),
      category: text(row, "category"), amount: Number(row.amount ?? 0), currency: text(row, "currency", "USD"),
      status: text(row, "status", "pending") as Expense["status"],
    })),
    workflowTasks: tasks.filter((task) => !onboardingTasks.includes(task)),
    onboardingTasks,
    sources: [
      source("attendance_records", rows.attendance_records.length), source("leave_requests", rows.leave_requests.length), source("employees", rows.employees.length), source("goals", rows.goals.length), source("pulse_surveys", rows.pulse_surveys.length), source("offboarding_cases", rows.offboarding_cases.length), source("documents", rows.documents.length), source("expense_reports", rows.expense_reports.length), source("applications", rows.applications.length), source("interviews", rows.interviews.length), source("daily_tasks", rows.daily_employee_tasks.length),
    ],
  };
}

/** Tenant adapter: reads only through H2's pinned, bounded capability surface. */
export function createTenantIntelligenceDataAdapter(context: IntelligenceTenantContext): IntelligenceDataAdapter {
  const tables: IntelligenceTenantTable[] = ["attendance_records", "leave_requests", "employees", "goals", "pulse_surveys", "offboarding_cases", "documents", "expense_reports", "candidates", "applications", "interviews", "job_openings", "daily_employee_tasks"];
  return {
    async load() {
      const results = await Promise.all(tables.map(async (table) => {
        try {
          const columns = table === "candidates"
            ? "id, first_name, last_name"
            : table === "job_openings"
              ? "id, title"
              : table === "applications"
                ? "id, candidate_id, job_opening_id, stage, stage_changed_at, applied_at"
                : table === "interviews"
                  ? "application_id, scheduled_start, status"
                  : table === "attendance_records"
                    ? "employee_name, work_date, status"
                    : table === "leave_requests"
                      ? "employee_name, type, start_date, end_date, status"
                      : table === "employees"
                        ? "department, employment_status, status, start_date"
                        : table === "goals"
                          ? "employee_name, title, status, due_date"
                          : table === "pulse_surveys"
                            ? "enps, responses, status"
                            : table === "offboarding_cases"
                              ? "employee_name, exit_date, status, tasks_done, tasks_total"
                              : table === "documents"
                                ? "name, kind, uploaded_at"
                                : "id, employee_name, merchant, category, amount, currency, status";
          return [table, await context.readRows(table, columns, 500)] as const;
        } catch {
          return [table, []] as const;
        }
      }));
      const rows = Object.fromEntries(results) as Record<IntelligenceTenantTable, Record<string, unknown>[]>;
      return rowsToTenantSnapshot(rows);
    },
  };
}
