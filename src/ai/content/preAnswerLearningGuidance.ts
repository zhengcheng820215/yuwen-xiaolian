export type PreAnswerLearningGuidance = {
  goal: string;
  clue: string;
  thinkingAction: string;
  hint: string;
};

type GuidanceCandidate = {
  clue: string;
  thinkingAction: string;
  clueSource: 'question_quote' | 'question_scope' | 'question_object' | 'choice_interaction';
};

const SAFE_ACTIONS: Record<string, string> = {
  extraction: '定位并提取关键信息',
  comprehension: '理解句段含义与内容关系',
  summarization: '概括材料的主要内容',
  analysis: '分析具体描写与表达作用',
  inference: '结合文本依据进行合理推断',
  expression: '组织材料依据并清楚表达',
};

const ACTION_PATTERN = /比较|去掉|删除|替换|压缩|排除|检查|核对|列出|并排|归并|对照/;
const BANNED_GENERIC_HINT_PATTERN = /留意(?:题目所指词句前后的)?具体描写|留意最有表现力的词语|结合上下文(?:分析|思考)?|找到相关(?:句段|内容)|想一想(?:它)?表现了什么|想一想(?:它)?突出表现了什么/;
const NON_LOCATABLE_CLUE_PATTERN = /^(?:具体描写|相关内容|上下文|题目所指内容|题目所指词句|材料内容)$/;

function buildGuidanceCandidate(input: {
  abilityId: string;
  questionText: string;
  responseFormat?: 'text' | 'single_choice';
}): GuidanceCandidate | undefined {
  if (input.responseFormat === 'single_choice') {
    return {
      clue: '各选项与材料中对应的内容',
      thinkingAction: '逐项核对是否有材料依据，并排除只看表面或推断过远的说法',
      clueSource: 'choice_interaction',
    };
  }

  const quotedTerms = extractQuotedTerms(input.questionText).slice(0, 2);
  const scope = extractQuestionScope(input.questionText);

  if (quotedTerms.length > 0 && /词语|字词|表达效果|表达作用|表现力|修辞/.test(input.questionText)) {
    return {
      clue: quotedTerms.map((item) => `“${item}”`).join('和'),
      thinkingAction: '暂时去掉或换成普通说法后重读原句，比较前后的表达差异',
      clueSource: 'question_quote',
    };
  }

  if (/景物/.test(input.questionText) && /共同|特点|状态|如何表现/.test(input.questionText) && scope) {
    return {
      clue: `${scope}中的几处景物变化`,
      thinkingAction: '并排比较，判断它们共同指向怎样的状态',
      clueSource: 'question_scope',
    };
  }

  if (/心理|心情|情感|态度|感受/.test(input.questionText)) {
    const subject = extractPsychologySubject(input.questionText);
    if (!scope && !subject) return undefined;
    return {
      clue: `${scope ? `${scope}中` : ''}${subject || '人物'}的处境和前后表现`,
      thinkingAction: '放在一起比较，判断哪处变化最能说明其心理',
      clueSource: scope ? 'question_scope' : 'question_object',
    };
  }

  if (/原因|为什么|因果/.test(input.questionText) && scope) {
    return {
      clue: `${scope}中结果发生前直接出现的条件`,
      thinkingAction: '逐项核对，检查它们是否能解释后面的结果',
      clueSource: 'question_scope',
    };
  }

  if (/关系|联系|照应|承接/.test(input.questionText) && scope) {
    return {
      clue: `${scope}中的前后两部分`,
      thinkingAction: '各压缩成一句话，再比较是否写到同一对象或同一变化',
      clueSource: 'question_scope',
    };
  }

  if (
    /(反应|态度|状态|做法|表现).{0,16}(发生了|有了)?怎样的变化/.test(input.questionText)
    && /这(?:一变化|种变化|样的变化|对).{0,24}(作用|影响)/.test(input.questionText)
    && quotedTerms.length > 0
  ) {
    return {
      clue: `“${quotedTerms[0]}”前后人们的反应`,
      thinkingAction: '前后对照他们说了什么，再判断这种变化怎样影响后续结果',
      clueSource: 'question_quote',
    };
  }

  if (/作用|效果|如何表现|特点|形象/.test(input.questionText) && quotedTerms.length > 0) {
    return {
      clue: quotedTerms.map((item) => `“${item}”`).join('和'),
      thinkingAction: '换成普通说法后重读，比较原句多出了怎样的表达效果',
      clueSource: 'question_quote',
    };
  }

  if (/概括|主要内容|主要事件/.test(input.questionText) && scope) {
    return {
      clue: `${scope}中的主要对象、关键行动和结果`,
      thinkingAction: '逐项检查，删除会使事件不完整的内容就应保留',
      clueSource: 'question_scope',
    };
  }

  if (input.abilityId === 'extraction' && scope) {
    return {
      clue: `${scope}内符合题目对象和范围的信息`,
      thinkingAction: '逐项核对两个条件，排除只符合其中一个条件的内容',
      clueSource: 'question_scope',
    };
  }

  if (input.abilityId === 'comprehension' && quotedTerms.length > 0) {
    return {
      clue: quotedTerms.map((item) => `“${item}”`).join('和'),
      thinkingAction: '对照前后内容，比较它所指对象或状态发生了什么变化',
      clueSource: 'question_quote',
    };
  }

  if (input.abilityId === 'inference' && scope) {
    return {
      clue: `${scope}中材料明确写出的事实`,
      thinkingAction: '先列出两项，再比较哪一项最能支撑你的判断',
      clueSource: 'question_scope',
    };
  }

  return undefined;
}

function extractQuotedTerms(questionText: string): string[] {
  return [...questionText.matchAll(/[“"]([^”"\n]{1,48})[”"]/gu)]
    .map((match) => match[1]?.trim())
    .filter((item): item is string => Boolean(item));
}

function extractQuestionScope(questionText: string): string | undefined {
  const scopes = [...questionText.matchAll(/第\s*\d+(?:\s*[—－~至到-]\s*\d+)?\s*段|全文|开头|结尾|前文|后文/gu)]
    .map((match) => match[0].replace(/\s+/g, ''));
  const uniqueScopes = [...new Set(scopes)];
  return uniqueScopes.length > 0 ? uniqueScopes.join('和') : undefined;
}

function extractPsychologySubject(questionText: string): string | undefined {
  const scope = extractQuestionScope(questionText);
  const normalized = questionText
    .replace(scope || '', '')
    .replace(/^[，。！？、\s]*(?:请|结合)*/u, '');
  const match = normalized.match(/(?:分析|理解|说明|判断|体会)([\u4e00-\u9fa5]{1,8}?)(?:此时|当时|前后)?(?:的)?(?:心理|心情|情感|态度|感受)/u)
    || normalized.match(/([\u4e00-\u9fa5]{1,6}?)(?:此时|当时|前后)?(?:的)?(?:心理|心情|情感|态度|感受)/u);
  const candidate = match?.[1]?.trim();
  if (!candidate || /^(?:人物|作者|对象|角色)$/u.test(candidate)) return undefined;
  return candidate;
}

function composeHintText(candidate: GuidanceCandidate): string {
  return `先看${candidate.clue}，${candidate.thinkingAction}。`;
}

function isValidGuidanceCandidate(candidate: GuidanceCandidate | undefined, hint: string): candidate is GuidanceCandidate {
  if (!candidate || !candidate.clue.trim() || !candidate.thinkingAction.trim()) return false;
  if (candidate.clue.length < 3 || NON_LOCATABLE_CLUE_PATTERN.test(candidate.clue)) return false;
  if (!ACTION_PATTERN.test(candidate.thinkingAction)) return false;
  if (BANNED_GENERIC_HINT_PATTERN.test(hint)) return false;
  if ((hint.match(/。/g) || []).length !== 1 || /[；;]/.test(hint)) return false;
  return hint.length <= 72;
}

export function validatePreAnswerLearningGuidance(
  guidance: PreAnswerLearningGuidance,
): { passed: boolean; issues: string[] } {
  const issues: string[] = [];
  if (!guidance.clue.trim() || guidance.clue.length < 3) issues.push('specific_clue_missing');
  if (NON_LOCATABLE_CLUE_PATTERN.test(guidance.clue)) issues.push('clue_not_locatable');
  if (!guidance.thinkingAction.trim() || !ACTION_PATTERN.test(guidance.thinkingAction)) {
    issues.push('thinking_action_not_executable');
  }
  if (BANNED_GENERIC_HINT_PATTERN.test(guidance.hint)) issues.push('generic_fallback_copy');
  if ((guidance.hint.match(/。/g) || []).length !== 1 || /[；;]/.test(guidance.hint)) {
    issues.push('hint_not_single_entry');
  }
  if (guidance.hint.length > 72) issues.push('hint_too_long');
  if (!guidance.hint.includes(guidance.clue)) issues.push('hint_clue_projection_missing');
  return { passed: issues.length === 0, issues };
}

export function safeLearningAction(abilityId?: string, abilityName?: string): string {
  return SAFE_ACTIONS[String(abilityId || '').trim()]
    || `练习${String(abilityName || '当前阅读能力').trim()}`;
}

export function buildPreAnswerLearningGuidance(input: {
  abilityId?: string;
  abilityName?: string;
  responseFormat?: 'text' | 'single_choice';
  questionText?: string;
}): PreAnswerLearningGuidance | undefined {
  const abilityId = String(input.abilityId || '').trim();
  const candidate = buildGuidanceCandidate({
    abilityId,
    questionText: String(input.questionText || '').trim(),
    responseFormat: input.responseFormat,
  });
  const hint = candidate ? composeHintText(candidate) : '';
  if (!isValidGuidanceCandidate(candidate, hint)) return undefined;
  return {
    goal: `练习${safeLearningAction(abilityId, input.abilityName)}。`,
    clue: candidate.clue,
    thinkingAction: candidate.thinkingAction,
    hint,
  };
}
