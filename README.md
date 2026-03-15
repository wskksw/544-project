# AIMC Study Prototype

Next.js + SQLite implementation of the AIMC within-subjects experiment with three AI roles:
- `drafter`
- `revisor`
- `facilitator`

## Run

```bash
npm install
npm run dev
```

Open:
- `http://localhost:3000/researcher` (researcher control panel)
- `http://localhost:3000/researcher/playground` (single-condition sandbox testing)

## Environment

Optional `.env.local`:

```bash
OPENAI_API_KEY=...
AIMC_MODEL=gpt-5-mini
AIMC_TARGET_N=18
```

If `OPENAI_API_KEY` is missing, mock AI outputs are used so the workflow still runs.

## Implemented Requirements

- Registration-time counterbalancing with scenario-order crossing and quota enforcement (`target N` must be a multiple of 6)
- Shared writing workspace with persistent scenario checklist, same editor, same side-panel container
- Condition controller with constrained role workflows
- Shared state machine + timestamped transition logging
- First-class logging tables in SQLite (events, AI calls, revisor suggestion actions, facilitator reflections, surveys)
- Facilitator server-side schema validation (JSON structure enforced with Zod)
- Researcher control panel for assignment, session monitoring, export, and playground testing
- Scenario content loaded from editable `data/scenarios.json`

## Data Storage

SQLite file path:
- `data/aimc.sqlite`

Export endpoint:
- `GET /api/researcher/export`
