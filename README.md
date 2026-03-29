# AIMC Study Platform

Next.js + SQLite implementation of the AIMC experiment with:
- Participant access-code login (`/study`)
- Researcher console for assignment, matrix monitoring, survey editing, and export (`/researcher`)
- Condition-controlled writing workflows (`drafter`, `revisor`, `facilitator`)

## Run

```bash
npm install
npm run dev
```

Open:
- `http://localhost:3000/study` (participant portal)
- `http://localhost:3000/researcher` (researcher console)
- `http://localhost:3000/researcher/playground` (single-condition sandbox)

## Environment

Optional `.env.local`:

```bash
OPENAI_API_KEY=...
AIMC_MODEL=gpt-5-mini
AIMC_TARGET_N=24
```

If `OPENAI_API_KEY` is missing, mock AI outputs are used.

## What Changed In This Refactor

- Replaced participant/session URL sharing with generated access-code login (`AIMC-XXXX`)
- Upgraded counterbalancing to a 12-cell matrix:
  - `2` scenario-first options (`scenario_1`, `scenario_2`)
  - `6` role-order permutations
- Auto-assignment now always uses least-filled eligible counterbalance cell
- `Target N` is locked after the first participant population
- Added participant dashboard visibility (code, cell, completion progress) with inline label editing
- Separated survey layers:
  - Per-condition survey after every trial block
  - Final post-study survey after all condition blocks
- Trial elapsed time now starts only when participant clicks `Start When Ready`
- Added researcher survey editor for both templates (no code changes required)
- Added post-study completion gate and completion code

## Survey System

Survey templates are stored in SQLite (`survey_templates`) and edited from `/researcher`.

Template IDs:
- `per_condition`
- `post_study`

Supported item types:
- `likert`
- `open_text`
- `multiple_choice`

Per-condition items can optionally be filtered by condition (`all`, `drafter`, `revisor`, `facilitator`).

## Counterbalance Assignment

Population endpoint:
- `POST /api/researcher/populate`
- `PATCH /api/researcher/participants/:participantId` (edit participant label)

Behavior:
- Auto mode: assign least-filled cell under quota (`targetN / 12`)
- `Target N` locks after first population for consistent balancing

## Data + Export

SQLite file:
- `data/aimc.sqlite`

Export endpoint:
- `GET /api/researcher/export`

Tables include:
- `participants`, `assignments`, `sessions`, `trial_plan`
- `events`, `ai_calls`, `revisor_suggestions`, `facilitator_reflections`
- `surveys`, `post_study_surveys`, `survey_templates`

## Schema Reset Note

This refactor ships with a schema-versioned bootstrap in `lib/db.ts`.
If the DB schema is outdated or missing required tables, it is automatically recreated.
This intentionally wipes old local prototype data.

## Flow Diagrams + Testing

- Participant flow: `userside_flow.md`
- Researcher flow: `researcher_flow.md`
- Manual E2E test sequence: `manual_test_sequence.md`
