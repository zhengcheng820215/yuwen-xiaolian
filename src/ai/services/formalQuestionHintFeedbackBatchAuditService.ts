import { buildPreAnswerLearningGuidance, validatePreAnswerLearningGuidance } from
  '../content/preAnswerLearningGuidance.ts';
import { projectFeedbackObservationTarget } from
  '../agents/feedbackObservationTargetAdapter.ts';
import type { FeedbackObservationTargetProjection } from
  '../schemas/feedbackObservationTargetProjection.schema.ts';
import type { FrozenQuestionResourceVersion } from
  '../schemas/questionResourceAdmission.schema.ts';
import type { SharedFormalResourceSnapshot } from
  '../schemas/sharedFormalResourcePersistence.schema.ts';
import { validateSingleChoiceInteraction } from
  '../schemas/singleChoiceInteraction.schema.ts';

export const FORMAL_QUESTION_HINT_FEEDBACK_AUDIT_SCHEMA_VERSION =
  'formal_question_hint_feedback_batch_audit_v2' as const;

export type FormalQuestionHintFeedbackAuditSeverity = 'blocked' | 'advisory' | 'info';

export type FormalQuestionHintFeedbackAuditFinding = {
  domain: 'hint' | 'feedback' | 'contract';
  code: string;
  severity: FormalQuestionHintFeedbackAuditSeverity;
  message: string;
};

export type FormalQuestionHintFeedbackAuditItem = {
  materialTitle: string;
  resourceId: string;
  resourceVersionId: string;
  taskId: string;
  questionStem: string;
  responseFormat: string;
  abilityId: string;
  taskRole: string;
  hintProjection: {
    status: 'ready' | 'hidden_by_quality_gate' | 'suppressed_by_role';
    clue?: string;
    thinkingAction?: string;
    hint?: string;
  };
  feedbackProjection: FeedbackObservationTargetProjection;
  feedbackTarget: string;
  rubricFeedbackReadiness: {
    status: 'ready' | 'limited' | 'blocked';
    rubricItemCount: number;
    requiredRubricItemCount: number;
    criticalRubricItemCount: number;
    projectionReadyItemCount: number;
    studentVisibleProjectionPolicy: 'minimum_necessary_only';
    limitations: string[];
  };
  disposition: 'blocked' | 'advisory' | 'pass';
  findings: FormalQuestionHintFeedbackAuditFinding[];
};

export type FormalQuestionHintFeedbackBatchAuditReport = {
  schemaVersion: typeof FORMAL_QUESTION_HINT_FEEDBACK_AUDIT_SCHEMA_VERSION;
  storeRevision: number;
  auditedAt: string;
  currentQuestionCount: number;
  summary: {
    pass: number;
    advisory: number;
    blocked: number;
    hintReady: number;
    hintHidden: number;
    hintSuppressed: number;
    rubricFeedbackReady: number;
    rubricFeedbackLimited: number;
    rubricFeedbackBlocked: number;
  };
  findingBreakdown: Record<string, number>;
  targetBreakdown: Record<string, number>;
  materialBreakdown: Array<{
    materialTitle: string;
    total: number;
    pass: number;
    advisory: number;
    blocked: number;
  }>;
  items: FormalQuestionHintFeedbackAuditItem[];
};

export function buildFormalQuestionHintFeedbackBatchAudit(
  snapshot: SharedFormalResourceSnapshot,
  auditedAt = new Date().toISOString(),
): FormalQuestionHintFeedbackBatchAuditReport {
  const versionById = new Map(snapshot.data.questionResources.versions.map((version) => (
    [version.resourceVersionId, version]
  )));
  const currentVersions = snapshot.data.questionResources.registryEntries
    .filter((entry) => entry.status === 'active' && entry.currentFrozenVersionId)
    .map((entry) => versionById.get(entry.currentFrozenVersionId!))
    .filter((version): version is FrozenQuestionResourceVersion => (
      Boolean(version) && version!.status === 'frozen'
    ));
  const uniqueVersions = [...new Map(currentVersions.map((version) => (
    [version.resourceVersionId, version]
  ))).values()];
  const items = uniqueVersions
    .map(auditVersion)
    .sort((left, right) => (
      `${left.materialTitle}:${left.resourceVersionId}`.localeCompare(
        `${right.materialTitle}:${right.resourceVersionId}`,
        'zh-CN',
      )
    ));
  const findingBreakdown: Record<string, number> = {};
  for (const item of items) {
    for (const finding of item.findings) {
      findingBreakdown[finding.code] = (findingBreakdown[finding.code] || 0) + 1;
    }
  }
  const targetBreakdown: Record<string, number> = {};
  const materialBreakdown = new Map<string, {
    materialTitle: string;
    total: number;
    pass: number;
    advisory: number;
    blocked: number;
  }>();
  for (const item of items) {
    targetBreakdown[item.feedbackProjection.targetCode] = (
      targetBreakdown[item.feedbackProjection.targetCode] || 0
    ) + 1;
    const aggregate = materialBreakdown.get(item.materialTitle) || {
      materialTitle: item.materialTitle,
      total: 0,
      pass: 0,
      advisory: 0,
      blocked: 0,
    };
    aggregate.total += 1;
    aggregate[item.disposition] += 1;
    materialBreakdown.set(item.materialTitle, aggregate);
  }
  return {
    schemaVersion: FORMAL_QUESTION_HINT_FEEDBACK_AUDIT_SCHEMA_VERSION,
    storeRevision: snapshot.revision,
    auditedAt,
    currentQuestionCount: items.length,
    summary: {
      pass: items.filter((item) => item.disposition === 'pass').length,
      advisory: items.filter((item) => item.disposition === 'advisory').length,
      blocked: items.filter((item) => item.disposition === 'blocked').length,
      hintReady: items.filter((item) => item.hintProjection.status === 'ready').length,
      hintHidden: items.filter((item) => item.hintProjection.status === 'hidden_by_quality_gate').length,
      hintSuppressed: items.filter((item) => item.hintProjection.status === 'suppressed_by_role').length,
      rubricFeedbackReady: items.filter((item) => item.rubricFeedbackReadiness.status === 'ready').length,
      rubricFeedbackLimited: items.filter((item) => item.rubricFeedbackReadiness.status === 'limited').length,
      rubricFeedbackBlocked: items.filter((item) => item.rubricFeedbackReadiness.status === 'blocked').length,
    },
    findingBreakdown: Object.fromEntries(Object.entries(findingBreakdown).sort(([left], [right]) => (
      left.localeCompare(right)
    ))),
    targetBreakdown: Object.fromEntries(Object.entries(targetBreakdown).sort(([left], [right]) => (
      left.localeCompare(right)
    ))),
    materialBreakdown: [...materialBreakdown.values()].sort((left, right) => (
      left.materialTitle.localeCompare(right.materialTitle, 'zh-CN')
    )),
    items,
  };
}

function auditVersion(version: FrozenQuestionResourceVersion): FormalQuestionHintFeedbackAuditItem {
  const findings: FormalQuestionHintFeedbackAuditFinding[] = [];
  const expectsNoHint = version.abilityMetadata.taskRole === 'retest'
    || version.tags.includes('hint_policy:no_hint');
  const guidance = buildPreAnswerLearningGuidance({
    abilityId: version.abilityMetadata.abilityId,
    abilityName: abilityDisplayName(version.abilityMetadata.abilityId),
    responseFormat: version.responseFormat === 'single_choice' ? 'single_choice' : 'text',
    questionText: version.questionStem,
  });
  let hintProjection: FormalQuestionHintFeedbackAuditItem['hintProjection'];
  if (expectsNoHint) {
    hintProjection = { status: 'suppressed_by_role' };
    if (guidance) {
      findings.push(finding(
        'hint',
        'hint_generated_for_no_hint_role',
        'blocked',
        '当前 Task Role 要求无提示，但通用提示生成器仍会产生提示。',
      ));
    }
  } else if (!guidance) {
    hintProjection = { status: 'hidden_by_quality_gate' };
    findings.push(finding(
      'hint',
      'hint_hidden_without_specific_clue',
      'info',
      '题干无法提供可靠的具体线索与思考动作，Learning 将安全隐藏提示入口。',
    ));
  } else {
    const validation = validatePreAnswerLearningGuidance(guidance);
    hintProjection = {
      status: 'ready',
      clue: guidance.clue,
      thinkingAction: guidance.thinkingAction,
      hint: guidance.hint,
    };
    for (const issue of validation.issues) {
      findings.push(finding(
        'hint',
        `hint_${issue}`,
        'blocked',
        `提示未通过统一结构化质量门禁：${issue}。`,
      ));
    }
  }

  const feedbackProjection = projectFeedbackObservationTarget({
    question: version.questionStem,
    abilityName: abilityDisplayName(version.abilityMetadata.abilityId),
    questionType: version.questionType,
    rubric: version.rubric,
    taskRole: version.abilityMetadata.taskRole,
  });
  auditFeedbackTarget(version, feedbackProjection, findings);
  auditRequirementContract(version, findings);
  const rubricFeedbackReadiness = auditRubricFeedbackReadiness(version, findings);

  return {
    materialTitle: version.materialSnapshot?.title || '阅读材料',
    resourceId: version.resourceId,
    resourceVersionId: version.resourceVersionId,
    taskId: version.taskId,
    questionStem: version.questionStem,
    responseFormat: version.responseFormat,
    abilityId: version.abilityMetadata.abilityId,
    taskRole: version.abilityMetadata.taskRole,
    hintProjection,
    feedbackProjection,
    feedbackTarget: feedbackProjection.displayLabel,
    rubricFeedbackReadiness,
    disposition: findings.some((item) => item.severity === 'blocked')
      ? 'blocked'
      : findings.some((item) => item.severity === 'advisory')
        ? 'advisory'
        : 'pass',
    findings,
  };
}

function auditRubricFeedbackReadiness(
  version: FrozenQuestionResourceVersion,
  findings: FormalQuestionHintFeedbackAuditFinding[],
): FormalQuestionHintFeedbackAuditItem['rubricFeedbackReadiness'] {
  const limitations: string[] = [];
  const localFindings: FormalQuestionHintFeedbackAuditFinding[] = [];
  const add = (
    code: string,
    severity: FormalQuestionHintFeedbackAuditSeverity,
    message: string,
  ) => {
    const item = finding('feedback', code, severity, message);
    findings.push(item);
    localFindings.push(item);
    if (severity !== 'info') limitations.push(code);
  };

  const itemIds = version.rubric.map((item) => item.itemId?.trim()).filter(Boolean);
  if (
    !version.resourceVersionId.trim()
    || !version.taskId.trim()
    || itemIds.length !== version.rubric.length
    || new Set(itemIds).size !== itemIds.length
  ) {
    add(
      'rubric_feedback_identity_mismatch',
      'blocked',
      '题目版本、任务或 Rubric Item 身份不完整或重复，不能建立可追溯反馈投射。',
    );
  }

  const requiredOrCritical = version.rubric.filter((item) => (
    item.required || item.importance === 'critical'
  ));
  const missingSignals = requiredOrCritical.filter((item) => (
    !Array.isArray(item.acceptedSignals)
    || item.acceptedSignals.filter((signal) => signal.trim().length > 0).length === 0
  ));
  if (missingSignals.length > 0) {
    add(
      'rubric_missing_accepted_signals',
      'advisory',
      `有 ${missingSignals.length} 个必要或关键 Rubric Item 缺少可接受观察信号，只能进入受限反馈投射。`,
    );
  }

  const minimum = version.minimumAnswerRequirement as {
    requireTextEvidence?: boolean;
    requireExplanation?: boolean;
  };
  const requiredRubric = version.rubric.filter((item) => item.required);
  const evidenceAligned = !minimum.requireTextEvidence || requiredRubric.some((item) => (
    item.evidenceRequirement?.requireTextEvidence
  ));
  const explanationAligned = !minimum.requireExplanation || requiredRubric.some((item) => (
    item.evidenceRequirement?.requireExplanation
  ));
  if (!evidenceAligned || !explanationAligned) {
    add(
      'rubric_requirement_misaligned',
      'advisory',
      '最低作答要求与必要 Rubric 的证据或解释责任没有完整对齐。',
    );
  }

  if (version.responseFormat === 'single_choice') {
    const interaction = validateSingleChoiceInteraction(version.choiceInteraction);
    if (!interaction.passed || minimum.requireTextEvidence || minimum.requireExplanation) {
      add(
        'single_choice_feedback_contract_mismatch',
        'blocked',
        '单选题的选项身份、干扰项解释或最低作答要求不能支持独立反馈链路。',
      );
    }
  }

  const projectionReadyItemCount = version.rubric.filter((item) => (
    item.itemId.trim().length > 0
    && item.name.trim().length > 0
    && (
      item.acceptedSignals.some((signal) => signal.trim().length > 0)
      || Boolean(item.description?.trim())
    )
  )).length;
  if (projectionReadyItemCount === 0 && localFindings.every((item) => item.severity !== 'blocked')) {
    add(
      'rubric_feedback_limited',
      'advisory',
      '当前 Rubric 没有足够结构化信息形成针对性反馈投射。',
    );
  }

  const status = localFindings.some((item) => item.severity === 'blocked')
    ? 'blocked'
    : localFindings.some((item) => item.severity === 'advisory')
      ? 'limited'
      : 'ready';
  if (status === 'ready') {
    findings.push(finding(
      'feedback',
      'rubric_feedback_ready',
      'info',
      'Rubric 已具备反馈投射准备度；运行时仍必须经过 Formal Diagnosis 与最小必要信息裁剪。',
    ));
  } else if (status === 'limited' && !localFindings.some((item) => item.code === 'rubric_feedback_limited')) {
    findings.push(finding(
      'feedback',
      'rubric_feedback_limited',
      'advisory',
      'Rubric 可进入兼容反馈，但针对性与可解释性受到已记录限制。',
    ));
  }

  return {
    status,
    rubricItemCount: version.rubric.length,
    requiredRubricItemCount: version.rubric.filter((item) => item.required).length,
    criticalRubricItemCount: version.rubric.filter((item) => item.importance === 'critical').length,
    projectionReadyItemCount,
    studentVisibleProjectionPolicy: 'minimum_necessary_only',
    limitations: [...new Set(limitations)],
  };
}

function auditFeedbackTarget(
  version: FrozenQuestionResourceVersion,
  projection: FeedbackObservationTargetProjection,
  findings: FormalQuestionHintFeedbackAuditFinding[],
): void {
  const question = version.questionStem;
  const feedbackTarget = projection.displayLabel;
  const sceneryTask = /(?:景物|景色|春天|万物|小草|山|水|太阳).{0,24}(?:特点|状态|变化|如何表现)/.test(question);
  if (sceneryTask && feedbackTarget === '人物的特点') {
    findings.push(finding(
      'feedback',
      'feedback_scenery_misclassified_as_character_trait',
      'blocked',
      '景物或整体状态题被错误投射为人物特点。',
    ));
  }
  if (
    /表达效果|表达作用|表现力|修辞/.test(question)
    && projection.targetCode !== 'expression_effect'
    && !(
      projection.targetCode === 'requirement_completion'
      && projection.evidenceSignals.some((signal) => signal.includes('expression_effect'))
    )
  ) {
    findings.push(finding(
      'feedback',
      'feedback_expression_target_mismatch',
      'blocked',
      '表达效果题未稳定投射为词句表达效果。',
    ));
  }
  if (
    /结构关系|照应|承接|总起|分述|前后关系/.test(question)
    && projection.targetCode !== 'structure_relation'
    && !(
      projection.targetCode === 'requirement_completion'
      && projection.evidenceSignals.some((signal) => signal.includes('structure_relation'))
    )
  ) {
    findings.push(finding(
      'feedback',
      'feedback_structure_target_mismatch',
      'blocked',
      '结构关系题未稳定投射为句段结构关系。',
    ));
  }
  if (
    projection.targetCode === 'generic_content'
    && projection.fallbackReason === 'question_rubric_mismatch'
  ) {
    findings.push(finding(
      'feedback',
      'feedback_question_rubric_target_mismatch',
      'blocked',
      '题干与必要 Rubric 指向不同观察对象，Adapter 已拒绝静默覆盖。',
    ));
  } else if (projection.targetCode === 'generic_content') {
    findings.push(finding(
      'feedback',
      'feedback_target_ambiguous',
      'advisory',
      '当前题目只能投射为克制的通用观察对象，需要在真实作答中观察反馈可解释性。',
    ));
  } else if (projection.confidence === 'medium') {
    findings.push(finding(
      'feedback',
      'feedback_target_medium_confidence',
      'info',
      '观察对象由必要 Rubric 或兼容信号投射，需要在真实 Trial 中校准主体与范围。',
    ));
  }
}

function auditRequirementContract(
  version: FrozenQuestionResourceVersion,
  findings: FormalQuestionHintFeedbackAuditFinding[],
): void {
  const requiredRubric = version.rubric.filter((item) => item.required);
  if (requiredRubric.length === 0) {
    findings.push(finding(
      'contract',
      'feedback_required_rubric_missing',
      'blocked',
      '正式题没有必要 Rubric，运行时无法形成可靠 Requirement 覆盖反馈。',
    ));
  }

  const minimum = version.minimumAnswerRequirement as {
    requireTextEvidence?: boolean;
    requireExplanation?: boolean;
  };
  if (version.responseFormat === 'single_choice') {
    if (minimum.requireTextEvidence || minimum.requireExplanation) {
      findings.push(finding(
        'contract',
        'single_choice_text_requirement_conflict',
        'blocked',
        '单选题仍携带文本依据或解释要求，反馈覆盖口径与作答形式冲突。',
      ));
    }
    return;
  }
  if (
    minimum.requireTextEvidence
    && !requiredRubric.some((item) => item.evidenceRequirement?.requireTextEvidence)
  ) {
    findings.push(finding(
      'contract',
      'feedback_evidence_requirement_not_in_rubric',
      'advisory',
      '最低作答要求需要文本依据，但必要 Rubric 未显式声明该证据要求。',
    ));
  }
  if (
    minimum.requireExplanation
    && !requiredRubric.some((item) => item.evidenceRequirement?.requireExplanation)
  ) {
    findings.push(finding(
      'contract',
      'feedback_relation_requirement_not_in_rubric',
      'advisory',
      '最低作答要求需要解释关系，但必要 Rubric 未显式声明该关系要求。',
    ));
  }
}

function finding(
  domain: FormalQuestionHintFeedbackAuditFinding['domain'],
  code: string,
  severity: FormalQuestionHintFeedbackAuditSeverity,
  message: string,
): FormalQuestionHintFeedbackAuditFinding {
  return { domain, code, severity, message };
}

function abilityDisplayName(value: string): string {
  const names: Record<string, string> = {
    extraction: '信息提取',
    comprehension: '理解',
    summarization: '概括',
    analysis: '分析',
    inference: '推理',
    expression: '表达',
  };
  return names[value] || '本题';
}
