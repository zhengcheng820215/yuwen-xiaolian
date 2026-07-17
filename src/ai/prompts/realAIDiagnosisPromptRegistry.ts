import type { DiagnosisInput } from '../schemas/diagnosis.schema.ts';
import {
  REAL_AI_DIAGNOSIS_PROMPT_VERSION,
  buildRealAIDiagnosisPrompt,
} from './buildRealAIDiagnosisPrompt.ts';
import {
  REAL_AI_DIAGNOSIS_PROMPT_V4_VERSION,
  buildRealAIDiagnosisPromptV4,
} from './buildRealAIDiagnosisPromptV4.ts';

export const DEFAULT_REAL_AI_DIAGNOSIS_PROMPT_VERSION = REAL_AI_DIAGNOSIS_PROMPT_VERSION;

export const SUPPORTED_REAL_AI_DIAGNOSIS_PROMPT_VERSIONS = [
  REAL_AI_DIAGNOSIS_PROMPT_VERSION,
  REAL_AI_DIAGNOSIS_PROMPT_V4_VERSION,
] as const;

export type RealAIDiagnosisPromptVersion =
  typeof SUPPORTED_REAL_AI_DIAGNOSIS_PROMPT_VERSIONS[number];

export function isSupportedRealAIDiagnosisPromptVersion(
  value: string,
): value is RealAIDiagnosisPromptVersion {
  return (SUPPORTED_REAL_AI_DIAGNOSIS_PROMPT_VERSIONS as readonly string[]).includes(value);
}

export function buildVersionedRealAIDiagnosisPrompt(
  input: DiagnosisInput,
  promptVersion: RealAIDiagnosisPromptVersion,
): string {
  if (promptVersion === REAL_AI_DIAGNOSIS_PROMPT_VERSION) {
    return buildRealAIDiagnosisPrompt(input);
  }
  return buildRealAIDiagnosisPromptV4(input);
}
