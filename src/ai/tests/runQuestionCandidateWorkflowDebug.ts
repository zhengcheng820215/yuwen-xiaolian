import assert from 'node:assert/strict';
import {
  QuestionCandidateConflictError,
  QuestionCandidateService,
  type CandidateAdoptionGateway,
  type GeneratedQuestionCandidate,
  type QuestionCandidateContextGateway,
  type QuestionCandidateGenerator,
} from '../agents/questionCandidateService.ts';
import { InMemoryQuestionCandidateRepository } from '../repositories/inMemoryQuestionCandidateRepository.ts';
import {
  createQuestionCandidate,
  resolveTaskCandidateState,
  type CandidateRuntimeContext,
  type QuestionCandidate,
} from '../schemas/questionCandidate.schema.ts';
import {
  calculateQuestionEditableFieldsHash,
  cloneWorkingTaskContent,
  type QuestionEditableFields,
} from '../schemas/workingTaskContent.schema.ts';

const NOW = '2026-08-05T10:00:00.000Z';

const cases: Array<{ name: string; run: () => Promise<void> }> = [
  { name: '01 generation only creates immutable candidates', run: caseGenerationBoundary },
  { name: '02 generation command is idempotent', run: caseGenerationIdempotency },
  { name: '03 candidate repository rejects mutation', run: caseCandidateImmutability },
  { name: '04 regeneration supersedes the base and remains retryable', run: caseRegeneration },
  { name: '05 optimization respects allowed fields', run: caseAllowedOptimization },
  { name: '06 optimization rejects locked field changes', run: caseLockedOptimization },
  { name: '07 stale material context expires a candidate', run: caseStaleContext },
  { name: '08 active draft revision conflicts block adoption', run: caseDraftConflict },
  { name: '09 adoption is idempotent and cannot be repeated', run: caseAdoptionIdempotency },
  { name: '10 candidate projection uses one context resolver', run: caseProjection },
];

async function main(): Promise<void> {
  let passed = 0;
  const failures: string[] = [];
  console.log('Question Candidate Workflow P1 Debug');
  console.log('='.repeat(64));
  for (const item of cases) {
    try {
      await item.run();
      passed += 1;
      console.log(`PASS ${item.name}`);
    } catch (error) {
      const message = error instanceof Error ? error.stack || error.message : String(error);
      failures.push(`${item.name}: ${message}`);
      console.log(`FAIL ${item.name}: ${message}`);
    }
  }
  console.log('-'.repeat(64));
  console.log(`Result: ${passed} / ${cases.length} PASS`);
  if (failures.length > 0) {
    failures.forEach((failure) => console.log(`- ${failure}`));
    process.exitCode = 1;
  }
}

async function caseGenerationBoundary(): Promise<void> {
  const fixture = createFixture();
  const candidates = await fixture.service.generateTaskCandidates({
    trainingTaskId: 'task-1',
    count: 3,
    idempotencyKey: 'generate-1',
  });
  assert.equal(candidates.length, 3);
  assert.equal((await fixture.repository.listCandidates()).length, 3);
  assert.equal(fixture.adoption.calls, 0, 'Generation entered the formal adoption boundary.');
  assert(candidates.every((candidate) => candidate.status === 'ready'));
  assert(candidates.every((candidate) => candidate.candidateType === 'initial'));
  assert(candidates.every((candidate) => candidate.generationContext.promptVersion === 'prompt-v1'));
}

async function caseGenerationIdempotency(): Promise<void> {
  const fixture = createFixture();
  const input = {
    trainingTaskId: 'task-1',
    count: 2,
    goals: ['覆盖分析能力'],
    idempotencyKey: 'generate-idempotent',
  };
  const first = await fixture.service.generateTaskCandidates(input);
  const second = await fixture.service.generateTaskCandidates(input);
  assert.deepEqual(second, first);
  assert.equal(fixture.generator.calls, 1, 'Idempotent generation called the generator twice.');
  assert.equal((await fixture.repository.listCandidates()).length, 2);
  await expectConflict(
    () => fixture.service.generateTaskCandidates({ ...input, count: 3 }),
    'CANDIDATE_IDEMPOTENCY_CONFLICT',
  );
}

async function caseCandidateImmutability(): Promise<void> {
  const fixture = createFixture();
  const [candidate] = await fixture.service.generateTaskCandidates({
    trainingTaskId: 'task-1',
    count: 1,
    idempotencyKey: 'immutable',
  });
  assert(candidate);
  await assert.rejects(
    fixture.repository.saveCandidate({
      ...candidate,
      content: { ...candidate.content, questionStem: '篡改候选内容。' },
    }),
    /immutable/,
  );
  candidate.content.questionStem = '外部对象篡改。';
  assert.notEqual(
    (await fixture.repository.getCandidate(candidate.candidateId))?.content.questionStem,
    '外部对象篡改。',
  );
}

async function caseRegeneration(): Promise<void> {
  const fixture = createFixture();
  const [base] = await fixture.service.generateTaskCandidates({
    trainingTaskId: 'task-1',
    count: 1,
    idempotencyKey: 'regenerate-base',
  });
  assert(base);
  const input = {
    trainingTaskId: 'task-1',
    baseCandidateId: base.candidateId,
    count: 2,
    reasonCodes: ['direction_mismatch'],
    idempotencyKey: 'regenerate-1',
  };
  const generated = await fixture.service.regenerateTaskCandidates(input);
  assert.equal(generated.length, 2);
  assert(generated.every((candidate) => candidate.candidateType === 'regenerated'));
  assert.equal((await fixture.repository.getCandidate(base.candidateId))?.status, 'superseded');
  const retryService = new QuestionCandidateService(
    fixture.repository,
    fixture.generator,
    fixture.context,
    fixture.adoption,
    () => '2026-08-05T10:05:00.000Z',
  );
  const retried = await retryService.regenerateTaskCandidates(input);
  assert.deepEqual(retried, generated);
  assert.equal(fixture.generator.calls, 2, 'Regeneration retry called the generator again.');
  assert.equal(
    (await fixture.repository.listDecisionEvents(base.candidateId)).length,
    1,
    'Regeneration retry created a duplicate decision event.',
  );
}

async function caseAllowedOptimization(): Promise<void> {
  const fixture = createFixture();
  const [base] = await fixture.service.generateTaskCandidates({
    trainingTaskId: 'task-1',
    count: 1,
    idempotencyKey: 'optimize-base',
  });
  assert(base);
  fixture.generator.transform = (content) => ({
    ...content,
    questionStem: `${content.questionStem} 请结合文本说明。`,
  });
  fixture.generator.changedFields = ['questionStem'];
  const [optimized] = await fixture.service.optimizeTaskCandidate({
    trainingTaskId: 'task-1',
    baseCandidateId: base.candidateId,
    goals: ['减少歧义'],
    allowedFields: ['questionStem'],
    lockedFields: ['abilityTarget', 'materialScope'],
    idempotencyKey: 'optimize-allowed',
  });
  assert(optimized);
  assert.equal(optimized.candidateType, 'optimized');
  assert.equal(optimized.basedOnCandidateId, base.candidateId);
  assert.match(optimized.content.questionStem, /结合文本说明/);
  assert.equal((await fixture.repository.getCandidate(base.candidateId))?.status, 'ready');
}

async function caseLockedOptimization(): Promise<void> {
  const fixture = createFixture();
  const [base] = await fixture.service.generateTaskCandidates({
    trainingTaskId: 'task-1',
    count: 1,
    idempotencyKey: 'locked-base',
  });
  assert(base);
  fixture.generator.transform = (content) => ({
    ...content,
    abilityMetadata: { ...content.abilityMetadata, abilityId: 'inference' },
  });
  fixture.generator.changedFields = ['abilityTarget'];
  await expectConflict(
    () => fixture.service.optimizeTaskCandidate({
      trainingTaskId: 'task-1',
      baseCandidateId: base.candidateId,
      goals: ['优化表达'],
      allowedFields: ['questionStem'],
      lockedFields: ['abilityTarget'],
      idempotencyKey: 'optimize-locked',
    }),
    'CANDIDATE_LOCKED_FIELD_CHANGE',
  );
  assert.equal((await fixture.repository.listCandidates()).length, 1);
}

async function caseStaleContext(): Promise<void> {
  const fixture = createFixture();
  const [candidate] = await fixture.service.generateTaskCandidates({
    trainingTaskId: 'task-1',
    count: 1,
    idempotencyKey: 'stale-base',
  });
  assert(candidate);
  fixture.context.current.materialVersionId = 'material:v2';
  await expectConflict(
    () => fixture.service.adoptTaskCandidate({
      trainingTaskId: 'task-1',
      candidateId: candidate.candidateId,
      expectedContentHash: candidate.contentHash,
      idempotencyKey: 'stale-adopt',
      adoptedBy: 'teacher-1',
    }),
    'CANDIDATE_EXPIRED',
  );
  assert.equal((await fixture.repository.getCandidate(candidate.candidateId))?.status, 'expired');
  assert.equal(fixture.adoption.calls, 0);
}

async function caseDraftConflict(): Promise<void> {
  const fixture = createFixture({
    activeDraftId: 'draft-1',
    activeDraftRevision: 1,
    activeDraftContentHash: 'hash-r1',
  });
  const [candidate] = await fixture.service.generateTaskCandidates({
    trainingTaskId: 'task-1',
    count: 1,
    idempotencyKey: 'draft-base',
  });
  assert(candidate);
  fixture.context.current.activeDraftRevision = 2;
  fixture.context.current.activeDraftContentHash = 'hash-r2';
  await expectConflict(
    () => fixture.service.adoptTaskCandidate({
      trainingTaskId: 'task-1',
      candidateId: candidate.candidateId,
      expectedContentHash: candidate.contentHash,
      idempotencyKey: 'draft-conflict-adopt',
      adoptedBy: 'teacher-1',
    }),
    'CANDIDATE_EXPIRED',
  );
  assert.equal(fixture.adoption.calls, 0);
}

async function caseAdoptionIdempotency(): Promise<void> {
  const fixture = createFixture();
  const [candidate] = await fixture.service.generateTaskCandidates({
    trainingTaskId: 'task-1',
    count: 1,
    idempotencyKey: 'adopt-base',
  });
  assert(candidate);
  const input = {
    trainingTaskId: 'task-1',
    candidateId: candidate.candidateId,
    expectedContentHash: candidate.contentHash,
    idempotencyKey: 'adopt-once',
    adoptedBy: 'teacher-1',
  };
  const first = await fixture.service.adoptTaskCandidate(input);
  const second = await fixture.service.adoptTaskCandidate(input);
  assert.deepEqual(second, first);
  assert.equal(fixture.adoption.calls, 1, 'Adoption gateway was called twice.');
  assert.equal((await fixture.repository.getCandidate(candidate.candidateId))?.status, 'adopted');
  assert.equal((await fixture.repository.listDecisionEvents(candidate.candidateId)).length, 1);
  await expectConflict(
    () => fixture.service.adoptTaskCandidate({ ...input, idempotencyKey: 'adopt-again' }),
    'CANDIDATE_NOT_ADOPTABLE',
  );
}

async function caseProjection(): Promise<void> {
  const context = defaultContext();
  assert.deepEqual(resolveTaskCandidateState({ candidates: [], context }), {
    state: 'not_generated',
    availableActions: ['generate'],
    readyCandidateIds: [],
    expiredCandidateIds: [],
  });
  const ready = candidateFixture('candidate-ready', context);
  assert.equal(resolveTaskCandidateState({ candidates: [ready], context }).state, 'candidate_ready');
  assert.equal(resolveTaskCandidateState({
    candidates: [ready],
    context: { ...context, trainingTaskVersion: 2 },
  }).state, 'candidate_expired');
  assert.equal(resolveTaskCandidateState({
    candidates: [],
    context,
    operation: 'optimizing',
  }).state, 'optimizing');
  assert.equal(resolveTaskCandidateState({ candidates: [], context, failed: true }).state, 'candidate_failed');
}

function createFixture(contextOverrides: Partial<CandidateRuntimeContext> = {}) {
  const repository = new InMemoryQuestionCandidateRepository();
  const generator = new FakeGenerator();
  const context = new FakeContextGateway({ ...defaultContext(), ...contextOverrides });
  const adoption = new FakeAdoptionGateway();
  const service = new QuestionCandidateService(
    repository,
    generator,
    context,
    adoption,
    () => NOW,
  );
  return { repository, generator, context, adoption, service };
}

class FakeGenerator implements QuestionCandidateGenerator {
  calls = 0;
  changedFields: GeneratedQuestionCandidate['changedFields'] = ['questionStem'];
  transform: (content: QuestionEditableFields) => QuestionEditableFields = (content) => content;

  async generate(input: Parameters<QuestionCandidateGenerator['generate']>[0]) {
    this.calls += 1;
    const base = input.baseCandidate?.content || contentFixture();
    return Array.from({ length: input.count }, (_, index): GeneratedQuestionCandidate => {
      const content = this.transform({
        ...cloneWorkingTaskContent(base),
        questionStem: input.operation === 'optimize'
          ? base.questionStem
          : `${base.questionStem} 候选 ${index + 1}`,
      });
      return {
        content,
        generationReason: `${input.operation} candidate ${index + 1}`,
        changedFields: input.operation === 'optimize' ? [...this.changedFields] : ['questionStem'],
        generationContext: {
          modelId: 'test-model',
          promptVersion: 'prompt-v1',
          promptHash: 'prompt-hash-v1',
          ruleVersion: 'rule-v1',
          materialVersionId: input.context.materialVersionId,
          observationPlanVersion: input.context.observationPlanVersion,
          trainingTaskVersion: input.context.trainingTaskVersion,
          generatedAt: NOW,
        },
      };
    });
  }
}

class FakeContextGateway implements QuestionCandidateContextGateway {
  current: CandidateRuntimeContext;

  constructor(current: CandidateRuntimeContext) {
    this.current = current;
  }

  async getCurrentContext(): Promise<CandidateRuntimeContext> {
    return cloneWorkingTaskContent(this.current);
  }
}

class FakeAdoptionGateway implements CandidateAdoptionGateway {
  calls = 0;
  private readonly results = new Map<string, Awaited<ReturnType<CandidateAdoptionGateway['adoptCandidate']>>>();

  async adoptCandidate(input: Parameters<CandidateAdoptionGateway['adoptCandidate']>[0]) {
    const existing = this.results.get(input.idempotencyKey);
    if (existing) return cloneWorkingTaskContent(existing);
    this.calls += 1;
    const result = {
      candidateId: input.candidate.candidateId,
      questionLineageId: `lineage:${input.candidate.trainingTaskId}`,
      draftId: `draft:${input.candidate.trainingTaskId}`,
      revision: 1,
      contentHash: input.candidate.contentHash,
      adoptedAt: input.adoptedAt,
    };
    this.results.set(input.idempotencyKey, result);
    return cloneWorkingTaskContent(result);
  }
}

function defaultContext(): CandidateRuntimeContext {
  return {
    materialVersionId: 'material:v1',
    observationPlanVersion: 1,
    trainingTaskVersion: 1,
  };
}

function contentFixture(): QuestionEditableFields {
  return {
    materialVersionId: 'material:v1',
    title: '人物心理分析',
    questionStem: '请分析人物选择沉默的原因。',
    questionType: 'reading_comprehension',
    responseFormat: 'long_text',
    options: [],
    assessmentMode: 'reasoning_chain',
    answerAcceptance: {
      acceptedKeywords: ['处境', '压力'],
      semanticEquivalentAllowed: true,
      normalizationRules: ['trim', 'ignore_punctuation'],
    },
    rubric: [{
      itemId: 'rubric-1',
      name: '结合文本分析原因',
      description: '指出人物处境并解释沉默原因。',
      abilityId: 'analysis',
      importance: 'critical',
      required: true,
      evidenceRequirement: { requireTextEvidence: true, requireExplanation: true },
      acceptedSignals: ['处境', '压力'],
    }],
    minimumAnswerRequirement: {
      minLength: 30,
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
    source: {
      sourceType: 'ai_assisted',
      description: 'AI candidate workflow debug fixture',
    },
    tags: ['material_scope:full_text', 'observation_task:task-1'],
  };
}

function candidateFixture(
  candidateId: string,
  context: CandidateRuntimeContext,
): QuestionCandidate {
  return createQuestionCandidate({
    candidateId,
    generationCommandId: `generate:${candidateId}`,
    generationCommandFingerprint: 'fingerprint',
    trainingTaskId: 'task-1',
    candidateType: 'initial',
    content: contentFixture(),
    generationReason: 'fixture',
    changedFields: ['questionStem'],
    allowedFields: ['questionStem'],
    lockedFields: [],
    generationContext: {
      modelId: 'test-model',
      promptVersion: 'prompt-v1',
      promptHash: 'prompt-hash-v1',
      ruleVersion: 'rule-v1',
      materialVersionId: context.materialVersionId,
      observationPlanVersion: context.observationPlanVersion,
      trainingTaskVersion: context.trainingTaskVersion,
      generatedAt: NOW,
    },
    status: 'ready',
    createdAt: NOW,
  });
}

async function expectConflict(
  run: () => Promise<unknown>,
  code: string,
): Promise<void> {
  try {
    await run();
  } catch (error) {
    assert(error instanceof QuestionCandidateConflictError);
    assert.equal(error.code, code);
    return;
  }
  throw new Error(`Expected conflict ${code}.`);
}

void main();
