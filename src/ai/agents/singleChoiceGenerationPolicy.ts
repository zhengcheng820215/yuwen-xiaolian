import {
  validateSingleChoiceInteraction,
  type SingleChoiceInteraction,
} from '../schemas/singleChoiceInteraction.schema.ts';
import type { PrimaryAbilityId } from '../schemas/questionResourceAdmission.schema.ts';

export const SINGLE_CHOICE_GENERATION_POLICY_VERSION =
  'single-choice-generation-policy-v1' as const;

export type SingleChoiceGenerationPolicyIssue = {
  code: string;
  message: string;
};

export type SingleChoiceGenerationPolicyResult = {
  passed: boolean;
  issues: SingleChoiceGenerationPolicyIssue[];
};

export function evaluateSingleChoiceTrainingFit(input: {
  primaryAbilityId: PrimaryAbilityId;
  observationDimension: string;
  questionStem: string;
  expectedStudentAction: string;
  requiredRubricCount: number;
}): SingleChoiceGenerationPolicyResult {
  const issues: SingleChoiceGenerationPolicyIssue[] = [];
  const taskText = `${input.questionStem} ${input.expectedStudentAction}`;
  if (['summarization', 'expression'].includes(input.primaryAbilityId)) {
    issues.push({
      code: 'choice.training_action_requires_text',
      message: '概括或表达训练必须保留文本作答，不能转换为单项选择。',
    });
  }
  if (/概括|归纳|整合.{0,8}(证据|信息)|多角度|组织.{0,8}表达|写出.{0,8}(理由|过程)/u.test(taskText)) {
    issues.push({
      code: 'choice.training_action_requires_constructed_response',
      message: '当前训练动作要求学生组织或整合答案，不适合单项选择。',
    });
  }
  if (input.requiredRubricCount >= 3) {
    issues.push({
      code: 'choice.rubric_too_dense',
      message: '当前题目包含三个或更多独立核心观察点，不适合单项选择。',
    });
  }
  if (['analysis', 'inference'].includes(input.primaryAbilityId)
    && !/判断|辨认|识别|选择|最恰当|主要|初步|直接原因|作用/u.test(taskText)) {
    issues.push({
      code: 'choice.high_order_action_not_bounded',
      message: '分析或推理任务只有在观察动作明确且证据边界有限时才可使用单项选择。',
    });
  }
  return { passed: issues.length === 0, issues };
}

export function evaluateGeneratedSingleChoiceOptions(
  interaction: SingleChoiceInteraction | undefined,
): SingleChoiceGenerationPolicyResult {
  const structural = validateSingleChoiceInteraction(interaction);
  const issues: SingleChoiceGenerationPolicyIssue[] = structural.issues.map((issue) => ({
    code: issue.code,
    message: issue.message,
  }));
  if (!interaction || !structural.passed) return { passed: false, issues };

  const correctId = interaction.correctOptionIds[0];
  const correct = interaction.options.find((option) => option.optionId === correctId);
  const distractors = interaction.options.filter((option) => option.optionId !== correctId);
  if (interaction.options.some((option) => normalize(option.content).length < 4)) {
    issues.push({
      code: 'choice.option_too_thin',
      message: '选项必须表达完整判断，不能用明显残缺内容凑数。',
    });
  }
  if (interaction.distractorRationales.some((item) => !item.evidenceBoundary?.trim())) {
    issues.push({
      code: 'choice.distractor_evidence_boundary_missing',
      message: '每个错误选项都必须说明可核对的文本证据边界。',
    });
  }
  if (interaction.distractorRationales.some((item) => (
    normalize(item.diagnosisMeaning).length < 8 || /^(错误|不正确|不符合原文)$/u.test(item.diagnosisMeaning.trim())
  ))) {
    issues.push({
      code: 'choice.distractor_diagnosis_too_vague',
      message: '干扰项依据必须描述具体理解偏差，不能只说选项错误。',
    });
  }
  if (correct && distractors.length > 0) {
    const distractorLengths = distractors
      .map((option) => normalize(option.content).length)
      .sort((left, right) => left - right);
    const median = distractorLengths[Math.floor(distractorLengths.length / 2)] || 1;
    const correctLength = normalize(correct.content).length;
    if (correctLength > median * 2.5 || correctLength * 2.5 < median) {
      issues.push({
        code: 'choice.correct_option_length_cue',
        message: '正确选项与错误选项长度差异过大，可能形成明显答案提示。',
      });
    }
  }
  return { passed: issues.length === 0, issues };
}

function normalize(value: string): string {
  return value.replace(/[\s\p{P}\p{S}]+/gu, '');
}
