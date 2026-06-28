# AGENTS.md

High-signal instructions for agents working in this codebase.

## Commands

```bash
npm run typecheck          # tsc --noEmit (fast, do this often)
npm run build              # next build
npm run dev                # Next.js dev server (web chat UI only)
npm exec -- eve dev        # Eve HMR dev server with agent REPL
npm exec -- eve dev --no-ui  # Eve headless (for verification/scripts)
```

No `npm test` or `npm run lint` — there is no test suite or linter configured.

## Eve framework — read the bundled docs

**Always** read `node_modules/eve/docs/` before writing eve code. The bundled docs match the installed version exactly. Training data is unreliable for eve APIs.

Start with:
- `node_modules/eve/docs/agent-config.md` — `defineAgent` options
- `node_modules/eve/docs/tools/overview.mdx` — defining tools
- `node_modules/eve/docs/reference/project-layout.md` — full slot table
- `node_modules/eve/docs/reference/typescript-api.md` — all exported types

## Eve filesystem layout (`agent/`)

Eve discovers capabilities by walking the `agent/` directory. **Filename = identity** — no `name` or `id` fields needed.

| Path | Purpose |
|---|---|
| `agent/agent.ts` | Runtime config via `defineAgent` (model, context window) |
| `agent/instructions.md` | Always-on system prompt (required on root agent) |
| `agent/tools/*.ts` | Typed tools using `defineTool` from `eve/tools` + Zod `inputSchema` |
| `agent/schedules/*.ts` | Recurring jobs via `defineSchedule` |
| `agent/channels/` | Messaging integrations (HTTP is built-in) |

Key imports:
- `defineAgent` from `"eve"` — agent config
- `defineTool` from `"eve/tools"` — tool definitions
- `z` from `"zod"` — input/output schemas
- `always` / `once` / `"never"` from `"eve/tools/approval"` — human-in-the-loop gating

## Model config — trust the code, not the docs

`CLAUDE.md` says the model is `anthropic/claude-sonnet-4.6`, but `agent/agent.ts` actually configures **`GLM-5.2`** via edgefn (`https://api.edgefn.net/v1`). The code is the source of truth.

## Project structure

| Directory | Purpose |
|---|---|
| `agent/` | Eve agent config, tools, schedules |
| `app/` | Next.js 16 app (web chat UI + API routes) |
| `components/` | AI Elements + shadcn/ui components |
| `lib/` | Shared utility functions |

API routes (all GET, browser-triggerable):
- `/api/trigger` — yuanjisong.com monitoring
- `/api/trigger-huzhan` — huzhan.com monitoring
- `/api/trigger-r5` — r5.cn monitoring
- `/api/checkin` — 69yun69 daily check-in

## Import convention

`package.json` defines path aliases: `"#*": "./agent/*"`. Agent code imports like `#tools/fetch_jobs` (resolves to `./agent/tools/fetch_jobs`).

## Next.js + Eve integration

`next.config.ts` wraps the config with `withEve` from `"eve/next"`. This is required for eve to work alongside Next.js.

## Runtime requirements

- Node.js 24.x (`engines.node: "24.x"` in package.json)
- TypeScript 6.0.3
- Next.js 16
- Eve ^0.16.0

## Environment variables

Required for full functionality:
- `OPENAI_API_KEY` — used by edgefn provider in `agent/agent.ts`
- `FIRECRAWL_API_KEY` — for yuanjisong.com scraping (TLS fingerprint bypass)
- `KV_REST_API_URL` / `KV_REST_API_TOKEN` — Upstash Redis (Vercel KV)
- `TELEGRAM_BOT_TOKEN` / `TELEGRAM_CHAT_ID` — Telegram notifications
- `YUN69_EMAIL` / `YUN69_PASSWORD` — 69yun69 account (optional)

## Gotchas

- No test suite or linter — `typecheck` is the only verification command
- `.eve/`, `.vercel/`, `.workflow-data/` are gitignored
- Anti-scraping: yuanjisong.com requires Firecrawl (TLS fingerprint detection); huzhan.com and r5.cn use native fetch (no anti-bot)
