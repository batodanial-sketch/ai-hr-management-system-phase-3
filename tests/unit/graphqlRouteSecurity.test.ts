jest.mock("server-only", () => ({}), { virtual: true });
jest.mock("react", () => ({ ...jest.requireActual("react"), cache: (fn: unknown) => fn }));
jest.mock("@graphql-tools/schema", () => ({ makeExecutableSchema: jest.fn(() => ({})) }));
jest.mock("graphql-yoga", () => ({
  createYoga: jest.fn(() => ({ handleRequest: jest.fn(async () => new Response("graphql-ok", { status: 200 })) })),
}));
jest.mock("@/lib/graphql/schema", () => ({ typeDefs: "type Query { ok: Boolean }", resolvers: {} }));
jest.mock("@/lib/graphql/security", () => ({
  requireGraphqlContext: jest.fn(),
  graphqlAuthorizationError: jest.fn((error: { status?: number }) => Response.json({ ok: false }, { status: error.status === 403 ? 403 : 401 })),
}));

import { GET, POST } from "@/app/api/graphql/route";
import { requireGraphqlContext } from "@/lib/graphql/security";

describe("GraphQL HTTP trust boundary", () => {
  beforeEach(() => jest.clearAllMocks());

  it("rejects an unauthenticated request before Yoga executes", async () => {
    (requireGraphqlContext as jest.Mock).mockRejectedValueOnce(Object.assign(new Error("unauthenticated"), { status: 401 }));
    const response = await GET(new Request("http://localhost/api/graphql"));
    expect(response.status).toBe(401);
  });

  it("rejects an under-privileged request before Yoga executes", async () => {
    (requireGraphqlContext as jest.Mock).mockRejectedValueOnce(Object.assign(new Error("forbidden"), { status: 403 }));
    const response = await POST(new Request("http://localhost/api/graphql", { method: "POST", body: "{}" }));
    expect(response.status).toBe(403);
  });

  it("executes only after authorization succeeds", async () => {
    (requireGraphqlContext as jest.Mock).mockResolvedValueOnce({ role: "HR_ADMIN", organizationId: "org-1" });
    const response = await GET(new Request("http://localhost/api/graphql"));
    expect(response.status).toBe(200);
    expect(await response.text()).toBe("graphql-ok");
  });
});
