import {
  createQuestionStemOptimizationConfig,
  optimizeQuestionStem,
} from '../agents/questionStemOptimizationAgent.ts';
import { ScriptedDiagnosisProviderAdapter } from '../providers/diagnosisProviderAdapter.ts';
import type {
  QuestionStemOptimizationInput,
} from '../schemas/questionStemOptimization.schema.ts';

const reports: Array<{ name: string; passed: boolean; detail: string }> = [];

const input: QuestionStemOptimizationInput = {
  requestId: 'question-stem-optimization-debug',
  material: {
    materialVersionId: 'material-field:v1',
    title: '初春田野',
    content: '清晨，薄雾笼罩着田野。\n第二段写麦苗上的露珠和远处的鸟鸣。',
  },
  question: {
    questionStem: '文章描写了初春田野的景色，请分析景物描写的作用。',
    observationFocus: '景物描写作用分析',
    abilityId: 'analysis',
    difficulty: 'intermediate',
    rubricFocuses: ['景物特点', '内容作用'],
  },
  qualityIssues: [{
    check: 'materialGrounding',
    message: '题目缺少明确的材料依据。',
  }],
};

await check('C01 合法建议可以返回', async () => {
  const provider = providerWith(validOutput());
  const result = await run(input, provider);
  return result.suggestedStem.includes('第2段') &&
    result.addressedChecks.includes('materialGrounding') &&
    result.suggestionReview.status === 'improved' &&
    provider.getCallCount() === 1;
});

await check('C02 材料缺失时不会调用 Provider', async () => {
  const provider = providerWith(validOutput());
  try {
    await run({
      ...input,
      material: { ...input.material, content: '' },
    }, provider);
    return false;
  } catch {
    return provider.getCallCount() === 0;
  }
});

await check('C03 原样返回会被拒绝并定向重试', async () => {
  const provider = new ScriptedDiagnosisProviderAdapter([
    {
      type: 'response',
      rawOutput: JSON.stringify({
        ...validOutput(),
        suggestedStem: input.question.questionStem,
      }),
    },
    { type: 'response', rawOutput: JSON.stringify(validOutput()) },
  ]);
  const result = await run(input, provider);
  return result.suggestedStem !== input.question.questionStem &&
    provider.getCallCount() === 2 &&
    provider.getRequests()[1]?.prompt.includes('暂未生成更合适的表述');
});

await check('C04 越界段落会被拦截并定向重试', async () => {
  const provider = new ScriptedDiagnosisProviderAdapter([
    {
      type: 'response',
      rawOutput: JSON.stringify({
        ...validOutput(),
        suggestedStem: '结合第9段，分析初春田野景物描写的作用。',
      }),
    },
    { type: 'response', rawOutput: JSON.stringify(validOutput()) },
  ]);
  const result = await run(input, provider);
  return result.suggestedStem.includes('第2段') &&
    provider.getRequests()[1]?.prompt.includes('材料共 2 段');
});

await check('C05 Prompt 明确限制只改题干', async () => {
  const provider = providerWith(validOutput());
  await run(input, provider);
  const prompt = provider.getRequests()[0]?.prompt || '';
  return prompt.includes('唯一任务是优化“题干文字”') &&
    prompt.includes('不得修改训练能力、观察重点、难度、评分标准或材料') &&
    prompt.includes('不得编造材料原句、段落、人物、事件或背景知识');
});

await check('C06 泛化材料表述仍会保留提醒', async () => {
  const provider = providerWith({
    ...validOutput(),
    suggestedStem: '结合材料，分析这段景物描写在文中的作用。',
  });
  const result = await run(input, provider);
  return result.suggestionReview.status === 'needs_attention' &&
    result.suggestionReview.remainingIssues.some(
      (issue) => issue.check === 'materialGrounding',
    );
});

await check('C07 定向重试会完整暴露优化重点', async () => {
  const provider = providerWith(validOutput());
  await run({
    ...input,
    targetChecks: ['materialGrounding'],
  }, provider);
  const prompt = provider.getRequests()[0]?.prompt || '';
  return prompt.includes('"optimizationFocus":["materialGrounding"]') &&
    prompt.includes('必须优先修复其中列出的检查项');
});

await check('C08 非题干字段问题会明确返回修改位置', async () => {
  const provider = providerWith(validOutput());
  const result = await run({
    ...input,
    qualityIssues: [{
      check: 'rubricAlignment',
      message: '评分标准与题干不一致。',
    }],
    targetChecks: ['rubricAlignment'],
  }, provider);
  return result.suggestionReview.status === 'needs_attention' &&
    result.suggestionReview.remainingIssues[0]?.recommendedAction.includes('评分标准');
});

const failed = reports.filter((report) => !report.passed);
reports.forEach((report) => {
  console.log(`${report.passed ? 'PASS' : 'FAIL'} ${report.name} ${report.detail}`);
});
if (failed.length > 0) process.exitCode = 1;

async function run(
  nextInput: QuestionStemOptimizationInput,
  provider: ScriptedDiagnosisProviderAdapter,
) {
  return optimizeQuestionStem(nextInput, {
    provider,
    config: createQuestionStemOptimizationConfig({
      providerName: provider.providerName,
      model: 'scripted-model',
      maxAttempts: 2,
    }),
  });
}

function providerWith(output: Record<string, unknown>) {
  return new ScriptedDiagnosisProviderAdapter([{
    type: 'response',
    rawOutput: JSON.stringify(output),
  }]);
}

function validOutput() {
  return {
    suggestedStem: '结合第2段对麦苗露珠和远处鸟鸣的描写，分析这段景物描写在文中的作用。',
    changes: ['补充具体材料范围', '明确需要分析的景物及其作用'],
    rationale: '让学生能够快速定位材料依据，同时保持原有分析能力目标不变。',
    addressedChecks: ['materialGrounding', 'scopeClarity'],
  };
}

async function check(name: string, action: () => Promise<boolean>) {
  try {
    const passed = await action();
    reports.push({ name, passed, detail: passed ? '' : 'condition returned false' });
  } catch (error) {
    reports.push({
      name,
      passed: false,
      detail: error instanceof Error ? error.message : String(error),
    });
  }
}
