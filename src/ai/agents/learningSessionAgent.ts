import type { AbilityEvidenceSource } from '../schemas/abilityEvidence.schema.ts';
import type { PersonalizedTaskExecutionSummary } from '../schemas/personalizedTaskExecution.schema.ts';
import {
  type LearningSessionMemory,
  type LearningSessionNextRecommendationDecision,
  type LearningSessionOutcome,
  type LearningSessionStatus,
  type LearningSessionTaskExecutionSnapshot,
} from '../schemas/learningSession.schema.ts';

export type LearningSessionExecutionInput = {
  summary: PersonalizedTaskExecutionSummary;
  evidence_id: string;
  evidence_source: AbilityEvidenceSource;
};

export type LearningSessionInput = {
  sessionId: string;
  studentId: string;
  targetAbility?: string;
  startedAt: string;
  endedAt?: string;
  executions: LearningSessionExecutionInput[];
  otherAbilityWeaknessIsHigher?: boolean;
};

export function generateLearningSessionMemory(
  input: LearningSessionInput,
): LearningSessionMemory {
  validateLearningSessionInput(input);

  const targetAbility = input.targetAbility || input.executions[0].summary.execution.target_ability;
  const firstSummary = input.executions[0].summary;
  const lastSummary = input.executions[input.executions.length - 1].summary;
  const snapshots = input.executions.map((execution) => toTaskExecutionSnapshot(execution.summary));
  const evidenceIds = unique(input.executions.map((execution) => execution.evidence_id));
  const outcome = decideSessionOutcome({
    executions: input.executions,
    lastSummary,
    otherAbilityWeaknessIsHigher: Boolean(input.otherAbilityWeaknessIsHigher),
  });
  const status = decideSessionStatus(outcome);
  const nextRecommendation = buildNextRecommendation(outcome);

  return {
    session_id: input.sessionId,
    student_id: input.studentId,
    target_ability: targetAbility,
    started_at: input.startedAt,
    ended_at: input.endedAt,
    task_execution_ids: snapshots.map((snapshot) => snapshot.task_id),
    task_execution_snapshots: snapshots,
    evidence_ids: evidenceIds,
    task_count: input.executions.length,
    weakness_evidence_count_before: firstSummary.before.weakness_evidence_count,
    weakness_evidence_count_after: lastSummary.after.weakness_evidence_count,
    growth_evidence_count_before: firstSummary.before.growth_evidence_count,
    growth_evidence_count_after: lastSummary.after.growth_evidence_count,
    positive_evidence_count_before: 0,
    positive_evidence_count_after: countEvidenceType(input.executions, 'positive'),
    session_status: status,
    session_outcome: outcome,
    summary: buildSessionSummary({
      targetAbility,
      taskCount: input.executions.length,
      firstSummary,
      lastSummary,
      outcome,
    }),
    next_recommendation: nextRecommendation,
  };
}

function validateLearningSessionInput(input: LearningSessionInput): void {
  if (input.executions.length < 3) {
    throw new Error('Phase 5.3 requires at least 3 PersonalizedTaskExecutionSummary items.');
  }

  const targetAbility = input.targetAbility || input.executions[0].summary.execution.target_ability;

  for (const execution of input.executions) {
    const summary = execution.summary;
    const abilities = [
      summary.before.target_ability,
      summary.execution.target_ability,
      summary.after.target_ability,
    ];

    if (!abilities.every((ability) => ability === targetAbility)) {
      throw new Error('All taskExecutionSummary target_ability values must be consistent.');
    }

    if (!summary.execution.diagnosis_focus_match) {
      throw new Error('Phase 5.3 minimum debug requires diagnosis_focus_match=true for every execution.');
    }
  }
}

function toTaskExecutionSnapshot(
  summary: PersonalizedTaskExecutionSummary,
): LearningSessionTaskExecutionSnapshot {
  return {
    task_id: summary.execution.task_id,
    diagnosis_answer_status: summary.execution.diagnosis_answer_status,
    diagnosis_main_ability: summary.execution.diagnosis_main_ability,
    diagnosis_focus_match: summary.execution.diagnosis_focus_match,
    new_evidence_type: summary.execution.new_evidence_type,
    next_decision: summary.next_decision,
  };
}

function decideSessionOutcome(input: {
  executions: LearningSessionExecutionInput[];
  lastSummary: PersonalizedTaskExecutionSummary;
  otherAbilityWeaknessIsHigher: boolean;
}): LearningSessionOutcome {
  const weaknessCount = countEvidenceType(input.executions, 'weakness');
  const growthCount = countEvidenceType(input.executions, 'growth');
  const positiveCount = countEvidenceType(input.executions, 'positive');
  const hasRetestEvidence = input.executions.some((execution) => execution.evidence_source === 'retest');
  const hasImprovement = growthCount + positiveCount > 0;

  if (
    input.lastSummary.after.status === 'stable_positive' &&
    input.otherAbilityWeaknessIsHigher
  ) {
    return 'ability_focus_can_shift';
  }

  if (growthCount + positiveCount >= 2 && !hasRetestEvidence) {
    return 'needs_retest_validation';
  }

  if (growthCount + positiveCount >= 2) {
    return 'consistent_improvement';
  }

  if (growthCount === 1 && weaknessCount >= 1) {
    return 'early_improvement_signal';
  }

  if (weaknessCount >= growthCount + positiveCount) {
    return 'no_clear_improvement';
  }

  if (hasImprovement && !hasRetestEvidence) {
    return 'needs_retest_validation';
  }

  return 'no_clear_improvement';
}

function decideSessionStatus(outcome: LearningSessionOutcome): LearningSessionStatus {
  if (outcome === 'ability_focus_can_shift') return 'ready_to_switch_ability';
  if (outcome === 'needs_retest_validation' || outcome === 'consistent_improvement') return 'needs_retest';
  if (outcome === 'no_clear_improvement' || outcome === 'early_improvement_signal') return 'needs_more_training';

  return 'completed';
}

function buildNextRecommendation(
  outcome: LearningSessionOutcome,
): { decision: LearningSessionNextRecommendationDecision; reason: string } {
  if (outcome === 'ability_focus_can_shift') {
    return {
      decision: 'start_new_session_new_ability',
      reason: '目标能力已呈现相对稳定表现，且其他能力薄弱更突出，可以切换到新的能力 Session。',
    };
  }

  if (outcome === 'consistent_improvement') {
    return {
      decision: 'retest',
      reason: '本轮出现多条 growth / positive evidence，需要通过复测验证迁移稳定性。',
    };
  }

  if (outcome === 'needs_retest_validation') {
    return {
      decision: 'retest',
      reason: '训练任务中出现改善，但缺少 retest evidence，下一步应换题验证。',
    };
  }

  if (outcome === 'early_improvement_signal') {
    return {
      decision: 'continue_session',
      reason: '本轮已经出现早期改善信号，但 weakness 仍然存在，需要继续同能力 Session。',
    };
  }

  return {
    decision: 'start_new_session_same_ability',
    reason: '连续任务后仍主要产生 weakness evidence，需要继续围绕同一能力训练，并考虑降低难度或调整训练方式。',
  };
}

function buildSessionSummary(input: {
  targetAbility: string;
  taskCount: number;
  firstSummary: PersonalizedTaskExecutionSummary;
  lastSummary: PersonalizedTaskExecutionSummary;
  outcome: LearningSessionOutcome;
}): string {
  return [
    `本轮 Session 围绕「${input.targetAbility}」完成 ${input.taskCount} 次任务执行。`,
    `训练前 weakness=${input.firstSummary.before.weakness_evidence_count}, growth=${input.firstSummary.before.growth_evidence_count}。`,
    `训练后 weakness=${input.lastSummary.after.weakness_evidence_count}, growth=${input.lastSummary.after.growth_evidence_count}。`,
    `Session Outcome=${input.outcome}。`,
  ].join('');
}

function countEvidenceType(
  executions: LearningSessionExecutionInput[],
  evidenceType: string,
): number {
  return executions.filter((execution) => execution.summary.execution.new_evidence_type === evidenceType).length;
}

function unique(values: string[]): string[] {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))];
}
