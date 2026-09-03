export const TEXTBOOK_OBJECTIVE_CALIBRATION_POLICY_VERSION =
  'textbook_objective_calibration_v1' as const;

export const READING_CURRICULUM_CALIBRATION_ROLES = [
  'whole_text_orientation',
  'local_close_reading',
  'relation_explanation',
  'integrated_understanding',
  'optional_transfer',
] as const;

export type ReadingCurriculumCalibrationRole =
  typeof READING_CURRICULUM_CALIBRATION_ROLES[number];

export const READING_CURRICULUM_CALIBRATION_BASIS_CODES = [
  'multi_scene_structure',
  'multi_character_relation',
  'multi_stage_plot',
  'whole_text_organization',
] as const;

export type ReadingCurriculumCalibrationBasisCode =
  typeof READING_CURRICULUM_CALIBRATION_BASIS_CODES[number];

export const READING_CURRICULUM_DEFERRED_ACTIVITY_CODES = [
  'oral_reading',
  'recitation',
  'vocabulary_accumulation',
] as const;

export type ReadingCurriculumDeferredActivityCode =
  typeof READING_CURRICULUM_DEFERRED_ACTIVITY_CODES[number];

export type ReadingCurriculumCalibrationContext = {
  policyVersion: typeof TEXTBOOK_OBJECTIVE_CALIBRATION_POLICY_VERSION;
  requiresWholeTextOrientation: boolean;
  enforcementMode: 'advisory' | 'enforced';
  basisCodes: ReadingCurriculumCalibrationBasisCode[];
  deferredActivityCodes?: ReadingCurriculumDeferredActivityCode[];
};

export function isReadingCurriculumCalibrationRole(
  value: unknown,
): value is ReadingCurriculumCalibrationRole {
  return typeof value === 'string'
    && (READING_CURRICULUM_CALIBRATION_ROLES as readonly string[]).includes(value);
}

export function isReadingCurriculumCalibrationContext(
  value: unknown,
): value is ReadingCurriculumCalibrationContext {
  if (!value || typeof value !== 'object') return false;
  const context = value as ReadingCurriculumCalibrationContext;
  return context.policyVersion === TEXTBOOK_OBJECTIVE_CALIBRATION_POLICY_VERSION
    && typeof context.requiresWholeTextOrientation === 'boolean'
    && ['advisory', 'enforced'].includes(context.enforcementMode)
    && Array.isArray(context.basisCodes)
    && context.basisCodes.length > 0
    && new Set(context.basisCodes).size === context.basisCodes.length
    && context.basisCodes.every((code) => (
      (READING_CURRICULUM_CALIBRATION_BASIS_CODES as readonly string[]).includes(code)
    ))
    && (context.deferredActivityCodes === undefined
      || (Array.isArray(context.deferredActivityCodes)
        && new Set(context.deferredActivityCodes).size === context.deferredActivityCodes.length
        && context.deferredActivityCodes.every((code) => (
          (READING_CURRICULUM_DEFERRED_ACTIVITY_CODES as readonly string[]).includes(code)
        ))));
}
