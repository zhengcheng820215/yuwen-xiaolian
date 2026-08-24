import type { LearningFeedbackRevisionOfferDecision } from './learningFeedbackRevisionOfferPolicy.ts';
import type { DelayedRetestSchedulingResult } from '../schemas/delayedRetestScheduling.schema.ts';
import type { NextLearningStrategy } from '../schemas/nextLearningStrategy.schema.ts';
import type { TargetedMicroTrainingTriggerDecision } from '../schemas/targetedMicroTrainingScheduling.schema.ts';
import type {
  ConvergenceConditionalOwnerDecisionRef,
  ConvergenceConditionalSourceFactRef,
} from '../schemas/productComplexityConvergenceConditionalPolicy.schema.ts';

export function adaptRevisionOwnerDecision(input: {
  decision: LearningFeedbackRevisionOfferDecision;
  studentId: string;
  sourceAttemptId: string;
}): { ownerDecision: ConvergenceConditionalOwnerDecisionRef; sourceFactRefs: ConvergenceConditionalSourceFactRef[] } {
  const decision = input.decision;
  return {
    ownerDecision: {
      ownerType: 'revision_offer_snapshot',
      ownerId: stableId('revision-offer', [input.studentId, input.sourceAttemptId, decision.policyVersion]),
      ownerPolicyVersion: decision.policyVersion,
      ownerOutcome: decision.level,
      ownerMappedOutcome: decision.level === 'none' ? 'no_action' : 'trigger',
      ownerReasonCode: decision.reason,
    },
    sourceFactRefs: uniqueFacts([
      { factType: 'attempt', factId: input.sourceAttemptId },
      ...(decision.revisionGoal ? [
        { factType: 'diagnosis' as const, factId: decision.revisionGoal.sourceDiagnosisId },
        { factType: 'feedback' as const, factId: decision.revisionGoal.sourceFeedbackId },
      ] : []),
    ]),
  };
}

export function adaptTargetedOwnerDecision(
  decision: TargetedMicroTrainingTriggerDecision,
): { ownerDecision: ConvergenceConditionalOwnerDecisionRef; sourceFactRefs: ConvergenceConditionalSourceFactRef[] } {
  return {
    ownerDecision: {
      ownerType: 'targeted_trigger_decision', ownerId: decision.decisionId,
      ownerPolicyVersion: decision.triggerPolicyVersion, ownerOutcome: decision.outcome,
      ownerMappedOutcome: decision.outcome === 'eligible' ? 'trigger' : 'no_action',
      ownerReasonCode: decision.reasonCode,
    },
    sourceFactRefs: uniqueFacts([
      { factType: 'attempt', factId: decision.sourceAttemptId },
      ...(decision.primaryGapRequirementId
        ? [{ factType: 'targeted_gap' as const, factId: decision.primaryGapRequirementId }] : []),
    ]),
  };
}

export function adaptRetestOwnerDecision(
  result: DelayedRetestSchedulingResult,
): { ownerDecision: ConvergenceConditionalOwnerDecisionRef; sourceFactRefs: ConvergenceConditionalSourceFactRef[] } {
  const outcome = result.nextStep === 'create_task_request' ? 'trigger'
    : result.nextStep === 'wait_until_due' ? 'defer'
      : result.nextStep === 'blocked' || result.nextStep === 'review_required' ? 'blocked' : 'no_action';
  return {
    ownerDecision: {
      ownerType: 'delayed_retest_candidate', ownerId: result.candidate.candidateId,
      ownerPolicyVersion: result.candidate.policyVersion, ownerOutcome: result.nextStep,
      ownerMappedOutcome: outcome, ownerReasonCode: result.candidate.status,
    },
    sourceFactRefs: uniqueFacts([
      { factType: 'retest_candidate', factId: result.candidate.candidateId },
      ...result.candidate.sourceEvidenceIds.map((factId) => ({ factType: 'ability_evidence' as const, factId })),
      ...(result.plan ? [{ factType: 'retest_plan' as const, factId: result.plan.planId }] : []),
    ]),
  };
}

export function adaptTransferOwnerDecision(
  strategy: NextLearningStrategy,
): { ownerDecision: ConvergenceConditionalOwnerDecisionRef; sourceFactRefs: ConvergenceConditionalSourceFactRef[] } {
  const trigger = strategy.action === 'transfer_test' && strategy.recommendedTaskRole === 'transfer';
  return {
    ownerDecision: {
      ownerType: 'next_learning_strategy', ownerId: strategy.strategyId,
      ownerPolicyVersion: 'next_learning_strategy_v1', ownerOutcome: strategy.action,
      ownerMappedOutcome: trigger ? 'trigger' : 'no_action', ownerReasonCode: strategy.action,
    },
    sourceFactRefs: uniqueFacts([
      { factType: 'next_learning_strategy', factId: strategy.strategyId },
      ...strategy.growthMemoryRecordIds.map((factId) => ({ factType: 'growth_memory' as const, factId })),
      ...strategy.evidenceLinks.map((factId) => ({ factType: 'ability_evidence' as const, factId })),
    ]),
  };
}

function uniqueFacts(values: ConvergenceConditionalSourceFactRef[]): ConvergenceConditionalSourceFactRef[] {
  return [...new Map(values.map((item) => [`${item.factType}:${item.factId}`, item])).values()];
}

function stableId(prefix: string, values: string[]): string {
  return `${prefix}:${values.map((value) => value.trim()).join(':')}`;
}
