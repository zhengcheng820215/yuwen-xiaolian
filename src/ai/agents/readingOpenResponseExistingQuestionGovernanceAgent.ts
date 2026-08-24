import type { ReadingOpenResponseGovernanceRepository } from
  '../repositories/readingOpenResponseGovernanceRepository.ts';
import {
  READING_OPEN_RESPONSE_GOVERNANCE_POLICY_VERSION,
  READING_OPEN_RESPONSE_GOVERNANCE_SCHEMA_VERSION,
  isExistingQuestionGovernanceCase,
  type ExistingQuestionGenerationConstraint,
  type ExistingQuestionGovernanceBatch,
  type ExistingQuestionGovernanceCase,
  type ExistingQuestionGovernanceCaseInput,
  type ExistingQuestionGovernanceStatus,
  type ReadingOpenResponseVersionCalibrationReport,
} from '../schemas/readingOpenResponseGovernance.schema.ts';
import type {
  CandidateRuntimeContext,
  QuestionCandidate,
} from '../schemas/questionCandidate.schema.ts';
import type { TextResponseLoadFindingCode } from
  '../schemas/readingOpenResponseInputLoad.schema.ts';
import { buildStableId } from './reviewedResourceCandidateAdapter.ts';

export interface ExistingQuestionCandidateGateway {
  generateFormalVersionOptimizationCandidates(input: {
    trainingTaskId: string;
    count: number;
    reasonCodes: string[];
    goals: string[];
    expectedContext: CandidateRuntimeContext;
    formalResourceId: string;
    baseFormalVersionId: string;
    idempotencyKey: string;
  }): Promise<QuestionCandidate[]>;
}

export class ReadingOpenResponseGovernanceConflictError extends Error {
  readonly code: string;

  constructor(code: string, message: string) {
    super(message);
    this.name = 'ReadingOpenResponseGovernanceConflictError';
    this.code = code;
  }
}

export class ReadingOpenResponseExistingQuestionGovernanceAgent {
  private readonly repository: ReadingOpenResponseGovernanceRepository;
  private readonly candidateGateway?: ExistingQuestionCandidateGateway;
  private readonly now: () => string;

  constructor(
    repository: ReadingOpenResponseGovernanceRepository,
    candidateGateway?: ExistingQuestionCandidateGateway,
    now: () => string = () => new Date().toISOString(),
  ) {
    this.repository = repository;
    this.candidateGateway = candidateGateway;
    this.now = now;
  }

  async createCase(
    input: ExistingQuestionGovernanceCaseInput,
  ): Promise<ExistingQuestionGovernanceCase> {
    requireText(input.questionLineageId, 'questionLineageId');
    requireText(input.sourceResourceVersionId, 'sourceResourceVersionId');
    requireText(input.materialVersionId, 'materialVersionId');
    requireText(input.observationTaskPlanId, 'observationTaskPlanId');
    requireText(input.sourceDigest, 'sourceDigest');
    requireText(input.auditDigest, 'auditDigest');
    const now = this.now();
    const governanceCaseId = buildGovernanceCaseId(input);
    const existing = await this.repository.getCase(governanceCaseId);
    if (existing) return existing;
    const governanceCase: ExistingQuestionGovernanceCase = {
      ...structuredClone(input),
      governanceCaseId,
      findingCodes: [...new Set(input.findingCodes)].sort(),
      priority: priorityFor(input.disposition),
      status: 'queued',
      generationAttemptCount: 0,
      createdAt: now,
      updatedAt: now,
      schemaVersion: READING_OPEN_RESPONSE_GOVERNANCE_SCHEMA_VERSION,
    };
    if (!isExistingQuestionGovernanceCase(governanceCase)) {
      throw new Error('Existing Question Governance Case failed schema validation.');
    }
    const saved = await this.repository.saveCase(governanceCase);
    if (saved.status === 'conflict') {
      throw new ReadingOpenResponseGovernanceConflictError(
        'GOVERNANCE_CASE_IDENTITY_CONFLICT',
        saved.issues.join(', '),
      );
    }
    return saved.governanceCase;
  }

  async markStaleWhenSourceVersionChanges(input: {
    questionLineageId: string;
    activeSourceResourceVersionId: string;
  }): Promise<ExistingQuestionGovernanceCase[]> {
    const changed: ExistingQuestionGovernanceCase[] = [];
    for (const governanceCase of await this.repository.listCases()) {
      if (
        governanceCase.questionLineageId !== input.questionLineageId
        || governanceCase.sourceResourceVersionId === input.activeSourceResourceVersionId
        || governanceCase.status === 'stale'
        || governanceCase.status === 'published'
      ) continue;
      changed.push(await this.updateCase(governanceCase, { status: 'stale' }));
    }
    return changed;
  }

  async planBatch(input: {
    idempotencyKey: string;
    maximumSize?: number;
  }): Promise<ExistingQuestionGovernanceBatch | null> {
    const maximumSize = input.maximumSize ?? 5;
    if (!Number.isInteger(maximumSize) || maximumSize < 1 || maximumSize > 5) {
      throw new ReadingOpenResponseGovernanceConflictError(
        'GOVERNANCE_BATCH_SIZE_INVALID',
        '阶段 4 每批只能包含 1—5 道题。',
      );
    }
    const eligible = (await this.repository.listCases())
      .filter((item) => (
        item.status === 'queued'
        && item.disposition !== 'retain'
        && !item.activeCandidateId
      ))
      .sort((left, right) => left.priority - right.priority
        || left.createdAt.localeCompare(right.createdAt))
      .slice(0, maximumSize);
    if (eligible.length === 0) return null;
    const now = this.now();
    const batch: ExistingQuestionGovernanceBatch = {
      batchId: buildStableId('reading-open-response-governance-batch', [
        requireText(input.idempotencyKey, 'idempotencyKey'),
        ...eligible.map((item) => item.governanceCaseId),
      ]),
      governanceCaseIds: eligible.map((item) => item.governanceCaseId),
      status: 'planned',
      createdAt: now,
      updatedAt: now,
      policyVersion: READING_OPEN_RESPONSE_GOVERNANCE_POLICY_VERSION,
    };
    const existing = await this.repository.getBatch(batch.batchId);
    return existing || this.repository.saveBatch(batch);
  }

  async generateSuccessorCandidate(input: {
    governanceCaseId: string;
    trainingTaskId: string;
    expectedContext: CandidateRuntimeContext;
    formalResourceId: string;
    baseFormalVersionId: string;
    idempotencyKey: string;
    primaryAbilityChanged?: boolean;
  }): Promise<{
    governanceCase: ExistingQuestionGovernanceCase;
    candidateId?: string;
    reused: boolean;
  }> {
    if (!this.candidateGateway) throw new Error('Candidate Gateway is unavailable.');
    const governanceCase = await this.requireCase(input.governanceCaseId);
    this.assertGeneratable(governanceCase, input);
    if (governanceCase.activeCandidateId) {
      return {
        governanceCase,
        candidateId: governanceCase.activeCandidateId,
        reused: true,
      };
    }
    if (input.primaryAbilityChanged) {
      const blocked = await this.updateCase(governanceCase, {
        status: 'blocked',
        lastFailureCodes: ['primary_ability_change_requires_observation_replan'],
      });
      return { governanceCase: blocked, reused: false };
    }
    const attemptCount = Math.min(2, governanceCase.generationAttemptCount + 1) as 1 | 2;
    const constraints = translateGovernanceFindings(governanceCase.findingCodes);
    try {
      const candidates = await this.candidateGateway.generateFormalVersionOptimizationCandidates({
        trainingTaskId: requireText(input.trainingTaskId, 'trainingTaskId'),
        count: 1,
        reasonCodes: [
          `governance_case:${governanceCase.governanceCaseId}`,
          ...governanceCase.findingCodes,
        ],
        goals: constraints.map((item) => item.goal),
        expectedContext: structuredClone(input.expectedContext),
        formalResourceId: requireText(input.formalResourceId, 'formalResourceId'),
        baseFormalVersionId: requireText(input.baseFormalVersionId, 'baseFormalVersionId'),
        idempotencyKey: requireText(input.idempotencyKey, 'idempotencyKey'),
      });
      if (candidates.length !== 1) throw new Error('Governance generation must return one Candidate.');
      const candidate = candidates[0]!;
      const updated = await this.updateCase(governanceCase, {
        status: 'candidate_ready',
        generationAttemptCount: attemptCount,
        activeCandidateId: candidate.candidateId,
        lastFailureCodes: undefined,
      });
      return { governanceCase: updated, candidateId: candidate.candidateId, reused: false };
    } catch (error) {
      const failureCode = error instanceof ReadingOpenResponseGovernanceConflictError
        ? error.code
        : error instanceof Error
          ? error.name
          : 'candidate_generation_failed';
      const updated = await this.updateCase(governanceCase, {
        status: attemptCount >= 2 ? 'deferred' : 'blocked',
        generationAttemptCount: attemptCount,
        lastFailureCodes: [failureCode],
      });
      return { governanceCase: updated, reused: false };
    }
  }

  async updateBatchStatus(
    batchId: string,
    status: ExistingQuestionGovernanceBatch['status'],
  ): Promise<ExistingQuestionGovernanceBatch> {
    const batch = await this.repository.getBatch(requireText(batchId, 'batchId'));
    if (!batch) throw new Error(`Governance Batch not found: ${batchId}`);
    return this.repository.saveBatch({ ...batch, status, updatedAt: this.now() });
  }

  async recordAdopted(
    governanceCaseId: string,
    candidateId: string,
  ): Promise<ExistingQuestionGovernanceCase> {
    const governanceCase = await this.requireCase(governanceCaseId);
    if (governanceCase.activeCandidateId !== candidateId) {
      throw new ReadingOpenResponseGovernanceConflictError(
        'GOVERNANCE_CANDIDATE_IDENTITY_CONFLICT',
        '采用结果不属于当前活动治理 Candidate。',
      );
    }
    return this.updateCase(governanceCase, { status: 'adopted' });
  }

  async recordPublished(input: {
    governanceCaseId: string;
    candidateId: string;
    predecessorResourceVersionId: string;
    successorResourceVersionId: string;
  }): Promise<ExistingQuestionGovernanceCase> {
    const governanceCase = await this.requireCase(input.governanceCaseId);
    if (
      governanceCase.activeCandidateId !== input.candidateId
      || governanceCase.sourceResourceVersionId !== input.predecessorResourceVersionId
      || governanceCase.status !== 'adopted'
    ) {
      throw new ReadingOpenResponseGovernanceConflictError(
        'GOVERNANCE_PUBLICATION_IDENTITY_CONFLICT',
        '发布结果与治理 Case 的 Candidate 或 predecessor 版本不一致。',
      );
    }
    if (input.successorResourceVersionId === input.predecessorResourceVersionId) {
      throw new ReadingOpenResponseGovernanceConflictError(
        'GOVERNANCE_SUCCESSOR_VERSION_INVALID',
        '后继 Frozen Version 必须具有新的版本身份。',
      );
    }
    return this.updateCase(governanceCase, {
      status: 'published',
      successorResourceVersionId: input.successorResourceVersionId,
    });
  }

  async recordRejected(governanceCaseId: string): Promise<ExistingQuestionGovernanceCase> {
    return this.updateCase(await this.requireCase(governanceCaseId), { status: 'rejected' });
  }

  private assertGeneratable(
    governanceCase: ExistingQuestionGovernanceCase,
    input: { baseFormalVersionId: string },
  ): void {
    if (governanceCase.disposition === 'retain') {
      throw new ReadingOpenResponseGovernanceConflictError(
        'GOVERNANCE_RETAIN_HAS_NO_SUCCESSOR',
        'retain 题目不生成治理 Candidate。',
      );
    }
    if (governanceCase.sourceResourceVersionId !== input.baseFormalVersionId) {
      throw new ReadingOpenResponseGovernanceConflictError(
        'GOVERNANCE_SOURCE_VERSION_STALE',
        '正式版本已经变化，请重新审计后再生成。',
      );
    }
    if (['published', 'rejected', 'deferred', 'stale'].includes(governanceCase.status)) {
      throw new ReadingOpenResponseGovernanceConflictError(
        'GOVERNANCE_CASE_NOT_GENERATABLE',
        `治理 Case 当前为 ${governanceCase.status}。`,
      );
    }
    if (governanceCase.generationAttemptCount >= 2) {
      throw new ReadingOpenResponseGovernanceConflictError(
        'GOVERNANCE_GENERATION_ATTEMPTS_EXHAUSTED',
        '同一问题已连续两次生成失败，需重新规划或补充证据。',
      );
    }
  }

  private async requireCase(governanceCaseId: string): Promise<ExistingQuestionGovernanceCase> {
    const governanceCase = await this.repository.getCase(
      requireText(governanceCaseId, 'governanceCaseId'),
    );
    if (!governanceCase) throw new Error(`Governance Case not found: ${governanceCaseId}`);
    return governanceCase;
  }

  private async updateCase(
    current: ExistingQuestionGovernanceCase,
    patch: Partial<Pick<
      ExistingQuestionGovernanceCase,
      | 'status'
      | 'generationAttemptCount'
      | 'activeCandidateId'
      | 'successorResourceVersionId'
      | 'lastFailureCodes'
    >>,
  ): Promise<ExistingQuestionGovernanceCase> {
    const updated: ExistingQuestionGovernanceCase = {
      ...current,
      ...structuredClone(patch),
      updatedAt: this.now(),
    };
    const saved = await this.repository.saveCase(updated);
    if (saved.status === 'conflict') {
      throw new ReadingOpenResponseGovernanceConflictError(
        'GOVERNANCE_CASE_UPDATE_CONFLICT',
        saved.issues.join(', '),
      );
    }
    return saved.governanceCase;
  }
}

export function buildGovernanceCaseId(input: ExistingQuestionGovernanceCaseInput): string {
  return buildStableId('reading-open-response-governance-case', [
    input.questionLineageId,
    input.sourceResourceVersionId,
    input.baselineAuditVersion,
    input.auditDigest,
  ]);
}

export function translateGovernanceFindings(
  findingCodes: TextResponseLoadFindingCode[],
): ExistingQuestionGenerationConstraint[] {
  return [...new Set(findingCodes)].map((findingCode) => ({
    findingCode,
    ...(FINDING_CONSTRAINTS[findingCode] || {
      goal: '保持主要训练目标，消除本次输入负担审计发现的问题。',
      lockedPrinciples: ['不得改变主要能力、观察对象或任务角色'],
    }),
  }));
}

const FINDING_CONSTRAINTS: Partial<Record<
  TextResponseLoadFindingCode,
  Omit<ExistingQuestionGenerationConstraint, 'findingCode'>
>> = {
  composite_core_actions: {
    goal: '只保留一个主要作答动作，其余独立动作移出本题。',
    lockedPrinciples: ['不得以更长答案掩盖多动作问题'],
  },
  hidden_rubric_requirement: {
    goal: '让题干显式要求与 Required Rubric 完全对齐。',
    lockedPrinciples: ['不得保留题干未要求的隐含评分项'],
  },
  evidence_scope_insufficient: {
    goal: '缩小问题范围，或在材料支持范围内扩大合法证据范围。',
    lockedPrinciples: ['不得伪造材料依据'],
  },
  object_scope_overloaded: {
    goal: '聚焦一个主要对象，或只保留对象之间的一种关系。',
    lockedPrinciples: ['不得同时要求多个独立对象结论'],
  },
  relation_load_overloaded: {
    goal: '只保留一个主要关系判断。',
    lockedPrinciples: ['避免同时要求多层结构与情感推断'],
  },
  response_format_load_mismatch: {
    goal: '使 responseFormat、题干动作和 Rubric 负担保持一致。',
    lockedPrinciples: ['保留原主要训练目标'],
  },
  minimum_length_overweighted: {
    goal: '降低学生最低作答门槛，推荐长度只保留为内部设计信息。',
    lockedPrinciples: ['不得在学生界面显示机械推荐字数'],
  },
  minimum_length_under_supports_rubric: {
    goal: '收敛 Rubric 或调整作答形式，不机械提高学生字数门槛。',
    lockedPrinciples: ['优先降低隐藏负担'],
  },
};

function priorityFor(disposition: ExistingQuestionGovernanceCase['disposition']): 1 | 2 | 3 {
  if (disposition === 'regenerate') return 1;
  if (disposition === 'decompose_or_refocus') return 2;
  return 3;
}

function requireText(value: string, field: string): string {
  const normalized = value?.trim();
  if (!normalized) throw new Error(`${field} is required.`);
  return normalized;
}

export function isTerminalGovernanceStatus(status: ExistingQuestionGovernanceStatus): boolean {
  return ['published', 'rejected', 'deferred', 'stale'].includes(status);
}

export function resolveGovernanceAvailableActions(
  governanceCase: ExistingQuestionGovernanceCase,
): Array<'generate' | 'regenerate' | 'adopt_and_publish' | 'continue_publication'> {
  if (governanceCase.status === 'queued' && governanceCase.disposition !== 'retain') {
    return ['generate'];
  }
  if (governanceCase.status === 'candidate_ready') {
    return ['regenerate', 'adopt_and_publish'];
  }
  if (governanceCase.status === 'blocked' && governanceCase.generationAttemptCount < 2) {
    return ['regenerate'];
  }
  if (governanceCase.status === 'adopted') return ['continue_publication'];
  return [];
}

export function resolveReadingSessionResourceVersion(input: {
  sessionStarted: boolean;
  sessionResourceVersionId?: string;
  registryActiveResourceVersionId: string;
}): string {
  if (input.sessionStarted) {
    return requireText(input.sessionResourceVersionId || '', 'sessionResourceVersionId');
  }
  return requireText(input.registryActiveResourceVersionId, 'registryActiveResourceVersionId');
}

export function buildReadingOpenResponseGovernanceProjection(input: {
  cases: ExistingQuestionGovernanceCase[];
  batches: ExistingQuestionGovernanceBatch[];
  calibrationReports: ReadingOpenResponseVersionCalibrationReport[];
}) {
  const statusCounts = Object.fromEntries(
    [
      'queued',
      'candidate_ready',
      'blocked',
      'adopted',
      'published',
      'rejected',
      'deferred',
      'stale',
    ].map((status) => [
      status,
      input.cases.filter((item) => item.status === status).length,
    ]),
  );
  return {
    engineering: {
      caseCount: input.cases.length,
      statusCounts,
      activeBatchCount: input.batches.filter((item) => item.status === 'active').length,
      pausedBatchCount: input.batches.filter((item) => item.status === 'paused').length,
    },
    samples: input.calibrationReports.map((report) => ({
      resourceVersionId: report.resourceVersionId,
      status: report.status,
      eligibleSampleCount: report.eligibleSampleCount,
      independentSubjectCount: report.independentSubjectCount,
      excludedCounts: structuredClone(report.excludedCounts),
    })),
    educationConclusion: 'not_inferred_from_engineering_or_sample_status' as const,
  };
}
