# Connect Ervin over MCP

Ervin exposes its bug→deploy loop as MCP tools so agents in **Cursor, Claude Code, Claude Desktop, or a terminal** can file bugs, watch runs, and approve/roll back — all scoped to your account.

Tools: `ervin_create_run`, `ervin_list_runs`, `ervin_get_run`, `ervin_get_run_diff`, `ervin_approve_run`, `ervin_reject_run`, `ervin_rollback_run`, `ervin_find_similar_runs`.

## 1. Get an API key

Keys are per-account and shown **once**. From the server:

```bash
npm run key:create -- --account "Your Company"
# → ervin_sk_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx   (store it now)
```

Use it as `Authorization: Bearer ervin_sk_…` (remote) or `ERVIN_API_KEY` (stdio). Treat it like a password.

There are two ways to connect. **Remote (Streamable HTTP)** is simplest — point the client at the hosted URL with your Bearer key. **Local (stdio)** runs a tiny proxy via `npx @tryervin/mcp` that relays to the same endpoint (handy for clients that only do stdio).

- Hosted URL: `https://app.tryervin.com/api/mcp`  ·  Local dev: `http://localhost:3000/api/mcp`

---

## Cursor

`~/.cursor/mcp.json` (global) or `.cursor/mcp.json` (per-project).

**Remote (HTTP):**
```json
{
  "mcpServers": {
    "ervin": {
      "url": "https://app.tryervin.com/api/mcp",
      "headers": { "Authorization": "Bearer ervin_sk_YOUR_KEY" }
    }
  }
}
```

**Local (stdio):**
```json
{
  "mcpServers": {
    "ervin": {
      "command": "npx",
      "args": ["-y", "@tryervin/mcp"],
      "env": { "ERVIN_API_KEY": "ervin_sk_YOUR_KEY" }
    }
  }
}
```

---

## Claude Code

**Remote (HTTP)** — one command:
```bash
claude mcp add --transport http ervin https://app.tryervin.com/api/mcp \
  --header "Authorization: Bearer ervin_sk_YOUR_KEY"
```

**Local (stdio):**
```bash
claude mcp add ervin --env ERVIN_API_KEY=ervin_sk_YOUR_KEY -- npx -y @tryervin/mcp
```

Or commit a project `.mcp.json`:
```json
{
  "mcpServers": {
    "ervin": {
      "type": "http",
      "url": "https://app.tryervin.com/api/mcp",
      "headers": { "Authorization": "Bearer ervin_sk_YOUR_KEY" }
    }
  }
}
```

---

## Claude Desktop

Edit `claude_desktop_config.json` (Settings → Developer → Edit Config; macOS: `~/Library/Application Support/Claude/claude_desktop_config.json`, Windows: `%APPDATA%\Claude\claude_desktop_config.json`), then restart Claude Desktop.

**Local (stdio) — recommended:**
```json
{
  "mcpServers": {
    "ervin": {
      "command": "npx",
      "args": ["-y", "@tryervin/mcp"],
      "env": { "ERVIN_API_KEY": "ervin_sk_YOUR_KEY" }
    }
  }
}
```

For a **remote** HTTP connection, add Ervin as a custom connector in Settings → Connectors with the URL `https://app.tryervin.com/api/mcp` and the `Authorization: Bearer …` header.

---

## Verify with MCP Inspector

```bash
# Remote (HTTP):
npx @modelcontextprotocol/inspector
#   → Transport: "Streamable HTTP", URL: https://app.tryervin.com/api/mcp
#   → Authentication: Header "Authorization", Value "Bearer ervin_sk_YOUR_KEY"

# Local (stdio):
ERVIN_API_KEY=ervin_sk_YOUR_KEY npx @modelcontextprotocol/inspector npx -y @tryervin/mcp
```

You should see all 8 `ervin_` tools. Try `ervin_list_runs` (read-only) first.

---

## Notes

- **Auth is mandatory.** Every MCP request needs a valid key; missing/invalid → `401`. A connection only ever sees its own account's runs.
- **`ervin_approve_run` is the only path to merge** and is annotated `destructive` — clients should confirm before calling it. `ervin_rollback_run` opens a revert PR (also `destructive`).
- **stdio env override:** set `ERVIN_MCP_URL` to point the proxy at a non-default endpoint (e.g. `http://localhost:3000/api/mcp` for local dev).
- **Publishing the stdio package:** `cd packages/ervin-mcp && npm publish --access public` (publishes `@tryervin/mcp`).
