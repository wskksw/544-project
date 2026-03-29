# AIMC Manual Test Sequence

This document is a full end-to-end manual test plan for the two-portal platform.

## 0. Preconditions

1. Run `npm install`.
2. Run `npm run dev`.
3. Open `http://localhost:3000/researcher`, `http://localhost:3000/researcher/surveys`, and `http://localhost:3000/study`.
4. Optional reset: delete `data/aimc.sqlite` before boot if you want a clean run.

Expected:
- App boots without error.
- Researcher console and participant login pages load.

## 1. Researcher Console Smoke Test

1. Open `/researcher`.
2. Verify sections render:
- Participant Population
- Counterbalance Matrix (12 Cells)
- Participant Dashboard
- Link/button to Survey Area

Expected:
- 12 matrix cells are visible (6 under scenario_1 first, 6 under scenario_2 first).
- No runtime errors in browser console.

## 2. Populate To Target N

1. Set `Target N = 24`.
2. Click `Populate To Target N`.

Expected:
- Success message indicates participants were created up to total `24`.
- Dashboard shows 24 participants with access codes.
- Matrix fill is balanced across the 12 cells.

## 3. Target N Lock Test

1. After first population run, verify `Target N` input is disabled.
2. Click `Populate To Target N` again.

Expected:
- No new participants are created when already at target N.
- Target N remains locked.
- Auto-assignment continues to least-filled cell.

## 4. Participant Login and Resume Entry

1. Copy any access code from the dashboard.
2. Open `/study`.
3. Enter access code and click `Continue Study`.

Expected:
- Redirects to `/study/<ACCESS_CODE>`.
- Workspace opens current session.
- Header shows access code.

## 5. Condition Block Execution (All Core Paths)

Use one participant session and progress through all six trials. Validate each condition branch at least once.

### 5A. Drafter Path

1. In `scenario_intro`, confirm elapsed timer is `0s`.
2. Click `Start When Ready`.
3. Enter 3 bullets.
4. Click `Generate Draft`.
5. Confirm editor fills with AI draft.
6. Edit draft.
7. Click `Continue to Post-Condition Survey`.
8. Fill required survey fields.
9. Click `Submit Condition + Continue`.

Expected:
- Transition sequence follows drafter states.
- Elapsed timer starts only after `Start When Ready`.
- Trial status updates to completed.
- Next trial enters `scenario_intro`.

### 5B. Revisor Path

1. In `scenario_intro`, click `Start When Ready`.
2. Write a full human draft.
3. Click `Get Revision Suggestions`.
4. Apply one `accept`, one `modify`, one `reject` action if available.
5. Continue to final edit.
6. Continue to post-condition survey.
7. Submit condition survey.

Expected:
- Suggestions render and actions persist without error.
- Trial advances to next block after submit.

### 5C. Facilitator Path

1. In `scenario_intro`, click `Start When Ready`.
2. Enter at least 3 bullets.
3. Start reflection questions.
4. Answer at least one question.
5. Generate reflection summary.
6. Continue to independent drafting.
7. Optional branch: test `Get Optional High-Level Feedback`, then continue.
8. Continue to post-condition survey and submit.

Expected:
- Full facilitator path works.
- Optional feedback branch works.

## 6. Final Post-Study Survey Gate

1. Complete all six trials (`2 scenarios x 3 roles`).
2. After final trial submit, verify session does not instantly complete.
3. Verify dedicated final post-study survey page appears.
4. Fill required final survey fields.
5. Submit final survey.

Expected:
- Session transitions to completion only after final survey submission.
- Completion screen shows compensation/completion code (`AIMC-XXXXXXXX`).

## 7. Participant Resume Behavior

1. During an active session, close tab mid-trial.
2. Re-open `/study` and login with same code.

Expected:
- User resumes same session and trial/state.
- No new participant/session is created.

## 8. Survey Area Functional Test

1. In `/researcher/surveys`, edit `Per-Condition Template`:
- Add one required `open_text` item with unique ID.
2. Click `Save Survey Templates`.
3. Reload participant in `post_condition_survey` state.

Expected:
- New question appears immediately in per-condition survey.
- Submission blocked if required field left empty.

4. Edit `Post-Study Template`:
- Add a required `multiple_choice` item with 3 options.
5. Save templates.
6. Reach final post-study survey in participant flow.

Expected:
- New post-study question is visible and required before final submit.

## 9. Participant Label Editing Test

1. In participant dashboard, edit one participant label inline.
2. Click `Save Label`.

Expected:
- Label update succeeds and persists after refresh.
- Access code and completion progress remain unchanged.

## 10. Data Export Verification

1. Click `Export Participants CSV` in participant dash.
Expected:
- CSV downloads with participant, assignment, and progress columns.

2. Click `Export Survey CSV` in survey area.
Expected:
- CSV downloads with per-condition and post-study response rows.

3. Click `Export Full JSON` in survey area.
4. Inspect payload for these tables:
- `participants`
- `assignments`
- `sessions`
- `trial_plan`
- `surveys`
- `post_study_surveys`
- `survey_templates`

Expected:
- New participant/session rows exist.
- Per-condition and post-study survey data both present.
- Template edits are persisted in `survey_templates`.

## 11. Playground Regression Check

1. Open `/researcher/playground`.
2. Launch one session per condition.
3. Validate each opens `/session/<id>` and remains functional.

Expected:
- Playground still works after refactor.
- No impact on participant access-code flow.

## 12. Negative and Edge Cases

1. In `/study`, submit empty access code.
Expected: validation error.

2. Submit unknown access code.
Expected: API/login error and no crash.

3. In participant population setup, set invalid `Target N` (e.g., `25`) on a fresh DB.
Expected: server error `Target N must be a positive multiple of 12`.

4. Attempt per-condition submit with missing required survey answer.
Expected: client validation blocks submit.

5. Attempt final survey submit with missing required answer.
Expected: client validation blocks submit.

## 13. Build/Quality Gate

1. Run `npm run lint`.
2. Run `npm run build`.

Expected:
- Both succeed.

## 14. Sign-Off Checklist

Mark complete when all are true:
- [ ] Access-code login is the primary participant entry flow.
- [ ] 12-cell matrix is visible and auto-assignment balances cells.
- [ ] Target N locks after first population.
- [ ] Participant dashboard shows completion progress.
- [ ] Participant labels are editable in dashboard.
- [ ] Per-condition and post-study surveys are clearly separated in runtime.
- [ ] Survey templates are editable from survey area and reflected in participant UI.
- [ ] Full run completes only after final post-study survey.
- [ ] Export includes new survey/template tables.
