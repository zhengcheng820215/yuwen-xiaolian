import { runDiagnosisAgent } from '../ai/agents/diagnosisAgent.ts';
import {
  type DiagnosisInput,
  type DiagnosisResult,
  isDiagnosisInput,
} from '../ai/schemas/diagnosis.schema.ts';

export async function diagnosis(input: DiagnosisInput): Promise<DiagnosisResult> {
  console.log('[diagnosis API] received metadata', input.questionMetadata);
  return runDiagnosisAgent(input);
}

export async function diagnoseStudentAnswer(input: DiagnosisInput): Promise<DiagnosisResult> {
  return diagnosis(input);
}

export async function diagnosisHandler(request: Request): Promise<Response> {
  const body = await request.json();

  if (!isDiagnosisInput(body)) {
    return Response.json(
      { error: 'Invalid diagnosis payload. Required: question, referenceAnswer, studentAnswer.' },
      { status: 400 },
    );
  }

  const result = await diagnosis(body);
  return Response.json(result);
}
