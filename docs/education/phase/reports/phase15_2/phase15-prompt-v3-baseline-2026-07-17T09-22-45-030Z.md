# Phase 15.2 Prompt v3 Baseline Report

Status: AUTOMATED SHADOW BATCH COMPLETE / HUMAN REVIEW PENDING

## Configuration

- Dataset: phase15-real-diagnosis-dataset-v1 / 1.0.0
- Provider / Model: deepseek_chat / deepseek-v4-flash
- Prompt / Repair: real_ai_diagnosis_prompt_v3 / diagnosis_repair_policy_v1
- Temperature: 0.2
- Execution Mode: shadow
- Report Purpose: baseline
- Repetitions: 3

## Run Summary

- Planned / completed logical runs: 108 / 108
- Planned / completed Provider calls: 93 / 93
- Provider failed runs: 0
- Accepted / questionable / unacceptable / critical: 19 / 73 / 12 / 4

## Metrics

| Metric | Numerator | Denominator | Excluded | Rate |
| --- | ---: | ---: | ---: | ---: |
| providerAvailability | 93 | 93 | 15 | 100.0% |
| rawSchemaValidity | 93 | 93 | 0 | 100.0% |
| postRepairSchemaValidity | 93 | 93 | 0 | 100.0% |
| formalCandidateSchemaValidity | 93 | 93 | 0 | 100.0% |
| mainAbilityAccuracy | 93 | 93 | 0 | 100.0% |
| answerStatusAccuracy | 79 | 93 | 0 | 84.9% |
| rootCauseAcceptability | 8 | 93 | 0 | 8.6% |
| studentQuoteFidelity | 89 | 93 | 0 | 95.7% |
| textEvidenceFidelity | 89 | 93 | 0 | 95.7% |
| invalidResponseSafety | 15 | 15 | 0 | 100.0% |
| semanticStability | 24 | 31 | 5 | 77.4% |
| samplesAcceptedAtLeastTwoOfThree | 1 | 31 | 5 | 3.2% |
| samplesStableThreeOfThree | 0 | 31 | 5 | 0.0% |

## Provider

- Input / output / total tokens: 103341 / 23658 / 126999
- Average latency: 2726 ms
- Retry count: 0
- Error categories: {}

## Review Queue

- Priority review: phase15-v1-01, phase15-v1-02, phase15-v1-03, phase15-v1-04, phase15-v1-05, phase15-v1-06, phase15-v1-07, phase15-v1-08, phase15-v1-09, phase15-v1-10, phase15-v1-11, phase15-v1-12, phase15-v1-13, phase15-v1-14, phase15-v1-15, phase15-v1-16, phase15-v1-17, phase15-v1-18, phase15-v1-19, phase15-v1-20, phase15-v1-21, phase15-v1-22, phase15-v1-23, phase15-v1-24, phase15-v1-25, phase15-v1-26, phase15-v1-27, phase15-v1-28, phase15-v1-29, phase15-v1-35, phase15-v1-36
- Accepted audit sample: phase15-v1-14, phase15-v1-22, phase15-v1-29
- Human review conclusion: PENDING

### Priority Run Reasons

| Run | Quality | Failed dimensions | Violations |
| --- | --- | --- | --- |
| phase15-v1-04#1 | unacceptable | answerStatusAccepted, rootCauseAcceptable | none |
| phase15-v1-04#2 | unacceptable | answerStatusAccepted, rootCauseAcceptable | none |
| phase15-v1-08#1 | unacceptable | answerStatusAccepted, rootCauseAcceptable | none |
| phase15-v1-08#2 | unacceptable | answerStatusAccepted, rootCauseAcceptable | none |
| phase15-v1-08#3 | unacceptable | answerStatusAccepted | none |
| phase15-v1-15#1 | critical_violation | answerStatusAccepted, rootCauseAcceptable, studentQuoteFaithful, textEvidenceFaithful, noCriticalHallucination | Invented quote: 等待 |
| phase15-v1-15#2 | unacceptable | answerStatusAccepted, rootCauseAcceptable | none |
| phase15-v1-15#3 | unacceptable | answerStatusAccepted | none |
| phase15-v1-16#3 | critical_violation | rootCauseAcceptable, studentQuoteFaithful, textEvidenceFaithful, noCriticalHallucination | Invented quote: 因为……所以…… |
| phase15-v1-20#1 | critical_violation | rootCauseAcceptable, studentQuoteFaithful, textEvidenceFaithful, noCriticalHallucination | Invented quote: 因为……所以…… |
| phase15-v1-23#1 | unacceptable | answerStatusAccepted, rootCauseAcceptable | none |
| phase15-v1-23#2 | unacceptable | answerStatusAccepted, requiredFactsPresent | none |
| phase15-v1-23#3 | critical_violation | answerStatusAccepted, rootCauseAcceptable, studentQuoteFaithful, textEvidenceFaithful, noCriticalHallucination | Invented quote: 引用动作; Invented quote: 说明关系 |
| phase15-v1-26#1 | unacceptable | answerStatusAccepted, rootCauseAcceptable, requiredFactsPresent | none |
| phase15-v1-26#2 | unacceptable | answerStatusAccepted, rootCauseAcceptable, requiredFactsPresent | none |
| phase15-v1-26#3 | unacceptable | answerStatusAccepted, rootCauseAcceptable, requiredFactsPresent | none |

## Safety

- Evidence created: false
- Profile updated: false
- Secret, full Prompt, Raw Output stored in this report: false

Automatic baseline decision: blocked_by_critical_violation
