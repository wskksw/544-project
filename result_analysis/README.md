# Result Analysis Notes

This folder contains the analysis notebooks, exported tables, and figures for the paper.

Main sources:
- `paper_analysis.ipynb`: paper-facing quantitative analysis
- `quantitative_analysis.ipynb`: broader analysis notebook, including G*Power notes
- `results_tables/`: exported CSV summaries used below

Sample size for the repeated-measures analyses: `N = 21`

## What The Main Statistics Mean

### Reliability: Cronbach's alpha (`alpha`)

Used for multi-item scales to check whether the items hang together consistently.

Common rule-of-thumb interpretation:
- `< .70`: weak / may be questionable
- `.70-.79`: acceptable
- `.80-.89`: good
- `>= .90`: excellent

Our values:

| Scale | alpha | Interpretation |
|---|---:|---|
| SPMA authenticity composite | 0.850 | Good |
| NASA-TLX short form | 0.895 | Good, close to excellent |

Source: `results_tables/reliability.csv`

### ANOVA

Repeated-measures ANOVA tests whether there is any difference across the 3 conditions overall.

Reported values:
- `F(df1, df2)`: the omnibus test statistic
- `p`: whether the omnibus difference is statistically significant
- `partial eta squared (partial eta^2)`: effect size for the omnibus effect

Common rule-of-thumb interpretation for `partial eta^2`:
- `.01`: small
- `.06`: medium
- `.14`: large

All four omnibus effects here are in the `large` range by those conventions.

### p-value

The `p`-value is not the effect size. It is evidence against the null hypothesis.

Common convention:
- `p < .05`: statistically significant
- `p < .01`: stronger evidence
- `p < .001`: very strong evidence

Important: a very small `p` does not tell you the effect is practically large. That is why we also report effect sizes.

### Pairwise Contrasts

After a significant omnibus ANOVA, pairwise contrasts test which specific conditions differ.

Reported values:
- `estimate`: mean paired difference between the two conditions
- `95% CI`: plausible range for the difference
- `t`, `df`, `p`: paired contrast test statistic
- `p_holm`: multiplicity-corrected `p` for the preplanned contrasts
- `p_bonferroni`: Bonferroni-adjusted `p` when exported after rerunning the notebook
- `Cohen's d_z`: paired-samples effect size

How to read them:
- Positive `estimate` means the first condition is higher than the second
- Negative `estimate` means the first condition is lower than the second
- If the `95% CI` crosses `0`, that contrast is not clearly different from `0`

Common rule-of-thumb interpretation for `|Cohen's d_z|`:
- `.20`: small
- `.50`: medium
- `.80`: large

Multiple-comparison note:
- The current notebook uses `Holm` correction for the preplanned contrasts and item-level contrasts
- `Bonferroni` is also valid here and has now been added to `paper_analysis.ipynb` for future reruns
- The currently exported CSVs in `results_tables/` were generated before that update, so they may not yet include `p_bonferroni`

## Main Reliability Results

From `results_tables/reliability.csv`:

| Scale | Items | alpha | Interpretation |
|---|---|---:|---|
| SPMA (authenticity) | genuine thoughts & feelings / authentic voice / stand behind message | 0.850 | Good reliability |
| NASA-TLX short form | mental demand / effort / frustration | 0.895 | Good reliability |

## Main Outcome Results

### 1. Authenticity Composite

Descriptives from `results_tables/rq1_auth_descriptives.csv`:

| Condition | Mean | SD |
|---|---:|---:|
| Thought Partner | 6.302 | 0.649 |
| Editor | 6.127 | 0.619 |
| Ghost-writer | 4.952 | 1.404 |

Omnibus ANOVA from `results_tables/rq1_auth_anova.csv`:
- `F(2, 40) = 14.44`
- `p = 1.90e-05`
- `partial eta^2 = .419`

Interpretation:
- Statistically significant overall difference across conditions
- Effect size is `large`
- On the 1-7 outcome scale, Thought Partner and Editor are both high, while Ghost-writer is notably lower

Planned contrasts from `results_tables/rq1_auth_contrasts.csv`:

| Contrast | Estimate | 95% CI | t(df) | p | Holm p | d_z | Interpretation |
|---|---:|---|---|---:|---:|---:|---|
| Thought Partner - Ghost-writer | 1.349 | [0.635, 2.063] | 3.94 (20) | 0.00081 | 0.00135 | 0.860 | Significant, large effect |
| Editor - Ghost-writer | 1.175 | [0.565, 1.785] | 4.02 (20) | 0.00068 | 0.00135 | 0.877 | Significant, large effect |
| Thought Partner - Editor [exploratory] | 0.175 | [-0.127, 0.477] | 1.21 (20) | 0.24191 | — | 0.263 | Not significant, small effect |

Bottom line:
- Both Thought Partner and Editor outperform Ghost-writer on authenticity
- Thought Partner and Editor do not clearly differ from each other on the composite

### 2. Cognitive Effort Composite

Descriptives from `results_tables/rq2_effort_descriptives.csv`:

| Condition | Mean | SD |
|---|---:|---:|
| Thought Partner | 4.889 | 1.510 |
| Editor | 4.190 | 1.405 |
| Ghost-writer | 3.810 | 1.566 |

Omnibus ANOVA from `results_tables/rq2_effort_anova.csv`:
- `F(2, 40) = 5.81`
- `p = .0061`
- `partial eta^2 = .225`

Interpretation:
- Statistically significant overall difference across conditions
- Effect size is `large`
- The condition means suggest Thought Partner required the most effort and Ghost-writer the least

Planned contrasts from `results_tables/rq2_effort_contrasts.csv`:

| Contrast | Estimate | 95% CI | t(df) | p | Holm p | d_z | Interpretation |
|---|---:|---|---|---:|---:|---:|---|
| Editor - Ghost-writer | 0.381 | [-0.357, 1.119] | 1.08 (20) | 0.29412 | 0.29412 | 0.235 | Not significant, small effect |
| Editor - Thought Partner | -0.698 | [-1.394, -0.003] | -2.10 (20) | 0.04904 | 0.09807 | -0.457 | Nominally significant before correction, not significant after Holm; small-to-medium effect |
| Thought Partner - Ghost-writer [exploratory] | 1.079 | [0.514, 1.645] | 3.98 (20) | 0.00073 | — | 0.869 | Exploratory contrast only; large effect |

Bottom line:
- The omnibus test is significant
- But the two preplanned contrasts are not significant after Holm correction
- So this result should be described more cautiously than authenticity

### 3. Willingness To Send

Descriptives from `results_tables/rq3a_wts_descriptives.csv`:

| Condition | Mean | SD |
|---|---:|---:|
| Thought Partner | 5.810 | 1.209 |
| Editor | 5.952 | 1.024 |
| Ghost-writer | 4.381 | 1.830 |

Omnibus ANOVA from `results_tables/rq3a_wts_anova.csv`:
- `F(2, 40) = 7.97`
- `p = .00122`
- `partial eta^2 = .285`

Interpretation:
- Statistically significant overall difference across conditions
- Effect size is `large`
- Editor and Thought Partner are both higher than Ghost-writer descriptively

Current limitation:
- The notebook currently exports the omnibus ANOVA for willingness to send
- It does not currently export pairwise post-hoc / planned contrasts for this outcome

### 4. Completion Time

Descriptives from `results_tables/rq3b_time_descriptives.csv`:

| Condition | Mean seconds | SD |
|---|---:|---:|
| Thought Partner | 969.762 | 525.232 |
| Editor | 585.381 | 341.626 |
| Ghost-writer | 404.619 | 237.462 |

Omnibus ANOVA from `results_tables/rq3b_time_anova.csv`:
- `F(2, 40) = 29.89`
- `p = 1.15e-08`
- `partial eta^2 = .599`
- This ANOVA is run on `log(completion time)`, not raw seconds

Friedman sensitivity check on raw time:
- `chi^2(2) = 20.67`
- `p = 3.25e-05`

Interpretation:
- Very strong evidence of condition differences in time
- Effect size is `very large`
- Thought Partner took longest, Ghost-writer shortest
- Because time is often skewed, the notebook appropriately uses a log transform for the ANOVA and a Friedman sensitivity check on raw time

Current limitation:
- The notebook currently does not export pairwise post-hoc contrasts for completion time

## Quick Interpretation Guide: Where Our Numbers Sit

### Reliability

Our alphas:
- `0.850` and `0.895`

Where they sit: 
- Both are solid
- Neither scale looks unreliable

### Omnibus Effect Sizes (`partial eta^2`)

Our values:
- Authenticity: `.419`
- Effort: `.225`
- Willingness to send: `.285`
- Time: `.599`

Where they sit relative to common benchmarks:
- All are above `.14`, so all are `large`
- Time is the strongest omnibus effect in the main set

### Pairwise Effect Sizes (`Cohen's d_z`)

Our main contrast values:
- Authenticity TP-GW: `0.860`
- Authenticity ED-GW: `0.877`
- Authenticity TP-ED: `0.263`
- Effort ED-GW: `0.235`
- Effort ED-TP: `0.457`
- Effort TP-GW exploratory: `0.869`

Where they sit:
- `~0.86-0.88`: large
- `~0.23-0.26`: small
- `~0.46`: small-to-medium / approaching medium

### p-values

Our omnibus p-values:
- Authenticity: `1.90e-05`
- Effort: `.0061`
- Willingness: `.00122`
- Time: `1.15e-08`

Where they sit:
- All four omnibus tests are statistically significant
- Authenticity and time are especially strong by p-value
- Effort is significant overall, but its preplanned pairwise follow-ups are weaker after correction

## Power / G*Power Notes

Documented in `quantitative_analysis.ipynb`:
- Test family: `F tests`
- Statistical test: repeated-measures ANOVA, within factors
- Number of groups: `1`
- Number of measurements: `3`
- Alpha: `.05`
- Desired power: `.80`
- Assumed repeated-measures correlation: `.50`
- Nonsphericity correction: `1.0`

Important note:
- The notebook says not to report post hoc observed power
- The current notes do not document the assumed effect size `f` or the resulting target sample size, so the G*Power write-up is not fully complete yet

## Practical Summary

If you need the shortest paper-oriented summary:
- Authenticity shows a clear and strong advantage for Thought Partner and Editor over Ghost-writer
- Cognitive effort shows an overall difference, but the preplanned pairwise results are not robust after Holm correction
- Willingness to send differs overall across conditions, but pairwise follow-up tests are not yet exported
- Completion time differs very strongly across conditions, with Thought Partner taking longest and Ghost-writer shortest

## Relevant Files

- `results_tables/reliability.csv`
- `results_tables/rq1_auth_descriptives.csv`
- `results_tables/rq1_auth_anova.csv`
- `results_tables/rq1_auth_contrasts.csv`
- `results_tables/rq2_effort_descriptives.csv`
- `results_tables/rq2_effort_anova.csv`
- `results_tables/rq2_effort_contrasts.csv`
- `results_tables/rq3a_wts_descriptives.csv`
- `results_tables/rq3a_wts_anova.csv`
- `results_tables/rq3b_time_descriptives.csv`
- `results_tables/rq3b_time_anova.csv`
