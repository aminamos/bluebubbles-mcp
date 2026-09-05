# BlueBubbles MCP Server

Model Context Protocol (MCP) server for interacting with a self-hosted
[BlueBubbles](https://bluebubbles.app/) iMessage bridge server. Exposes tools
to read conversations, fetch messages, send texts, and add reactions — all from
any AI agent or tool that speaks MCP.

## Requirements

- A running BlueBubbles server (macOS, with iMessage access)
- `BLUEBUBBLES_PASSWORD` — the server password set in BlueBubbles Server app
- **Deno ≥ 1.40** or **Node.js ≥ 20** (see [Running](#running))

## Features & Tools

| Tool | Description |
|---|---|
| `bluebubbles_status` | Server health check + macOS / server metadata |
| `bluebubbles_list_chats` | List/query active iMessage conversations with pagination |
| `bluebubbles_get_chat` | Get detailed info and participants for a specific chat GUID |
| `bluebubbles_list_messages` | Fetch or search messages across all chats or within a specific chat |
| `bluebubbles_get_contacts` | Retrieve contacts and handles |
| `bluebubbles_send_message` | Send a text to a chat GUID or phone number |
| `bluebubbles_send_reaction` | Send a Tapback (love/like/dislike/laugh/emphasize/question) |

## Configuration

Environment variables:

| Variable | Description | Default |
|---|---|---|
| `BLUEBUBBLES_URL` | Base URL of your BlueBubbles server | `http://127.0.0.1:12345` |
| `BLUEBUBBLES_PASSWORD` | Server password (required) | _(unset)_ |
| `BLUEBUBBLES_TIMEOUT_MS` | HTTP timeout in milliseconds | `15000` |

> **Port:** BlueBubbles Server defaults to port `12345`. If yours uses a different
> port, set `BLUEBUBBLES_URL` explicitly.

## Running

### Deno (recommended)

```sh
BLUEBUBBLES_URL=http://your-mac.local:12345 \
BLUEBUBBLES_PASSWORD=your_password \
deno run --allow-env=BLUEBUBBLES_URL,BLUEBUBBLES_PASSWORD,BLUEBUBBLES_TIMEOUT_MS \
         --allow-net src/main.ts
```

Or with a `.env` file and `deno run`:

```sh
cp .env.example .env   # fill in your values
deno run --allow-env --allow-net src/main.ts
```

### Node.js / npm

```sh
npm install
cp .env.example .env   # fill in your values
npm run build
node dist/main.js
```

### npx (zero install)

```sh
npx -y @aminamos/bluebubbles-mcp
```

## Adding to AI agents

### OMP (Oh My Pi)

```sh
omp mcp add bluebubbles -- \
  deno run --allow-env=BLUEBUBBLES_URL,BLUEBUBBLES_PASSWORD,BLUEBUBBLES_TIMEOUT_MS \
            --allow-net PATH/TO/src/main.ts
```

### Claude Code / Codex

```sh
codex mcp add bluebubbles \
  --env BLUEBUBBLES_URL="http://your-mac.local:12345" \
  --env BLUEBUBBLES_PASSWORD="your_password" \
  -- deno run --allow-env=BLUEBUBBLES_URL,BLUEBUBBLES_PASSWORD,BLUEBUBBLES_TIMEOUT_MS \
              --allow-net src/main.ts
```

## Development

```sh
# type-check
deno check src/main.ts

# run tests
deno test --allow-env tests

# format
deno fmt
```

## Security Notes

- This MCP accesses your real iMessages. Only connect to a BlueBubbles server you trust.
- Keep `BLUEBUBBLES_PASSWORD` out of git — use environment variables or a
  `.env` file (already gitignored by this repo).
- The server should be on a trusted network or behind a VPN; it has no built-in
  TLS.
