export const SINGLE_CHOICE_INTERACTION_SCHEMA_VERSION =
  'single-choice-interaction-v1' as const;

export const SINGLE_CHOICE_MISCONCEPTION_CODES = [
  'surface_reading',
  'entity_confusion',
  'evidence_omission',
  'over_inference',
  'causal_reversal',
  'scope_shift',
  'other_explainable_bias',
] as const;

export type SingleChoiceMisconceptionCode =
  typeof SINGLE_CHOICE_MISCONCEPTION_CODES[number];

export type QuestionChoiceOption = {
  optionId: string;
  content: string;
};

export type QuestionDistractorRationale = {
  optionId: string;
  misconceptionCode: SingleChoiceMisconceptionCode;
  diagnosisMeaning: string;
  evidenceBoundary?: string;
};

export type SingleChoiceInteraction = {
  schemaVersion: typeof SINGLE_CHOICE_INTERACTION_SCHEMA_VERSION;
  selectionMode: 'single';
  options: QuestionChoiceOption[];
  correctOptionIds: [string];
  distractorRationales: QuestionDistractorRationale[];
  optionSetVersion: number;
};

export type SingleChoiceMinimumResponseRequirement = {
  responseFormat: 'single_choice';
  minLength: 0;
  requireTextEvidence: false;
  requireExplanation: false;
  minSelections: 1;
  maxSelections: 1;
};

export type StudentSingleChoiceDelivery = {
  responseFormat: 'single_choice';
  options: Array<QuestionChoiceOption & { displayOrder: number }>;
  optionSetVersion: number;
};

export type SingleChoiceStudentAnswerValue = {
  responseFormat: 'single_choice';
  selectedOptionIds: [string];
  optionSetVersion: number;
  displayedOptionOrder: string[];
};

export type SingleChoiceValidationIssue = {
  code: string;
  field: string;
  message: string;
};

export type SingleChoiceValidationResult = {
  passed: boolean;
  issues: SingleChoiceValidationIssue[];
};

export function validateSingleChoiceInteraction(
  value: unknown,
): SingleChoiceValidationResult {
  const issues: SingleChoiceValidationIssue[] = [];
  if (!value || typeof value !== 'object') {
    return fail('choice.interaction_required', 'choiceInteraction', 'Single-choice interaction is required.');
  }
  const interaction = value as SingleChoiceInteraction;
  if (interaction.schemaVersion !== SINGLE_CHOICE_INTERACTION_SCHEMA_VERSION) {
    add(issues, 'choice.schema_version', 'choiceInteraction.schemaVersion', 'Single-choice schema version is not supported.');
  }
  if (interaction.selectionMode !== 'single') {
    add(issues, 'choice.selection_mode', 'choiceInteraction.selectionMode', 'Single-choice selection mode must be single.');
  }
  if (!Number.isInteger(interaction.optionSetVersion) || interaction.optionSetVersion < 1) {
    add(issues, 'choice.option_set_version', 'choiceInteraction.optionSetVersion', 'Option set version must be a positive integer.');
  }

  const options = Array.isArray(interaction.options) ? interaction.options : [];
  if (options.length < 3 || options.length > 5) {
    add(issues, 'choice.option_count', 'choiceInteraction.options', 'Single-choice requires between three and five options.');
  }
  const optionIds: string[] = [];
  const optionContents: string[] = [];
  options.forEach((option, index) => {
    if (!option || typeof option !== 'object' || !nonEmpty(option.optionId)) {
      add(issues, 'choice.option_id', `choiceInteraction.options.${index}.optionId`, 'Option ID is required.');
    } else {
      optionIds.push(option.optionId.trim());
    }
    if (!option || typeof option !== 'object' || !nonEmpty(option.content)) {
      add(issues, 'choice.option_content', `choiceInteraction.options.${index}.content`, 'Option content is required.');
    } else {
      optionContents.push(normalizeText(option.content));
    }
  });
  if (new Set(optionIds).size !== optionIds.length) {
    add(issues, 'choice.option_id_duplicate', 'choiceInteraction.options', 'Option IDs must be unique.');
  }
  if (new Set(optionContents).size !== optionContents.length) {
    add(issues, 'choice.option_content_duplicate', 'choiceInteraction.options', 'Option contents must be unique.');
  }

  const correctOptionIds = Array.isArray(interaction.correctOptionIds)
    ? interaction.correctOptionIds.filter(nonEmpty).map((item) => item.trim())
    : [];
  if (correctOptionIds.length !== 1) {
    add(issues, 'choice.correct_option_count', 'choiceInteraction.correctOptionIds', 'Single-choice requires exactly one correct option.');
  } else if (!optionIds.includes(correctOptionIds[0])) {
    add(issues, 'choice.correct_option_unknown', 'choiceInteraction.correctOptionIds', 'Correct option must reference an existing option ID.');
  }

  const rationales = Array.isArray(interaction.distractorRationales)
    ? interaction.distractorRationales
    : [];
  const correctOptionId = correctOptionIds.length === 1 ? correctOptionIds[0] : null;
  const expectedDistractorIds = optionIds.filter((optionId) => optionId !== correctOptionId);
  const rationaleOptionIds: string[] = [];
  const misconceptionCodes: string[] = [];
  const diagnosisMeanings: string[] = [];
  rationales.forEach((rationale, index) => {
    const prefix = `choiceInteraction.distractorRationales.${index}`;
    if (!rationale || typeof rationale !== 'object' || !nonEmpty(rationale.optionId)) {
      add(issues, 'choice.distractor_option_id', `${prefix}.optionId`, 'Distractor rationale option ID is required.');
    } else {
      const optionId = rationale.optionId.trim();
      rationaleOptionIds.push(optionId);
      if (!optionIds.includes(optionId)) {
        add(issues, 'choice.distractor_option_unknown', `${prefix}.optionId`, 'Distractor rationale must reference an existing option ID.');
      }
      if (optionId === correctOptionId) {
        add(issues, 'choice.correct_option_has_rationale', `${prefix}.optionId`, 'Correct option cannot have a distractor rationale.');
      }
    }
    if (!SINGLE_CHOICE_MISCONCEPTION_CODES.includes(rationale?.misconceptionCode)) {
      add(issues, 'choice.misconception_code', `${prefix}.misconceptionCode`, 'Distractor misconception code is not supported.');
    } else {
      misconceptionCodes.push(rationale.misconceptionCode);
    }
    if (!nonEmpty(rationale?.diagnosisMeaning)) {
      add(issues, 'choice.diagnosis_meaning', `${prefix}.diagnosisMeaning`, 'Distractor diagnosis meaning is required.');
    } else {
      diagnosisMeanings.push(normalizeText(rationale.diagnosisMeaning));
    }
    if (rationale?.evidenceBoundary !== undefined && !nonEmpty(rationale.evidenceBoundary)) {
      add(issues, 'choice.evidence_boundary', `${prefix}.evidenceBoundary`, 'Evidence boundary cannot be blank.');
    }
  });
  if (new Set(rationaleOptionIds).size !== rationaleOptionIds.length) {
    add(issues, 'choice.distractor_duplicate', 'choiceInteraction.distractorRationales', 'Each distractor may have only one rationale.');
  }
  if (
    expectedDistractorIds.length !== rationaleOptionIds.length ||
    expectedDistractorIds.some((optionId) => !rationaleOptionIds.includes(optionId))
  ) {
    add(issues, 'choice.distractor_coverage', 'choiceInteraction.distractorRationales', 'Every incorrect option requires one distractor rationale.');
  }
  if (new Set(misconceptionCodes).size !== misconceptionCodes.length) {
    add(issues, 'choice.misconception_duplicate', 'choiceInteraction.distractorRationales', 'Distractors must represent independent misconception categories.');
  }
  if (new Set(diagnosisMeanings).size !== diagnosisMeanings.length) {
    add(issues, 'choice.diagnosis_meaning_duplicate', 'choiceInteraction.distractorRationales', 'Distractors must not reuse the same diagnosis meaning.');
  }

  return { passed: issues.length === 0, issues };
}

export function isSingleChoiceInteraction(value: unknown): value is SingleChoiceInteraction {
  return validateSingleChoiceInteraction(value).passed;
}

export function isSingleChoiceMinimumResponseRequirement(
  value: unknown,
): value is SingleChoiceMinimumResponseRequirement {
  if (!value || typeof value !== 'object') return false;
  const requirement = value as SingleChoiceMinimumResponseRequirement;
  return requirement.responseFormat === 'single_choice'
    && requirement.minLength === 0
    && requirement.requireTextEvidence === false
    && requirement.requireExplanation === false
    && requirement.minSelections === 1
    && requirement.maxSelections === 1;
}

export function createStudentSingleChoiceDelivery(
  interaction: SingleChoiceInteraction,
  displayedOptionOrder: string[] = interaction.options.map((option) => option.optionId),
): StudentSingleChoiceDelivery {
  const validation = validateSingleChoiceInteraction(interaction);
  if (!validation.passed) {
    throw new Error(`Single-choice interaction is invalid: ${validation.issues.map((issue) => issue.code).join(', ')}`);
  }
  const optionIds = interaction.options.map((option) => option.optionId);
  if (
    displayedOptionOrder.length !== optionIds.length ||
    new Set(displayedOptionOrder).size !== displayedOptionOrder.length ||
    displayedOptionOrder.some((optionId) => !optionIds.includes(optionId))
  ) {
    throw new Error('Single-choice display order must contain every option ID exactly once.');
  }
  const optionsById = new Map(interaction.options.map((option) => [option.optionId, option]));
  return {
    responseFormat: 'single_choice',
    options: displayedOptionOrder.map((optionId, index) => ({
      ...clone(optionsById.get(optionId)!),
      displayOrder: index + 1,
    })),
    optionSetVersion: interaction.optionSetVersion,
  };
}

export function buildDeterministicSingleChoiceOptionOrder(
  interaction: SingleChoiceInteraction,
  displaySeed = 'single-choice-default-display',
): string[] {
  const validation = validateSingleChoiceInteraction(interaction);
  if (!validation.passed) {
    throw new Error(`Single-choice interaction is invalid: ${validation.issues.map((issue) => issue.code).join(', ')}`);
  }
  const canonicalOptions = [...interaction.options]
    .sort((left, right) => left.optionId.localeCompare(right.optionId));
  const fingerprint = canonicalOptions
    .map((option) => `${option.optionId}:${normalizeText(option.content)}`)
    .join('|');
  const optionIds = canonicalOptions.map((option) => option.optionId);
  let state = stableHash(
    `${displaySeed}|${interaction.optionSetVersion}|${fingerprint}`,
  );
  for (let index = optionIds.length - 1; index > 0; index -= 1) {
    state = nextShuffleState(state);
    const targetIndex = state % (index + 1);
    [optionIds[index], optionIds[targetIndex]] = [optionIds[targetIndex], optionIds[index]];
  }
  return optionIds;
}

export function validateSingleChoiceStudentAnswerValue(
  value: unknown,
  delivery?: StudentSingleChoiceDelivery,
): SingleChoiceValidationResult {
  const issues: SingleChoiceValidationIssue[] = [];
  if (!value || typeof value !== 'object') {
    return fail('choice_response.required', 'studentAnswer', 'Single-choice response is required.');
  }
  const response = value as SingleChoiceStudentAnswerValue;
  if (response.responseFormat !== 'single_choice') {
    add(issues, 'choice_response.format', 'studentAnswer.responseFormat', 'Response format must be single_choice.');
  }
  const selectedOptionIds = Array.isArray(response.selectedOptionIds)
    ? response.selectedOptionIds.filter(nonEmpty).map((item) => item.trim())
    : [];
  if (selectedOptionIds.length !== 1) {
    add(issues, 'choice_response.selection_count', 'studentAnswer.selectedOptionIds', 'Exactly one option must be selected.');
  }
  if (!Number.isInteger(response.optionSetVersion) || response.optionSetVersion < 1) {
    add(issues, 'choice_response.option_set_version', 'studentAnswer.optionSetVersion', 'Option set version must be a positive integer.');
  }
  const displayedOptionOrder = Array.isArray(response.displayedOptionOrder)
    ? response.displayedOptionOrder.filter(nonEmpty).map((item) => item.trim())
    : [];
  if (new Set(displayedOptionOrder).size !== displayedOptionOrder.length) {
    add(issues, 'choice_response.display_order_duplicate', 'studentAnswer.displayedOptionOrder', 'Display order cannot contain duplicate option IDs.');
  }
  if (delivery) {
    const deliveredOptionIds = delivery.options.map((option) => option.optionId);
    if (response.optionSetVersion !== delivery.optionSetVersion) {
      add(issues, 'choice_response.option_set_mismatch', 'studentAnswer.optionSetVersion', 'Response option set does not match the delivered question.');
    }
    if (selectedOptionIds.some((optionId) => !deliveredOptionIds.includes(optionId))) {
      add(issues, 'choice_response.option_unknown', 'studentAnswer.selectedOptionIds', 'Selected option was not delivered.');
    }
    if (
      displayedOptionOrder.length !== deliveredOptionIds.length ||
      deliveredOptionIds.some((optionId) => !displayedOptionOrder.includes(optionId))
    ) {
      add(issues, 'choice_response.display_order_mismatch', 'studentAnswer.displayedOptionOrder', 'Response display order does not match the delivered question.');
    }
  }
  return { passed: issues.length === 0, issues };
}

function fail(code: string, field: string, message: string): SingleChoiceValidationResult {
  return { passed: false, issues: [{ code, field, message }] };
}

function add(
  issues: SingleChoiceValidationIssue[],
  code: string,
  field: string,
  message: string,
): void {
  issues.push({ code, field, message });
}

function nonEmpty(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function normalizeText(value: string): string {
  return value.trim().replace(/\s+/g, '');
}

function stableHash(value: string): number {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function nextShuffleState(value: number): number {
  let state = (value + 0x6d2b79f5) >>> 0;
  state = Math.imul(state ^ (state >>> 15), state | 1);
  state ^= state + Math.imul(state ^ (state >>> 7), state | 61);
  return (state ^ (state >>> 14)) >>> 0;
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}
