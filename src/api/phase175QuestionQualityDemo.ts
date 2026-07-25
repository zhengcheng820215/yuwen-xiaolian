import {
  assessQuestionDraftQuality,
  isCurrentQuestionQualityAssessment,
} from '../ai/agents/questionQualityAssessmentAgent.ts';
import type {
  QuestionMaterialVersion,
  ResourceValidationResult,
  StructuredQuestionDraft,
} from '../ai/schemas/questionResourceAdmission.schema.ts';
import type {
  QuestionQualityAssessment,
} from '../ai/schemas/questionQualityAssessment.schema.ts';

const NOW = '2026-07-25T14:00:00.000Z';

export type Phase175DemoCase = {
  id: string;
  label: string;
  description: string;
  expected: string;
  assessment: QuestionQualityAssessment;
  isCurrent: boolean;
  humanReviewAllowed: boolean;
  acceptancePoints: string[];
};

export type Phase175QuestionQualityDemoData = {
  defaultCaseId: string;
  cases: Phase175DemoCase[];
  debugSummary: string;
};

export function getPhase175QuestionQualityDemoData(): Phase175QuestionQualityDemoData {
  const material = createMaterial();
  const passDraft = createDraft('pass');
  const passValidation = createValidation(passDraft);
  const passAssessment = assessQuestionDraftQuality({
    draft: passDraft,
    validation: passValidation,
    material,
    assessedAt: NOW,
  });

  const duplicateDraft = createDraft('warning');
  const duplicateValidation = createValidation(duplicateDraft);
  const duplicateAssessment = assessQuestionDraftQuality({
    draft: duplicateDraft,
    validation: duplicateValidation,
    material,
    peerDrafts: [
      {
        ...createDraft('warning-peer'),
        questionStem: duplicateDraft.questionStem,
        abilityMetadata: duplicateDraft.abilityMetadata,
      },
    ],
    assessedAt: NOW,
  });

  const revisionDraft = createDraft('revision', {
    questionStem: '请谈谈你对亲情的理解。',
    rubric: [
      {
        itemId: 'general-view',
        name: '表达个人看法',
        description: '表达对亲情的看法。',
        abilityId: 'expression',
        importance: 'critical',
        required: true,
        evidenceRequirement: {
          requireTextEvidence: false,
          requireExplanation: false,
        },
        acceptedSignals: ['亲情很重要'],
      },
    ],
    minimumAnswerRequirement: {
      minLength: 12,
      requireTextEvidence: false,
      requireExplanation: false,
    },
  });
  const revisionValidation = createValidation(revisionDraft);
  const revisionAssessment = assessQuestionDraftQuality({
    draft: revisionDraft,
    validation: revisionValidation,
    material,
    assessedAt: NOW,
  });

  const staleDraftV1 = createDraft('stale');
  const staleValidationV1 = createValidation(staleDraftV1);
  const staleAssessment = assessQuestionDraftQuality({
    draft: staleDraftV1,
    validation: staleValidationV1,
    material,
    assessedAt: NOW,
  });
  const staleDraftV2 = {
    ...staleDraftV1,
    revision: 2,
    questionStem: `${staleDraftV1.questionStem} 请进一步说明理由。`,
    latestValidationId: `${staleDraftV1.draftId}:validation:r2`,
    updatedAt: '2026-07-25T14:10:00.000Z',
  };
  const staleValidationV2 = createValidation(staleDraftV2);

  return {
    defaultCaseId: 'pass',
    debugSummary: '17.5A 12/12 + 17.5B 9/9 自动化 Debug 通过',
    cases: [
      {
        id: 'pass',
        label: '质量检查通过',
        description: '材料依据、观察动作、区分度、难度与 Rubric 均保持一致。',
        expected: 'decision = pass，仍需人工审核，不自动批准或冻结。',
        assessment: passAssessment,
        isCurrent: isCurrentQuestionQualityAssessment(
          passDraft,
          passValidation,
          passAssessment,
        ),
        humanReviewAllowed: true,
        acceptancePoints: [
          '七项质量检查全部通过',
          '评估绑定当前 Draft Revision',
          '质量通过不等于人工审核通过',
        ],
      },
      {
        id: 'warning',
        label: '带提醒进入审核',
        description: '同一材料中存在观察目标相近的题目，需要审核者判断是否重复。',
        expected: 'decision = pass_with_warnings，提醒保留，但不阻断人工审核。',
        assessment: duplicateAssessment,
        isCurrent: isCurrentQuestionQualityAssessment(
          duplicateDraft,
          duplicateValidation,
          duplicateAssessment,
        ),
        humanReviewAllowed: true,
        acceptancePoints: [
          '明确显示重复观察提醒',
          '提醒包含可追溯字段引用',
          '系统不替代人工作出取舍',
        ],
      },
      {
        id: 'revision',
        label: '建议修改',
        description: '题目范围宽、材料关联弱，且 Rubric 难以形成有效区分。',
        expected: 'decision = revision_recommended，突出风险，但仍交由人工决定。',
        assessment: revisionAssessment,
        isCurrent: isCurrentQuestionQualityAssessment(
          revisionDraft,
          revisionValidation,
          revisionAssessment,
        ),
        humanReviewAllowed: true,
        acceptancePoints: [
          '强提醒不会被包装成普通通过',
          '建议修改仍是审核建议，不是自动拒绝',
          '警告能够定位到具体检查项',
        ],
      },
      {
        id: 'stale',
        label: '修改后评估失效',
        description: '题目从 Revision 1 修改为 Revision 2，旧质量评估不得继续被消费。',
        expected: '旧 assessment 不再 current，提交审核前必须重新评估。',
        assessment: staleAssessment,
        isCurrent: isCurrentQuestionQualityAssessment(
          staleDraftV2,
          staleValidationV2,
          staleAssessment,
        ),
        humanReviewAllowed: false,
        acceptancePoints: [
          '旧评估保留用于追溯',
          'Revision 改变后旧评估立即失效',
          '失效状态阻断提交审核，不生成替代结论',
        ],
      },
    ],
  };
}

function createMaterial(): QuestionMaterialVersion {
  return {
    materialId: 'phase175-demo-material',
    materialVersionId: 'phase175-demo-material:v1',
    versionNumber: 1,
    status: 'active',
    title: '旧书中的树叶',
    content: '父亲整理书柜时，从一本旧书里发现一片已经褪色的树叶。他捏着树叶站了很久，最后把它小心地夹回原处。',
    source: {
      sourceType: 'manual',
      description: 'Phase 17.5B 内部验收材料。',
      copyrightNote: '产品验证用合成文本。',
    },
    createdAt: NOW,
    updatedAt: NOW,
    schemaVersion: 'question_resource_admission_schema_v1',
  };
}

function createDraft(
  suffix: string,
  overrides: Partial<StructuredQuestionDraft> = {},
): StructuredQuestionDraft {
  const draftId = `phase175-demo-draft-${suffix}`;
  return {
    draftId,
    resourceId: `phase175-demo-resource-${suffix}`,
    taskId: `phase175-demo-task-${suffix}`,
    proposedVersionNumber: 1,
    materialVersionId: 'phase175-demo-material:v1',
    title: '从动作推断人物心理',
    questionStem: '结合父亲“捏着树叶站了很久，又小心地夹回原处”的动作，分析这一细节表现出的心理。',
    questionType: 'reading_comprehension',
    responseFormat: 'long_text',
    assessmentMode: 'reasoning_chain',
    answerAcceptance: {
      acceptedKeywords: ['树叶', '珍惜', '回忆'],
      semanticEquivalentAllowed: true,
      normalizationRules: ['trim', 'ignore_punctuation'],
    },
    rubric: [
      {
        itemId: 'evidence',
        name: '动作依据',
        description: '指出与判断相关的文本动作。',
        abilityId: 'inference',
        importance: 'critical',
        required: true,
        evidenceRequirement: {
          requireTextEvidence: true,
          requireExplanation: true,
        },
        acceptedSignals: ['捏着树叶站了很久', '小心地夹回原处'],
      },
      {
        itemId: 'explanation',
        name: '解释关系',
        description: '说明动作与人物心理之间的关系。',
        abilityId: 'inference',
        importance: 'important',
        required: true,
        evidenceRequirement: {
          requireExplanation: true,
          requireConclusion: true,
        },
        acceptedSignals: ['动作说明珍惜', '舍不得丢弃回忆'],
      },
    ],
    minimumAnswerRequirement: {
      minLength: 20,
      requireTextEvidence: true,
      requireExplanation: true,
    },
    abilityMetadata: {
      abilityId: 'inference',
      supportingAbilityIds: ['extraction', 'comprehension'],
      prerequisiteAbilityIds: ['comprehension'],
      taskRole: 'training',
      difficulty: 'intermediate',
      gradeRange: '初中',
    },
    source: {
      sourceType: 'manual',
      description: 'Phase 17.5B Demo 题目。',
      copyrightNote: '产品验证用合成内容。',
    },
    tags: ['phase17.5b', '题目质量', '人物心理'],
    status: 'drafted',
    revision: 1,
    latestValidationId: `${draftId}:validation:r1`,
    createdAt: NOW,
    updatedAt: NOW,
    version: 'question_resource_admission_v1',
    schemaVersion: 'question_resource_admission_schema_v1',
    ...overrides,
  };
}

function createValidation(draft: StructuredQuestionDraft): ResourceValidationResult {
  return {
    validationId: draft.latestValidationId || `${draft.draftId}:validation:r${draft.revision}`,
    draftId: draft.draftId,
    resourceId: draft.resourceId,
    validatedDraftRevision: draft.revision,
    validationRuleVersion: 'question_resource_admission_schema_v1',
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
