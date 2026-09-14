import { normalizeScimRoleCode } from "@/lib/scim/roles";

describe("SCIM canonical role mapping", () => {
  it.each([
    ["employee", "member"],
    ["member", "member"],
    ["manager", "manager"],
    ["hr_admin", "admin"],
    ["admin", "admin"],
    ["owner", "owner"],
    ["super_admin", "owner"],
  ] as const)("maps %s to canonical %s", (input, expected) => {
    expect(normalizeScimRoleCode(input)).toBe(expected);
  });

  it("fails safe to the least-privileged canonical role for unknown input", () => {
    expect(normalizeScimRoleCode("employee_admin")).toBe("member");
    expect(normalizeScimRoleCode(undefined)).toBe("member");
  });
});
