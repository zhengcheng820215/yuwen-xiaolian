import {
  createRubricItemOptimizationConfig,
  optimizeRubricItem,
} from '../agents/rubricItemOptimizationAgent.ts';
import { ScriptedDiagnosisProviderAdapter } from '../providers/diagnosisProviderAdapter.ts';
import type {
  RubricItemOptimizationInput,
} from '../schemas/rubricItemOptimization.schema.ts';

const reports: Array<{ name: string; passed: boolean; detail: string }> = [];

const input: RubricItemOptimizationInput = {
  requestId: 'rubric-item-optimization-debug',
  material: {
    materialVersionId: 'material-emperor:v1',
    title: '皇帝的新装',
    content: '两个骗子来到城里，自称能织出神奇的布。\n他们索要金钱和丝线，假装在织布机前工作。\n皇帝派大臣查看，最后亲自观看并称赞新衣。',
  },
  question: {
    questionStem: '结合材料，概括骗子从出现到获得皇帝信任的主要步骤。',
    observationFocus: '行骗过程概括',
    abilityId: 'summarization',
    difficulty: 'intermediate',
  },
  rubricItem: {
    localId: 'rubric-1',
    name: '行骗步骤概括',
    abilityId: 'summarization',
    importance: 'critical',
    required: true,
    acceptedSignals: ['先设骗局', '索要钱财', '假装织布', '获得信任'],
    requireTextEvidence: true,
    requireExplanation: false,
  },
  siblingRubricItems: [{
    name: '步骤顺序正确',
    abilityId: 'summarization',
    importance: 'important',
    required: false,
    acceptedSignals: ['按出现、索要、假装、获信的顺序作答'],
    requireTextEvidence: true,
    requireExplanation: false,
  }],
  qualityIssues: ['评分标准难以区分不同完成水平。'],
};

await check('C01 合法的单项建议可以返回', async () => {
  const provider = providerWith(validOutput());
  const result = await run(input, provider);
  return result.suggestedItem.acceptedSignals.length === 4 &&
    result.suggestedItem.importance === 'critical' &&
    result.originalItem.abilityId === 'summarization' &&
    provider.getCallCount() === 1;
});

await check('C02 Prompt 锁定能力与其他评分项', async () => {
  const provider = providerWith(validOutput());
  await run(input, provider);
  const prompt = provider.getRequests()[0]?.prompt || '';
  return prompt.includes('不得修改题干、材料、难度、训练能力或其他评分项') &&
    prompt.includes('不得改变 rubricItem.abilityId') &&
    prompt.includes('importance 合法值只有 critical、important、supporting') &&
    prompt.includes('同一道题的其他评分项，属于不可重复边界') &&
    prompt.includes('按出现、索要、假装、获信的顺序作答');
});

await check('C03 原样返回会被拒绝并定向重试', async () => {
  const provider = new ScriptedDiagnosisProviderAdapter([
    {
      type: 'response',
      rawOutput: JSON.stringify({
        ...validOutput(),
        suggestedItem: {
          name: input.rubricItem.name,
          importance: input.rubricItem.importance,
          required: input.rubricItem.required,
          acceptedSignals: input.rubricItem.acceptedSignals,
          requireTextEvidence: input.rubricItem.requireTextEvidence,
          requireExplanation: input.rubricItem.requireExplanation,
        },
      }),
    },
    { type: 'response', rawOutput: JSON.stringify(validOutput()) },
  ]);
  const result = await run(input, provider);
  return result.suggestedItem.name !== input.rubricItem.name &&
    provider.getCallCount() === 2 &&
    provider.getRequests()[1]?.prompt.includes('暂未生成更清晰的评分项');
});

await check('C04 非法判定作用会被拦截', async () => {
  const provider = providerWith({
    ...validOutput(),
    suggestedItem: {
      ...validOutput().suggestedItem,
      importance: 'mandatory',
    },
  });
  try {
    await run(input, provider, 1);
    return false;
  } catch (error) {
    return error instanceof Error && error.message.includes('判定作用不在允许范围内');
  }
});

await check('C05 越界段落会被拦截', async () => {
  const provider = providerWith({
    ...validOutput(),
    suggestedItem: {
      ...validOutput().suggestedItem,
      acceptedSignals: ['结合第9段概括骗局步骤'],
    },
  });
  try {
    await run(input, provider, 1);
    return false;
  } catch (error) {
    return error instanceof Error && error.message.includes('材料共 3 段');
  }
});

await check('C06 材料缺失时不会调用 Provider', async () => {
  const provider = providerWith(validOutput());
  try {
    await run({ ...input, material: { ...input.material, content: '' } }, provider);
    return false;
  } catch {
    return provider.getCallCount() === 0;
  }
});

await check('C07 与其他评分项标题重复会被拒绝并定向重试', async () => {
  const duplicateOutput = {
    ...validOutput(),
    suggestedItem: {
      ...validOutput().suggestedItem,
      name: input.siblingRubricItems[0].name,
    },
  };
  const provider = new ScriptedDiagnosisProviderAdapter([
    { type: 'response', rawOutput: JSON.stringify(duplicateOutput) },
    { type: 'response', rawOutput: JSON.stringify(validOutput()) },
  ]);
  const result = await run(input, provider);
  return result.suggestedItem.name === validOutput().suggestedItem.name &&
    provider.getCallCount() === 2 &&
    provider.getRequests()[1]?.prompt.includes('判断内容重复');
});

await check('C08 与其他评分项答案要点近似重复会被拦截', async () => {
  const nextInput = {
    ...input,
    siblingRubricItems: [{
      ...input.siblingRubricItems[0],
      name: '主要步骤是否齐全',
      acceptedSignals: ['自称能织神奇布料', '索要金钱和丝线', '假装织布', '使皇帝相信新衣存在'],
    }],
  };
  const provider = providerWith(validOutput());
  try {
    await run(nextInput, provider, 1);
    return false;
  } catch (error) {
    return error instanceof Error && error.message.includes('判断内容重复');
  }
});

const failed = reports.filter((report) => !report.passed);
reports.forEach((report) => {
  console.log(`${report.passed ? 'PASS' : 'FAIL'} ${report.name} ${report.detail}`);
});
if (failed.length > 0) process.exitCode = 1;

async function run(
  nextInput: RubricItemOptimizationInput,
  provider: ScriptedDiagnosisProviderAdapter,
  maxAttempts = 2,
) {
  return optimizeRubricItem(nextInput, {
    provider,
    config: createRubricItemOptimizationConfig({
      providerName: provider.providerName,
      model: 'scripted-model',
      maxAttempts,
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
    suggestedItem: {
      name: '主要行骗步骤完整',
      importance: 'critical',
      required: true,
      acceptedSignals: ['自称能织神奇布料', '索要金钱和丝线', '假装织布', '使皇帝相信新衣存在'],
      requireTextEvidence: true,
      requireExplanation: false,
    },
    changes: ['将笼统名称改为可判断的完成要求', '把答案要点改为可逐项核对的材料事实'],
    rationale: '评分者可以根据四个关键步骤判断回答是否完整，并与其他评分项分工。',
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
