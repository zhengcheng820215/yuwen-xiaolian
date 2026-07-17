import {
  evaluateDiagnosisQualityPolicyV2Legacy,
  evaluateDiagnosisStabilityV2,
} from '../agents/diagnosisQualityEvaluationV2Agent.ts';
import { PHASE15_2_ANNOTATION_V2 } from '../evaluation/phase15_2_annotation_v2.ts';
import { PHASE15_2_DATASET_V1 } from '../evaluation/phase15_2_dataset_v1.ts';
import type {
  DiagnosisCandidateSnapshot,
  DiagnosisQualityEvaluationV2,
} from '../schemas/diagnosisQualityPolicyV2.schema.ts';

type Check = { label: string; passed: boolean; detail: string };

const checks: Check[] = [];
const sampleById = new Map(PHASE15_2_DATASET_V1.samples.map((sample) => [sample.sampleId, sample]));
const annotationById = new Map(PHASE15_2_ANNOTATION_V2.annotations.map((item) => [item.sampleId, item]));

checks.push(check(
  'Annotation Protocol v2 covers Dataset v1 without modifying it',
  PHASE15_2_ANNOTATION_V2.validation.passed &&
    PHASE15_2_ANNOTATION_V2.datasetContentModified === false &&
    PHASE15_2_ANNOTATION_V2.annotations.length === PHASE15_2_DATASET_V1.samples.length,
  `${PHASE15_2_ANNOTATION_V2.annotations.length}/${PHASE15_2_DATASET_V1.samples.length}`,
));

const strongAnswer = evaluate('phase15-v1-01', 1, {
  mainAbility: '推理',
  answerStatus: 'fully_meets',
  rootCause: '本次作答未暴露明确能力缺口，后续仍需通过新情境观察稳定性',
  surfaceError: '本次作答未发现明确表面错误',
  abilityEvidence: ['学生写出了“怀念”，并引用“站了很久”作为依据。'],
  diagnosisSummary: '学生完成了心理判断、文本依据与关系说明。',
});
checks.push(check('优秀答案允许 no_clear_deficit，不强造弱点', strongAnswer.qualityLevel === 'accepted', strongAnswer.qualityLevel));
checks.push(check('学生原话引用按来源验证通过', strongAnswer.dimensions.quoteAttributionValid, JSON.stringify(strongAnswer.attributionEnvelope.attributions)));

const rubricQuote = evaluate('phase15-v1-15', 2, {
  mainAbility: '概括',
  answerStatus: 'partially_meets',
  rootCause: '未能准确提取文本核心事件，将个人主观推断混入概括中，导致概括偏离原文。',
  surfaceError: '学生保留了部分事件，但添加了原文未提及的主观推断。',
  abilityEvidence: [
    '学生答案保留了“父亲把伞给孩子后自己淋雨”这一事件，符合rubric中“保留主要事件”的部分要求。',
    '学生答案不符合“表达简洁完整”的要求。',
  ],
  diagnosisSummary: '学生能提取部分事件，但中心结论错误。',
}, {
  qualityLevel: 'critical_violation',
  failedDimensions: ['answerStatusAccepted', 'studentQuoteFaithful', 'textEvidenceFaithful', 'noCriticalHallucination'],
  violations: ['Invented quote: 保留主要事件', 'Invented quote: 表达简洁完整'],
});
checks.push(check('Rubric 术语不再被误判为学生虚构引用', rubricQuote.dimensions.quoteAttributionValid, JSON.stringify(rubricQuote.attributionEnvelope.attributions)));
checks.push(check('Sample 15 仍保留 answerStatus 模型问题', rubricQuote.qualityLevel === 'unacceptable' && rubricQuote.reviewFindings.some((item) => item.dimension === 'answer_status' && item.attribution === 'confirmed_model_issue'), rubricQuote.qualityLevel));
checks.push(check('Sample 15 引用误报归因为 evaluator_false_positive', rubricQuote.reviewFindings.some((item) => item.dimension === 'quote_attribution' && item.attribution === 'evaluator_false_positive'), JSON.stringify(rubricQuote.reviewFindings)));

const inventedStudentQuote = evaluate('phase15-v1-05', 1, {
  mainAbility: '推理',
  answerStatus: 'partially_meets',
  rootCause: '推理链不完整，缺少文本依据。',
  surfaceError: '回答只有结论。',
  abilityEvidence: ['学生引用了“站了很久”作为依据。'],
  diagnosisSummary: '需要补充依据。',
});
checks.push(check('材料原话被伪装成学生引用时仍触发 critical', inventedStudentQuote.qualityLevel === 'critical_violation', inventedStudentQuote.qualityLevel));

const negatedMaterialQuote = evaluate('phase15-v1-23', 1, {
  mainAbility: '推理',
  answerStatus: 'partially_meets',
  rootCause: '推理链表达不完整：能推断心理但未按题目要求结合文本动作说明理由。',
  surfaceError: '学生答案未明确引用原文具体动作（如“站了很久”“小心夹回”）。',
  abilityEvidence: [
    '学生提到“停留很久并轻轻保存树叶”，但未具体引用“站了很久”等原文表述。',
  ],
  diagnosisSummary: '学生能推断人物心理，但模型认为依据表达不完整。',
});
checks.push(check(
  '“未具体引用材料原话”是否定说明，不伪装成学生原话',
  negatedMaterialQuote.dimensions.quoteAttributionValid && negatedMaterialQuote.qualityLevel !== 'critical_violation',
  `${negatedMaterialQuote.qualityLevel}/${JSON.stringify(negatedMaterialQuote.attributionEnvelope.attributions)}`,
));

const aliasFact = evaluate('phase15-v1-03', 1, {
  mainAbility: '概括',
  answerStatus: 'fully_meets',
  rootCause: '本次作答未暴露明确能力缺口。',
  surfaceError: '未发现明确错误。',
  abilityEvidence: ['学生概括了父亲在雨中等待，并把伞递给孩子的主要事件。'],
  diagnosisSummary: '人物和主要事件完整。',
});
checks.push(check('Required Fact 概念组接受“递给”同义表达', aliasFact.dimensions.requiredFactsPresent, aliasFact.missingFactIds.join(',')));

const missingEvidence = evaluate('phase15-v1-05', 2, {
  mainAbility: '推理',
  answerStatus: 'partially_meets',
  rootCause: '推理链不完整：缺乏从文本动作到心理结论的推理过程。',
  surfaceError: '学生只给出舍不得的判断。',
  abilityEvidence: ['学生判断父亲舍不得，但没有提供动作依据。'],
  diagnosisSummary: '判断方向基本成立，依据不足。',
});
checks.push(check('结构化 Root Cause 接受 missing_evidence 同义表达', missingEvidence.dimensions.rootCauseCategoryAccepted, missingEvidence.detectedRootCauseCategories.join(',')));

const unknownRoot = evaluate('phase15-v1-05', 3, {
  mainAbility: '推理',
  answerStatus: 'partially_meets',
  rootCause: '需要继续观察。',
  surfaceError: '回答较短。',
  abilityEvidence: ['学生写出舍不得。'],
  diagnosisSummary: '暂不确定具体问题。',
});
checks.push(check('无法安全分类的 Root Cause 进入 questionable 而非强判错误', unknownRoot.qualityLevel === 'questionable' && unknownRoot.detectedRootCauseCategories.includes('unknown'), unknownRoot.qualityLevel));

const stableBoundary = evaluateDiagnosisStabilityV2([missingEvidence, unknownRoot, evaluate('phase15-v1-05', 4, {
  mainAbility: '推理',
  answerStatus: 'partially_meets',
  rootCause: '缺少文本动作依据。',
  surfaceError: '依据不足。',
  abilityEvidence: ['学生写出舍不得。'],
  diagnosisSummary: '判断存在，但依据不足。',
})]);
checks.push(check('Boundary Stability 与 Quality Stability 分开计算', stableBoundary.boundaryStability === 'stable_within_boundary' && stableBoundary.qualityStability === 'quality_unstable', `${stableBoundary.boundaryStability}/${stableBoundary.qualityStability}`));

const stableAccepted = evaluateDiagnosisStabilityV2([
  strongAnswer,
  evaluate('phase15-v1-01', 2, strongAnswerCandidate()),
  evaluate('phase15-v1-01', 3, strongAnswerCandidate()),
]);
checks.push(check('三次边界和质量均稳定时输出 stable_accepted', stableAccepted.boundaryStability === 'stable_within_boundary' && stableAccepted.qualityStability === 'stable_accepted', `${stableAccepted.boundaryStability}/${stableAccepted.qualityStability}`));

console.log('\nPhase 15.2 Diagnosis Quality Policy v2 Debug');
console.log('='.repeat(76));
for (const item of checks) console.log(`${item.passed ? 'PASS' : 'FAIL'} | ${item.label} | ${item.detail}`);
const passed = checks.filter((item) => item.passed).length;
console.log('-'.repeat(76));
console.log(`Result: ${passed}/${checks.length} PASS`);
if (passed !== checks.length) process.exitCode = 1;

function evaluate(
  sampleId: string,
  runIndex: number,
  candidate: DiagnosisCandidateSnapshot,
  previousPolicyResult?: {
    qualityLevel: 'accepted' | 'questionable' | 'unacceptable' | 'critical_violation';
    failedDimensions: string[];
    violations: string[];
  },
): DiagnosisQualityEvaluationV2 {
  const sample = sampleById.get(sampleId);
  const annotation = annotationById.get(sampleId);
  if (!sample || !annotation) throw new Error(`Missing fixture for ${sampleId}.`);
  return evaluateDiagnosisQualityPolicyV2Legacy({
    datasetVersion: PHASE15_2_DATASET_V1.datasetVersion,
    annotationVersion: PHASE15_2_ANNOTATION_V2.annotationVersion,
    sampleId,
    runId: `${sampleId}#${runIndex}`,
    studentAnswer: sample.taskExecutionResult.studentResponse?.answerText || '',
    readingText: sample.concreteTask.readingText,
    question: sample.concreteTask.question,
    referenceAnswer: sample.concreteTask.referenceAnswer,
    rubricTerms: [
      ...sample.concreteTask.scoringPoints,
      ...sample.concreteTask.rubric.map((item) => item.name),
    ],
    candidate,
    annotation,
    previousPolicyResult,
    evaluatedAt: '2026-07-17T12:30:00.000Z',
  });
}

function strongAnswerCandidate(): DiagnosisCandidateSnapshot {
  return {
    mainAbility: '推理',
    answerStatus: 'fully_meets',
    rootCause: '本次作答未暴露明确能力缺口。',
    surfaceError: '未发现明确错误。',
    abilityEvidence: ['学生写出了“怀念”，并引用“站了很久”作为依据。'],
    diagnosisSummary: '心理判断、依据与关系说明完整。',
  };
}

function check(label: string, passed: boolean, detail: string): Check {
  return { label, passed, detail };
}
