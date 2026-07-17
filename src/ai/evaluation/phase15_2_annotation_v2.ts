import { PHASE15_2_DATASET_V1 } from './phase15_2_dataset_v1.ts';
import {
  DIAGNOSIS_ANNOTATION_PROTOCOL_V2,
  type DiagnosisEvaluationAnnotationSetV2,
  type DiagnosisEvaluationAnnotationV2,
  type RequiredFactBoundary,
  type RootCauseBoundaryCategory,
} from '../schemas/diagnosisQualityPolicyV2.schema.ts';

const FACT_ALIASES: Record<string, string[]> = {
  怀念: ['怀念', '想起过去', '回忆', '珍惜过去'],
  站了很久: ['站了很久', '停留很久', '看了很久', '站那儿半天', '站了半天'],
  自己发现: ['自己发现', '自主发现', '自己检查', '自己查出'],
  漏读: ['漏读', '漏看', '漏掉条件', '题目条件'],
  父亲: ['父亲', '爸爸'],
  把伞给孩子: ['把伞给孩子', '把伞递给孩子', '把伞让给孩子', '把伞留给孩子', '把伞给了孩子', '递伞', '给伞', '将伞递给孩子'],
  赞成: ['赞成', '同意', '可以延长', '支持延长'],
  阅读环境: ['阅读环境', '阅读时间', '多一些选择', '方便阅读', '多待会儿'],
  舍不得: ['舍不得', '不舍'],
  不舍: ['不舍', '舍不得'],
  以前: ['以前', '过去', '回忆'],
  很久: ['很久', '半天'],
  不赞成: ['不赞成', '不同意', '不支持统一延长'],
  早点回家: ['早点回家', '早回家', '回家安排'],
  把伞: ['把伞', '雨伞', '递伞', '给伞'],
  珍惜: ['珍惜', '有意义', '重视', '轻轻保存'],
  停留很久: ['停留很久', '站了很久', '看了很久'],
  检查机会: ['检查机会', '自己检查', '重新检查'],
  读题条件: ['读题条件', '题目条件', '漏读条件'],
  伞: ['伞', '雨伞'],
  自愿: ['自愿', '自行离开', '照常走'],
  站那儿半天: ['站那儿半天', '站了很久', '停留很久'],
  自己查出: ['自己查出', '自己发现', '自己检查'],
  可以延长: ['可以延长', '赞成延长', '支持延长'],
};

const annotations = PHASE15_2_DATASET_V1.samples.map(buildAnnotation);
const validationIssues = validateAnnotations(annotations);

export const PHASE15_2_ANNOTATION_V2: DiagnosisEvaluationAnnotationSetV2 = {
  annotationSetId: 'phase15-diagnosis-annotation-v2',
  annotationVersion: '2.0.0',
  protocolVersion: DIAGNOSIS_ANNOTATION_PROTOCOL_V2,
  datasetId: PHASE15_2_DATASET_V1.datasetId,
  datasetVersion: PHASE15_2_DATASET_V1.datasetVersion,
  datasetContentModified: false,
  status: 'accepted',
  annotations,
  validation: {
    passed: validationIssues.length === 0,
    issues: validationIssues,
  },
};

function buildAnnotation(
  sample: (typeof PHASE15_2_DATASET_V1.samples)[number],
): DiagnosisEvaluationAnnotationV2 {
  return {
    sampleId: sample.sampleId,
    allowedMainAbilities: [...sample.expectedBoundaries.allowedMainAbilities],
    allowedAnswerStatuses: [...sample.expectedBoundaries.allowedAnswerStatuses],
    allowedRootCauseCategories: allowedRootCategories(sample.sampleId, sample.category, sample.targetAbilityId),
    requiredFacts: sample.expectedBoundaries.requiredFacts.map(toFactBoundary),
    forbiddenClaims: [
      ...sample.expectedBoundaries.forbiddenClaims,
      ...sample.expectedBoundaries.forbiddenEvidenceClaims,
    ],
    reviewerAgreement: sample.expectedBoundaries.reviewerAgreement,
    reviewerNotes: [
      ...sample.expectedBoundaries.reviewerNotes,
      'Annotation v2 is an overlay. Dataset v1 question, response and task content remain unchanged.',
    ],
  };
}

function toFactBoundary(fact: string, index: number): RequiredFactBoundary {
  return {
    factId: `fact-${index + 1}-${slug(fact)}`,
    canonicalMeaning: fact,
    acceptedExpressions: unique([fact, ...(FACT_ALIASES[fact] || [])]),
    required: true,
  };
}

function allowedRootCategories(
  sampleId: string,
  category: string,
  ability: string,
): RootCauseBoundaryCategory[] {
  if (['phase15-v1-30', 'phase15-v1-31', 'phase15-v1-32', 'phase15-v1-33', 'phase15-v1-34'].includes(sampleId)) {
    return ['unknown'];
  }
  if (category === 'full_high_quality' || category === 'reasonable_alternative') {
    return ['no_clear_deficit_in_current_response'];
  }
  if (category === 'correct_insufficient_basis') {
    return ability === '表达'
      ? ['expression_incomplete']
      : ability === '概括'
        ? ['incomplete_summary']
        : ['missing_evidence'];
  }
  if (category === 'correct_judgement_wrong_explanation') {
    return ['incorrect_causal_relation', 'unsupported_inference'];
  }
  if (category === 'detail_correct_judgement_wrong') {
    return ability === '概括'
      ? ['incomplete_summary', 'unsupported_inference', 'misread_key_detail']
      : ['incorrect_causal_relation', 'unsupported_inference', 'misread_key_detail'];
  }
  if (category === 'partially_correct') {
    return ability === '表达'
      ? ['expression_incomplete', 'no_clear_deficit_in_current_response']
      : ability === '概括'
        ? ['incomplete_summary']
        : ['missing_evidence'];
  }
  if (category === 'concise_valid' || category === 'colloquial_expression') {
    return ability === '表达'
      ? ['no_clear_deficit_in_current_response', 'expression_incomplete']
      : ability === '概括'
        ? ['no_clear_deficit_in_current_response', 'incomplete_summary']
        : ['no_clear_deficit_in_current_response', 'missing_evidence'];
  }
  if (category === 'prompt_injection') {
    return ability === '概括'
      ? ['no_clear_deficit_in_current_response', 'incomplete_summary']
      : ['no_clear_deficit_in_current_response', 'missing_evidence'];
  }
  return ['unknown'];
}

function validateAnnotations(items: DiagnosisEvaluationAnnotationV2[]): string[] {
  const issues: string[] = [];
  const ids = new Set<string>();
  for (const item of items) {
    if (ids.has(item.sampleId)) issues.push(`Duplicate annotation: ${item.sampleId}.`);
    ids.add(item.sampleId);
    if (item.allowedMainAbilities.length === 0) issues.push(`${item.sampleId}: allowedMainAbilities is empty.`);
    if (item.allowedAnswerStatuses.length === 0) issues.push(`${item.sampleId}: allowedAnswerStatuses is empty.`);
    if (item.allowedRootCauseCategories.length === 0) issues.push(`${item.sampleId}: root cause categories are empty.`);
    if (item.requiredFacts.some((fact) => fact.acceptedExpressions.length === 0)) {
      issues.push(`${item.sampleId}: required fact has no accepted expression.`);
    }
  }
  if (items.length !== PHASE15_2_DATASET_V1.samples.length) {
    issues.push('Annotation count does not match Dataset v1 sample count.');
  }
  return issues;
}

function unique(values: string[]): string[] {
  return [...new Set(values.filter((value) => value.trim().length > 0))];
}

function slug(value: string): string {
  return [...value].map((char) => char.codePointAt(0)?.toString(16)).join('-');
}
