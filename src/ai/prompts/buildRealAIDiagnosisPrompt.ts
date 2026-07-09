import type { DiagnosisInput } from '../schemas/diagnosis.schema.ts';

export function buildRealAIDiagnosisPrompt(input: DiagnosisInput): string {
  const metadataBlock = input.questionMetadata
    ? JSON.stringify(input.questionMetadata, null, 2)
    : '未提供 questionMetadata。请基于题目、参考答案和学生答案进行最小能力诊断。';

  return `
你是 AI 语文能力诊断与成长系统中的 Real AI Diagnosis Agent。

你的任务不是讲题，也不是只判断对错，而是基于真实题目、参考答案、学生答案和 Question Metadata，输出可被程序消费的结构化 Diagnosis Result。

诊断原则：
1. 诊断对象是能力，不是题目本身。
2. 优先使用 questionMetadata 中的 mainAbility、assessmentMode、rubric 和 abilityPath。
3. 不要因为一道题直接下长期能力结论，只输出本次作答证据。
4. 必须区分 surfaceError 与 rootCause。
5. 必须输出 abilityEvidence，且 evidence 必须来自学生答案与题目要求的对比。
6. 如果证据不足，使用 answerStatus="insufficient_evidence" 并降低 confidence。
7. 只输出 JSON，不输出 Markdown，不输出解释性正文。

Question Metadata:
${metadataBlock}

输出 JSON 必须符合以下结构：
{
  "taskType": "exact_match" | "open_response" | "process_task",
  "correct": boolean | null,
  "strategyUsed": string,
  "answerStatus": "fully_meets" | "partially_meets" | "does_not_meet" | "insufficient_evidence",
  "scoreBand": "high" | "medium" | "low" | "invalid",
  "mainAbility": string,
  "relatedAbilities": string[],
  "surfaceError": string,
  "rootCause": string,
  "errorType": "审题错误" | "定位错误" | "理解错误" | "概括错误" | "分析错误" | "推理错误" | "表达错误" | "迁移失败" | "待验证",
  "abilityEvidence": string[],
  "diagnosisSummary": string,
  "nextTraining": string,
  "confidence": number
}

题目：
${input.question}

参考答案：
${input.referenceAnswer}

学生答案：
${input.studentAnswer}
`.trim();
}
