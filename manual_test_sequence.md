# AIMC Manual Test Sequence

## Preconditions

1. Run `npm install`
2. Run `npm run dev`
3. Open `/researcher`, `/researcher/surveys`, and `/study`

Expected:
- App boots without errors
- Researcher console and participant login both load

## Researcher Console

1. Open `/researcher`
2. Verify sections render:
- Participant Dash
- Latin Square (3 Sequences)
- Participant Dashboard

Expected:
- 3 sequences are visible
- Each sequence shows Scenario A in Block 1, Scenario B in Block 2, and Scenario C in Block 3

## Populate To Target N

1. Set `Target N = 18`
2. Click `Populate To Target N`

Expected:
- 18 participants are created
- Sequence fill is balanced across the 3 sequences
- Dashboard shows progress out of 3 trials per participant

## Target N Validation

1. On a fresh DB, try `Target N = 17`

Expected:
- Server rejects it as not a multiple of 3

## Participant Flow

Use one participant session and progress through all 3 trials.

### Practice Round

1. Open a participant session
2. Confirm the practice intro appears before any real study block
3. Complete the short dummy writing task
4. Submit the practice survey

Expected:
- Practice occurs before Block 1
- No AI is available in practice
- Completing practice opens the first real study block
- Participant progress still reflects only 3 experimental trials

### Ghost-writer

1. In `scenario_intro`, click `Start When Ready`
2. Enter 3-5 bullets
3. Click `Generate Draft`
4. Confirm one draft appears in the editor
5. Edit the draft
6. Continue to the post-condition survey
7. Submit the survey

Expected:
- Only one AI generation is allowed
- Word count is visible
- Soft warning appears below 50 words
- Post-condition survey uses the shared fixed item set described below

### Editor

1. In `scenario_intro`, click `Start When Ready`
2. Write a full draft
3. Click `Get Revision Suggestions`
4. Confirm exactly 4 suggestion cards render
5. Use `accept`, `modify`, and `reject`
6. Continue to final review, then the survey
7. Submit the survey

Expected:
- Suggestion categories are `tone`, `specificity`, `empathy`, `closing_next_step`
- Actions persist without error
- Post-condition survey uses the shared fixed item set described below

### Thought Partner

1. In `scenario_intro`, click `Start When Ready`
2. Enter exactly 3 bullets
3. Start reflection questions
4. Answer all 4 questions one at a time
5. Generate the reflection summary
6. Continue to independent drafting
7. Write the message and continue to final review
8. Submit the survey

Expected:
- Exactly 4 reflective questions appear
- No optional feedback step exists
- AI is unavailable once independent drafting starts
- Post-condition survey uses the shared fixed item set described below

## Fixed Post-Condition Survey Spec

Use the same post-condition survey after each of the 3 experimental conditions.

### Sender-side Perceived Authenticity

- `3` items
- `7`-point Likert
- Adapted from Kernis & Goldman (2006) and AIMC social support literature
- Items:
- `"This message reflects my genuine thoughts and feelings."`
- `"This message preserves my authentic voice as a communicator."`
- `"I could comfortably stand behind this message as representative of me."`

### Manipulation Check: Perceived AI Contribution

- `3` items
- `7`-point Likert
- Items:
- `"AI helped me figure out what to say."`
- `"AI helped me figure out how to say it."`
- `"The final message text was mostly written by me."`

### Cognitive Effort

- NASA-TLX short-form subset using only `3` dimensions: mental demand, effort, frustration
- Original NASA-TLX uses a `21`-point scale; this study uses a reduced `7`-point scale for consistency with the other items
- Items:
- `"How mentally demanding was this condition?"`
- `"How hard did you have to work to complete this condition?"`
- `"How frustrated, stressed, or annoyed did you feel during this condition?"`

### Satisfaction / Willingness To Send

- `1` item
- `7`-point Likert
- Items:
- `"I would feel comfortable sending this message to my friend in a real-life situation."`

## Final Post-Study Survey

1. Complete all 3 trials
2. Verify the final survey appears
3. Confirm the ranking question requires a full ordering
4. Confirm the rationale question is optional
5. Submit the final survey

Expected:
- Session completes only after the final survey
- Completion code is shown
- Final survey contains:
- Ranking: `"Rank the three AI tools from most to least preferred"`
- Optional open-ended rationale: `"Why did you rank them this way? (1-2 sentences)"`

## Behavioral Log Checklist

Target automatic measures for each condition:
- Time to complete (sec)
- Keystroke count
- Self-authored text ratio = participant-typed characters / total characters in final message
- AI suggestion acceptance rate (`editor`)
- Number of edits to AI output (`ghost_writer`)
- Time spent in reflection phase before drafting (`thought_partner`)

Implemented in the current app:
- `completion_time_sec`
- `keystroke_count`
- `self_authored_text_ratio`
- `suggestion_acceptance_rate`
- `ghost_writer_edit_count`
- `reflection_duration_sec`
- `suggestion_total_count`
- `suggestion_accept_count`
- `suggestion_modify_count`
- `suggestion_reject_count`
- `suggestion_applied_count`
- `suggestion_modify_rate`
- `suggestion_applied_rate`

Implementation note:
- `self_authored_text_ratio` is currently approximated as `keystrokeCount / finalMessageLength`, clamped to `0..1`
- `keystroke_count` counts text-editing key presses in the main editor: printable characters, `Enter`, `Backspace`, and `Delete`
- `ghost_writer_edit_count` is counted from those same tracked keystrokes after the Ghost Writer draft is generated, not a semantic diff against AI output
- `suggestion_acceptance_rate` remains strict accepts only; `modify` outcomes are exported separately
- If stricter instrumentation is needed later, validate those two metrics before relying on them analytically

## Export Verification

1. Export participants CSV
2. Export surveys CSV
3. Export full JSON

Expected:
- Participant CSV includes `trial_sequence` instead of `scenario_first`
- Full JSON includes `editor_suggestions`, `thought_partner_reflections`, and `trial_metrics`
- Trial data reflects `thought_partner`, `editor`, and `ghost_writer`
- `trial_metrics` includes the implemented automatic fields listed above

## Quality Gate

1. Run `npm run build`

Expected:
- Build succeeds
