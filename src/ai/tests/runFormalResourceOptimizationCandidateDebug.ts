import assert from 'node:assert/strict';
import {
  QuestionCandidateConflictError,
  QuestionCandidateService,
  type QuestionCandidateGenerator,
} from '../agents/questionCandidateService.ts';
import { InMemoryQuestionCandidateRepository } from
  '../repositories/inMemoryQuestionCandidateRepository.ts';
import {
  candidateContextMatches,
  type CandidateRuntimeContext,
} from '../schemas/questionCandidate.schema.ts';
import type { QuestionEditableFields } from '../schemas/workingTaskContent.schema.ts';

const NOW = '2026-08-09T10:00:00.000Z';
const context: CandidateRuntimeContext = {
  materialVersionId: 'material-wolf:v1',
  observationPlanVersion: 1,
  trainingTaskVersion: 1,
  baseFormalResourceId: 'question-task-wolf-1',
  baseFormalVersionId: 'question-task-wolf-1:v1',
  activeDraftId: 'draft-wolf-1',
  activeDraftRevision: 4,
  activeDraftContentHash: 'frozen-v1-content',
};

async function main(): Promise<void> {
  const repository = new InMemoryQuestionCandidateRepository();
  let generationCount = 0;
  const generator: QuestionCandidateGenerator = {
    async generate(input) {
      generationCount += 1;
      return Array.from({ length: input.count }, (_, index) => ({
        content: contentFixture(index + 1),
        generationReason: `基于正式版本 V1 生成新版方案 ${index + 1}`,
        changedFields: ['questionStem'],
        generationContext: {
          modelId: 'formal-version-debug-model',
          promptVersion: 'formal-version-optimization-v1',
          promptHash: `formal-version-prompt-${index + 1}`,
          ruleVersion: 'formal-resource-immutability-v1',
          materialVersionId: input.context.materialVersionId,
          observationPlanVersion: input.context.observationPlanVersion,
          trainingTaskVersion: input.context.trainingTaskVersion,
          generatedAt: NOW,
        },
      }));
    },
  };
  const service = new QuestionCandidateService(
    repository,
    generator,
    { async getCurrentContext() { return context; } },
    { async adoptCandidate() { throw new Error('not used'); } },
    () => NOW,
  );

  const first = await service.generateFormalVersionOptimizationCandidates({
    trainingTaskId: 'task-wolf-1',
    formalResourceId: context.baseFormalResourceId!,
    baseFormalVersionId: context.baseFormalVersionId!,
    count: 3,
    expectedContext: context,
    idempotencyKey: 'formal-v1-command-1',
  });
  assert.equal(first.length, 3);
  assert.equal(first[0]?.candidateType, 'formal_version_optimization');
  assert.equal(first[0]?.basedOnFormalResourceId, context.baseFormalResourceId);
  assert.equal(first[0]?.basedOnFormalVersionId, context.baseFormalVersionId);
  assert.equal(candidateContextMatches(first[0]!, context), true);

  const repeated = await service.generateFormalVersionOptimizationCandidates({
    trainingTaskId: 'task-wolf-1',
    formalResourceId: context.baseFormalResourceId!,
    baseFormalVersionId: context.baseFormalVersionId!,
    count: 3,
    expectedContext: context,
    idempotencyKey: 'formal-v1-command-1',
  });
  assert.deepEqual(repeated.map((item) => item.candidateId), first.map((item) => item.candidateId));
  assert.equal(generationCount, 1, 'Idempotent retry must not invoke the generator again.');

  assert.equal(candidateContextMatches(first[0]!, {
    ...context,
    baseFormalVersionId: 'question-task-wolf-1:v2',
  }), false, 'A V1 candidate must not appear under V2.');
  assert.equal(candidateContextMatches(first[0]!, {
    materialVersionId: context.materialVersionId,
    observationPlanVersion: context.observationPlanVersion,
    trainingTaskVersion: context.trainingTaskVersion,
    activeDraftId: context.activeDraftId,
    activeDraftRevision: context.activeDraftRevision,
    activeDraftContentHash: context.activeDraftContentHash,
  }), false, 'A formal-version candidate must not leak into the ordinary draft context.');

  await assert.rejects(
    () => service.generateFormalVersionOptimizationCandidates({
      trainingTaskId: 'task-wolf-1',
      formalResourceId: context.baseFormalResourceId!,
      baseFormalVersionId: 'question-task-wolf-1:v2',
      count: 1,
      expectedContext: context,
      idempotencyKey: 'formal-v2-conflict',
    }),
    (error) => error instanceof QuestionCandidateConflictError
      && error.code === 'FORMAL_RESOURCE_CANDIDATE_BASE_CONFLICT',
  );

  console.log('Formal Resource Optimization Candidate P1 Debug');
  console.log('PASS 01 candidate binds formal resource and V1 identity');
  console.log('PASS 02 generation command is idempotent');
  console.log('PASS 03 V1 candidate is isolated from V2 and ordinary draft contexts');
  console.log('PASS 04 mismatched formal version is rejected');
  console.log('Result: 4 / 4 PASS');
}

function contentFixture(index: number): QuestionEditableFields {
  return {
    materialVersionId: context.materialVersionId,
    title: `新版题目方案 ${index}`,
    questionStem: `结合《狼》的动作描写，分析狼的特点（新版方案 ${index}）。`,
    questionType: 'reading_comprehension',
    responseFormat: 'long_text',
    options: [],
    assessmentMode: 'reasoning_chain',
    answerAcceptance: {
      acceptedKeywords: ['狡猾', '贪婪'],
      semanticEquivalentAllowed: true,
      normalizationRules: ['trim', 'ignore_punctuation'],
    },
    rubric: [{
      itemId: `rubric-${index}`,
      name: '结合动作分析特点',
      description: '引用动作并说明人物特点。',
      abilityId: 'analysis',
      importance: 'critical',
      required: true,
      evidenceRequirement: { requireTextEvidence: true, requireExplanation: true },
      acceptedSignals: ['动作', '特点'],
    }],
    minimumAnswerRequirement: {
      minLength: 20,
      requireTextEvidence: true,
      requireExplanation: true,
    },
    abilityMetadata: {
      abilityId: 'analysis',
      supportingAbilityIds: ['comprehension'],
      prerequisiteAbilityIds: [],
      taskRole: 'training',
      difficulty: 'intermediate',
      gradeRange: '初中',
    },
    source: { sourceType: 'ai_assisted', description: 'Formal V1 optimization debug.' },
    tags: ['material_scope:full_text', 'observation_task:task-wolf-1'],
  };
}

void main();
