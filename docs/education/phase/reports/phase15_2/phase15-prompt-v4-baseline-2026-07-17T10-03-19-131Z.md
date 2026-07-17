# Phase 15.2 Prompt v3 Baseline Report

Status: AUTOMATED SHADOW BATCH COMPLETE / HUMAN REVIEW PENDING

## Configuration

- Dataset: phase15-real-diagnosis-dataset-v1 / 1.0.0
- Provider / Model: deepseek_chat / deepseek-v4-flash
- Prompt / Repair: real_ai_diagnosis_prompt_v4 / diagnosis_repair_policy_v1
- Temperature: 0.2
- Execution Mode: shadow
- Report Purpose: baseline
- Repetitions: 3

## Run Summary

- Planned / completed logical runs: 108 / 108
- Planned / completed Provider calls: 93 / 93
- Provider failed runs: 0
- Accepted / questionable / unacceptable / critical: 19 / 77 / 7 / 5

## Metrics

| Metric | Numerator | Denominator | Excluded | Rate |
| --- | ---: | ---: | ---: | ---: |
| providerAvailability | 93 | 93 | 15 | 100.0% |
| rawSchemaValidity | 93 | 93 | 0 | 100.0% |
| postRepairSchemaValidity | 93 | 93 | 0 | 100.0% |
| formalCandidateSchemaValidity | 93 | 93 | 0 | 100.0% |
| mainAbilityAccuracy | 93 | 93 | 0 | 100.0% |
| answerStatusAccuracy | 85 | 93 | 0 | 91.4% |
| rootCauseAcceptability | 8 | 93 | 0 | 8.6% |
| studentQuoteFidelity | 88 | 93 | 0 | 94.6% |
| textEvidenceFidelity | 88 | 93 | 0 | 94.6% |
| invalidResponseSafety | 15 | 15 | 0 | 100.0% |
| semanticStability | 24 | 31 | 5 | 77.4% |
| samplesAcceptedAtLeastTwoOfThree | 0 | 31 | 5 | 0.0% |
| samplesStableThreeOfThree | 0 | 31 | 5 | 0.0% |

## Provider

- Input / output / total tokens: 161001 / 22778 / 183779
- Average latency: 2918 ms
- Retry count: 0
- Error categories: {}

## Review Queue

- Priority review: phase15-v1-01, phase15-v1-02, phase15-v1-03, phase15-v1-04, phase15-v1-05, phase15-v1-06, phase15-v1-07, phase15-v1-08, phase15-v1-09, phase15-v1-10, phase15-v1-11, phase15-v1-12, phase15-v1-13, phase15-v1-14, phase15-v1-15, phase15-v1-16, phase15-v1-17, phase15-v1-18, phase15-v1-19, phase15-v1-20, phase15-v1-21, phase15-v1-22, phase15-v1-23, phase15-v1-24, phase15-v1-25, phase15-v1-26, phase15-v1-27, phase15-v1-28, phase15-v1-29, phase15-v1-35, phase15-v1-36
- Accepted audit sample: phase15-v1-05, phase15-v1-09, phase15-v1-13, phase15-v1-18
- Human review conclusion: PENDING

### Priority Run Reasons

| Run | Quality | Failed dimensions | Violations |
| --- | --- | --- | --- |
| phase15-v1-05#1 | unacceptable | answerStatusAccepted, rootCauseAcceptable | none |
| phase15-v1-05#2 | unacceptable | answerStatusAccepted, rootCauseAcceptable | none |
| phase15-v1-06#1 | unacceptable | answerStatusAccepted, rootCauseAcceptable | none |
| phase15-v1-06#2 | unacceptable | answerStatusAccepted, rootCauseAcceptable | none |
| phase15-v1-06#3 | unacceptable | answerStatusAccepted, rootCauseAcceptable | none |
| phase15-v1-08#1 | unacceptable | answerStatusAccepted, rootCauseAcceptable | none |
| phase15-v1-08#2 | critical_violation | answerStatusAccepted, rootCauseAcceptable, studentQuoteFaithful, textEvidenceFaithful, noCriticalHallucination | Invented quote: 理由相关; Invented quote: 表达连贯 |
| phase15-v1-08#3 | unacceptable | answerStatusAccepted, rootCauseAcceptable | none |
| phase15-v1-12#3 | critical_violation | rootCauseAcceptable, requiredFactsPresent, studentQuoteFaithful, textEvidenceFaithful, noCriticalHallucination | Invented quote: 父亲把伞给孩子、自己淋雨 |
| phase15-v1-13#1 | critical_violation | studentQuoteFaithful, textEvidenceFaithful, noCriticalHallucination | Invented quote: 引用相关动作 |
| phase15-v1-16#2 | critical_violation | rootCauseAcceptable, studentQuoteFaithful, textEvidenceFaithful, noCriticalHallucination | Invented quote: 说明动作与心理的关系; Invented quote: 因为……所以…… |
| phase15-v1-17#1 | critical_violation | rootCauseAcceptable, studentQuoteFaithful, textEvidenceFaithful, noCriticalHallucination | Invented quote: 为了; Invented quote: 以便 |

## Safety

- Evidence created: false
- Profile updated: false
- Secret, full Prompt, Raw Output stored in this report: false

Automatic baseline decision: blocked_by_critical_violation
