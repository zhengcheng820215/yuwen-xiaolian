import { runDiagnosisAgent } from '../ai/agents/diagnosisAgent';
import {
  type DiagnosisInput,
  type DiagnosisResult,
  isDiagnosisInput,
} from '../ai/schemas/diagnosis.schema';

export async function diagnosis(input: DiagnosisInput): Promise<DiagnosisResult> {
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
