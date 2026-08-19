import type {
  QuestionResourceRubricItem,
} from '../schemas/questionResourceAdmission.schema.ts';

export type HiddenRequiredRubricDimension =
  | 'text_evidence'
  | 'explanation'
  | 'structure'
  | 'comparison'
  | 'cause'
  | 'emotion_or_theme'
  | 'technique_or_effect';

export type QuestionStemRubricAlignmentResult = {
  aligned: boolean;
  hiddenDimensions: HiddenRequiredRubricDimension[];
  rubricItemIds: string[];
};

const DIMENSION_LABELS: Record<HiddenRequiredRubricDimension, string> = {
  text_evidence: '文本依据',
  explanation: '解释关系',
  structure: '结构关系',
  comparison: '比较分析',
  cause: '原因或因果',
  emotion_or_theme: '情感或主题',
  technique_or_effect: '写法或表达效果',
};

export function assessQuestionStemRubricAlignment(
  questionStem: string,
  rubric: QuestionResourceRubricItem[],
): QuestionStemRubricAlignmentResult {
  const stem = normalize(questionStem);
  const required = rubric.filter((item) => item.required);
  const hiddenDimensions = new Set<HiddenRequiredRubricDimension>();
  const hiddenItemIds = new Set<string>();

  for (const item of required) {
    // The description and accepted signals normally contain the expected answer.
    // Treating those answer details as extra student actions creates false blockers.
    // Only the rubric item label is used to detect an independently graded dimension.
    const rubricActionLabel = normalizeRubricActionLabel(item.name);
    const itemDimensions = new Set<HiddenRequiredRubricDimension>();
    if (item.evidenceRequirement?.requireTextEvidence && !asksForTextEvidence(stem)) {
      itemDimensions.add('text_evidence');
    }
    if (item.evidenceRequirement?.requireExplanation && !asksForExplanation(stem)) {
      itemDimensions.add('explanation');
    }
    for (const dimension of semanticDimensions(rubricActionLabel)) {
      if (!stemAsksForDimension(stem, dimension)) itemDimensions.add(dimension);
    }
    if (!itemDimensions.size) continue;
    hiddenItemIds.add(item.itemId);
    itemDimensions.forEach((dimension) => hiddenDimensions.add(dimension));
  }

  return {
    aligned: hiddenDimensions.size === 0,
    hiddenDimensions: [...hiddenDimensions],
    rubricItemIds: [...hiddenItemIds],
  };
}

export function formatHiddenRubricDimensions(
  dimensions: HiddenRequiredRubricDimension[],
): string {
  return dimensions.map((dimension) => DIMENSION_LABELS[dimension]).join('、');
}

function asksForTextEvidence(stem: string): boolean {
  return /(结合|根据|依据|从文中|联系|阅读|具体(?:动作|语句|细节|描写)|找出|写出|指出|引用|举例|第\d+(?:至|到|—|-)?\d*段|文中|文章|全文|诗中|诗句|原句|“[^”]+”)/u.test(stem);
}

function asksForExplanation(stem: string): boolean {
  return /(分析|说明|解释|概括|比较|角度|理由|为什么|原因|作用|含义|效果|如何|怎样|推断|理解|共同表现)/u.test(stem);
}

function semanticDimensions(text: string): HiddenRequiredRubricDimension[] {
  const dimensions: HiddenRequiredRubricDimension[] = [];
  if (/(总起|分述|结构|照应|承接|铺垫|过渡|呼应|层次|展开方式)/u.test(text)) {
    dimensions.push('structure');
  }
  if (/(比较|对比|异同|不同点|共同点)/u.test(text)) dimensions.push('comparison');
  if (/(原因|因果|导致|结果)/u.test(text)) dimensions.push('cause');
  if (/(情感|态度|主题|主旨)/u.test(text)) dimensions.push('emotion_or_theme');
  if (/(修辞|手法|表达效果|写法作用|语言作用)/u.test(text)) {
    dimensions.push('technique_or_effect');
  }
  return dimensions;
}

function stemAsksForDimension(
  stem: string,
  dimension: HiddenRequiredRubricDimension,
): boolean {
  if (dimension === 'structure') {
    return /(?:说明|分析|解释|梳理|指出|判断).{0,16}(?:总起|分述|结构|照应|承接|铺垫|过渡|呼应|层次|顺序|展开)/u.test(stem)
      || /(?:总起|分述|结构|照应|承接|铺垫|过渡|呼应|层次|顺序|展开).{0,16}(?:关系|作用|效果|如何|怎样|为什么)/u.test(stem)
      || /结构.{0,12}(?:分析|说明)/u.test(stem)
      || /(?:安排|句式|情节发展|能否调换|引向).{0,20}(?:作用|效果|理由|分析|说明|想象)/u.test(stem)
      || /(?:作用|效果).{0,16}(?:安排|句式|情节|结构)/u.test(stem);
  }
  if (dimension === 'comparison') return /(比较|对比|异同|不同|共同|分别|依据)/u.test(stem);
  if (dimension === 'cause') {
    return /(原因|为什么|因果|导致|结果|最终.{0,8}解决|最后.{0,8}解决|怎样解决|如何解决)/u.test(stem);
  }
  if (dimension === 'emotion_or_theme') {
    return /(情感|态度|主题|主旨|表达效果|为什么这样写|如何(?:表达|体现|表现)|怎样(?:表达|体现|表现)|谈谈.{0,12}理解)/u.test(stem);
  }
  if (dimension === 'technique_or_effect') {
    return /(修辞|手法|效果|作用|如何表现|怎样表现|怎么表现|表达.{0,12}共同|共同.{0,12}表达)/u.test(stem);
  }
  if (dimension === 'text_evidence') return asksForTextEvidence(stem);
  return asksForExplanation(stem);
}

function normalize(value: string): string {
  // Preserve paragraph ranges, quotation marks and other evidence-scope signals.
  return String(value || '').replace(/\s+/gu, '');
}

function normalizeRubricActionLabel(value: string): string {
  return normalize(value)
    // Legacy portfolio-supplement labels appended internal observation wording
    // that is not part of the scored student action or the rubric description.
    .replace(/(?:及)?直接结果观察项$/u, '')
    .replace(/观察项$/u, '');
}
