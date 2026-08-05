import assert from 'node:assert/strict';
import {
  QuestionCandidateOptimizationAgent,
  createQuestionCandidateOptimizationAgentConfig,
} from '../agents/questionCandidateOptimizationAgent.ts';
import {
  QuestionCandidateConflictError,
  QuestionCandidateService,
  type CandidateAdoptionGateway,
  type QuestionCandidateContextGateway,
} from '../agents/questionCandidateService.ts';
import { StructuredQuestionCandidateOptimizationService } from '../agents/structuredQuestionCandidateOptimizationService.ts';
import type {
  DiagnosisProviderAdapter,
  DiagnosisProviderRequest,
  DiagnosisProviderResponse,
} from '../providers/diagnosisProviderAdapter.ts';
import {
  ScriptedDiagnosisProviderAdapter,
} from '../providers/diagnosisProviderAdapter.ts';
import { InMemoryQuestionCandidateRepository } from '../repositories/inMemoryQuestionCandidateRepository.ts';
import {
  cloneQuestionCandidate,
  createQuestionCandidate,
  type CandidateFieldKey,
  type CandidateRuntimeContext,
  type QuestionCandidate,
} from '../schemas/questionCandidate.schema.ts';
import {
  QuestionCandidateOptimizationError,
  resolveCandidateOptimizationFieldPolicy,
  type CandidateOptimizationGoal,
} from '../schemas/questionCandidateOptimization.schema.ts';
import type { QuestionEditableFields } from '../schemas/workingTaskContent.schema.ts';

const NOW = '2026-08-05T12:00:00.000Z';

const cases: Array<{ name: string; run: () => Promise<void> }> = [
  { name: '01 structured goals resolve stable field policies', run: caseGoalPolicy },
  { name: '02 valid Agent output creates an audited optimized candidate', run: caseValidOptimization },
  { name: '03 idempotent retry does not call Agent or write events twice', run: caseIdempotency },
  { name: '04 no effective change creates no candidate or decision event', run: caseNoEffectiveChange },
  { name: '05 invalid provider output maps to one stable error', run: caseInvalidOutput },
  { name: '06 provider timeout preserves retryable semantics', run: caseTimeout },
  { name: '07 locked field changes are blocked before persistence', run: caseLockedField },
  { name: '08 context drift during Agent execution blocks persistence', run: caseContextDrift },
  { name: '09 unsupported goals are blocked before calling the provider', run: caseUnsupportedGoal },
  { name: '10 declared changes must match the actual diff', run: caseDiffMismatch },
];

async function main(): Promise<void> {
  let passed = 0;
  const failures: string[] = [];
  console.log('Question Candidate Optimization Agent P2 Debug');
  console.log('='.repeat(72));
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
  console.log('-'.repeat(72));
  console.log(`Result: ${passed} / ${cases.length} PASS`);
  if (failures.length > 0) {
    failures.forEach((failure) => console.log(`- ${failure}`));
    process.exitCode = 1;
  }
}

async function caseGoalPolicy(): Promise<void> {
  const ambiguity = resolveCandidateOptimizationFieldPolicy(['reduce_ambiguity']);
  assert.deepEqual(ambiguity.allowedFields, ['questionStem', 'answerAcceptance']);
  assert.deepEqual(ambiguity.lockedFields, [
    'abilityTarget',
    'observationTarget',
    'materialScope',
  ]);

  const combined = resolveCandidateOptimizationFieldPolicy([
    'strengthen_material_evidence',
    'optimize_rubric',
  ]);
  assert(combined.allowedFields.includes('questionStem'));
  assert(combined.allowedFields.includes('rubric'));
  assert(!combined.allowedFields.includes('observationTarget'));
  assert(combined.lockedFields.includes('observationTarget'));
}

async function caseValidOptimization(): Promise<void> {
  const content = changedContent((draft) => {
    draft.questionStem = '请结合文本证据，分析人物选择沉默的一个主要原因。';
  });
  const fixture = await createFixture(responseStep(content, ['questionStem']));
  const [candidate] = await optimize(fixture, 'valid-optimization');

  assert(candidate);
  assert.equal(candidate.candidateType, 'optimized');
  assert.equal(candidate.basedOnCandidateId, fixture.base.candidateId);
  assert.deepEqual(candidate.changedFields, ['questionStem']);
  assert.match(candidate.generationReason, /questionStem:/);
  assert.equal(candidate.generationContext.promptVersion, 'question_candidate_optimization_prompt_v1');
  assert.equal(fixture.provider.getCallCount(), 1);
  const events = await fixture.repository.listDecisionEvents(fixture.base.candidateId);
  assert.equal(events.length, 1);
  assert.equal(events[0]?.decision, 'optimized');
  assert.deepEqual(events[0]?.relatedCandidateIds, [candidate.candidateId]);
}

async function caseIdempotency(): Promise<void> {
  const content = changedContent((draft) => {
    draft.questionStem = '请结合第 3 段文本，分析人物沉默的主要原因。';
  });
  const fixture = await createFixture(responseStep(content, ['questionStem']));
  const first = await optimize(fixture, 'idempotent-optimization');
  const second = await optimize(fixture, 'idempotent-optimization');

  assert.deepEqual(second, first);
  assert.equal(fixture.provider.getCallCount(), 1);
  assert.equal((await fixture.repository.listCandidates()).length, 2);
  assert.equal(
    (await fixture.repository.listDecisionEvents(fixture.base.candidateId)).length,
    1,
  );
}

async function caseNoEffectiveChange(): Promise<void> {
  const fixture = await createFixture(responseStep(contentFixture(), []));
  await expectCode(
    () => optimize(fixture, 'no-effective-change'),
    'CANDIDATE_NO_EFFECTIVE_CHANGE',
  );
  await assertNoOptimizationPersistence(fixture);
}

async function caseInvalidOutput(): Promise<void> {
  const fixture = await createFixture({ type: 'response', rawOutput: '{not-json' });
  const error = await expectCode(
    () => optimize(fixture, 'invalid-output'),
    'CANDIDATE_AGENT_INVALID_OUTPUT',
  );
  assert(error instanceof QuestionCandidateOptimizationError);
  assert.equal(error.retryable, true);
  await assertNoOptimizationPersistence(fixture);
}

async function caseTimeout(): Promise<void> {
  const fixture = await createFixture({
    type: 'error',
    category: 'timeout',
    retryable: true,
    message: 'scripted timeout',
  });
  const error = await expectCode(
    () => optimize(fixture, 'timeout'),
    'CANDIDATE_AGENT_TIMEOUT',
  );
  assert(error instanceof QuestionCandidateOptimizationError);
  assert.equal(error.retryable, true);
  await assertNoOptimizationPersistence(fixture);
}

async function caseLockedField(): Promise<void> {
  const content = changedContent((draft) => {
    draft.abilityMetadata.abilityId = 'expression';
  });
  const fixture = await createFixture(responseStep(content, ['abilityTarget']));
  await expectCode(
    () => optimize(fixture, 'locked-field'),
    'CANDIDATE_LOCKED_FIELD_CHANGE',
  );
  await assertNoOptimizationPersistence(fixture);
}

async function caseContextDrift(): Promise<void> {
  const context = new MutableContextGateway(defaultContext());
  const content = changedContent((draft) => {
    draft.questionStem = '请结合文本，概括人物沉默的主要原因。';
  });
  const provider = new HookedProvider(
    optimizationOutput(content, ['questionStem']),
    () => { context.current.trainingTaskVersion += 1; },
  );
  const fixture = await createFixtureWithProvider(provider, context);
  await expectCode(
    () => optimize(fixture, 'context-drift'),
    'CANDIDATE_CONTEXT_CONFLICT',
  );
  await assertNoOptimizationPersistence(fixture);
}

async function caseUnsupportedGoal(): Promise<void> {
  const fixture = await createFixture(responseStep(changedContent((draft) => {
    draft.questionStem = '不会被调用。';
  }), ['questionStem']));
  await expectCode(
    () => fixture.structured.optimizeTaskCandidate({
      trainingTaskId: 'task-1',
      baseCandidateId: fixture.base.candidateId,
      goals: ['rewrite_everything' as CandidateOptimizationGoal],
      idempotencyKey: 'unsupported-goal',
    }),
    'CANDIDATE_OPTIMIZATION_GOAL_UNSUPPORTED',
  );
  assert.equal(fixture.provider.getCallCount(), 0);
  await assertNoOptimizationPersistence(fixture);
}

async function caseDiffMismatch(): Promise<void> {
  const content = changedContent((draft) => {
    draft.questionStem = '请结合文本证据，分析人物沉默的原因。';
  });
  const fixture = await createFixture({
    type: 'response',
    rawOutput: optimizationOutput(content, ['answerAcceptance']),
  });
  await expectCode(
    () => optimize(fixture, 'diff-mismatch'),
    'CANDIDATE_AGENT_INVALID_OUTPUT',
  );
  await assertNoOptimizationPersistence(fixture);
}

async function createFixture(step: ConstructorParameters<typeof ScriptedDiagnosisProviderAdapter>[0][number]) {
  const provider = new ScriptedDiagnosisProviderAdapter([step]);
  return createFixtureWithProvider(provider, new MutableContextGateway(defaultContext()));
}

async function createFixtureWithProvider(
  provider: DiagnosisProviderAdapter,
  context: MutableContextGateway,
) {
  const repository = new InMemoryQuestionCandidateRepository();
  const base = await repository.saveCandidate(candidateFixture(context.current));
  const agent = new QuestionCandidateOptimizationAgent(
    provider,
    createQuestionCandidateOptimizationAgentConfig({
      providerName: provider.providerName,
      model: 'test-model',
      ruleVersion: 'rule-v2',
      timeoutMs: 100,
    }),
    () => NOW,
  );
  const service = new QuestionCandidateService(
    repository,
    agent,
    context,
    new NoopAdoptionGateway(),
    () => NOW,
  );
  const structured = new StructuredQuestionCandidateOptimizationService(service);
  return { repository, provider, context, base, structured };
}

async function optimize(
  fixture: Awaited<ReturnType<typeof createFixture>>,
  idempotencyKey: string,
): Promise<QuestionCandidate[]> {
  return fixture.structured.optimizeTaskCandidate({
    trainingTaskId: 'task-1',
    baseCandidateId: fixture.base.candidateId,
    goals: ['reduce_ambiguity'],
    reasonCodes: ['manual_quality_direction'],
    idempotencyKey,
  });
}

function responseStep(content: QuestionEditableFields, changedFields: CandidateFieldKey[]) {
  return {
    type: 'response' as const,
    rawOutput: optimizationOutput(content, changedFields),
  };
}

function optimizationOutput(
  content: QuestionEditableFields,
  changedFields: CandidateFieldKey[],
): string {
  return JSON.stringify({
    content,
    changedFields,
    reason: changedFields.length > 0 ? '按结构化目标优化候选。' : '无需调整。',
    changeSummary: changedFields.map((field) => ({
      field,
      summary: `${field} 已按优化目标调整。`,
    })),
  });
}

function changedContent(change: (draft: QuestionEditableFields) => void): QuestionEditableFields {
  const content = cloneQuestionCandidate(contentFixture());
  change(content);
  return content;
}

async function assertNoOptimizationPersistence(
  fixture: Awaited<ReturnType<typeof createFixtureWithProvider>>,
): Promise<void> {
  assert.equal((await fixture.repository.listCandidates()).length, 1);
  assert.equal((await fixture.repository.listDecisionEvents()).length, 0);
}

async function expectCode(run: () => Promise<unknown>, code: string): Promise<unknown> {
  try {
    await run();
  } catch (error) {
    assert(
      error instanceof QuestionCandidateOptimizationError ||
      error instanceof QuestionCandidateConflictError,
    );
    assert.equal(error.code, code);
    return error;
  }
  throw new Error(`Expected error ${code}.`);
}

class MutableContextGateway implements QuestionCandidateContextGateway {
  current: CandidateRuntimeContext;

  constructor(current: CandidateRuntimeContext) {
    this.current = current;
  }

  async getCurrentContext(): Promise<CandidateRuntimeContext> {
    return cloneQuestionCandidate(this.current);
  }
}

class NoopAdoptionGateway implements CandidateAdoptionGateway {
  async adoptCandidate(): Promise<never> {
    throw new Error('P2 optimization must not enter the adoption boundary.');
  }
}

class HookedProvider implements DiagnosisProviderAdapter {
  readonly providerName = 'hooked_test_provider';
  private calls = 0;
  private readonly rawOutput: string;
  private readonly beforeReturn: () => void;

  constructor(
    rawOutput: string,
    beforeReturn: () => void,
  ) {
    this.rawOutput = rawOutput;
    this.beforeReturn = beforeReturn;
  }

  async diagnose(request: DiagnosisProviderRequest): Promise<DiagnosisProviderResponse> {
    this.calls += 1;
    this.beforeReturn();
    return {
      providerRequestId: `hooked-${request.requestId}`,
      rawOutput: this.rawOutput,
      latencyMs: 1,
    };
  }

  getCallCount(): number {
    return this.calls;
  }
}

function defaultContext(): CandidateRuntimeContext {
  return {
    materialVersionId: 'material:v1',
    observationPlanVersion: 1,
    trainingTaskVersion: 1,
  };
}

function candidateFixture(context: CandidateRuntimeContext): QuestionCandidate {
  return createQuestionCandidate({
    candidateId: 'candidate:base',
    generationCommandId: 'generate:base',
    generationCommandFingerprint: 'base-fingerprint',
    trainingTaskId: 'task-1',
    candidateType: 'initial',
    content: contentFixture(),
    generationReason: 'P2 base candidate fixture',
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
      description: 'P2 optimization debug fixture',
    },
    tags: ['material_scope:full_text', 'observation_task:task-1'],
  };
}

void main();
