import {
  summarizeQuestionGenerationBatchQuality,
  type QuestionGenerationBatchQualitySummaryInput,
} from '../ai/agents/questionQualityBatchSummaryAgent.ts';
import {
  QUESTION_QUALITY_ASSESSMENT_VERSION,
  QUESTION_QUALITY_RULE_VERSION,
  type QuestionQualityAssessment,
} from '../ai/schemas/questionQualityAssessment.schema.ts';
import {
  QUESTION_QUALITY_BATCH_MANIFEST_VERSION,
  type BatchSummaryStatus,
  type QuestionGenerationBatchQualitySummary,
  type QuestionGenerationQualityBatchManifest,
} from '../ai/schemas/questionQualityBatchSummary.schema.ts';
import {
  QUESTION_RESOURCE_ADMISSION_SCHEMA_VERSION,
  QUESTION_RESOURCE_ADMISSION_VERSION,
  type ResourceReviewDecision,
  type ResourceValidationResult,
  type StructuredQuestionDraft,
} from '../ai/schemas/questionResourceAdmission.schema.ts';
import {
  QUESTION_QUALITY_MERGE_RULE_VERSION,
  QUESTION_SEMANTIC_QUALITY_OUTPUT_SCHEMA_VERSION,
  QUESTION_SEMANTIC_QUALITY_PROMPT_VERSION,
  QUESTION_SEMANTIC_QUALITY_RULE_VERSION,
  type QuestionQualityAssessmentBundle,
  type QuestionSemanticQualityAssessment,
} from '../ai/schemas/questionSemanticQualityAssessment.schema.ts';

const NOW = '2026-07-26T16:00:00.000Z';

export type Phase175C3ADemoCase = {
  id: string;
  label: string;
  description: string;
  expectedStatus: BatchSummaryStatus;
  summary: QuestionGenerationBatchQualitySummary;
  acceptancePoints: string[];
};

export type Phase175C3ADemoData = {
  defaultCaseId: string;
  debugSummary: string;
  runtimeBoundary: string;
  cases: Phase175C3ADemoCase[];
};

export function getPhase175C3ABatchQualitySummaryDemoData(): Phase175C3ADemoData {
  return {
    defaultCaseId: 'complete',
    debugSummary: 'Phase 17.5C3A 工程 Debug 13/13 通过',
    runtimeBoundary: '固定验收输入，直接调用正式 Batch Summary Agent；不写真实录题工作台。',
    cases: [
      createCase(
        'complete',
        '完整批次',
        '两个 Draft 均具备当前 Validation、Assessment Bundle 与人工审核记录。',
        'complete',
        fixture(),
        [
          '状态为 complete，当前质量覆盖率为 100%',
          'Ability、Difficulty 与人工决定分布可追溯',
          'Summary 保留规则、Prompt 与 Bundle 身份',
        ],
      ),
      createCase(
        'incomplete',
        '缺少当前评估',
        '移除一个 Draft 的当前 Bundle，验证缺项不会被静默当作完整批次。',
        'incomplete',
        missingBundleFixture(),
        [
          '状态为 incomplete',
          'missingAssessmentCount 明确增加',
          '覆盖率按真实分母计算，不补写虚假结果',
        ],
      ),
      createCase(
        'mixed-versions',
        '版本混杂',
        '将一个 Draft 推进到 r2，但批次清单与质量事实仍指向 r1。',
        'mixed_versions',
        mixedRevisionFixture(),
        [
          '状态为 mixed_versions',
          'staleAssessmentCount 明确增加',
          '旧 Revision 事实不会授权当前批次',
        ],
      ),
      createCase(
        'blocked',
        '重复当前 Bundle',
        '同一 Draft 出现两个完全匹配的当前 Bundle，验证身份冲突必须阻断。',
        'blocked',
        duplicateBundleFixture(),
        [
          '状态为 blocked',
          'issues 包含 duplicate_current_bundle',
          '冲突不会通过取第一条记录被掩盖',
        ],
      ),
      createCase(
        'zero-denominator',
        '零分母指标',
        '生成候选总数为 0，验证 Contract Validation 通过率保持“暂无数据”。',
        'complete',
        zeroDenominatorFixture(),
        [
          '指标 value 为 null，而不是 0%',
          '页面显示暂无数据并保留 2/0 原始计数',
          '零分母不改变其他正式汇总事实',
        ],
      ),
    ],
  };
}

function createCase(
  id: string,
  label: string,
  description: string,
  expectedStatus: BatchSummaryStatus,
  input: QuestionGenerationBatchQualitySummaryInput,
  acceptancePoints: string[],
): Phase175C3ADemoCase {
  return {
    id,
    label,
    description,
    expectedStatus,
    summary: summarizeQuestionGenerationBatchQuality(input),
    acceptancePoints,
  };
}

function missingBundleFixture(): QuestionGenerationBatchQualitySummaryInput {
  const input = fixture();
  input.bundles = input.bundles.slice(0, 1);
  return input;
}

function mixedRevisionFixture(): QuestionGenerationBatchQualitySummaryInput {
  const input = fixture();
  input.drafts[0] = { ...input.drafts[0], revision: 2 };
  return input;
}

function duplicateBundleFixture(): QuestionGenerationBatchQualitySummaryInput {
  const input = fixture();
  input.bundles.push({ ...input.bundles[0], bundleId: 'bundle-draft-a-duplicate' });
  return input;
}

function zeroDenominatorFixture(): QuestionGenerationBatchQualitySummaryInput {
  const input = fixture();
  input.manifest.generatedCandidateCount = 0;
  return input;
}

function fixture(): QuestionGenerationBatchQualitySummaryInput {
  const drafts = [
    draft('a', 'analysis', 'intermediate'),
    draft('b', 'inference', 'advanced'),
  ];
  const validations = drafts.map(validationFor);
  const deterministicAssessments = drafts.map((item, index) => (
    deterministicFor(item, validations[index])
  ));
  const semanticAssessments = drafts.map((item, index) => (
    semanticFor(item, deterministicAssessments[index])
  ));
  const bundles = drafts.map((item, index) => (
    bundleFor(item, deterministicAssessments[index], semanticAssessments[index])
  ));
  const reviews = drafts.map((item, index) => (
    reviewFor(item, index === 0 ? 'approve' : 'revision_required', `review-${index + 1}`)
  ));
  const manifest: QuestionGenerationQualityBatchManifest = {
    manifestId: 'demo-manifest-batch-a-v1',
    batchId: 'demo-batch-a',
    batchVersion: 'v1',
    materialVersionIds: ['material-a:v1', 'material-b:v1'],
    generationRequestIds: ['request-a', 'request-b'],
    generatedCandidateCount: 2,
    draftRefs: drafts.map((item, index) => ({
      draftId: item.draftId,
      resourceId: item.resourceId,
      draftRevision: item.revision,
      validationId: validations[index].validationId,
    })),
    createdAt: NOW,
    frozenAt: NOW,
    version: QUESTION_QUALITY_BATCH_MANIFEST_VERSION,
  };
  return {
    manifest,
    drafts,
    validations,
    deterministicAssessments,
    semanticAssessments,
    bundles,
    reviews,
    reviewStartedAtByReviewId: {
      'review-1': '2026-07-26T15:58:00.000Z',
      'review-2': '2026-07-26T15:59:00.000Z',
    },
    generatedAt: NOW,
  };
}

function draft(
  suffix: string,
  abilityId: 'analysis' | 'inference',
  difficulty: 'intermediate' | 'advanced',
): StructuredQuestionDraft {
  return {
    draftId: `draft-${suffix}`,
    resourceId: `resource-${suffix}`,
    taskId: `task-${suffix}`,
    proposedVersionNumber: 1,
    materialVersionId: `material-${suffix}:v1`,
    title: `验收题目 ${suffix.toUpperCase()}`,
    questionStem: '结合材料说明人物行为体现的心理。',
    questionType: 'reading_comprehension',
    responseFormat: 'long_text',
    assessmentMode: 'structured',
    rubric: [{
      itemId: `rubric-${suffix}`,
      name: '证据与解释',
      abilityId,
      importance: 'critical',
      required: true,
      acceptedSignals: ['文本依据', '解释'],
    }],
    minimumAnswerRequirement: {
      minLength: 20,
      requireTextEvidence: true,
      requireExplanation: true,
    },
    abilityMetadata: {
      abilityId,
      supportingAbilityIds: [],
      prerequisiteAbilityIds: [],
      taskRole: 'training',
      difficulty,
    },
    source: { sourceType: 'ai_assisted', description: 'C3A 轻量 Demo。' },
    tags: [],
    status: 'reviewed',
    revision: 1,
    latestValidationId: `validation-${suffix}`,
    latestReviewId: `review-${suffix === 'a' ? '1' : '2'}`,
    createdAt: NOW,
    updatedAt: NOW,
    version: QUESTION_RESOURCE_ADMISSION_VERSION,
    schemaVersion: QUESTION_RESOURCE_ADMISSION_SCHEMA_VERSION,
  };
}

function validationFor(item: StructuredQuestionDraft): ResourceValidationResult {
  return {
    validationId: item.latestValidationId || '',
    draftId: item.draftId,
    resourceId: item.resourceId,
    validatedDraftRevision: item.revision,
    validationRuleVersion: QUESTION_RESOURCE_ADMISSION_SCHEMA_VERSION,
    passed: true,
    checks: {
      identityValid: true,
      contentValid: true,
      answerAcceptanceValid: true,
      rubricValid: true,
      abilityAndRoleValid: true,
      versionLineageValid: true,
      materialValid: true,
    },
    issues: [],
    checkedAt: NOW,
  };
}

function deterministicFor(
  item: StructuredQuestionDraft,
  validation: ResourceValidationResult,
): QuestionQualityAssessment {
  return {
    assessmentId: `deterministic-${item.draftId}`,
    draftId: item.draftId,
    resourceId: item.resourceId,
    assessedDraftRevision: item.revision,
    validationId: validation.validationId,
    checks: {
      materialGrounding: 'pass',
      observationClarity: 'pass',
      observationDistinctness: 'pass',
      discriminativePower: 'pass',
      difficultyCoherence: 'pass',
      rubricAlignment: 'pass',
      scopeClarity: 'pass',
    },
    decision: 'pass',
    warnings: [],
    assessedAt: NOW,
    ruleVersion: QUESTION_QUALITY_RULE_VERSION,
    version: QUESTION_QUALITY_ASSESSMENT_VERSION,
  };
}

function semanticFor(
  item: StructuredQuestionDraft,
  deterministic: QuestionQualityAssessment,
): QuestionSemanticQualityAssessment {
  const checks: QuestionSemanticQualityAssessment['findings'][number]['check'][] = [
    'materialGrounding',
    'observationClarity',
    'observationDistinctness',
    'discriminativePower',
    'difficultyCoherence',
    'rubricAlignment',
    'scopeClarity',
  ];
  return {
    semanticAssessmentId: `semantic-${item.draftId}`,
    semanticRequestKey: `semantic-request-${item.draftId}`,
    requestId: `request-${item.draftId}`,
    draftId: item.draftId,
    resourceId: item.resourceId,
    assessedDraftRevision: item.revision,
    validationId: deterministic.validationId,
    materialVersionId: item.materialVersionId || '',
    deterministicAssessmentId: deterministic.assessmentId,
    status: 'completed',
    findings: checks.map((check) => ({
      check,
      status: 'pass',
      reason: `${check} 通过。`,
      evidenceRefs: ['draft.questionStem'],
    })),
    limitations: [],
    providerId: 'scripted-demo-provider',
    modelId: 'scripted-demo-model',
    promptVersion: QUESTION_SEMANTIC_QUALITY_PROMPT_VERSION,
    semanticRuleVersion: QUESTION_SEMANTIC_QUALITY_RULE_VERSION,
    outputSchemaVersion: QUESTION_SEMANTIC_QUALITY_OUTPUT_SCHEMA_VERSION,
    startedAt: NOW,
    completedAt: NOW,
  };
}

function bundleFor(
  item: StructuredQuestionDraft,
  deterministic: QuestionQualityAssessment,
  semantic: QuestionSemanticQualityAssessment,
): QuestionQualityAssessmentBundle {
  return {
    bundleId: `bundle-${item.draftId}`,
    draftId: item.draftId,
    resourceId: item.resourceId,
    assessedDraftRevision: item.revision,
    validationId: deterministic.validationId,
    deterministicAssessmentId: deterministic.assessmentId,
    semanticAssessmentId: semantic.semanticAssessmentId,
    effectiveChecks: { ...deterministic.checks },
    decision: 'ready_for_review',
    warningCodes: [],
    deterministicRuleVersion: deterministic.ruleVersion,
    semanticRuleVersion: semantic.semanticRuleVersion,
    mergeRuleVersion: QUESTION_QUALITY_MERGE_RULE_VERSION,
    createdAt: NOW,
  };
}

function reviewFor(
  item: StructuredQuestionDraft,
  action: ResourceReviewDecision['action'],
  reviewId: string,
): ResourceReviewDecision {
  return {
    reviewId,
    draftId: item.draftId,
    resourceId: item.resourceId,
    reviewedDraftRevision: item.revision,
    validationId: item.latestValidationId || '',
    action,
    reviewerId: 'demo-reviewer',
    notes: 'C3A 人工验收样例。',
    reviewedAt: NOW,
  };
}
