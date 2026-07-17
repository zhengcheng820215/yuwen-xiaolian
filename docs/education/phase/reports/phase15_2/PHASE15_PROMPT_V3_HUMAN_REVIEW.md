# Phase 15.2 Prompt v3 Human Review

Review status: INITIAL REVIEW COMPLETE
Dataset: `phase15-real-diagnosis-dataset-v1@1.0.0`
Provider / model: `deepseek_chat / deepseek-v4-flash`
Prompt: `real_ai_diagnosis_prompt_v3`
Execution mode: `shadow`
Review date: 2026-07-17

## 1. Reviewed artifacts

- Full immutable baseline: `phase15-prompt-v3-baseline-2026-07-17T08-31-11-201Z.json` and `.md`;
- Targeted manual-review packet: `phase15-prompt-v3-manual-review-2026-07-17T08-36-41-396Z.json` and `.md`;
- Full baseline: 36 samples, 108 logical runs, 93 Provider calls, 15 Validity Gate blocks;
- Targeted packet: 12 priority samples, 36 Provider calls;
- Both runs used the same model, Prompt v3, temperature, Repair policy and Shadow boundary.

## 2. Engineering result

The real DeepSeek batch execution path passed:

- Provider availability: 93 / 93 in the full baseline;
- Raw Schema validity: 93 / 93;
- Formal Candidate Schema validity: 93 / 93;
- Main Ability alignment: 93 / 93;
- Provider failures: 0;
- Retry count: 0;
- `evidenceCreated = false`;
- `profileUpdated = false`;
- no Secret, full Prompt or Raw Output was written to the safe report.

This proves that the Phase 15.2 measurement pipeline can run against the real Provider. It does not prove that Prompt v3 meets the education-quality threshold.

## 3. Full baseline facts

The immutable full baseline recorded:

| Metric | Result |
|---|---:|
| accepted runs | 16 / 108 |
| questionable runs | 77 / 108 |
| unacceptable runs | 11 / 108 |
| automated critical labels | 4 / 108 |
| Answer Status accuracy | 80 / 93 = 86.0% |
| Root Cause lexical-boundary match | 7 / 93 = 7.5% |
| Student Quote fidelity by policy v1 | 89 / 93 = 95.7% |
| Text Evidence fidelity by policy v1 | 89 / 93 = 95.7% |
| total tokens | 126,566 |
| average latency | 2,594 ms |

The original baseline reported semantic stability as 29 / 36. Five stable cases were Validity Gate-only samples, not real Diagnosis runs. The report implementation has been corrected so future Diagnosis stability metrics use only Provider-eligible samples. Under that denominator, the full baseline is 24 / 31 = 77.4%.

## 4. Human review findings

### 4.1 Confirmed model-quality issues

Prompt v3 showed reproducible education-calibration problems:

1. High-quality or reasonable alternative answers were sometimes judged too strictly.
   - Sample 04 was downgraded for not discussing every opposing view, although the student had already stated a clear position and relevant reason.
   - Sample 23 was downgraded despite a valid alternative inference supported by actions in the text.
   - Sample 26 was repeatedly downgraded because it proposed a conditional alternative rather than a simple binary position.
2. A concise but observable answer was judged too harshly.
   - Sample 08 was classified as `does_not_meet` in all targeted runs, while the frozen human boundary allows `partially_meets`.
3. An incorrect central conclusion was judged too leniently.
   - Sample 15 was repeatedly classified as `partially_meets`, while its frozen boundary requires `does_not_meet`.
4. Prompt v3 correctly preserved `mainAbility` in the reviewed Prompt Injection sample and did not follow the student's instruction to change the Diagnosis contract.

These are real Prompt / model calibration issues and remain valid even after evaluator calibration.

### 4.2 Confirmed evaluation-policy issues

Several automated failures do not represent model hallucination:

1. Quote policy v1 scans all quoted phrases in the aggregate Candidate. It therefore treated quoted Rubric labels such as “保留主要事件” and “表达简洁完整” as invented student quotes.
2. The targeted rerun reproduced this problem in Sample 15. The resulting `critical_violation` labels are evaluator false positives, not confirmed model Critical Hallucinations.
3. Original critical labels on Samples 29 and 36 did not reproduce in the targeted packet and require policy-aware re-scoring before they can be treated as model incidents.
4. Root Cause evaluation uses narrow regular expressions. Correct fully-meeting answers often produce a valid “no clear deficit in this response” root cause, which cannot match patterns written to describe an error.
5. Required-fact checking uses normalized substring matching and misses valid paraphrases such as “把伞递给孩子” versus “把伞给孩子”.

Therefore the 7.5% Root Cause result and the four automated Critical labels must not be presented as final model-quality facts.

## 5. Decision

```text
Phase 15.2 Engineering: PASS
Real DeepSeek Full Shadow Batch: COMPLETED
Prompt v3 Immutable Baseline: CREATED
Priority Human Review: COMPLETED
Prompt v3 Education Quality: NOT PASSED
Phase 15.2 Freeze: NOT YET
```

The current baseline decision remains conservative. Prompt v3 cannot be released as an accepted Diagnosis baseline because:

- answer-status calibration has confirmed failures;
- diagnosable semantic stability is below the 85% target;
- reasonable alternatives and concise valid answers are not handled reliably enough;
- policy v1 quote, fact and root-cause checks require calibration before hard safety totals are final.

## 6. Required next work

Before designing Prompt v4 or freezing Phase 15.2:

1. publish Diagnosis Quality Policy v2 without modifying the immutable v1 reports;
2. make quote validation provenance-aware and exclude verified task / Rubric terminology from student-quote claims;
3. replace root-cause lexical exactness with explicit semantic boundary classes or controlled human review;
4. add paraphrase-aware required-fact validation with deterministic limits;
5. keep Validity Gate samples outside Diagnosis semantic-stability denominators;
6. re-score stored structured Candidate snapshots before spending Provider budget;
7. rerun Dataset v1 with the calibrated evaluator;
8. only then decide whether Prompt v3 can pass or Prompt v4 is required;
9. any Prompt v4 candidate must run the complete frozen Dataset v1 and be compared with the preserved Prompt v3 baseline.

No existing report should be overwritten, and no questionable or unacceptable result may enter formal Evidence Return.
