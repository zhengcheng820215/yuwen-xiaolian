import {
  canApplyQualityReviewAction,
  canFreezeWithQualityBundle,
  mergeQuestionQualityAssessments,
} from '../ai/agents/questionSemanticQualityAssessmentAgent.ts';
import {
  QUESTION_QUALITY_ASSESSMENT_VERSION,
  QUESTION_QUALITY_CHECKS,
  QUESTION_QUALITY_RULE_VERSION,
  type QuestionQualityAssessment,
  type QuestionQualityCheck,
} from '../ai/schemas/questionQualityAssessment.schema.ts';
import {
  QUESTION_QUALITY_MERGE_RULE_VERSION,
  QUESTION_SEMANTIC_QUALITY_OUTPUT_SCHEMA_VERSION,
  QUESTION_SEMANTIC_QUALITY_PROMPT_VERSION,
  QUESTION_SEMANTIC_QUALITY_RULE_VERSION,
  type QuestionQualityAssessmentBundle,
  type QuestionSemanticQualityAssessment,
  type SemanticAssessmentStatus,
  type SemanticCheckStatus,
} from '../ai/schemas/questionSemanticQualityAssessment.schema.ts';

const NOW = '2026-07-26T15:30:00.000Z';

export type Phase175C1DemoCase = {
  id: string;
  label: string;
  description: string;
  expected: string;
  semantic: QuestionSemanticQualityAssessment;
  bundle: QuestionQualityAssessmentBundle;
  actions: {
    approve: boolean;
    revisionRequired: boolean;
    reject: boolean;
    freeze: boolean;
  };
  acceptancePoints: string[];
};

export type Phase175C1SemanticQualityDemoData = {
  defaultCaseId: string;
  cases: Phase175C1DemoCase[];
  debugSummary: string;
};

export function getPhase175C1SemanticQualityDemoData():
Phase175C1SemanticQualityDemoData {
  const deterministic = createDeterministicAssessment();
  const cases = [
    createCase({
      id: 'completed',
      label: '语义评估完成',
      description: 'Provider 返回结构合法的七项语义检查，确定性检查与语义检查合并为可审核结果。',
      expected: 'status = completed，七项 Finding 完整，允许人工审核与 Freeze。',
      deterministic,
      semantic: createSemanticAssessment('completed'),
      acceptancePoints: [
        '七项语义 Finding 各出现一次',
        'Bundle 保留确定性与语义 Assessment 身份',
        '结果只允许进入人工审核，不自动批准',
      ],
    }),
    createCase({
      id: 'warning',
      label: '语义警告保留',
      description: '确定性检查通过，但语义评估发现题目区分度仍需人工复核。',
      expected: '语义 warning 进入 Bundle，decision = review_with_warnings。',
      deterministic,
      semantic: createSemanticAssessment('completed', {
        check: 'discriminativePower',
        status: 'warning',
        reason: '优秀答案与部分答案的表现边界仍需人工确认。',
      }),
      acceptancePoints: [
        '确定性 pass 不覆盖语义 warning',
        'warningCodes 保留语义来源',
        '审核者能看到具体理由和证据引用',
      ],
    }),
    createCase({
      id: 'provider-failed',
      label: 'Provider 失败阻断',
      description: '语义 Provider 暂时不可用，不用确定性结果冒充完整质量结论。',
      expected: 'decision = semantic_unavailable，approve 与 Freeze 均被阻断。',
      deterministic,
      semantic: createSemanticAssessment('provider_failed'),
      acceptancePoints: [
        'Provider 失败作为正式运行事实展示',
        '不生成虚假的七项语义 Finding',
        '批准与 Freeze 明确不可用',
      ],
    }),
    createCase({
      id: 'safe-exit',
      label: '阻断后的安全出口',
      description: '语义评估不可用时，系统仍允许审核者退回修改或拒绝，避免流程被困住。',
      expected: 'approve = blocked；revision_required / reject = allowed。',
      deterministic,
      semantic: createSemanticAssessment('timeout'),
      acceptancePoints: [
        '超时不会降级为通过',
        '仍允许退回修改',
        '仍允许拒绝并保留人工决定',
      ],
    }),
  ];

  return {
    defaultCaseId: 'completed',
    cases,
    debugSummary: '17.5C1 自动化 Debug 18/18 通过',
  };
}

function createCase(input: {
  id: string;
  label: string;
  description: string;
  expected: string;
  deterministic: QuestionQualityAssessment;
  semantic: QuestionSemanticQualityAssessment;
  acceptancePoints: string[];
}): Phase175C1DemoCase {
  const bundle = mergeQuestionQualityAssessments({
    deterministic: input.deterministic,
    semantic: input.semantic,
    createdAt: NOW,
  });
  return {
    id: input.id,
    label: input.label,
    description: input.description,
    expected: input.expected,
    semantic: input.semantic,
    bundle,
    actions: {
      approve: canApplyQualityReviewAction(bundle, 'approve'),
      revisionRequired: canApplyQualityReviewAction(bundle, 'revision_required'),
      reject: canApplyQualityReviewAction(bundle, 'reject'),
      freeze: canFreezeWithQualityBundle(bundle),
    },
    acceptancePoints: input.acceptancePoints,
  };
}

function createDeterministicAssessment(): QuestionQualityAssessment {
  return {
    assessmentId: 'phase17-5c1-deterministic-assessment',
    draftId: 'phase17-5c1-draft',
    resourceId: 'phase17-5c1-resource',
    assessedDraftRevision: 1,
    validationId: 'phase17-5c1-validation',
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

function createSemanticAssessment(
  status: SemanticAssessmentStatus,
  warning?: {
    check: QuestionQualityCheck;
    status: SemanticCheckStatus;
    reason: string;
  },
): QuestionSemanticQualityAssessment {
  const suffix = warning?.check || status;
  return {
    semanticAssessmentId: `phase17-5c1-semantic-${suffix}`,
    semanticRequestKey: `phase17-5c1-request-key-${suffix}`,
    requestId: `phase17-5c1-request-${suffix}`,
    draftId: 'phase17-5c1-draft',
    resourceId: 'phase17-5c1-resource',
    assessedDraftRevision: 1,
    validationId: 'phase17-5c1-validation',
    materialVersionId: 'phase17-5c1-material:v1',
    deterministicAssessmentId: 'phase17-5c1-deterministic-assessment',
    status,
    findings: status === 'completed'
      ? QUESTION_QUALITY_CHECKS.map((check) => ({
          check,
          status: check === warning?.check ? warning.status : 'pass',
          reason: check === warning?.check
            ? warning.reason
            : `${check} 的题目语义与材料、观察目标保持一致。`,
          evidenceRefs: [evidenceRef(check)],
          suggestedReviewQuestion: `请人工复核 ${check} 是否支持当前观察目标。`,
        }))
      : [],
    limitations: status === 'completed'
      ? ['语义评估提供审核依据，不替代人工决定。']
      : [failureLimitation(status)],
    providerId: 'phase17-5c1-scripted-provider',
    modelId: 'semantic-quality-demo-model-v1',
    promptVersion: QUESTION_SEMANTIC_QUALITY_PROMPT_VERSION,
    semanticRuleVersion: QUESTION_SEMANTIC_QUALITY_RULE_VERSION,
    outputSchemaVersion: QUESTION_SEMANTIC_QUALITY_OUTPUT_SCHEMA_VERSION,
    startedAt: NOW,
    completedAt: NOW,
  };
}

function evidenceRef(check: QuestionQualityCheck): string {
  if (check === 'materialGrounding') return 'material.content:父亲小心地夹回树叶';
  if (check === 'rubricAlignment') return 'draft.rubric';
  if (check === 'difficultyCoherence') return 'draft.abilityMetadata';
  return 'draft.questionStem';
}

function failureLimitation(status: SemanticAssessmentStatus): string {
  if (status === 'timeout') return '语义质量 Provider 请求超时。';
  if (status === 'invalid_output') return 'Provider 输出修复后仍不符合结构契约。';
  return '语义质量 Provider 当前不可用。';
}

export const PHASE175_C1_DEMO_MERGE_RULE_VERSION =
  QUESTION_QUALITY_MERGE_RULE_VERSION;
