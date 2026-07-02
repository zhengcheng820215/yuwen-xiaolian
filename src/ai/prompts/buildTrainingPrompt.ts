import type { TrainingInput } from '../schemas/training.schema.ts';

const EDUCATION_MODEL_REFERENCES = [
  'docs/education/ABILITY_MODEL.md',
  'docs/education/TRAINING_MODEL.md',
  'docs/education/QUESTION_MODEL.md',
  'docs/education/STUDENT_PROFILE_MODEL.md',
  'education-system/ABILITY_MODEL.md',
  'education-system/TRAINING_MODEL.md',
  'education-system/QUESTION_MODEL.md',
  'education-system/STUDENT_PROFILE_MODEL.md',
  'education/ABILITY_MODEL.md',
  'education/TRAINING_MODEL.md',
  'education/QUESTION_MODEL.md',
  'education/STUDENT_PROFILE_MODEL.md',
];

const TRAINING_MODEL_EXCERPT = `
训练不是刷题，而是帮助学生建立能力。
训练目标永远是能力成长，不是完成题目数量。
训练流程：能力诊断 -> 确定训练目标 -> 制定训练计划 -> 执行训练 -> AI反馈 -> 学生修正 -> 再次训练 -> 复测 -> 能力升级。
训练策略包括：针对训练、渐进训练、重复强化、变式训练、迁移训练、综合训练、动态训练。
训练完成标准是形成能力证据，包括独立完成、迁移应用、稳定完成、完成修正、通过复测。
`;

const ABILITY_MODEL_EXCERPT = `
一级能力包括：信息提取、理解、概括、分析、推理、表达。
能力成长强调独立、稳定、可迁移、可复测、可成长。
训练必须回到能力路径和前置能力，而不是只围绕题目答案。
`;

const QUESTION_MODEL_EXCERPT = `
题目不是学习目标，而是能力成长载体。
训练任务应服务能力目标，可以用于首次训练、重复训练、迁移训练、强化训练和综合训练。
`;

const PROFILE_MODEL_EXCERPT = `
学生能力画像记录能力等级、能力状态、支撑证据、常见问题、成长趋势和下一步建议。
训练方案应产生可进入画像的能力证据。
`;

export function buildTrainingPrompt(input: TrainingInput): string {
  return `
你是 AI 语文能力诊断与成长系统中的 Training Agent。

你的任务不是重新诊断学生错因，而是严格基于 Diagnosis Result 生成结构化训练方案 JSON。

请引用并遵循以下模型文档：
${EDUCATION_MODEL_REFERENCES.map((ref) => `- ${ref}`).join('\n')}

以下是当前最小可运行版本内置的模型摘要：

[ABILITY_MODEL]
${ABILITY_MODEL_EXCERPT}

[TRAINING_MODEL]
${TRAINING_MODEL_EXCERPT}

[QUESTION_MODEL]
${QUESTION_MODEL_EXCERPT}

[STUDENT_PROFILE_MODEL]
${PROFILE_MODEL_EXCERPT}

训练要求：
- 不重新判断错因。
- targetAbility 必须来自 diagnosisResult.mainAbility。
- rootCause 必须来自 diagnosisResult.rootCause。
- 训练方案必须围绕能力成长，而不是题目对错。
- 输出必须是 JSON，不要输出 Markdown，不要输出解释性正文。

JSON 字段必须严格为：
{
  "targetAbility": string,
  "rootCause": string,
  "trainingGoal": string,
  "trainingStrategy": string,
  "trainingSteps": string[],
  "practiceTasks": string[],
  "coachGuidance": string[],
  "completionCriteria": string[],
  "nextEvaluation": string,
  "confidence": number
}

Diagnosis Result：
${JSON.stringify(input.diagnosisResult, null, 2)}

题目：
${input.question}

学生答案：
${input.studentAnswer}
`;
}

export function getTrainingModelReferences(): string[] {
  return [...EDUCATION_MODEL_REFERENCES];
}
