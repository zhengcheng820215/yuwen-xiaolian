import {
  buildDeterministicSingleChoiceOptionOrder,
  validateSingleChoiceInteraction,
  type SingleChoiceInteraction,
  type SingleChoiceMisconceptionCode,
} from '../ai/schemas/singleChoiceInteraction.schema.ts';

export type SingleChoiceOptionPresentation = {
  displayLabel: string;
  content: string;
};

export type SingleChoiceDistractorPresentation = SingleChoiceOptionPresentation & {
  misconceptionLabel: string;
  diagnosisMeaning?: string;
  evidenceBoundary?: string;
};

export type SingleChoiceAssessmentPresentation = {
  correctOption: SingleChoiceOptionPresentation | null;
  distractors: SingleChoiceDistractorPresentation[];
  unansweredMessage: string;
};

export function resolveSingleChoiceAssessmentPresentation(
  interaction: SingleChoiceInteraction | null | undefined,
): SingleChoiceAssessmentPresentation {
  const options = resolveAuthoringPreviewOptions(interaction);
  const correctOptionId = interaction?.correctOptionIds?.[0] || null;
  const rationaleByOptionId = new Map(
    (interaction?.distractorRationales || []).map((rationale) => [rationale.optionId, rationale]),
  );
  const correctOptionIndex = options.findIndex((option) => option.optionId === correctOptionId);
  const correctOption = correctOptionIndex >= 0
    ? optionPresentation(options[correctOptionIndex], correctOptionIndex)
    : null;
  const distractors = options.flatMap((option, optionIndex) => {
    if (option.optionId === correctOptionId) return [];
    const rationale = rationaleByOptionId.get(option.optionId);
    return [{
      ...optionPresentation(option, optionIndex),
      misconceptionLabel: singleChoiceMisconceptionLabel(rationale?.misconceptionCode),
      diagnosisMeaning: rationale?.diagnosisMeaning,
      evidenceBoundary: rationale?.evidenceBoundary,
    }];
  });
  return {
    correctOption,
    distractors,
    unansweredMessage: '未形成可判断结果，不据此形成能力结论。',
  };
}

export function formatSingleChoiceAcceptedSignal(
  signal: string,
  interaction: SingleChoiceInteraction | null | undefined,
): string {
  const options = resolveAuthoringPreviewOptions(interaction);
  const formatted = options.reduce((current, option, optionIndex) => (
    current.split(option.optionId).join(
      `${singleChoiceOptionMarker(optionIndex)}（${option.content}）`,
    )
  ), String(signal || ''));
  return formatted.replace(/\boption[-_][\w-]+\b/gi, '对应选项');
}

export function singleChoiceOptionMarker(index: number): string {
  return String.fromCharCode(65 + index);
}

export function formatTrainingTaskTitle(
  index: number,
  responseFormat: string | null | undefined,
): string {
  return `训练任务${index + 1}${responseFormat === 'single_choice' ? '（单项选择）' : ''}`;
}

function optionPresentation(
  option: SingleChoiceInteraction['options'][number],
  optionIndex: number,
): SingleChoiceOptionPresentation {
  return {
    displayLabel: singleChoiceOptionMarker(optionIndex),
    content: option.content,
  };
}

function resolveAuthoringPreviewOptions(
  interaction: SingleChoiceInteraction | null | undefined,
): SingleChoiceInteraction['options'] {
  const sourceOptions = Array.isArray(interaction?.options) ? interaction.options : [];
  if (!interaction || !validateSingleChoiceInteraction(interaction).passed) return sourceOptions;
  const optionsById = new Map(sourceOptions.map((option) => [option.optionId, option]));
  return buildDeterministicSingleChoiceOptionOrder(interaction, 'authoring-preview')
    .flatMap((optionId) => {
      const option = optionsById.get(optionId);
      return option ? [option] : [];
    });
}

function singleChoiceMisconceptionLabel(
  code: SingleChoiceMisconceptionCode | undefined,
): string {
  return ({
    surface_reading: '停留在表面信息',
    entity_confusion: '混淆人物或对象',
    evidence_omission: '遗漏关键证据',
    over_inference: '推理超过文本证据',
    causal_reversal: '因果关系倒置',
    scope_shift: '理解范围发生偏移',
    other_explainable_bias: '其他可解释偏差',
  } satisfies Record<SingleChoiceMisconceptionCode, string>)[code || 'other_explainable_bias']
    || '待核对的理解偏差';
}
