import { buildPreAnswerLearningGuidance } from '../content/preAnswerLearningGuidance.ts';

type Case = {
  name: string;
  pass: boolean;
  detail: string;
};

const cases: Case[] = [];

function check(name: string, pass: boolean, detail: string): void {
  cases.push({ name, pass, detail });
}

const comprehension = buildPreAnswerLearningGuidance({
  abilityId: 'comprehension',
  questionText: '请找出第2段中具体描写了哪些景物，并说明这些景物描写是如何共同体现“刚睡醒”的特点的。',
  responseFormat: 'text',
});
check(
  '理解题提示只保留景物变化这一思考入口',
  comprehension?.clue === '第2段中的几处景物变化'
    && comprehension.thinkingAction === '并排比较，判断它们共同指向怎样的状态'
    && comprehension.hint === '先看第2段中的几处景物变化，并排比较，判断它们共同指向怎样的状态。',
  comprehension?.hint || 'missing',
);
check(
  '理解题提示不再投射完整解题流程或答案结构',
  comprehension !== undefined && !/圈出|抓住|回答时|线索—含义|观点—|不要只/.test(comprehension.hint),
  comprehension?.hint || 'missing',
);

const psychology = buildPreAnswerLearningGuidance({
  abilityId: 'inference',
  questionText: '结合第4—6段分析女娲前后心理变化。',
  responseFormat: 'text',
});
check(
  '人物心理题提示聚焦处境与前后表现',
  psychology !== undefined
    && psychology.clue === '第4—6段中女娲的处境和前后表现'
    && /比较/.test(psychology.thinkingAction)
    && /心理/.test(psychology.hint),
  psychology?.hint || 'missing',
);

const choice = buildPreAnswerLearningGuidance({
  abilityId: 'comprehension',
  questionText: '下列对人物心情的理解，正确的一项是？',
  responseFormat: 'single_choice',
});
check(
  '单选提示简洁引导证据核对但不暴露答案',
  choice !== undefined
    && choice.clue === '各选项与材料中对应的内容'
    && /逐项核对/.test(choice.thinkingAction)
    && /材料依据/.test(choice.hint)
    && !/[A-D]项|正确答案|应该选/.test(choice.hint),
  choice?.hint || 'missing',
);

for (const [index, guidance] of [comprehension, psychology, choice].entries()) {
  check(
    `提示 ${index + 1} 保持一句话和单一思路入口`,
    guidance !== undefined && (guidance.hint.match(/。/g) || []).length === 1
      && !/[；;]/.test(guidance.hint)
      && guidance.hint.length <= 52,
    guidance?.hint || 'missing',
  );
}

const wordEffect = buildPreAnswerLearningGuidance({
  abilityId: 'analysis',
  questionText: '请分析“偷偷地”和“钻”这两个词语的表达效果。',
  responseFormat: 'text',
});
check(
  '词语表达效果提示提供删词比较动作而不是重复题意',
  wordEffect !== undefined
    && wordEffect.clue === '“偷偷地”和“钻”'
    && /去掉/.test(wordEffect.thinkingAction)
    && /比较/.test(wordEffect.hint)
    && !/留意题目所指|想一想它突出表现/.test(wordEffect.hint),
  wordEffect?.hint || 'missing',
);

const unsupported = buildPreAnswerLearningGuidance({
  abilityId: 'unknown_ability',
  questionText: '请完成本题。',
  responseFormat: 'text',
});
check(
  '无法形成具体线索与思考动作时不展示低价值提示',
  unsupported === undefined,
  unsupported ? unsupported.hint : 'hidden',
);

const genericEffect = buildPreAnswerLearningGuidance({
  abilityId: 'analysis',
  questionText: '请结合上下文分析这句话的作用。',
  responseFormat: 'text',
});
check(
  '只有通用对象和空泛动作时不回退到伪提示',
  genericEffect === undefined,
  genericEffect ? genericEffect.hint : 'hidden',
);

const genericPsychology = buildPreAnswerLearningGuidance({
  abilityId: 'inference',
  questionText: '请分析人物的心理变化。',
  responseFormat: 'text',
});
check(
  '人物心理题缺少可定位范围或明确对象时隐藏提示',
  genericPsychology === undefined,
  genericPsychology ? genericPsychology.hint : 'hidden',
);

const cause = buildPreAnswerLearningGuidance({
  abilityId: 'inference',
  questionText: '结合第5段，说明人物为什么改变了决定。',
  responseFormat: 'text',
});
check(
  '原因题使用公开段落范围和因果核对动作',
  cause?.clue === '第5段中结果发生前直接出现的条件'
    && /核对|检查/.test(cause.thinkingAction),
  cause?.hint || 'missing',
);

const relation = buildPreAnswerLearningGuidance({
  abilityId: 'analysis',
  questionText: '第3段和第7段有什么照应关系？',
  responseFormat: 'text',
});
check(
  '结构关系题使用公开范围和压缩比较动作',
  relation?.clue === '第3段和第7段中的前后两部分'
    && /压缩/.test(relation.thinkingAction)
    && /比较/.test(relation.thinkingAction),
  relation?.hint || 'missing',
);

const changeEffect = buildPreAnswerLearningGuidance({
  abilityId: 'analysis',
  questionText: '小孩子说出“可是他什么衣服也没有穿呀”后，人们的反应发生了怎样的变化？这对揭穿骗局有什么作用？',
  responseFormat: 'text',
});
check(
  '变化—作用题提示只引导前后对照，不提前说出变化和答案',
  changeEffect?.clue === '“可是他什么衣服也没有穿呀”前后人们的反应'
    && /前后对照/.test(changeEffect.thinkingAction)
    && /后续结果/.test(changeEffect.thinkingAction)
    && !/开始说出真相|打破沉默|骗局被揭穿/.test(changeEffect.hint),
  changeEffect?.hint || 'missing',
);

const summary = buildPreAnswerLearningGuidance({
  abilityId: 'summarization',
  questionText: '请概括全文的主要事件。',
  responseFormat: 'text',
});
check(
  '概括题使用全文范围和完整性检查动作',
  summary?.clue === '全文中的主要对象、关键行动和结果'
    && /检查|删除/.test(summary.thinkingAction),
  summary?.hint || 'missing',
);

const failed = cases.filter((item) => !item.pass);
for (const item of cases) {
  console.log(`${item.pass ? 'PASS' : 'FAIL'} ${item.name}: ${item.detail}`);
}

if (failed.length) {
  throw new Error(`Pre-answer learning guidance debug failed: ${failed.length}/${cases.length}`);
}

console.log(`Pre-answer learning guidance debug passed: ${cases.length}/${cases.length}`);
