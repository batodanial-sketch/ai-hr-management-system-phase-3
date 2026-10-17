import { test } from "../fixtures/customTest";
import { createAdminClient } from "../utils/supabase-test-seed";
import { cleanupPayrollData, seedPayrollData, RUN_001, RUN_002 } from "../utils/domain-seed";
import { E2E_EMP_ONE, E2E_EMP_TWO, E2E_EMP_THREE } from "../utils/supabase-test-seed";

/**
 * Payroll suite: global run execution, row calculation assertions and
 * multi-currency verification against seeded draft runs and line items.
 */
test.describe("Payroll", () => {
  test.beforeAll(async () => {
    await seedPayrollData(createAdminClient());
  });

  test.afterAll(async () => {
    await cleanupPayrollData(createAdminClient());
  });

  test("executes the global run and verifies row calculations", async ({
    payrollPage,
  }) => {
    await payrollPage.goto();

    await payrollPage.executeRun();
    await payrollPage.expectRunStatus(RUN_001, "completed");

    // net = gross - deductions for every USD line.
    await payrollPage.expectLineBalances(E2E_EMP_ONE);
    await payrollPage.expectLineBalances(E2E_EMP_TWO);

    await payrollPage.expectLineNet(E2E_EMP_ONE, 4000);
    await payrollPage.expectLineNet(E2E_EMP_TWO, 4800);
  });

  test("verifies multi-currency run isolation", async ({ payrollPage }) => {
    await payrollPage.goto();

    await payrollPage.selectCurrency("EUR");
    await payrollPage.expectCurrencyIndicator("EUR");
    await payrollPage.expectLineNet(E2E_EMP_THREE, 3200);

    await payrollPage.selectCurrency("USD");
    await payrollPage.expectCurrencyIndicator("USD");
  });
});
