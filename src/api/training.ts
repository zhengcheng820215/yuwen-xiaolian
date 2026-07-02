import { runTrainingAgent } from '../ai/agents/trainingAgent.ts';
import {
  type TrainingInput,
  type TrainingResult,
  isTrainingInput,
} from '../ai/schemas/training.schema.ts';

export async function training(input: TrainingInput): Promise<TrainingResult> {
  return runTrainingAgent(input);
}

export async function generateTrainingPlan(input: TrainingInput): Promise<TrainingResult> {
  return training(input);
}

export async function trainingHandler(request: Request): Promise<Response> {
  const body = await request.json();

  if (!isTrainingInput(body)) {
    return Response.json(
      { error: 'Invalid training payload. Required: diagnosisResult, question, studentAnswer.' },
      { status: 400 },
    );
  }

  const result = await training(body);
  return Response.json(result);
}
