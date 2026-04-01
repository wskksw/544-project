# AIMC Study Platform

Next.js + SQLite implementation of the three-scenario AIMC experiment with:
- Participant access-code login (`/study`)
- Researcher console for assignment, matrix monitoring, survey editing, and export (`/researcher`)
- Three condition-controlled writing workflows: `thought_partner`, `editor`, `ghost_writer`

## Run

```bash
npm install
npm run dev
```

Open:
- `http://localhost:3000/study`
- `http://localhost:3000/researcher`
- `http://localhost:3000/researcher/playground`

## Environment

Optional `.env.local`:

```bash
OPENAI_API_KEY=...
AIMC_MODEL=gpt-5-mini
AIMC_TARGET_N=18
```

If `OPENAI_API_KEY` is missing, mock AI outputs are used.

## Study Design

- Short no-AI onboarding practice round before the real study
- Within-subjects
- `3` trials per participant
- `3` seeded scenarios (`scenario_a`, `scenario_b`, `scenario_c`)
- `3` conditions (`thought_partner`, `editor`, `ghost_writer`)
- `3` Latin-square sequences
- `Target N` must be a multiple of `3`

Scenario order is fixed as `A -> B -> C`. Each sequence rotates which condition appears in Block 1, Block 2, and Block 3.

## Survey System

Survey templates are stored in SQLite (`survey_templates`) and edited from `/researcher`.

Template IDs:
- `per_condition`
- `post_study`

Default survey content:
- `per_condition`
- Sender-side perceived authenticity: `3` items, `7`-point Likert
- Manipulation check (perceived AI contribution): `3` items, `7`-point Likert
- Cognitive effort: `3` NASA-TLX subset items (`mental demand`, `effort`, `frustration`) on a reduced `7`-point scale
- Satisfaction / willingness to send: `1` item, `7`-point Likert
- `post_study`
- Overall preference ranking across `Thought Partner`, `Editor`, and `Ghost-writer`
- Optional open-text rationale (`1-2` sentences)

Supported item types:
- `likert`
- `open_text`
- `multiple_choice`
- `ranking`

Per-condition items can optionally be filtered by condition (`all`, `thought_partner`, `editor`, `ghost_writer`).

## Data + Export

SQLite file:
- `data/aimc.sqlite`

Export endpoints:
- `GET /api/researcher/export/procedural-csv`
- `GET /api/researcher/export/surveys-csv`
- `GET /api/researcher/export`

Tables include:
- `participants`, `assignments`, `sessions`, `trial_plan`
- `events`, `ai_calls`, `editor_suggestions`, `thought_partner_reflections`
- `surveys`, `post_study_surveys`, `survey_templates`, `trial_metrics`

Current `trial_metrics` fields:
- `completion_time_sec`
- `word_count`
- `keystroke_count`
- `self_authored_text_ratio`
- `suggestion_acceptance_rate`
- `ghost_writer_edit_count`
- `reflection_duration_sec`

## Schema Reset Note

The app uses a schema-versioned bootstrap in [`lib/db.ts`](/Users/kevin/school/544-hci/544-project/lib/db.ts).
When the schema version changes or required tables are missing, the local database is recreated from scratch.

## Flow Diagrams + Testing

- Participant flow: `userside_flow.md`
- Researcher flow: `researcher_flow.md`
- Manual E2E test sequence: `manual_test_sequence.md`
