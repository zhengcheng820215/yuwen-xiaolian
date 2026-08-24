import type {
  FrozenQuestionResourceVersion,
  PrimaryAbilityId,
} from '../schemas/questionResourceAdmission.schema.ts';
import {
  READING_LOAD_RESPONSIBILITIES,
  READING_TRAINING_PROGRESSIVE_LOAD_POLICY_VERSION,
  READING_TRAINING_PROGRESSIVE_LOAD_STAGE0_AUDIT_VERSION,
  type ProgressionAuditFinding,
  type ProgressionTransitionAudit,
  type ReadingLoadResponsibility,
  type ReadingTaskGroupProgressionAudit,
  type TaskLoadSemanticsProjection,
  type TaskLoadSequenceRole,
} from '../schemas/readingTrainingProgressionAudit.schema.ts';
import type {
  CanonicalTextResponseAction,
  TextResponseLoadAuditResult,
  TextResponseLoadLevel,
} from '../schemas/readingOpenResponseInputLoad.schema.ts';
import type {
  TrainingTaskSequenceReason,
  TrainingTaskSequenceStrategy,
} from '../schemas/trainingTaskSequencePlanning.schema.ts';

export type LegacyTaskLoadProjectionInput = {
  version: FrozenQuestionResourceVersion;
  observationTaskPlanId?: string;
  sourceAnchorIds?: string[];
  textLoadAudit?: TextResponseLoadAuditResult;
};

export type ReadingTaskGroupProgressionAuditInput = {
  materialId: string;
  materialVersionId: string;
  materialTitle: string;
  usageType: 'core_reading' | 'targeted_excerpt';
  strategy: TrainingTaskSequenceStrategy;
  sequenceReason?: TrainingTaskSequenceReason;
  projections: TaskLoadSemanticsProjection[];
};

const ROLE_RANK: Record<TaskLoadSequenceRole, number> = {
  foundation_entry: 1,
  bridge: 2,
  development: 3,
  integration: 4,
  independent_validation: 5,
};

export function projectLegacyTaskLoadSemantics(
  input: LegacyTaskLoadProjectionInput,
): TaskLoadSemanticsProjection {
  const { version, textLoadAudit } = input;
  const taskRole = version.abilityMetadata.taskRole;
  const evidencePaths = [
    'version.responseFormat',
    'version.abilityMetadata',
    'version.tags',
  ];
  const limitations: string[] = [];
  let primaryAction = actionForAbility(version.abilityMetadata.abilityId);
  let supportingAction: CanonicalTextResponseAction | undefined;
  let textLoadLevel: TextResponseLoadLevel | undefined;
  let confidence: TaskLoadSemanticsProjection['confidence'] = 'medium';
  let completeness: TaskLoadSemanticsProjection['completeness'] = 'partial';

  if (textLoadAudit?.profile) {
    primaryAction = textLoadAudit.profile.primaryAction;
    supportingAction = textLoadAudit.profile.supportingAction;
    textLoadLevel = textLoadAudit.profile.loadLevel;
    evidencePaths.push('textLoadAudit.profile');
    completeness = textLoadAudit.analysisCompleteness === 'complete' ? 'complete' : 'partial';
    confidence = textLoadAudit.analysisCompleteness === 'complete' ? 'high' : 'medium';
  } else if (version.responseFormat === 'single_choice') {
    evidencePaths.push('version.choiceInteraction');
    completeness = version.choiceInteraction ? 'complete' : 'partial';
    confidence = tagValue(version.tags, 'sequence-prelude') === 'true'
      ? 'high'
      : 'medium';
    if (!version.choiceInteraction) limitations.push('single_choice_interaction_missing');
  } else {
    confidence = 'low';
    completeness = 'insufficient';
    limitations.push('text_load_profile_unavailable');
  }

  const sequenceRole = sequenceRoleFor(version, textLoadLevel);
  if (taskRole === 'diagnosis' || taskRole === 'observation') {
    limitations.push('non_training_role_requires_contextual_interpretation');
  }
  if (!input.observationTaskPlanId) limitations.push('observation_task_identity_unavailable');
  if ((input.sourceAnchorIds || []).length === 0) limitations.push('source_anchor_scope_unavailable');

  return {
    policyVersion: READING_TRAINING_PROGRESSIVE_LOAD_POLICY_VERSION,
    projectionVersion: READING_TRAINING_PROGRESSIVE_LOAD_STAGE0_AUDIT_VERSION,
    questionVersionId: version.resourceVersionId,
    materialVersionId: version.materialVersionId,
    observationTaskPlanId: input.observationTaskPlanId,
    responseFormat: version.responseFormat,
    taskRole,
    abilityId: version.abilityMetadata.abilityId,
    sourceAnchorIds: [...(input.sourceAnchorIds || [])].sort(),
    sequenceRole,
    primaryAction,
    supportingAction,
    textLoadLevel,
    responsibilities: responsibilitiesFor(sequenceRole),
    derivationSource: 'legacy_projection',
    confidence,
    completeness,
    evidencePaths,
    limitations,
  };
}

export function auditReadingTaskGroupProgression(
  input: ReadingTaskGroupProgressionAuditInput,
): ReadingTaskGroupProgressionAudit {
  const projections = [...input.projections];
  const findings: ProgressionAuditFinding[] = [];
  const legalException = input.strategy === 'holistic_first'
    || input.strategy === 'role_driven'
    || projections.every((item) => item.taskRole !== 'training');

  for (const projection of projections) {
    if (projection.completeness !== 'complete') {
      findings.push(finding(
        'projection_incomplete',
        projection.completeness === 'insufficient' ? 'high_risk' : 'warning',
        [projection.questionVersionId],
        '历史字段不足，当前负担语义只能保守投影。',
      ));
    }
    if (projection.confidence === 'low') {
      findings.push(finding(
        'projection_low_confidence',
        'warning',
        [projection.questionVersionId],
        '该题缺少足够的结构化语义，不能用于精确定位学生失稳层级。',
      ));
    }
  }

  const transitions = projections.slice(1).map((current, index) => (
    transition(projections[index], current, legalException)
  ));
  for (const item of transitions.filter((value) => value.status === 'unexplained_jump')) {
    findings.push(finding(
      'unexplained_responsibility_jump',
      'warning',
      [item.fromQuestionVersionId, item.toQuestionVersionId],
      item.rationale,
    ));
  }

  if (input.usageType === 'core_reading' && !legalException && projections.length > 0) {
    const first = projections[0];
    if (!['foundation_entry', 'bridge'].includes(first.sequenceRole)) {
      findings.push(finding(
        'missing_accessible_entry',
        'warning',
        [first.questionVersionId],
        '核心题组从较高负担任务进入，且没有记录合法的顺序例外。',
      ));
    }
  }

  for (let leftIndex = 0; leftIndex < projections.length; leftIndex += 1) {
    for (let rightIndex = leftIndex + 1; rightIndex < projections.length; rightIndex += 1) {
      const left = projections[leftIndex];
      const right = projections[rightIndex];
      if (sameObservationScope(left, right)) {
        findings.push(finding(
          'duplicate_observation_scope',
          'warning',
          [left.questionVersionId, right.questionVersionId],
          '两题的主要动作、能力与证据范围相同，可能只是换一种问法重复观察。',
        ));
      }
    }
  }

  const observedResponsibilities = READING_LOAD_RESPONSIBILITIES.filter((responsibility) => (
    projections.some((projection) => projection.responsibilities.includes(responsibility))
  ));
  const comparableAbilityCounts = countBy(projections.map((item) => item.abilityId));
  const hasComparableThread = Object.values(comparableAbilityCounts).some((count) => count >= 2);
  const usableStages = new Set(projections
    .filter((item) => item.confidence !== 'low')
    .map((item) => item.sequenceRole));
  const breakPointObservability = input.usageType === 'targeted_excerpt'
    ? 'not_assessable'
    : hasComparableThread && usableStages.size >= 3
      ? 'traceable'
      : usableStages.size >= 2
        ? 'partial'
        : 'not_assessable';

  if (input.usageType === 'core_reading' && projections.length >= 2 && !hasComparableThread) {
    findings.push(finding(
      'cross_thread_comparison_invalid',
      'info',
      projections.map((item) => item.questionVersionId),
      '题组覆盖多个能力线程，但缺少可比较的相邻层级；不能据此定位单一失稳点。',
    ));
  }
  if (input.usageType === 'core_reading' && breakPointObservability !== 'traceable') {
    findings.push(finding(
      'breakpoint_not_inferable',
      'info',
      projections.map((item) => item.questionVersionId),
      '当前结构不足以精确判断学生从哪一负担层级开始失稳。',
    ));
  }
  const first = projections[0];
  if (first && first.sequenceRole === 'integration' && !legalException) {
    findings.push(finding(
      'task_overload_attribution_risk',
      'high_risk',
      [first.questionVersionId],
      '首题已经承担综合责任；失败时不能直接归因为学生基础理解不足。',
    ));
  }
  if (!input.sequenceReason && input.usageType === 'core_reading') {
    findings.push(finding(
      'legacy_sequence_reason_missing',
      'info',
      [],
      '历史题组没有结构化顺序理由，阶段 0 仅按 Learning 实际排序审计。',
    ));
  }

  return {
    materialId: input.materialId,
    materialVersionId: input.materialVersionId,
    materialTitle: input.materialTitle,
    usageType: input.usageType,
    strategy: input.strategy,
    sequenceReason: input.sequenceReason,
    orderedQuestionVersionIds: projections.map((item) => item.questionVersionId),
    projections,
    transitions,
    findings: deduplicateFindings(findings),
    observedResponsibilities,
    breakPointObservability,
    auditScope: input.usageType === 'targeted_excerpt'
      ? 'targeted_excerpt_single_task'
      : 'core_task_group',
  };
}

function sequenceRoleFor(
  version: FrozenQuestionResourceVersion,
  textLoadLevel?: TextResponseLoadLevel,
): TaskLoadSequenceRole {
  if (version.abilityMetadata.taskRole === 'retest'
    || version.abilityMetadata.taskRole === 'transfer') {
    return 'independent_validation';
  }
  if (version.responseFormat === 'single_choice') {
    return version.abilityMetadata.difficulty === 'advanced' ? 'bridge' : 'foundation_entry';
  }
  if (textLoadLevel === 'entry_short') return 'foundation_entry';
  if (textLoadLevel === 'focused_short') return 'bridge';
  if (textLoadLevel === 'developing') return 'development';
  return 'integration';
}

function actionForAbility(abilityId: PrimaryAbilityId): CanonicalTextResponseAction {
  if (abilityId === 'extraction') return 'locate_information';
  if (abilityId === 'summarization') return 'summarize_content';
  if (abilityId === 'analysis') return 'identify_relation';
  if (abilityId === 'inference') return 'infer_from_evidence';
  if (abilityId === 'expression') return 'evaluate_expression';
  return 'explain_local_meaning';
}

function responsibilitiesFor(role: TaskLoadSequenceRole): ReadingLoadResponsibility[] {
  if (role === 'foundation_entry') return ['basic_understanding'];
  if (role === 'bridge') return ['basic_understanding', 'text_evidence'];
  if (role === 'development') {
    return ['basic_understanding', 'text_evidence', 'relation_explanation'];
  }
  if (role === 'integration') return [...READING_LOAD_RESPONSIBILITIES];
  return ['basic_understanding', 'text_evidence', 'relation_explanation'];
}

function transition(
  from: TaskLoadSemanticsProjection,
  to: TaskLoadSemanticsProjection,
  legalException: boolean,
): ProgressionTransitionAudit {
  const addedResponsibilities = to.responsibilities.filter((item) => (
    !from.responsibilities.includes(item)
  ));
  const removedResponsibilities = from.responsibilities.filter((item) => (
    !to.responsibilities.includes(item)
  ));
  const delta = ROLE_RANK[to.sequenceRole] - ROLE_RANK[from.sequenceRole];
  if (legalException || to.sequenceRole === 'independent_validation') {
    return {
      fromQuestionVersionId: from.questionVersionId,
      toQuestionVersionId: to.questionVersionId,
      fromSequenceRole: from.sequenceRole,
      toSequenceRole: to.sequenceRole,
      addedResponsibilities,
      removedResponsibilities,
      status: 'exception',
      rationale: '顺序由整体判断或独立验证角色决定。',
    };
  }
  const status = delta > 1 ? 'unexplained_jump' : delta === 0 ? 'level' : 'progressive';
  return {
    fromQuestionVersionId: from.questionVersionId,
    toQuestionVersionId: to.questionVersionId,
    fromSequenceRole: from.sequenceRole,
    toSequenceRole: to.sequenceRole,
    addedResponsibilities,
    removedResponsibilities,
    status,
    rationale: status === 'unexplained_jump'
      ? `相邻任务一次增加 ${addedResponsibilities.length} 项责任，历史数据没有提供正式过渡理由。`
      : status === 'level'
        ? '相邻任务保持相近负担，是否重复需结合观察范围判断。'
        : '相邻任务按一个层级或更小幅度增加责任。',
  };
}

function sameObservationScope(
  left: TaskLoadSemanticsProjection,
  right: TaskLoadSemanticsProjection,
): boolean {
  return left.abilityId === right.abilityId
    && left.primaryAction === right.primaryAction
    && left.sourceAnchorIds.length > 0
    && left.sourceAnchorIds.join('|') === right.sourceAnchorIds.join('|');
}

function finding(
  code: ProgressionAuditFinding['code'],
  severity: ProgressionAuditFinding['severity'],
  questionVersionIds: string[],
  explanation: string,
): ProgressionAuditFinding {
  return { code, severity, questionVersionIds, explanation };
}

function deduplicateFindings(findings: ProgressionAuditFinding[]): ProgressionAuditFinding[] {
  return [...new Map(findings.map((item) => [
    `${item.code}:${item.questionVersionIds.join('|')}`,
    item,
  ])).values()];
}

function countBy(values: string[]): Record<string, number> {
  return values.reduce<Record<string, number>>((result, value) => {
    result[value] = (result[value] || 0) + 1;
    return result;
  }, {});
}

function tagValue(tags: string[], prefix: string): string | undefined {
  return tags.find((tag) => tag.startsWith(`${prefix}:`))?.slice(prefix.length + 1);
}
