# Phase 17.2 Material Observation Engineering Debug Acceptance

Date: 2026-07-22

Status: PASS

Scope: Phase 17.2A Observation Planning Runtime + Phase 17.2B Question Draft and Traceability Integration + Phase 17.2C Manifest / Diversity Runtime foundation

## Result

```text
Phase 17.2 Deterministic Debug: 26 / 26 PASS
Phase 17.1 Resource Coverage Regression: 22 / 22 PASS
Phase 16.1 Question Resource Admission Regression: 22 / 22 PASS
Phase 16.2 Resource Match Quality Regression: 16 / 16 PASS
Phase 16.1 -> 16.2 Integration Regression: 5 / 5 PASS
Phase 1 -> 16.2 Single-object E2E Regression: 5 / 5 PASS
Production Build (Node 24): PASS
External LLM Call: NOT REQUIRED / NOT EXECUTED
```

## Proven

- Material Version can produce a stable Structure Snapshot and version-bound Source Anchors.
- All seven V1 Observation Dimensions are explicitly reviewed without requiring a Cartesian task matrix.
- Observation Task Plans preserve one primary Dimension, one registered Ability, TaskRole and Difficulty.
- Reviewed Material Observation Plans are immutable and repeated review handoff is idempotent.
- A reviewed Task Plan creates only an ordinary Phase 16.1 Structured Question Draft; it cannot review or freeze itself.
- Existing Phase 16.1 still owns Rubric, AnswerAcceptance, Review, Freeze and Registry validation.
- Only a current, reviewed and traceable Frozen Resource can receive an active ResourceObservationLink.
- New Frozen versions supersede old active Links while historical versions remain traceable.
- Non-current or unlinked resources cannot inflate Pack Manifest or Observation Diversity counts.
- Transfer and Retest design intent does not become Runtime novelty or comparability fact.
- Pack quota gaps and single-Dimension concentration remain explicit limitations.
- Observation planning creates no AbilityEvidence, ProfileUpdateDecision or GrowthMemory.
- Failed Plan or Link operations do not mutate Frozen Resource, Registry or existing Manifest facts.

## Implementation

- `materialObservation.schema.ts`
- `materialObservationAgent.ts`
- `materialObservationApplicationService.ts`
- `materialObservationRepository.ts`
- `inMemoryMaterialObservationRepository.ts`
- `indexedDBMaterialObservationRepository.ts`
- `runMaterialObservationDebug.ts`

## Remaining Before Full Phase 17.2 Acceptance

- Build and human-review 4–6 real Material Clusters.
- Build 26–28 reviewed Registry-current Frozen Resources.
- Ensure every Pack resource has an active ResourceObservationLink.
- Recalculate the Phase 17.1 Coverage Report from the resulting Registry.
- Complete Material Observation Workspace browser acceptance and IndexedDB Smoke.
- Complete representative content quality review across Dimension × Ability intersections.

The deterministic fixtures used by Debug are test data. They are not formal product resources and do not count toward the first Frozen Resource Pack.
