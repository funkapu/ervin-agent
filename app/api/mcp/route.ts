import { createMcpHandler } from "mcp-handler";
import { NextResponse } from "next/server";
import { bearerFromRequest, resolveAccount } from "@/lib/auth/api-key";
import { registerErvinTools } from "@/lib/mcp/tools";

export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * Ervin MCP server — Streamable HTTP, stateless JSON. Every request must carry a
 * valid `Authorization: Bearer ervin_sk_…`; the resolved account scopes all
 * tools so a connection only ever sees its own runs.
 */
async function handle(req: Request): Promise<Response> {
  const account = await resolveAccount(bearerFromRequest(req));
  if (!account) {
    return NextResponse.json(
      { error: "Unauthorized. Provide a valid Ervin API key: Authorization: Bearer ervin_sk_…" },
      { status: 401, headers: { "WWW-Authenticate": 'Bearer realm="ervin"' } },
    );
  }

  const handler = createMcpHandler(
    (server) => registerErvinTools(server, account.id),
    { serverInfo: { name: "ervin", version: "1.0.0" } },
    { basePath: "/api", disableSse: true, maxDuration: 60 },
  );

  return handler(req);
}

export { handle as DELETE, handle as GET, handle as POST };
