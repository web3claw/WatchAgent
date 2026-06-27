# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

WatchAgent is an eve framework agent — a filesystem-first framework for durable backend AI agents. The agent is compiled and run from files on disk. It includes a Next.js web chat UI channel.

## Commands

```bash
npm run typecheck    # Type-check the project (tsc --noEmit)
npm run build        # Production build (next build)
npm run dev          # Dev server (next dev) — for the web chat UI only
npm exec -- eve dev  # Eve HMR dev server with agent REPL (interactive terminal)
npm exec -- eve dev --no-ui  # Eve dev server without terminal UI (for background/verification)
```

To verify the agent works: run `npm exec -- eve dev --no-ui`, wait for the server URL, then exercise the HTTP API:
- `POST /eve/v1/session` — create a session
- `GET /eve/v1/session/:id/stream` — attach to stream
- Use the returned `continuationToken` for follow-up messages

## Architecture

### Eve filesystem layout (`agent/`)

Eve discovers capabilities by walking the `agent/` directory. **Filename = identity** — no `name` or `id` fields needed.

| Path | Purpose |
|---|---|
| `agent/agent.ts` | Runtime config via `defineAgent` (model, reasoning, compaction) |
| `agent/instructions.md` | Always-on system prompt (required on root agent) |
| `agent/tools/*.ts` | Typed tools using `defineTool` from `eve/tools` + Zod `inputSchema` |
| `agent/connections/*.ts` | External service connections (MCP, OpenAPI) |
| `agent/skills/*.md` | On-demand procedures the model loads when relevant |
| `agent/channels/` | Messaging integrations (HTTP is built-in) |
| `agent/schedules/*.ts` | Recurring jobs via `defineSchedule` |
| `agent/subagents/*/` | Specialist child agents (each has its own `agent.ts`) |
| `agent/lib/` | Shared helper code (import-only, not mounted in sandbox) |
| `agent/hooks/` | Lifecycle and stream-event subscribers |

### Key imports

- `defineAgent` from `"eve"` — agent config
- `defineTool` from `"eve/tools"` — tool definitions
- `z` from `"zod"` — input/output schemas
- `always` / `once` / `"never"` from `"eve/tools/approval"` — human-in-the-loop gating

### App layer (Next.js web chat)

Standard Next.js 16 app under `app/` with AI Elements components in `components/ai-elements/` and shadcn/ui primitives in `components/ui/`.

## Source of Truth

The eve framework's complete documentation is bundled at `node_modules/eve/docs/`. **Always read the bundled docs before writing eve code** — they match the installed version exactly. Start with `node_modules/eve/docs/README.md` for the full index. Do not rely on training data for eve API details.

Key doc files to start with:
- `node_modules/eve/docs/agent-config.md` — `defineAgent` options
- `node_modules/eve/docs/tools/overview.mdx` — defining tools
- `node_modules/eve/docs/reference/project-layout.md` — full slot table
- `node_modules/eve/docs/reference/typescript-api.md` — all exported types

## Current Agent Config

Model: `anthropic/claude-sonnet-4.6` (in `agent/agent.ts`)
