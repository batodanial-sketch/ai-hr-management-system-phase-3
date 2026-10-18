import { expect, test } from "../fixtures/customTest";
import { createAdminClient, E2E_CAND_ONE, E2E_CAND_TWO, E2E_CAND_THREE } from "../utils/supabase-test-seed";
import { mockAiEvaluation } from "../utils/ai-mocks";

/**
 * Recruitment kanban + Groq AI evaluation suite. Candidates are seeded by
 * global-setup (e2e-cand-001..003) against the e2e-software-engineer-posting.
 */
test.describe("Recruitment kanban", () => {
  // Reset seeded stages so the first test's drag-and-drop doesn't leak into
  // the stage-distribution assertion that follows it.
  test.beforeEach(async () => {
    const admin = createAdminClient();
    const baseline = [
      [E2E_CAND_ONE, "applied"],
      [E2E_CAND_TWO, "interview"],
      [E2E_CAND_THREE, "offer"],
    ] as const;
    for (const [id, stage] of baseline) {
      const { data, error } = await admin
        .from("candidates")
        .update({ stage })
        .eq("id", id)
        .select("id, stage")
        .maybeSingle();
      if (error) throw new Error(`Failed to reset candidate ${id}: ${error.message}`);
      if (data?.stage !== stage) {
        throw new Error(`Candidate ${id} was not reset to stage ${stage}.`);
      }
    }
  });
  test("moves a candidate across stages and triggers an AI evaluation", async ({
    recruitmentKanbanPage,
    page,
  }) => {
    await mockAiEvaluation(page, {
      candidateName: "E2E CandidateOne",
      score: 82,
      summary: "Strong backend fundamentals; screen for final round.",
      recommendation: "advance",
    });

    await recruitmentKanbanPage.goto();
    await recruitmentKanbanPage.expectCandidateInStage("E2E CandidateOne", "applied");

    await recruitmentKanbanPage.dragCardToStage("E2E CandidateOne", "screening");
    await recruitmentKanbanPage.expectCandidateInStage(
      "E2E CandidateOne",
      "screening",
    );
    await expect.poll(async () => {
      const admin = createAdminClient();
      const { data, error } = await admin.from("candidates").select("stage").eq("id", E2E_CAND_ONE).single();
      if (error) throw new Error(`Candidate stage query failed: ${error.message}`);
      return data.stage;
    }).toBe("screening");
    await recruitmentKanbanPage.expectAiEvaluationCard("E2E CandidateOne");

    await recruitmentKanbanPage.dragCardToStage("E2E CandidateOne", "interview");
    await recruitmentKanbanPage.expectCandidateInStage(
      "E2E CandidateOne",
      "interview",
    );
    await expect.poll(async () => {
      const admin = createAdminClient();
      const { data, error } = await admin.from("candidates").select("stage").eq("id", E2E_CAND_ONE).single();
      if (error) throw new Error(`Candidate stage query failed: ${error.message}`);
      return data.stage;
    }).toBe("interview");
  });

  test("verifies seeded stage distribution", async ({ recruitmentKanbanPage }) => {
    await recruitmentKanbanPage.goto();
    await recruitmentKanbanPage.expectCardCount("applied", 1);
    await recruitmentKanbanPage.expectCardCount("interview", 1);
    await recruitmentKanbanPage.expectCardCount("offer", 1);

    const admin = createAdminClient();
    const { data, error } = await admin
      .from("candidates")
      .select("stage")
      .eq("source_tag", "e2e");
    if (error) {
      throw new Error(`Candidate query failed: ${error.message}`);
    }
    const stages = (data ?? []).map((row) => row.stage).sort();
    expect(stages).toEqual(["applied", "interview", "offer"]);
  });
});
