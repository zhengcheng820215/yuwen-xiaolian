import type {
  FrozenQuestionResourceVersion,
  QuestionResourceRubricItem,
} from '../schemas/questionResourceAdmission.schema.ts';
import type { SharedFormalResourceData } from
  '../schemas/sharedFormalResourcePersistence.schema.ts';
import type { ObservationTaskPlan } from '../schemas/materialObservation.schema.ts';
import {
  prepareFormalQuestionGovernanceBatch,
  type FormalQuestionHighRiskGovernanceReport,
  type GovernanceSpecification,
} from './formalQuestionHighRiskGovernanceAgent.ts';

export const FORMAL_QUESTION_CHANGE_EFFECT_GOVERNANCE_MARKER =
  'formal-question-change-effect-governance:2026-08-25-v1' as const;

const CHANGE_EFFECT_RUBRICS: QuestionResourceRubricItem[] = [
  {
    itemId: 'formal-change-effect:反应变化识别',
    name: '反应变化识别',
    description: '说明人们由不敢说真话、随声附和，转为私下传播并公开说出皇帝没有穿衣服。',
    abilityId: 'analysis',
    importance: 'critical',
    required: true,
    evidenceRequirement: {
      requireTextEvidence: true,
      requireExplanation: false,
      requireConclusion: false,
    },
    acceptedSignals: ['不敢说真话', '随声附和', '私下传播', '公开说出真相', '反应发生变化'],
  },
  {
    itemId: 'formal-change-effect:变化推动骗局揭穿',
    name: '变化推动骗局揭穿',
    description: '说明人们反应的变化打破了集体沉默和附和，使真相扩散并推动骗局暴露。',
    abilityId: 'analysis',
    importance: 'critical',
    required: true,
    evidenceRequirement: {
      requireTextEvidence: true,
      requireExplanation: true,
      requireConclusion: false,
    },
    acceptedSignals: ['打破沉默', '不再附和', '真相扩散', '骗局暴露', '揭穿骗局'],
  },
];

const GOVERNANCE_SPECS: GovernanceSpecification[] = [
  {
    materialTitle: '《皇帝的新装》',
    resourceId: 'question-observation-task-plan-12ktvxo',
    expectedSourceVersionId: 'question-observation-task-plan-12ktvxo:v5',
    anchor: { startParagraph: 34, endParagraph: 37 },
    title: '分析 · 人们反应变化与骗局揭穿',
    questionStem: '小孩子说出“可是他什么衣服也没有穿呀”后，人们的反应发生了怎样的变化？这对揭穿骗局有什么作用？',
    responseFormat: 'short_text',
    expectedStudentAction: '比较孩子说出真相前后人们的反应，再说明这种变化怎样打破集体沉默、传播真相并推动骗局被揭穿。',
    designReason: '恢复“先观察变化、再解释作用”的学生思考顺序；两个问句属于同一条短因果链，不追加主题分析。',
    answerAcceptance: acceptance([
      '不敢说真话',
      '随声附和',
      '私下传播',
      '公开说出真相',
      '打破沉默',
      '不再附和',
      '真相扩散',
      '揭穿骗局',
    ]),
    rubric: CHANGE_EFFECT_RUBRICS,
    minimumAnswerRequirement: {
      minLength: 25,
      requireTextEvidence: true,
      requireExplanation: true,
    },
    calibrationCases: calibrationCases(),
  },
];

export function prepareFormalQuestionChangeEffectGovernance(
  source: SharedFormalResourceData,
  now: string,
): { data: SharedFormalResourceData; report: FormalQuestionHighRiskGovernanceReport } {
  return prepareFormalQuestionGovernanceBatch(
    source,
    now,
    FORMAL_QUESTION_CHANGE_EFFECT_GOVERNANCE_MARKER,
    GOVERNANCE_SPECS,
    'formal-change-effect-governance',
  );
}

function acceptance(keywords: string[]): FrozenQuestionResourceVersion['answerAcceptance'] {
  return {
    acceptedKeywords: keywords,
    semanticEquivalentAllowed: true,
    normalizationRules: ['trim', 'ignore_punctuation', 'ignore_whitespace'],
  };
}

function calibrationCases(): ObservationTaskPlan['calibrationCases'] {
  return [
    calibration(
      'fully_meets',
      '孩子说出真相前，人们明明看出皇帝没有穿衣服却随声附和；之后真话先在人群中传开，大家又公开喊出皇帝没有穿衣服。这打破了集体沉默，使真相扩散，骗局因此暴露。',
      'fully_meets',
      'completed',
      'completed',
      'eligible',
    ),
    calibration(
      'partially_meets',
      '孩子说完后，人们不再附和，也开始说皇帝没有穿衣服。',
      'partially_meets',
      'completed',
      'partial',
      'eligible_but_weak',
    ),
    calibration(
      'typical_error',
      '人们觉得孩子很勇敢，所以都开始赞美他。',
      'does_not_meet',
      'missing',
      'missing',
      'eligible',
    ),
    calibration(
      'reasonable_alternative',
      '众人原来害怕被当作愚蠢的人，只敢跟着称赞；孩子的话使他们从私下传话转为公开承认真相，附和形成的假象被打破，骗局随之被揭穿。',
      'fully_meets',
      'completed',
      'completed',
      'eligible',
    ),
    calibration(
      'irrelevant',
      '皇帝很喜欢漂亮的新衣服。',
      'insufficient_evidence',
      'missing',
      'missing',
      'ineligible',
    ),
  ];
}

function calibration(
  category: NonNullable<ObservationTaskPlan['calibrationCases']>[number]['category'],
  answerText: string,
  expectedAnswerStatus: NonNullable<ObservationTaskPlan['calibrationCases']>[number]['expectedAnswerStatus'],
  changeStatus: 'completed' | 'partial' | 'missing',
  effectStatus: 'completed' | 'partial' | 'missing',
  eligibility: 'eligible' | 'eligible_but_weak' | 'ineligible',
): NonNullable<ObservationTaskPlan['calibrationCases']>[number] {
  return {
    calibrationCaseId: `formal-change-effect:${category}`,
    category,
    answerText,
    expectedAnswerStatus,
    expectedRubricCoverage: [
      { rubricName: '反应变化识别', status: changeStatus },
      { rubricName: '变化推动骗局揭穿', status: effectStatus },
    ],
    expectedDiagnosisBoundary: '只判断是否识别人们的反应变化，并说明该变化与骗局暴露的直接关系；不外推主题理解或稳定能力结论。',
    expectedEvidenceEligibility: eligibility,
    reviewNote: '用于“变化—作用”短因果链题的 successor 质量边界验收，不作为学生界面示例。',
  };
}
