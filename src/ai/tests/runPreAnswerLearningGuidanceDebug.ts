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
  comprehension.hint === '留意题目所指段落中的景物分别发生了哪些变化，想一想这些变化有什么共同点。',
  comprehension.hint,
);
check(
  '理解题提示不再投射完整解题流程或答案结构',
  !/圈出|抓住|回答时|线索—含义|观点—|不要只/.test(comprehension.hint),
  comprehension.hint,
);

const psychology = buildPreAnswerLearningGuidance({
  abilityId: 'inference',
  questionText: '结合全文分析人物此时的心理变化。',
  responseFormat: 'text',
});
check(
  '人物心理题提示聚焦处境与前后表现',
  /处境/.test(psychology.hint) && /前后表现/.test(psychology.hint) && /心理/.test(psychology.hint),
  psychology.hint,
);

const choice = buildPreAnswerLearningGuidance({
  abilityId: 'comprehension',
  questionText: '下列对人物心情的理解，正确的一项是？',
  responseFormat: 'single_choice',
});
check(
  '单选提示简洁引导证据核对但不暴露答案',
  /逐项核对/.test(choice.hint)
    && /材料依据/.test(choice.hint)
    && !/[A-D]项|正确答案|应该选/.test(choice.hint),
  choice.hint,
);

for (const [index, guidance] of [comprehension, psychology, choice].entries()) {
  check(
    `提示 ${index + 1} 保持一句话和单一思路入口`,
    (guidance.hint.match(/。/g) || []).length === 1
      && !/[；;]/.test(guidance.hint)
      && guidance.hint.length <= 52,
    guidance.hint,
  );
}

const failed = cases.filter((item) => !item.pass);
for (const item of cases) {
  console.log(`${item.pass ? 'PASS' : 'FAIL'} ${item.name}: ${item.detail}`);
}

if (failed.length) {
  throw new Error(`Pre-answer learning guidance debug failed: ${failed.length}/${cases.length}`);
}

console.log(`Pre-answer learning guidance debug passed: ${cases.length}/${cases.length}`);
