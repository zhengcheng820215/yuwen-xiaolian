import type {
  FrozenQuestionResourceVersion,
  QuestionResourceRubricItem,
} from '../schemas/questionResourceAdmission.schema.ts';
import type { SharedFormalResourceData } from
  '../schemas/sharedFormalResourcePersistence.schema.ts';
import type { ObservationTaskPlan } from '../schemas/materialObservation.schema.ts';
import { SINGLE_CHOICE_INTERACTION_SCHEMA_VERSION } from
  '../schemas/singleChoiceInteraction.schema.ts';
import {
  prepareFormalQuestionGovernanceBatch,
  type FormalQuestionHighRiskGovernanceReport,
  type GovernanceSpecification,
} from './formalQuestionHighRiskGovernanceAgent.ts';

export const FORMAL_QUESTION_LATEST_STANDARD_GOVERNANCE_MARKER =
  'formal-question-latest-standard-governance:2026-08-25-v1' as const;

const SPRING_CHOICE_INTERACTION: NonNullable<FrozenQuestionResourceVersion['choiceInteraction']> = {
  schemaVersion: SINGLE_CHOICE_INTERACTION_SCHEMA_VERSION,
  selectionMode: 'single',
  options: [
    { optionId: 'spring-method', content: '作者按由远到近的顺序介绍了三种景物' },
    { optionId: 'spring-cause', content: '太阳变热直接造成了山色明亮和水位上涨' },
    { optionId: 'spring-correct', content: '春回大地，山水和阳光都显出新的生机' },
    { optionId: 'spring-season', content: '三种景物分别代表春、夏、秋三个季节' },
  ],
  correctOptionIds: ['spring-correct'],
  distractorRationales: [
    {
      optionId: 'spring-method',
      misconceptionCode: 'surface_reading',
      diagnosisMeaning: '把景物共同表现的内容误判为写景顺序。',
      evidenceBoundary: '第2段并未建立由远到近的空间顺序。',
    },
    {
      optionId: 'spring-cause',
      misconceptionCode: 'over_inference',
      diagnosisMeaning: '把并列的春日变化误读成直接因果。',
      evidenceBoundary: '原文并列描写山、水、太阳的变化，没有说明太阳导致其余变化。',
    },
    {
      optionId: 'spring-season',
      misconceptionCode: 'scope_shift',
      diagnosisMeaning: '忽略全文春景语境，把同段景物拆成不同季节。',
      evidenceBoundary: '题目和第2段都限定在春回大地的语境中。',
    },
  ],
  optionSetVersion: 1,
};

const GOVERNANCE_SPECS: GovernanceSpecification[] = [
  {
    materialTitle: '《春》',
    resourceId: 'question-observation-task-plan-10w5bsw',
    expectedSourceVersionId: 'question-observation-task-plan-10w5bsw:v1',
    anchor: { startParagraph: 2, endParagraph: 2 },
    title: '事实 · 春回大地共同含义',
    questionStem: '第2段写“山朗润起来了，水涨起来了，太阳的脸红起来了”，这些描写共同表现了什么？',
    questionType: 'multiple_choice',
    responseFormat: 'single_choice',
    choiceInteraction: SPRING_CHOICE_INTERACTION,
    assessmentMode: 'exact_match',
    expectedStudentAction: '比较三处景物变化，选择能够概括其共同含义的一项。',
    designReason: '修复正式发布投影遗漏，完整保留已通过审查的基础理解单选交互，不改变观察目标。',
    answerAcceptance: {
      acceptedKeywords: [],
      semanticEquivalentAllowed: false,
      acceptedOptionIds: ['spring-correct'],
      normalizationRules: ['trim', 'ignore_punctuation', 'ignore_whitespace'],
    },
    rubric: [choiceRubric()],
    minimumAnswerRequirement: {
      responseFormat: 'single_choice',
      minLength: 0,
      requireTextEvidence: false,
      requireExplanation: false,
      minSelections: 1,
      maxSelections: 1,
    },
    calibrationCases: choiceCalibrationCases(),
  },
  {
    materialTitle: '《女娲造人》',
    resourceId: 'question-observation-task-plan-bp4jxh',
    expectedSourceVersionId: 'question-observation-task-plan-bp4jxh:v1',
    anchor: { startParagraph: 11, endParagraph: 11 },
    title: '理解 · 创造结果与人物反应',
    questionStem: '第11段中，小人会活动，还叫女娲“妈妈”。这些表现为什么会让女娲“满心欢喜，眉开眼笑”？',
    questionType: 'reading_comprehension',
    responseFormat: 'short_text',
    assessmentMode: 'key_points',
    expectedStudentAction: '根据小人的活动和称呼，用一句因果说明女娲喜悦的原因。',
    designReason: '显式化原 Rubric 已要求的因果关系，不增加人物综合分析、主题判断或跨段推理。',
    answerAcceptance: {
      acceptedKeywords: ['小人有了生命', '叫女娲妈妈', '创造成功', '获得情感回应'],
      semanticEquivalentAllowed: true,
      normalizationRules: ['trim', 'ignore_punctuation', 'ignore_whitespace'],
    },
    rubric: [textRubric()],
    minimumAnswerRequirement: {
      minLength: 15,
      requireTextEvidence: true,
      requireExplanation: true,
    },
    calibrationCases: textCalibrationCases(),
  },
];

export function prepareFormalQuestionLatestStandardGovernance(
  source: SharedFormalResourceData,
  now: string,
): { data: SharedFormalResourceData; report: FormalQuestionHighRiskGovernanceReport } {
  return prepareFormalQuestionGovernanceBatch(
    source,
    now,
    FORMAL_QUESTION_LATEST_STANDARD_GOVERNANCE_MARKER,
    GOVERNANCE_SPECS,
    'formal-latest-standard-governance',
  );
}

function choiceRubric(): QuestionResourceRubricItem {
  return {
    itemId: 'formal-latest-standard:春回大地整体理解',
    name: '春回大地整体理解',
    description: '识别三处并列描写共同表现了春回大地、万物苏醒的生机。',
    abilityId: 'comprehension',
    importance: 'critical',
    required: true,
    evidenceRequirement: {
      requireTextEvidence: false,
      requireExplanation: false,
      requireConclusion: false,
    },
    acceptedSignals: ['spring-correct'],
  };
}

function textRubric(): QuestionResourceRubricItem {
  return {
    itemId: 'formal-latest-standard:人物反应与创造结果联系',
    name: '人物反应与创造结果联系',
    description: '说明小人有生命、会叫“妈妈”，表明女娲成功创造了人并获得情感回应，因此感到喜悦。',
    abilityId: 'comprehension',
    importance: 'critical',
    required: true,
    evidenceRequirement: {
      requireTextEvidence: true,
      requireExplanation: true,
      requireConclusion: false,
    },
    acceptedSignals: ['小人有了生命', '叫女娲妈妈', '创造成功', '获得情感回应', '因此喜悦'],
  };
}

function choiceCalibrationCases(): ObservationTaskPlan['calibrationCases'] {
  return [
    calibration('spring-choice-full', 'fully_meets', 'spring-correct', 'fully_meets', 'completed', 'eligible'),
    calibration('spring-choice-partial', 'partially_meets', 'spring-method', 'partially_meets', 'partial', 'eligible_but_weak'),
    calibration('spring-choice-error', 'typical_error', 'spring-season', 'does_not_meet', 'missing', 'eligible'),
    calibration('spring-choice-alternative', 'reasonable_alternative', 'spring-correct', 'fully_meets', 'completed', 'eligible'),
    calibration('spring-choice-empty', 'irrelevant', '未作答', 'insufficient_evidence', 'missing', 'ineligible'),
  ];
}

function textCalibrationCases(): ObservationTaskPlan['calibrationCases'] {
  return [
    calibration('nuwa-relation-full', 'fully_meets', '小人会活动并叫她“妈妈”，说明她成功创造了有生命的人并得到回应，所以十分喜悦。', 'fully_meets', 'completed', 'eligible'),
    calibration('nuwa-relation-partial', 'partially_meets', '因为小人叫她妈妈。', 'partially_meets', 'partial', 'eligible_but_weak'),
    calibration('nuwa-relation-error', 'typical_error', '因为女娲终于可以休息了。', 'does_not_meet', 'missing', 'eligible'),
    calibration('nuwa-relation-alternative', 'reasonable_alternative', '小人的活动和称呼证明创造成功，女娲获得回应后很高兴。', 'fully_meets', 'completed', 'eligible'),
    calibration('nuwa-relation-empty', 'irrelevant', '未作答', 'insufficient_evidence', 'missing', 'ineligible'),
  ];
}

function calibration(
  id: string,
  category: NonNullable<ObservationTaskPlan['calibrationCases']>[number]['category'],
  answerText: string,
  expectedAnswerStatus: NonNullable<ObservationTaskPlan['calibrationCases']>[number]['expectedAnswerStatus'],
  status: 'completed' | 'partial' | 'missing',
  eligibility: 'eligible' | 'eligible_but_weak' | 'ineligible',
): NonNullable<ObservationTaskPlan['calibrationCases']>[number] {
  return {
    calibrationCaseId: `formal-latest-standard:${id}`,
    category,
    answerText,
    expectedAnswerStatus,
    expectedRubricCoverage: [{
      rubricName: id.startsWith('spring') ? '春回大地整体理解' : '人物反应与创造结果联系',
      status,
    }],
    expectedDiagnosisBoundary: '只评价本题规定的主要动作，不外推稳定能力结论。',
    expectedEvidenceEligibility: eligibility,
    reviewNote: '用于本轮 successor 质量边界验收，不作为学生界面示例。',
  };
}
