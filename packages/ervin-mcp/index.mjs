#!/usr/bin/env node
/**
 * @tryervin/mcp — stdio MCP server for Ervin.
 *
 * This is a thin PROXY: it connects (as an MCP client) to Ervin's hosted
 * Streamable HTTP endpoint using your `ERVIN_API_KEY`, and re-exposes the exact
 * same tools over stdio. No tool logic is duplicated here — tools/list and
 * tools/call are relayed to the server, so the tool set always matches.
 *
 * Env:
 *   ERVIN_API_KEY  (required)  your `ervin_sk_…` key
 *   ERVIN_MCP_URL  (optional)  override the endpoint (default: hosted)
 */
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { CallToolRequestSchema, ListToolsRequestSchema } from "@modelcontextprotocol/sdk/types.js";

const apiKey = process.env.ERVIN_API_KEY;
const url = process.env.ERVIN_MCP_URL || "https://app.tryervin.com/api/mcp";

if (!apiKey) {
  console.error("[ervin-mcp] ERVIN_API_KEY is required. Mint one with `npm run key:create` on the server.");
  process.exit(1);
}

async function main() {
  // Connect upstream to the hosted Streamable HTTP endpoint with the Bearer key.
  const client = new Client({ name: "ervin-stdio-proxy", version: "1.0.0" });
  const upstream = new StreamableHTTPClientTransport(new URL(url), {
    requestInit: { headers: { Authorization: `Bearer ${apiKey}` } },
  });
  await client.connect(upstream);

  // Re-expose the same tools over stdio by relaying both requests.
  const server = new Server({ name: "ervin", version: "1.0.0" }, { capabilities: { tools: {} } });
  server.setRequestHandler(ListToolsRequestSchema, () => client.listTools());
  server.setRequestHandler(CallToolRequestSchema, (req) =>
    client.callTool({ name: req.params.name, arguments: req.params.arguments ?? {} }),
  );

  await server.connect(new StdioServerTransport());
  console.error("[ervin-mcp] connected — proxying stdio ⇄", url);
}

main().catch((err) => {
  console.error("[ervin-mcp] fatal:", err?.message ?? err);
  process.exit(1);
});
