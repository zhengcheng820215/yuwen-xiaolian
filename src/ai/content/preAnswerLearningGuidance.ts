export type PreAnswerLearningGuidance = {
  goal: string;
  hint: string;
};

const SAFE_ACTIONS: Record<string, string> = {
  extraction: '定位并提取关键信息',
  comprehension: '理解句段含义与内容关系',
  summarization: '概括材料的主要内容',
  analysis: '分析具体描写与表达作用',
  inference: '结合文本依据进行合理推断',
  expression: '组织材料依据并清楚表达',
};

function buildThinkingHint(input: {
  abilityId: string;
  questionText: string;
  responseFormat?: 'text' | 'single_choice';
}): string {
  if (input.responseFormat === 'single_choice') {
    return '逐项核对选项是否有材料依据，留意只看表面或推断过远的说法。';
  }

  if (/景物/.test(input.questionText) && /共同|特点|如何表现/.test(input.questionText)) {
    return '留意题目所指段落中的景物分别发生了哪些变化，想一想这些变化有什么共同点。';
  }
  if (/心理|心情|情感|态度|感受/.test(input.questionText)) {
    return '留意人物当时的处境和前后表现，想一想这些变化透露出怎样的心理。';
  }
  if (/原因|为什么|因果/.test(input.questionText)) {
    return '留意事情发生前的条件和之后的结果，想一想两者有什么联系。';
  }
  if (/关系|联系|照应|承接/.test(input.questionText)) {
    return '留意前后内容写到的相同对象或变化，想一想它们怎样相互联系。';
  }
  if (/作用|效果|如何表现|特点|形象/.test(input.questionText)) {
    return '留意题目所指词句前后的具体描写，想一想它突出表现了什么。';
  }
  if (/概括|主要内容|主要事件/.test(input.questionText)) {
    return '留意谁在什么情况下做了什么，想一想哪些内容推动了主要事件。';
  }

  const hints: Record<string, string> = {
    extraction: '留意题目限定的对象和范围，核对哪些信息同时符合这些条件。',
    comprehension: '留意对象在前后文中的动作或变化，想一想这些变化说明了什么。',
    summarization: '留意主要对象和关键事件，想一想哪些内容真正推动了事情发展。',
    analysis: '留意最有表现力的词语或描写，想一想它突出表现了什么。',
    inference: '留意材料直接写出的事实，想一想这些事实能够支持怎样的判断。',
    expression: '留意最能支持自己观点的文本细节，想一想它与观点有什么联系。',
  };
  return hints[input.abilityId]
    || '留意题目限定的对象和范围，想一想最关键的文本变化说明了什么。';
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
}): PreAnswerLearningGuidance {
  const abilityId = String(input.abilityId || '').trim();
  const action = safeLearningAction(abilityId, input.abilityName);
  const hint = buildThinkingHint({
    abilityId,
    questionText: String(input.questionText || '').trim(),
    responseFormat: input.responseFormat,
  });
  return {
    goal: `练习${action}。`,
    hint,
  };
}
