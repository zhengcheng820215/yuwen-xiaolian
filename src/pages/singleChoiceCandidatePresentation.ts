import {
  createStudentSingleChoiceDelivery,
  validateSingleChoiceInteraction,
  type SingleChoiceInteraction,
} from '../ai/schemas/singleChoiceInteraction.schema.ts';

export type SingleChoiceCandidatePreview = {
  responseFormat: 'single_choice';
  options: Array<{
    optionId: string;
    content: string;
    displayOrder: number;
    displayLabel: string;
  }>;
  optionSetVersion: number;
};

export function resolveSingleChoiceCandidatePreview(
  interaction: SingleChoiceInteraction | undefined,
): SingleChoiceCandidatePreview | null {
  if (!validateSingleChoiceInteraction(interaction).passed || !interaction) return null;
  const delivery = createStudentSingleChoiceDelivery(interaction);
  return {
    responseFormat: 'single_choice',
    options: delivery.options.map((option) => ({
      ...option,
      displayLabel: String.fromCharCode(64 + option.displayOrder),
    })),
    optionSetVersion: delivery.optionSetVersion,
  };
}
