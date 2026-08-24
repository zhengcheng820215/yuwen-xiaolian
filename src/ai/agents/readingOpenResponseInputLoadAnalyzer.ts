import {
  READING_OPEN_RESPONSE_INPUT_LOAD_AUDIT_VERSION,
  READING_OPEN_RESPONSE_INPUT_LOAD_POLICY_VERSION,
  isTextResponseFormat,
  type CanonicalTextResponseAction,
  type TextResponseCompositeLoadReason,
  type TextResponseLoadAnalysisInput,
  type TextResponseLoadAuditFinding,
  type TextResponseLoadAuditResult,
  type TextResponseLoadDisposition,
  type TextResponseLoadLevel,
} from '../schemas/readingOpenResponseInputLoad.schema.ts';
import type { PrimaryAbilityId } from '../schemas/questionResourceAdmission.schema.ts';

const ACTION_PATTERNS: Array<{
  action: CanonicalTextResponseAction;
  pattern: RegExp;
  rank: number;
}> = [
  { action: 'locate_information', pattern: /定位|哪一段|哪一句|何处|在哪里/u, rank: 1 },
  { action: 'extract_evidence', pattern: /找出|写出|指出|摘录|列举|提取|具体描写|具体语句/u, rank: 2 },
  { action: 'identify_relation', pattern: /指代|对应关系|因果关系|照应|呼应|承接/u, rank: 3 },
  { action: 'explain_local_meaning', pattern: /说明|解释|含义|为什么|原因|理解最准确/u, rank: 4 },
  { action: 'summarize_content', pattern: /概括|归纳|梳理|主要内容|关键行动/u, rank: 5 },
  { action: 'connect_evidence_and_conclusion', pattern: /依据.{0,12}(说明|判断)|证据.{0,12}(说明|结论)|结合.{0,12}说明/u, rank: 6 },
  { action: 'infer_from_evidence', pattern: /推断|推测|猜测|由此可见|可以看出/u, rank: 7 },
  { action: 'compare_objects', pattern: /比较|对比|异同|不同之处|共同点/u, rank: 8 },
  { action: 'analyze_character', pattern: /分析.{0,12}(人物|形象|心理|性格|品质)|(?:人物|形象|心理|性格|品质).{0,12}(分析|概括|说明)/u, rank: 9 },
  { action: 'analyze_theme', pattern: /(?:分析|说明).{0,12}(主题|主旨|中心|社会现象)|(?:主题|主旨|中心思想|社会现象).{0,12}(说明|分析|表达)/u, rank: 10 },
  { action: 'analyze_structure', pattern: /结构|铺垫|伏笔|线索|过渡|承上启下|情节发展.{0,12}作用/u, rank: 11 },
  { action: 'evaluate_expression', pattern: /赏析|表达效果|修辞|写法|语言特点|表现力/u, rank: 12 },
];

const ABILITY_ACTION: Record<PrimaryAbilityId, CanonicalTextResponseAction> = {
  extraction: 'extract_evidence',
  comprehension: 'explain_local_meaning',
  summarization: 'summarize_content',
  analysis: 'connect_evidence_and_conclusion',
  inference: 'infer_from_evidence',
  expression: 'evaluate_expression',
};

const LEVEL_BANDS: Record<TextResponseLoadLevel, { recommendedMin: number; recommendedMax: number }> = {
  entry_short: { recommendedMin: 10, recommendedMax: 25 },
  focused_short: { recommendedMin: 20, recommendedMax: 40 },
  developing: { recommendedMin: 30, recommendedMax: 60 },
  integrated: { recommendedMin: 50, recommendedMax: 100 },
};

const DISPOSITION_PRIORITY: Record<TextResponseLoadDisposition, number> = {
  retain: 0,
  copy_or_length_adjustment: 1,
  decompose_or_refocus: 2,
  regenerate: 3,
};

export function analyzeReadingOpenResponseInputLoad(
  input: TextResponseLoadAnalysisInput,
): TextResponseLoadAuditResult | null {
  if (!isTextResponseFormat(input.responseFormat)) return null;

  const requiredRubric = input.rubric.filter((item) => item.required);
  const stemText = normalizeText(`${input.title || ''} ${input.questionStem}`);
  const rubricText = normalizeText(requiredRubric.map((item) => (
    `${item.name} ${item.description || ''}`
  )).join(' '));
  const actionText = normalizeText(`${input.questionStem} ${input.expectedStudentAction || ''}`);
  const stemActions = detectActions(actionText);
  const rubricActions = detectActions(rubricText);
  const fallbackAction = ABILITY_ACTION[input.abilityMetadata.abilityId];
  const operationalActions = stemActions.length > 0 ? stemActions : [fallbackAction];
  const allActions = uniqueActions([
    ...stemActions,
    ...rubricActions,
    fallbackAction,
  ]);
  const orderedActions = [...allActions].sort((left, right) => (
    actionRank(right) - actionRank(left) || left.localeCompare(right)
  ));
  const primaryAction = orderedActions[0] || fallbackAction;
  const supportingAction = orderedActions.find((action) => action !== primaryAction);
  const independentActionCount = countIndependentActions(stemActions, rubricActions);
  const requiredEvidenceCount = resolveEvidenceCount(input, stemText, requiredRubric.length);
  const requiredRelationCount = resolveRelationCount(stemText, operationalActions, requiredRubric.length);
  const requiredObjectCount = resolveObjectCount(stemText, operationalActions);
  const wholeText = /全文|整篇|结合文章|联系全文|通读全文/u.test(stemText);
  const compositeLoadReasons = resolveCompositeReasons({
    independentActionCount,
    evidenceCount: requiredEvidenceCount,
    relationCount: requiredRelationCount,
    objectCount: requiredObjectCount,
    wholeText,
    requiredRubricCount: requiredRubric.length,
  });
  const loadLevel = resolveLoadLevel({
    primaryAction,
    independentActionCount,
    evidenceCount: requiredEvidenceCount,
    relationCount: requiredRelationCount,
    objectCount: requiredObjectCount,
    wholeText,
    requiredRubricCount: requiredRubric.length,
  });
  const expectedAnswerLengthBand = resolveLengthBand(loadLevel, {
    evidenceCount: requiredEvidenceCount,
    relationCount: requiredRelationCount,
    objectCount: requiredObjectCount,
  });
  const missingCoreInput = !input.questionVersionId?.trim()
    || !input.questionStem?.trim()
    || !input.minimumAnswerRequirement
    || !input.abilityMetadata?.abilityId;
  const partialInput = !input.materialVersionId
    || input.rubric.length === 0
    || input.sourceAnchorIds === undefined;
  const analysisCompleteness = missingCoreInput
    ? 'insufficient_input'
    : partialInput ? 'partial' : 'complete';
  const findings: TextResponseLoadAuditFinding[] = [];

  if (analysisCompleteness !== 'complete') {
    findings.push(finding(
      'analysis_input_incomplete',
      'info',
      ['questionStem', 'rubric', 'sourceAnchorIds', 'materialVersionId'],
      '结构化输入不足，当前负担画像只能作为保守审计结果。',
      'retain',
    ));
  }

  if (independentActionCount >= 3) {
    findings.push(finding(
      'composite_core_actions',
      'high_risk',
      ['questionStem', 'rubric'],
      '题目包含三个或更多可独立评分的核心动作，学生需要同时承担过多任务。',
      'decompose_or_refocus',
    ));
  }

  const hiddenRubricActions = rubricActions.filter((action) => !stemActions.includes(action));
  if (requiredRubric.length >= 2 && hiddenRubricActions.length > 0) {
    findings.push(finding(
      'hidden_rubric_requirement',
      'warning',
      ['questionStem', 'rubric'],
      '评分标准包含题干没有明确提出的核心观察动作。',
      'decompose_or_refocus',
    ));
  }

  const evidenceCharacterCount = Math.max(0, input.sourceEvidenceCharacterCount || 0);
  if (
    evidenceCharacterCount > 0
    && evidenceCharacterCount < 60
    && (loadLevel === 'integrated' || numericBucket(requiredEvidenceCount) >= 3)
  ) {
    findings.push(finding(
      'evidence_scope_insufficient',
      'high_risk',
      ['sourceAnchorIds', 'questionStem', 'rubric'],
      '当前证据范围较短，却要求综合或多证据分析，材料范围可能无法支撑作答。',
      'regenerate',
    ));
  }

  if (numericBucket(requiredEvidenceCount) >= 3 && loadLevel !== 'integrated') {
    findings.push(finding(
      'evidence_requirement_excessive',
      'warning',
      ['minimumAnswerRequirement', 'rubric'],
      '证据数量要求超过当前题目负担等级可合理承载的范围。',
      'decompose_or_refocus',
    ));
  }

  if (numericBucket(requiredObjectCount) >= 3) {
    findings.push(finding(
      'object_scope_overloaded',
      'warning',
      ['questionStem', 'rubric'],
      '题目要求同时处理三个或更多对象，建议检查是否需要缩小观察范围。',
      'decompose_or_refocus',
    ));
  }

  if (numericBucket(requiredRelationCount) >= 2 && input.responseFormat === 'short_text') {
    findings.push(finding(
      'relation_load_overloaded',
      'warning',
      ['questionStem', 'responseFormat'],
      '短文本作答需要组织多个关系，输入负担与作答形式可能不匹配。',
      'decompose_or_refocus',
    ));
  }

  if (
    (loadLevel === 'integrated' && input.responseFormat === 'short_text')
    || (loadLevel === 'entry_short' && input.responseFormat === 'long_text')
  ) {
    findings.push(finding(
      'response_format_load_mismatch',
      'warning',
      ['responseFormat', 'questionStem', 'rubric'],
      '作答形式与当前题目的实际输入负担不匹配。',
      'copy_or_length_adjustment',
    ));
  }

  const minLength = Math.max(0, Number(input.minimumAnswerRequirement.minLength || 0));
  if (
    minLength > expectedAnswerLengthBand.recommendedMax
    || (loadLevel === 'entry_short' && minLength > 30)
    || (loadLevel === 'focused_short' && minLength > 60)
  ) {
    findings.push(finding(
      'minimum_length_overweighted',
      'warning',
      ['minimumAnswerRequirement.minLength'],
      '最低字数明显高于完成当前认知动作通常需要的内部推荐范围。',
      'copy_or_length_adjustment',
    ));
  }

  if (
    minLength > 0
    && ((loadLevel === 'integrated' && minLength < 30)
      || (loadLevel === 'developing' && minLength < 15))
  ) {
    findings.push(finding(
      'minimum_length_under_supports_rubric',
      'info',
      ['minimumAnswerRequirement.minLength', 'rubric'],
      '最低作答要求可能不足以承载评分标准要求的证据和关系组织。',
      'copy_or_length_adjustment',
    ));
  }

  const sortedFindings = sortFindings(findings);
  return {
    questionVersionId: input.questionVersionId,
    materialVersionId: input.materialVersionId,
    responseFormat: input.responseFormat,
    analysisCompleteness,
    profile: missingCoreInput ? undefined : {
      policyVersion: READING_OPEN_RESPONSE_INPUT_LOAD_POLICY_VERSION,
      loadLevel,
      primaryAction,
      ...(supportingAction ? { supportingAction } : {}),
      requiredEvidenceUnitCount: bucketCount(requiredEvidenceCount),
      requiredRelationCount: relationBucket(requiredRelationCount),
      requiredObjectCount: objectBucket(requiredObjectCount),
      expectedAnswerLengthBand,
      compositeLoadReasons,
    },
    findings: sortedFindings,
    disposition: resolveDisposition(sortedFindings),
    analyzerVersion: READING_OPEN_RESPONSE_INPUT_LOAD_AUDIT_VERSION,
  };
}

export function countSemanticCharacters(value: string): number {
  return Array.from(value.trim().replace(/\s+/gu, '')).length;
}

function detectActions(text: string): CanonicalTextResponseAction[] {
  return ACTION_PATTERNS
    .filter(({ pattern }) => pattern.test(text))
    .map(({ action }) => action);
}

function uniqueActions(actions: CanonicalTextResponseAction[]): CanonicalTextResponseAction[] {
  return [...new Set(actions)];
}

function actionRank(action: CanonicalTextResponseAction): number {
  return ACTION_PATTERNS.find((item) => item.action === action)?.rank || 0;
}

function countIndependentActions(
  stemActions: CanonicalTextResponseAction[],
  rubricActions: CanonicalTextResponseAction[],
): number {
  const source = stemActions.length > 0 ? stemActions : rubricActions;
  const families = new Set(uniqueActions(source).map(actionFamily));
  if (families.size > 1) families.delete('evidence_location');
  const hasHighOrder = [...families].some((family) => [
    'infer_from_evidence',
    'compare_objects',
    'analyze_character',
    'analyze_theme',
    'analyze_structure',
    'evaluate_expression',
  ].includes(family));
  if (hasHighOrder) families.delete('evidence_explanation');
  return Math.max(1, families.size);
}

function actionFamily(action: CanonicalTextResponseAction): string {
  if (action === 'locate_information' || action === 'extract_evidence') return 'evidence_location';
  if (
    action === 'explain_local_meaning'
    || action === 'connect_evidence_and_conclusion'
  ) return 'evidence_explanation';
  return action;
}

function resolveEvidenceCount(
  input: TextResponseLoadAnalysisInput,
  text: string,
  requiredRubricCount: number,
): number {
  const anchorCount = Math.min(3, new Set(input.sourceAnchorIds || []).size);
  let count = 0;
  if (/至少.{0,2}(三|3)处|三处|三个证据/u.test(text)) count = Math.max(count, 3);
  else if (/至少.{0,2}(两|2)处|两处|两个证据|分别.{0,10}(找出|指出|说明)/u.test(text)) {
    count = Math.max(count, 2);
  }
  const paragraphRange = text.match(/第\s*(\d+)\s*[-—至到]\s*(\d+)\s*段/u);
  if (paragraphRange) {
    const start = Number(paragraphRange[1]);
    const end = Number(paragraphRange[2]);
    if (Number.isInteger(start) && Number.isInteger(end) && end >= start) {
      count = Math.max(count, Math.min(3, end - start + 1));
    }
  }
  if (
    input.minimumAnswerRequirement.requireTextEvidence
    || input.rubric.some((item) => item.required && item.evidenceRequirement?.requireTextEvidence)
    || /依据|证据|原文|结合.{0,10}(语句|内容|描写)/u.test(text)
  ) count = Math.max(count, Math.max(1, anchorCount));
  if (/全文|整篇|联系全文/u.test(text) && requiredRubricCount >= 2) count = Math.max(count, 2);
  return Math.min(3, count);
}

function resolveRelationCount(
  text: string,
  actions: CanonicalTextResponseAction[],
  requiredRubricCount: number,
): number {
  let count = actions.some((action) => [
    'identify_relation',
    'explain_local_meaning',
    'connect_evidence_and_conclusion',
    'infer_from_evidence',
    'compare_objects',
    'analyze_character',
    'analyze_theme',
    'analyze_structure',
    'evaluate_expression',
  ].includes(action)) ? 1 : 0;
  if (
    /分别.{0,18}(说明|分析|比较)|从.{0,24}(方面|角度)|内容.{0,20}结构|心理.{0,20}处境/u
      .test(text)
    || (actions.includes('compare_objects') && requiredRubricCount >= 2)
  ) count = 2;
  return count;
}

function resolveObjectCount(text: string, actions: CanonicalTextResponseAction[]): number {
  if (/三个|三种|三方面|三处|3个/u.test(text)) return 3;
  if (
    /两个|两种|两方面|两处|2个|分别/u.test(text)
    || actions.includes('compare_objects')
  ) return 2;
  return 1;
}

function resolveCompositeReasons(input: {
  independentActionCount: number;
  evidenceCount: number;
  relationCount: number;
  objectCount: number;
  wholeText: boolean;
  requiredRubricCount: number;
}): TextResponseCompositeLoadReason[] {
  const reasons: TextResponseCompositeLoadReason[] = [];
  if (input.independentActionCount >= 3) reasons.push('multiple_independent_actions');
  if (input.evidenceCount >= 2) reasons.push('multiple_required_evidence_units');
  if (input.relationCount >= 2) reasons.push('multiple_required_relations');
  if (input.objectCount >= 2) reasons.push('multiple_required_objects');
  if (input.wholeText) reasons.push('whole_text_integration');
  if (input.requiredRubricCount >= 3) reasons.push('rubric_requirement_density');
  return reasons;
}

function resolveLoadLevel(input: {
  primaryAction: CanonicalTextResponseAction;
  independentActionCount: number;
  evidenceCount: number;
  relationCount: number;
  objectCount: number;
  wholeText: boolean;
  requiredRubricCount: number;
}): TextResponseLoadLevel {
  const highOrder = [
    'infer_from_evidence',
    'compare_objects',
    'analyze_character',
    'analyze_theme',
    'analyze_structure',
    'evaluate_expression',
  ].includes(input.primaryAction);
  if (
    input.evidenceCount >= 3
    || input.relationCount >= 2
    || input.objectCount >= 3
    || input.independentActionCount >= 3
    || (input.wholeText && highOrder && input.requiredRubricCount >= 2)
  ) return 'integrated';
  if (
    input.evidenceCount >= 2
    || input.objectCount >= 2
    || input.independentActionCount >= 2
    || highOrder
    || input.requiredRubricCount >= 2
  ) return 'developing';
  if (
    input.relationCount >= 1
    || input.evidenceCount >= 1
    || ['explain_local_meaning', 'connect_evidence_and_conclusion']
      .includes(input.primaryAction)
  ) return 'focused_short';
  return 'entry_short';
}

function resolveLengthBand(
  level: TextResponseLoadLevel,
  input: { evidenceCount: number; relationCount: number; objectCount: number },
): { recommendedMin: number; recommendedMax: number } {
  const base = LEVEL_BANDS[level];
  const extra = Math.max(0, input.evidenceCount - 1) * 5
    + Math.max(0, input.relationCount - 1) * 5
    + Math.max(0, input.objectCount - 1) * 3;
  return {
    recommendedMin: base.recommendedMin,
    recommendedMax: Math.min(120, base.recommendedMax + extra),
  };
}

function bucketCount(value: number): 0 | 1 | 2 | '3_or_more' {
  if (value >= 3) return '3_or_more';
  if (value === 2) return 2;
  if (value === 1) return 1;
  return 0;
}

function relationBucket(value: number): 0 | 1 | '2_or_more' {
  if (value >= 2) return '2_or_more';
  return value === 1 ? 1 : 0;
}

function objectBucket(value: number): 1 | 2 | '3_or_more' {
  if (value >= 3) return '3_or_more';
  return value === 2 ? 2 : 1;
}

function numericBucket(value: 0 | 1 | 2 | '2_or_more' | '3_or_more'): number {
  if (value === '3_or_more') return 3;
  if (value === '2_or_more') return 2;
  return value;
}

function finding(
  code: TextResponseLoadAuditFinding['code'],
  severity: TextResponseLoadAuditFinding['severity'],
  evidencePaths: string[],
  explanation: string,
  recommendedDisposition: TextResponseLoadDisposition,
): TextResponseLoadAuditFinding {
  return {
    code,
    severity,
    evidencePaths: [...new Set(evidencePaths)].sort(),
    explanation,
    recommendedDisposition,
  };
}

function sortFindings(findings: TextResponseLoadAuditFinding[]): TextResponseLoadAuditFinding[] {
  const severityRank = { high_risk: 0, warning: 1, info: 2 } as const;
  return [...new Map(findings.map((item) => [item.code, item])).values()]
    .sort((left, right) => (
      severityRank[left.severity] - severityRank[right.severity]
      || left.code.localeCompare(right.code)
    ));
}

function resolveDisposition(findings: TextResponseLoadAuditFinding[]): TextResponseLoadDisposition {
  return findings.reduce<TextResponseLoadDisposition>((current, item) => (
    DISPOSITION_PRIORITY[item.recommendedDisposition] > DISPOSITION_PRIORITY[current]
      ? item.recommendedDisposition
      : current
  ), 'retain');
}

function normalizeText(value: string): string {
  return value.replace(/\s+/gu, ' ').trim();
}
