import type { DiagnosisInput } from '../schemas/diagnosis.schema';

const EDUCATION_MODEL_REFERENCES = [
  'education-system/ABILITY_MODEL.md',
  'education-system/DIAGNOSIS_MODEL.md',
  'education-system/QUESTION_MODEL.md',
  'education/ABILITY_MODEL.md',
  'education/DIAGNOSIS_MODEL.md',
  'education/QUESTION_MODEL.md',
];

const ABILITY_MODEL_EXCERPT = `
能力不是一道题做对，也不是一次考试成绩。
能力是在陌生情境中，能够持续、稳定、独立完成某项思维活动。
一级能力包括：信息提取、理解、概括、分析、推理、表达。
能力判断必须基于证据，正确率只是能力表现之一。
`;

const DIAGNOSIS_MODEL_EXCERPT = `
能力诊断不是判断一道题是否正确，而是识别学生真正缺失的能力。
诊断必须区分表面错误 Surface Error 与真实原因 Root Cause。
诊断原则：不根据一道题下结论、不根据正确率判断能力、优先寻找前置能力、所有诊断必须有证据。
错误类型包括：审题错误、定位错误、理解错误、概括错误、分析错误、推理错误、表达错误、迁移失败。
`;

const QUESTION_MODEL_EXCERPT = `
题目不是学习目标，而是能力成长载体。
AI 不应把题目理解为题干加答案，而应理解为能力任务、能力观察点、能力诊断点、能力训练点和能力评估点。
每一道题必须映射主要能力、辅助能力、能力路径和前置能力。
`;

export function buildDiagnosisPrompt(input: DiagnosisInput): string {
  return `
你是 AI 语文能力诊断与成长系统中的 Diagnosis Agent。

你的任务不是批改对错，而是根据题目、参考答案和学生答案，输出结构化能力诊断结果。

请引用并遵循以下模型文档：
${EDUCATION_MODEL_REFERENCES.map((ref) => `- ${ref}`).join('\n')}

以下是当前最小可运行版本内置的模型摘要：

[ABILITY_MODEL]
${ABILITY_MODEL_EXCERPT}

[DIAGNOSIS_MODEL]
${DIAGNOSIS_MODEL_EXCERPT}

[QUESTION_MODEL]
${QUESTION_MODEL_EXCERPT}

诊断要求：
- 必须围绕能力诊断，而不是题目对错。
- 必须区分 surfaceError 与 rootCause。
- 必须说明 abilityEvidence。
- 如果证据不足，应降低 confidence，并说明需要继续观察。
- 输出必须是 JSON，不要输出 Markdown，不要输出解释性正文。

JSON 字段必须严格为：
{
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
`;
}

export function getDiagnosisModelReferences(): string[] {
  return [...EDUCATION_MODEL_REFERENCES];
}
