import {
  FEEDBACK_OBSERVATION_TARGET_PROJECTION_SCHEMA_VERSION,
  type FeedbackObservationTargetCode,
  type FeedbackObservationTargetProjection,
} from '../schemas/feedbackObservationTargetProjection.schema.ts';

export type FeedbackObservationRubricSignal = {
  name: string;
  description?: string;
  required?: boolean;
};

export type FeedbackObservationTargetProjectionInput = {
  question: string;
  questionType?: string;
  abilityName?: string;
  answerRequirements?: string[];
  rubric?: FeedbackObservationRubricSignal[];
  taskRole?: string;
};

type TargetMatch = {
  targetCode: Exclude<FeedbackObservationTargetCode, 'generic_content'>;
  signal: string;
  confidence: 'high' | 'medium';
};

const DISPLAY_LABELS: Record<FeedbackObservationTargetCode, string> = {
  character_psychology: '人物的心理',
  character_trait: '人物的特点',
  scene_or_object_state: '景物或事物的状态',
  fact_or_evidence: '文中的具体事实或依据',
  event_process_or_change: '事情的发展或变化过程',
  event_cause: '事情发生的原因',
  relationship_or_comparison: '两项内容之间的关系',
  main_content: '主要内容',
  expression_effect: '词句的表达效果',
  structure_relation: '句段的结构关系',
  theme_or_meaning: '内容所表达的主题或含义',
  requirement_completion: '题目要求的各项内容',
  generic_content: '本题需要说明的内容',
};

export function projectFeedbackObservationTarget(
  input: FeedbackObservationTargetProjectionInput,
): FeedbackObservationTargetProjection {
  const question = normalize(input.question);
  const questionMatches = inferMatches(question, 'question');
  const primaryQuestionMatch = selectPrimaryQuestionMatch(question, questionMatches);
  const questionTypeMatch = inferQuestionType(input.questionType);
  const requiredRubricText = (input.rubric || [])
    .filter((item) => item.required !== false)
    .flatMap((item) => [item.name, item.description || ''])
    .filter(Boolean)
    .join('；');
  const rubricMatches = inferMatches(normalize(requiredRubricText), 'rubric');
  const primaryRubricMatch = selectRubricMatch(rubricMatches);

  const explicitMatch = primaryQuestionMatch || questionTypeMatch;
  if (explicitMatch) {
    if (isStrongRubricConflict(explicitMatch.targetCode, primaryRubricMatch?.targetCode)) {
      return fallbackProjection(
        'question_rubric_mismatch',
        uniqueStrings([
          explicitMatch.signal,
          primaryRubricMatch?.signal,
        ]),
      );
    }
    return buildProjection(
      explicitMatch.targetCode,
      explicitMatch.confidence,
      uniqueStrings([
        explicitMatch.signal,
        ...(primaryRubricMatch?.targetCode === explicitMatch.targetCode
          ? [primaryRubricMatch.signal]
          : []),
      ]),
      extractSubject(question, explicitMatch.targetCode),
    );
  }

  if (primaryRubricMatch) {
    return buildProjection(
      primaryRubricMatch.targetCode,
      'medium',
      [primaryRubricMatch.signal],
      extractSubject(question, primaryRubricMatch.targetCode),
    );
  }

  const requirementMatches = inferMatches(
    normalize((input.answerRequirements || []).join('；')),
    'requirement',
  );
  const requirementMatch = selectRubricMatch(requirementMatches);
  if (requirementMatch && requirementMatch.targetCode === 'requirement_completion') {
    return buildProjection(
      requirementMatch.targetCode,
      'medium',
      [requirementMatch.signal],
    );
  }

  return fallbackProjection(
    question ? 'unsupported_target_pattern' : 'insufficient_question_signal',
    uniqueStrings([
      question ? `question:${question.slice(0, 48)}` : undefined,
      input.abilityName ? `ability:${input.abilityName}` : undefined,
      input.taskRole ? `task_role:${input.taskRole}` : undefined,
    ]),
  );
}

function inferMatches(value: string, source: 'question' | 'rubric' | 'requirement'): TargetMatch[] {
  if (!value) return [];
  const matches: TargetMatch[] = [];
  const push = (
    targetCode: TargetMatch['targetCode'],
    pattern: RegExp,
    label: string,
    confidence: TargetMatch['confidence'] = 'high',
  ) => {
    if (pattern.test(value)) {
      matches.push({ targetCode, signal: `${source}:${label}`, confidence });
    }
  };

  push('expression_effect', /表达效果|表达作用|表现力|修辞(?:手法)?|赏析|词句.{0,10}作用|写法.{0,10}作用/u, 'expression_effect');
  push('structure_relation', /结构(?:关系|作用)|照应|承接|总起|分述|过渡|铺垫|推动.{0,12}(?:情节|故事|发展|揭穿|解决|形成|实现)|在文中.{0,6}作用/u, 'structure_relation');
  push('relationship_or_comparison', /比较|不同|区别|共同点|相同点|相互.{0,8}(?:关系|联想)|二者.{0,8}(?:关系|联系)|两者.{0,8}(?:关系|联系)|与.{0,18}(?:有什么|有何|形成.{0,4})(?:联系|关系)|能否调换|顺序.{0,8}(?:理由|作用)/u, 'relationship_or_comparison');
  push('character_psychology', /心理|心情|情感|想法|内心|感到|感受|(?:作者|“我”|我).{0,12}持怎样的态度/u, 'character_psychology');
  push('character_trait', /人物.{0,8}(?:特点|品质|形象)|(?:父亲|母亲|老师|学生|孩子|屠户|女娲|皇帝|白求恩).{0,8}(?:特点|品质|形象)|怎样的(?:人|人物|父亲|母亲|老师|学生|孩子)|什么样的(?:人|人物|父亲|母亲|老师|学生|孩子)/u, 'character_trait');
  push('scene_or_object_state', /(?:景物|景色|春天|万物|小草|山|水|太阳|自然|环境|事物).{0,30}(?:特点|状态|变化|如何表现|共同表现)|(?:刚睡醒|苏醒).{0,8}(?:特点|状态)/u, 'scene_or_object_state');
  push('theme_or_meaning', /主旨|主题|深层含义|含义|寓意|启示|象征|中心思想|思想感情|谈谈.{0,12}对[“"][^”"]{1,24}[”"].{0,8}理解|(?:这句话|一句|句子).{0,12}(?:理解|意思)/u, 'theme_or_meaning');
  push('main_content', /概括|主要内容|主要事件|主要表现|写了什么/u, 'main_content');
  push('event_process_or_change', /过程|经过|步骤|先后|发展过程|变化过程|发生了怎样的变化|按.{0,8}(?:顺序|发展)/u, 'event_process_or_change');
  push('event_cause', /为什么|原因|因何|缘由/u, 'event_cause');
  push('fact_or_evidence', /从哪些信息|哪些信息|直接信息|找出|指出|依据|哪些行为|哪些动作|做了哪些事情|分别提供了什么|哪一类人|主要对象是什么|能否证明|最准确的(?:一项|判断)|哪一项/u, 'fact_or_evidence');
  push('requirement_completion', /各项要求|各项内容|规定动作|分别.{0,12}(?:指出|概括|说明)|至少.{0,8}(?:两|三|2|3)/u, 'requirement_completion', 'medium');
  return matches;
}

function selectPrimaryQuestionMatch(question: string, matches: TargetMatch[]): TargetMatch | undefined {
  if (matches.length === 0) return undefined;
  const substantive = matches.filter((item) => item.targetCode !== 'fact_or_evidence');
  const distinct = [...new Set(substantive.map((item) => item.targetCode))];
  if (/并|同时|分别/u.test(question) && distinct.length >= 2) {
    const expression = substantive.find((item) => item.targetCode === 'expression_effect');
    if (expression && substantive.every((item) => (
      item.targetCode === 'expression_effect' || item.targetCode === 'main_content'
    ))) return expression;
    return {
      targetCode: 'requirement_completion',
      signal: `question:compound:${distinct.join('+')}`,
      confidence: 'high',
    };
  }
  return matches[0];
}

function selectRubricMatch(matches: TargetMatch[]): TargetMatch | undefined {
  const nonEvidence = matches.filter((item) => item.targetCode !== 'fact_or_evidence');
  return nonEvidence[0] || matches[0];
}

function inferQuestionType(questionType?: string): TargetMatch | undefined {
  const value = normalize(questionType || '');
  if (!value) return undefined;
  if (/人物形象/u.test(value)) return match('character_trait', 'question_type:character_trait');
  if (/心理|情感/u.test(value)) return match('character_psychology', 'question_type:character_psychology');
  if (/概括/u.test(value)) return match('main_content', 'question_type:main_content');
  if (/表达|赏析/u.test(value)) return match('expression_effect', 'question_type:expression_effect');
  return undefined;
}

function isStrongRubricConflict(
  questionTarget: FeedbackObservationTargetCode,
  rubricTarget?: FeedbackObservationTargetCode,
): boolean {
  if (!rubricTarget || questionTarget === rubricTarget) return false;
  const characterTargets = new Set<FeedbackObservationTargetCode>([
    'character_psychology',
    'character_trait',
  ]);
  return (
    characterTargets.has(questionTarget) && rubricTarget === 'scene_or_object_state'
  ) || (
    questionTarget === 'scene_or_object_state' && characterTargets.has(rubricTarget)
  );
}

function buildProjection(
  targetCode: Exclude<FeedbackObservationTargetCode, 'generic_content'>,
  confidence: 'high' | 'medium',
  evidenceSignals: string[],
  subject?: string,
): FeedbackObservationTargetProjection {
  return {
    schemaVersion: FEEDBACK_OBSERVATION_TARGET_PROJECTION_SCHEMA_VERSION,
    targetCode,
    subject,
    displayLabel: DISPLAY_LABELS[targetCode],
    confidence,
    evidenceSignals,
  };
}

function fallbackProjection(
  fallbackReason: NonNullable<FeedbackObservationTargetProjection['fallbackReason']>,
  evidenceSignals: Array<string | undefined>,
): FeedbackObservationTargetProjection {
  return {
    schemaVersion: FEEDBACK_OBSERVATION_TARGET_PROJECTION_SCHEMA_VERSION,
    targetCode: 'generic_content',
    displayLabel: DISPLAY_LABELS.generic_content,
    confidence: 'low',
    evidenceSignals: uniqueStrings(evidenceSignals),
    fallbackReason,
  };
}

function extractSubject(
  question: string,
  targetCode: FeedbackObservationTargetCode,
): string | undefined {
  if (targetCode !== 'character_psychology' && targetCode !== 'character_trait') return undefined;
  const pattern = targetCode === 'character_psychology'
    ? /([^，。；！？\s]{1,8}?)(?:此时|当时|最初)?(?:的)?(?:心理|心情|情感|想法|内心|感受)/u
    : /([^，。；！？\s]{1,8}?)(?:的)?(?:特点|品质|形象)/u;
  const raw = question.match(pattern)?.[1]
    ?.replace(/^(?:请|结合|根据|从|文中|文章中|材料中)+/u, '')
    .replace(/的$/u, '')
    .trim();
  if (!raw || /^(?:人物|他|她|它|他们|她们|它们|作者)$/u.test(raw)) return undefined;
  return raw.length <= 8 ? raw : undefined;
}

function match(
  targetCode: TargetMatch['targetCode'],
  signal: string,
): TargetMatch {
  return { targetCode, signal, confidence: 'high' };
}

function normalize(value: string): string {
  return value.replace(/\s+/gu, ' ').trim();
}

function uniqueStrings(values: Array<string | undefined>): string[] {
  return [...new Set(values.map((item) => item?.trim()).filter((item): item is string => Boolean(item)))];
}
