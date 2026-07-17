import type { OpenResponseAnswerStatus } from '../schemas/diagnosis.schema.ts';
import {
  DIAGNOSIS_QUALITY_POLICY_V21,
  type DiagnosisEvaluationAnnotationV2,
  type RootCauseBoundaryCategory,
} from '../schemas/diagnosisQualityPolicyV2.schema.ts';

export { DIAGNOSIS_QUALITY_POLICY_V21 } from '../schemas/diagnosisQualityPolicyV2.schema.ts';

export type RootCauseClassificationV21 = {
  policyVersion: typeof DIAGNOSIS_QUALITY_POLICY_V21;
  status: 'classified' | 'unknown' | 'conflicting';
  categories: RootCauseBoundaryCategory[];
  matchedRuleCodes: string[];
  issues: string[];
};

type RootCauseRule = {
  code: string;
  category: Exclude<RootCauseBoundaryCategory, 'unknown'>;
  patterns: RegExp[];
};

const RULES: RootCauseRule[] = [
  {
    code: 'no_clear_deficit_observed',
    category: 'no_clear_deficit_in_current_response',
    patterns: [
      /未暴露明确(?:能力)?缺口/,
      /未发现明确.*(?:错误|问题|不足)/,
      /没有明显.*(?:错误|问题|不足)/,
      /符合题目要求/,
      /推理链(?:条)?完整/,
    ],
  },
  {
    code: 'missing_support_or_relation',
    category: 'missing_evidence',
    patterns: [
      /依据不足/,
      /缺少.*(?:依据|动作|线索|材料|关系|理由|推理过程|说明)/,
      /缺乏.*(?:依据|文本|线索|推理过程|具体内容)/,
      /未(?:提取|引用|结合|提供).*(?:线索|动作|文本|依据|理由|材料)/,
      /没有(?:提供|引用|结合).*(?:依据|理由|材料|动作)/,
      /未能进一步(?:说明|建立|推断)/,
      /未进一步(?:说明|建立|推断)/,
      /未能结合.*(?:说明|建立|推断)/,
      /没有(?:说明|建立).*(?:支持|关系|理由|依据)/,
      /推理链(?:条)?不完整/,
      /只(?:给出|写出).*(?:结论|判断)/,
    ],
  },
  {
    code: 'unsupported_or_invented_inference',
    category: 'unsupported_inference',
    patterns: [
      /主观(?:推断|臆断)/,
      /原文(?:中)?未提及/,
      /材料(?:中)?(?:未|没有)(?:提及|出现|说明)/,
      /材料.*不支持/,
      /与材料(?:事实)?(?:不符|冲突|无关)/,
      /与原文(?:不符|冲突|无关)/,
      /添加.*(?:不存在|未提及|无关|冲突)/,
      /加入.*(?:不存在|未提及|无关|冲突)/,
      /无关信息/,
    ],
  },
  {
    code: 'incorrect_relation_or_purpose',
    category: 'incorrect_causal_relation',
    patterns: [
      /关系.*(?:错误|不成立|缺乏|不符)/,
      /错误(?:地)?(?:归因|推断|理解|关联)/,
      /因果.*(?:不成立|错误|缺乏)/,
      /理由.*(?:不成立|没有逻辑关联|缺乏逻辑关联)/,
      /缺乏.*(?:逻辑关联|因果关系)/,
      /之间.*(?:没有逻辑关联|缺乏逻辑关联|缺乏因果关系)/,
      /未能正确(?:理解|推断|说明)/,
      /推断.*不成立/,
      /目的.*(?:推断)?不成立/,
      /心理.*(?:错误|误判)/,
      /目的.*(?:错误|误判)/,
      /将.*误判为/,
      /核心结论.*(?:不成立|错误|冲突|不符)/,
    ],
  },
  {
    code: 'summary_missing_or_distorted',
    category: 'incomplete_summary',
    patterns: [
      /概括.*(?:不完整|偏离|错误)/,
      /遗漏.*(?:事件|情节|信息|要点|行为|细节)/,
      /未(?:完整|准确)?概括/,
      /未(?:能)?(?:准确)?提取.*(?:关键要素|主要事件|核心事件|事件链|人物和事件)/,
      /(?:未|没有)保留.*(?:事件|要素|信息|行为)/,
      /缺失.*(?:主要事件|关键要素|事件要素)/,
      /(?:主要事件|关键事件).*要素.*缺失/,
      /信息提取不完整/,
    ],
  },
  {
    code: 'key_detail_misread',
    category: 'misread_key_detail',
    patterns: [
      /误读/,
      /漏读/,
      /混淆/,
      /理解不够精准/,
      /偏离原文/,
      /将.*误判为/,
      /未能正确理解.*(?:细节|动作|行为|情感|目的)/,
    ],
  },
  {
    code: 'expression_or_reason_incomplete',
    category: 'expression_incomplete',
    patterns: [
      /表达.*(?:不完整|不清|不足)/,
      /答案.*不完整/,
      /理由.*(?:笼统|模糊|缺乏|不足|不够|未展开)/,
      /缺乏.*(?:逻辑|论证|阐述|具体理由)/,
      /展开.*不足/,
      /观点.*(?:不清|不够直接)/,
      /组织.*(?:不足|缺乏)/,
      /未按照题目要求说明理由/,
      /未能提供.*(?:具体|相关|合理).*(?:理由|依据|内容)/,
    ],
  },
];

const DEFICIT_CATEGORIES = new Set<RootCauseBoundaryCategory>([
  'missing_evidence',
  'unsupported_inference',
  'incorrect_causal_relation',
  'incomplete_summary',
  'misread_key_detail',
  'expression_incomplete',
]);

export function classifyRootCauseV21(value: string): RootCauseClassificationV21 {
  const categories: RootCauseBoundaryCategory[] = [];
  const matchedRuleCodes: string[] = [];

  for (const rule of RULES) {
    if (!rule.patterns.some((pattern) => pattern.test(value))) continue;
    if (!categories.includes(rule.category)) categories.push(rule.category);
    matchedRuleCodes.push(rule.code);
  }

  if (categories.length === 0) {
    return {
      policyVersion: DIAGNOSIS_QUALITY_POLICY_V21,
      status: 'unknown',
      categories: ['unknown'],
      matchedRuleCodes: [],
      issues: ['No sufficiently specific semantic rule matched.'],
    };
  }

  const hasNoDeficit = categories.includes('no_clear_deficit_in_current_response');
  const hasDeficit = categories.some((category) => DEFICIT_CATEGORIES.has(category));
  if (hasNoDeficit && hasDeficit) {
    return {
      policyVersion: DIAGNOSIS_QUALITY_POLICY_V21,
      status: 'conflicting',
      categories,
      matchedRuleCodes,
      issues: ['no_clear_deficit is mutually exclusive with explicit deficit categories.'],
    };
  }

  return {
    policyVersion: DIAGNOSIS_QUALITY_POLICY_V21,
    status: 'classified',
    categories,
    matchedRuleCodes,
    issues: [],
  };
}

export function acceptsRootCauseV21(input: {
  classification: RootCauseClassificationV21;
  annotation: DiagnosisEvaluationAnnotationV2;
  answerStatus?: OpenResponseAnswerStatus | string;
}): { accepted: boolean; reason: string } {
  if (input.classification.status !== 'classified') {
    return { accepted: false, reason: `classification_${input.classification.status}` };
  }
  const directMatch = input.classification.categories.some((category) =>
    input.annotation.allowedRootCauseCategories.includes(category)
  );
  if (directMatch) return { accepted: true, reason: 'direct_allowed_category_match' };

  const noDeficitForAllowedFullyMeets =
    input.answerStatus === 'fully_meets' &&
    input.annotation.allowedAnswerStatuses.includes('fully_meets') &&
    input.classification.categories.length === 1 &&
    input.classification.categories[0] === 'no_clear_deficit_in_current_response';
  if (noDeficitForAllowedFullyMeets) {
    return { accepted: true, reason: 'fully_meets_no_deficit_compatibility' };
  }

  return { accepted: false, reason: 'no_allowed_category_match' };
}

export function getRootCausePolicyV21RuleMetadata(): Array<{
  code: string;
  category: Exclude<RootCauseBoundaryCategory, 'unknown'>;
}> {
  return RULES.map((rule) => ({ code: rule.code, category: rule.category }));
}
