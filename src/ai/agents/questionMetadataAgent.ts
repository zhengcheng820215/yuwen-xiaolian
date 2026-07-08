import { matchQuestionMetadataPattern } from '../patterns/questionMetadataPatterns.ts';
import {
  type QuestionMetadataAgentResult,
  type QuestionMetadataInput,
  type QuestionMetadataResult,
  normalizeQuestionMetadata,
  validateQuestionMetadata,
} from '../schemas/questionMetadata.schema.ts';

export async function runQuestionMetadataAgent(
  input: QuestionMetadataInput,
): Promise<QuestionMetadataAgentResult> {
  const pattern = matchQuestionMetadataPattern(input.question);
  const metadata = normalizeQuestionMetadata(buildMetadataFromPattern(pattern));
  const validation = validateQuestionMetadata(metadata);

  return {
    metadata,
    matchedPattern: pattern.patternId,
    validation,
    confidence: validation.valid ? pattern.confidence : 0.35,
  };
}

function buildMetadataFromPattern(
  pattern: ReturnType<typeof matchQuestionMetadataPattern>,
): Partial<QuestionMetadataResult> {
  return {
    patternId: pattern.patternId,
    subject: '语文',
    questionType: pattern.questionType,
    assessmentMode: pattern.assessmentMode,
    mainAbility: pattern.mainAbility,
    relatedAbilities: pattern.relatedAbilities,
    abilityPath: pattern.abilityPath,
    rubric: pattern.rubric,
    trainingDirection: pattern.trainingDirection,
  };
}
