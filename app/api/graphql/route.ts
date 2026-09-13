import { createYoga } from "graphql-yoga";
import { makeExecutableSchema } from "@graphql-tools/schema";
import { typeDefs, resolvers } from "@/lib/graphql/schema";
import { graphqlAuthorizationError, requireGraphqlContext } from "@/lib/graphql/security";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const schema = makeExecutableSchema({ typeDefs, resolvers });

const { handleRequest } = createYoga({
  schema,
  graphqlEndpoint: "/api/graphql",
  fetchAPI: { Response },
});

async function authorizedRequest(request: Request): Promise<Response> {
  try {
    // This is the GraphQL trust boundary. The broad schema contains HR,
    // payroll, recruiting, document, audit and screening data, so every
    // operation requires a canonical authenticated HR_ADMIN/SUPER_ADMIN
    // membership before Yoga parses or executes the operation.
    await requireGraphqlContext();
    return handleRequest(request, {});
  } catch (error) {
    return graphqlAuthorizationError(error);
  }
}

export async function GET(request: Request): Promise<Response> {
  return authorizedRequest(request);
}

export async function POST(request: Request): Promise<Response> {
  return authorizedRequest(request);
}
