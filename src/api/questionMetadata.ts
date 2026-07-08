import { runQuestionMetadataAgent } from '../ai/agents/questionMetadataAgent.ts';
import {
  type QuestionMetadataAgentResult,
  type QuestionMetadataInput,
  isQuestionMetadataInput,
} from '../ai/schemas/questionMetadata.schema.ts';

export async function generateQuestionMetadata(
  input: QuestionMetadataInput,
): Promise<QuestionMetadataAgentResult> {
  return runQuestionMetadataAgent(input);
}

export async function questionMetadata(input: QuestionMetadataInput): Promise<QuestionMetadataAgentResult> {
  return generateQuestionMetadata(input);
}

export async function questionMetadataHandler(request: Request): Promise<Response> {
  const body = await request.json();

  if (!isQuestionMetadataInput(body)) {
    return Response.json(
      { error: 'Invalid question metadata payload. Required: question, referenceAnswer.' },
      { status: 400 },
    );
  }

  const result = await generateQuestionMetadata(body);
  return Response.json(result);
}
