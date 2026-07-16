import {
  DELAYED_RETEST_POLICY_VERSION,
  DELAYED_RETEST_SCHEDULING_SCHEMA_VERSION,
  type DelayedRetestCandidate,
  type DelayedRetestCandidateStatus,
  type DelayedRetestPlan,
  type DelayedRetestSchedulingInput,
  type DelayedRetestSchedulingNextStep,
  type DelayedRetestSchedulingResult,
  isDelayedRetestCandidate,
  isDelayedRetestPlan,
  isDelayedRetestPolicy,
  isDelayedRetestSchedulingResult,
} from '../schemas/delayedRetestScheduling.schema.ts';
import {
  isAbilityEvidence,
  type AbilityEvidence,
} from '../schemas/abilityEvidence.schema.ts';
import { isGrowthMemorySummary } from '../schemas/growthMemory.schema.ts';
import {
  isLearningSessionHistoryResult,
  type LearningSessionRecord,
} from '../schemas/learningSessionHistory.schema.ts';

const DAY_IN_MS = 24 * 60 * 60 * 1000;
const FALLBACK_TIME = '1970-01-01T00:00:00.000Z';

export function scheduleDelayedRetest(
  input: DelayedRetestSchedulingInput,
): DelayedRetestSchedulingResult {
  const inputIssues = validateInput(input);
  if (inputIssues.length > 0) {
    return terminalResult(input, 'blocked', 'blocked', inputIssues, '调度输入未通过校验，不能生成复测计划。');
  }

  const identityIssues = validateIdentityAlignment(input);
  if (identityIssues.length > 0) {
    return terminalResult(input, 'blocked', 'blocked', identityIssues, '学生、能力或历史身份不一致，调度已阻断。');
  }

  if (input.sessionHistory.rejectedTotal > 0 || !input.sessionHistory.validation.passed) {
    const issues = uniqueStrings([
      'Session History contains rejected records and requires review.',
      ...input.sessionHistory.validation.issues,
    ]);
    return terminalResult(
      input,
      'review_required',
      'review_required',
      issues,
      '学习历史存在被拒绝记录，需先确认数据完整性。',
    );
  }

  const acceptedSessions = input.sessionHistory.sessions.filter((session) => (
    session.studentId === input.studentId &&
    session.targetAbilityIds.includes(input.targetAbilityId)
  ));
  const formalEvidenceIds = new Set(acceptedSessions.flatMap((session) => session.evidenceIds));
  const growthEvidenceIds = new Set(input.growthMemorySummary.evidenceLinks);
  const targetEvidence = input.abilityEvidence.filter((evidence) => (
    evidence.studentId === input.studentId && evidence.ability === input.targetAbilityId
  ));
  const relevantEvidence = targetEvidence.filter((evidence) => (
    evidence.evidenceType === 'growth' || evidence.evidenceType === 'positive'
  ));

  const untraceable = relevantEvidence.filter((evidence) => (
    !formalEvidenceIds.has(evidence.id) || !growthEvidenceIds.has(evidence.id)
  ));
  if (untraceable.length > 0) {
    return terminalResult(
      input,
      'review_required',
      'review_required',
      untraceable.map((evidence) => `Evidence ${evidence.id} is not linked by both formal Session History and GrowthMemorySummary.`),
      '可用于调度的证据缺少正式 Session 或 GrowthMemory 追溯关系。',
    );
  }

  const traceableEvidence = relevantEvidence.filter((evidence) => (
    formalEvidenceIds.has(evidence.id) && growthEvidenceIds.has(evidence.id)
  ));
  if (traceableEvidence.length === 0) {
    return terminalResult(
      input,
      'not_eligible',
      'blocked',
      [],
      '当前没有可作为延迟保持性复测基准的 growth 或 positive Evidence。',
      [
        'weakness Evidence 应继续进入训练或一般观察，不因时间经过自动转为保持性复测。',
        'insufficient Evidence 不参与延迟复测基准判断。',
      ],
    );
  }

  const baseline = selectLatestEvidence(traceableEvidence);
  const currentTime = Date.parse(input.currentTime);
  const baselineTime = Date.parse(baseline.createdAt);
  if (baselineTime > currentTime) {
    return terminalResult(
      input,
      'review_required',
      'review_required',
      [`Evidence ${baseline.id} occurs after currentTime.`],
      '基准 Evidence 时间晚于当前时间，需要人工确认时间数据。',
    );
  }

  const intervalDays = baseline.evidenceType === 'growth'
    ? input.policy.growthIntervalDays
    : input.policy.positiveIntervalDays;
  const plannedRetestAt = new Date(baselineTime + intervalDays * DAY_IN_MS).toISOString();
  const sourceSessions = findSourceSessions(acceptedSessions, baseline.id);
  const candidateId = buildStableId('delayed-retest-candidate', [
    input.studentId,
    input.targetAbilityId,
    baseline.id,
    input.policy.policyVersion,
  ]);

  const duplicate = input.existingPlans?.find((plan) => (
    plan.studentId === input.studentId &&
    plan.targetAbilityId === input.targetAbilityId &&
    plan.baselineEvidenceId === baseline.id &&
    plan.policyVersion === input.policy.policyVersion
  ));
  if (duplicate) {
    const duplicateIssues = validateExistingPlanAlignment({
      plan: duplicate,
      candidateId,
      sourceSessionIds: sourceSessions.map((session) => session.sessionId),
      baselineEvidenceId: baseline.id,
      plannedRetestAt,
    });
    if (duplicateIssues.length > 0) {
      return terminalResult(
        input,
        'review_required',
        'review_required',
        duplicateIssues,
        '发现相同基准的既有计划，但计划结构无效，需要人工复核。',
      );
    }

    const candidate = createCandidate({
      input,
      status: 'already_scheduled',
      reason: '同一基准 Evidence 和策略版本已存在复测计划，不重复创建。',
      sourceSessions,
      baseline,
      intervalDays,
      plannedRetestAt,
      candidateId,
    });
    return finalizeResult({
      input,
      candidate,
      plan: duplicate,
      nextStep: 'already_scheduled',
      reason: candidate.eligibilityReason,
    });
  }

  const due = currentTime >= Date.parse(plannedRetestAt);
  const candidate = createCandidate({
    input,
    status: due ? 'due' : 'not_due',
    reason: due
      ? `最新 ${baseline.evidenceType} Evidence 已达到 ${intervalDays} 天复测间隔。`
      : `最新 ${baseline.evidenceType} Evidence 尚未达到 ${intervalDays} 天复测间隔。`,
    sourceSessions,
    baseline,
    intervalDays,
    plannedRetestAt,
    candidateId,
  });
  const plan = createPlan(input, candidate, baseline, due);

  return finalizeResult({
    input,
    candidate,
    plan,
    nextStep: due ? 'create_task_request' : 'wait_until_due',
    reason: due
      ? '延迟复测已到期，可交给既有策略与任务准备链路。'
      : `复测计划已登记，等待至 ${plannedRetestAt}。`,
  });
}

function validateExistingPlanAlignment(input: {
  plan: DelayedRetestPlan;
  candidateId: string;
  sourceSessionIds: string[];
  baselineEvidenceId: string;
  plannedRetestAt: string;
}): string[] {
  const issues: string[] = [];
  if (!isDelayedRetestPlan(input.plan)) {
    issues.push('Existing DelayedRetestPlan schema validation failed.');
    return issues;
  }
  if (input.plan.candidateId !== input.candidateId) {
    issues.push('Existing plan candidateId conflicts with the current candidate.');
  }
  if (input.plan.plannedRetestAt !== input.plannedRetestAt) {
    issues.push('Existing plan plannedRetestAt conflicts with the current policy result.');
  }
  if (!input.plan.sourceEvidenceIds.includes(input.baselineEvidenceId)) {
    issues.push('Existing plan does not trace to the current baseline Evidence.');
  }
  const expectedSessions = uniqueStrings(input.sourceSessionIds).sort();
  const actualSessions = uniqueStrings(input.plan.sourceSessionIds).sort();
  if (expectedSessions.join('|') !== actualSessions.join('|')) {
    issues.push('Existing plan sourceSessionIds conflict with the current formal Session History.');
  }
  return issues;
}

function validateInput(input: DelayedRetestSchedulingInput): string[] {
  const issues: string[] = [];
  if (!isNonEmptyString(input.studentId)) issues.push('studentId is required.');
  if (!isNonEmptyString(input.targetAbilityId)) issues.push('targetAbilityId is required.');
  if (!isGrowthMemorySummary(input.growthMemorySummary)) {
    issues.push('GrowthMemorySummary schema validation failed.');
  }
  if (!isLearningSessionHistoryResult(input.sessionHistory)) {
    issues.push('LearningSessionHistoryResult schema validation failed.');
  }
  if (!Array.isArray(input.abilityEvidence) || !input.abilityEvidence.every(isAbilityEvidence)) {
    issues.push('AbilityEvidence schema validation failed.');
  }
  if (input.existingPlans && !input.existingPlans.every(isDelayedRetestPlan)) {
    issues.push('Existing DelayedRetestPlan schema validation failed.');
  }
  if (!isTimestamp(input.currentTime)) issues.push('currentTime must be a valid ISO timestamp.');
  if (!isNonEmptyString(input.timezone)) issues.push('timezone is required.');
  if (!isDelayedRetestPolicy(input.policy)) issues.push('DelayedRetestPolicy schema validation failed.');
  return uniqueStrings(issues);
}

function validateIdentityAlignment(input: DelayedRetestSchedulingInput): string[] {
  const issues: string[] = [];
  if (input.growthMemorySummary.studentId !== input.studentId) {
    issues.push('GrowthMemorySummary studentId mismatch.');
  }
  if (input.growthMemorySummary.abilityId !== input.targetAbilityId) {
    issues.push('GrowthMemorySummary abilityId mismatch.');
  }
  if (input.sessionHistory.studentId !== input.studentId) {
    issues.push('LearningSessionHistoryResult studentId mismatch.');
  }
  for (const session of input.sessionHistory.sessions) {
    if (session.studentId !== input.studentId) {
      issues.push(`Session ${session.sessionId} studentId mismatch.`);
    }
  }
  for (const evidence of input.abilityEvidence) {
    if (evidence.studentId !== input.studentId) {
      issues.push(`Evidence ${evidence.id} studentId mismatch.`);
    }
    if (evidence.ability !== input.targetAbilityId) {
      issues.push(`Evidence ${evidence.id} ability mismatch.`);
    }
  }
  return uniqueStrings(issues);
}

function createCandidate(input: {
  input: DelayedRetestSchedulingInput;
  status: DelayedRetestCandidateStatus;
  reason: string;
  sourceSessions: LearningSessionRecord[];
  baseline: AbilityEvidence;
  intervalDays: number;
  plannedRetestAt: string;
  candidateId: string;
}): DelayedRetestCandidate {
  const candidate: DelayedRetestCandidate = {
    candidateId: input.candidateId,
    studentId: input.input.studentId,
    targetAbilityId: input.input.targetAbilityId,
    sourceSessionIds: uniqueStrings(input.sourceSessions.map((session) => session.sessionId)),
    sourceEvidenceIds: [input.baseline.id],
    baselineEvidenceId: input.baseline.id,
    baselineEvidenceType: input.baseline.evidenceType as 'growth' | 'positive',
    baselineEvidenceAt: input.baseline.createdAt,
    plannedRetestAt: input.plannedRetestAt,
    currentTime: input.input.currentTime,
    intervalDays: input.intervalDays,
    status: input.status,
    eligibilityReason: input.reason,
    limitations: [
      '证据时间变旧只表示需要重新观察，不表示能力已经下降。',
      '本计划不证明保持性，也不直接修改 StudentAbilityProfile。',
    ],
    policyVersion: input.input.policy.policyVersion,
    schemaVersion: DELAYED_RETEST_SCHEDULING_SCHEMA_VERSION,
    validation: { passed: true, issues: [] },
  };
  const valid = isDelayedRetestCandidate(candidate);
  return valid ? candidate : {
    ...candidate,
    validation: {
      passed: false,
      issues: ['DelayedRetestCandidate schema validation failed.'],
    },
  };
}

function createPlan(
  input: DelayedRetestSchedulingInput,
  candidate: DelayedRetestCandidate,
  baseline: AbilityEvidence,
  due: boolean,
): DelayedRetestPlan {
  const plannedRetestAt = candidate.plannedRetestAt as string;
  const plan: DelayedRetestPlan = {
    planId: buildStableId('delayed-retest-plan', [
      input.studentId,
      input.targetAbilityId,
      baseline.id,
      input.policy.policyVersion,
      plannedRetestAt,
    ]),
    candidateId: candidate.candidateId,
    studentId: input.studentId,
    targetAbilityId: input.targetAbilityId,
    sourceSessionIds: candidate.sourceSessionIds,
    sourceEvidenceIds: candidate.sourceEvidenceIds,
    baselineEvidenceId: baseline.id,
    scheduledAt: input.currentTime,
    plannedRetestAt,
    status: due ? 'available' : 'pending',
    whyRetestNow: due
      ? `目标能力“${input.targetAbilityId}”的最新 ${baseline.evidenceType} Evidence 已达到计划复测时间，需要在新材料中重新观察。`
      : `目标能力“${input.targetAbilityId}”已出现 ${baseline.evidenceType} Evidence，计划在 ${plannedRetestAt} 重新观察。`,
    retestGoal: `在新材料中重新观察学生的“${input.targetAbilityId}”表现。`,
    validationGoal: baseline.evidenceType === 'growth'
      ? '验证训练中出现的改善迹象能否在延迟、新材料和无提示条件下再次出现。'
      : '验证已达到要求的表现能否在延迟、新材料和无提示条件下保持。',
    requestedTaskRole: 'retest',
    requireNewMaterial: input.policy.requireNewMaterial,
    allowHint: input.policy.allowHint,
    constraints: [
      '必须使用与原训练不同的新材料或新情境。',
      '必须保持目标能力一致。',
      '第一版延迟复测不得提供提示。',
      '计划到期后仍须经过既有 TaskRequest 与 TaskFulfillment 链路。',
    ],
    policyVersion: input.policy.policyVersion,
    schemaVersion: DELAYED_RETEST_SCHEDULING_SCHEMA_VERSION,
    createdAt: input.currentTime,
    updatedAt: input.currentTime,
    validation: { passed: true, issues: [] },
  };
  const valid = isDelayedRetestPlan(plan);
  return valid ? plan : {
    ...plan,
    validation: {
      passed: false,
      issues: ['DelayedRetestPlan schema validation failed.'],
    },
  };
}

function terminalResult(
  input: DelayedRetestSchedulingInput,
  status: Extract<DelayedRetestCandidateStatus, 'not_eligible' | 'review_required' | 'blocked'>,
  nextStep: Extract<DelayedRetestSchedulingNextStep, 'review_required' | 'blocked'>,
  issues: string[],
  reason: string,
  limitations: string[] = [],
): DelayedRetestSchedulingResult {
  const candidate: DelayedRetestCandidate = {
    candidateId: buildStableId('delayed-retest-candidate', [
      input.studentId || 'unknown-student',
      input.targetAbilityId || 'unknown-ability',
      status,
      input.policy?.policyVersion || DELAYED_RETEST_POLICY_VERSION,
    ]),
    studentId: input.studentId || 'unknown-student',
    targetAbilityId: input.targetAbilityId || 'unknown-ability',
    sourceSessionIds: [],
    sourceEvidenceIds: [],
    currentTime: isTimestamp(input.currentTime) ? input.currentTime : FALLBACK_TIME,
    status,
    eligibilityReason: reason,
    limitations: uniqueStrings(limitations),
    policyVersion: DELAYED_RETEST_POLICY_VERSION,
    schemaVersion: DELAYED_RETEST_SCHEDULING_SCHEMA_VERSION,
    validation: {
      passed: issues.length === 0,
      issues: uniqueStrings(issues),
    },
  };
  return finalizeResult({ input, candidate, nextStep, reason });
}

function finalizeResult(input: {
  input: DelayedRetestSchedulingInput;
  candidate: DelayedRetestCandidate;
  plan?: DelayedRetestPlan;
  nextStep: DelayedRetestSchedulingNextStep;
  reason: string;
}): DelayedRetestSchedulingResult {
  const issues = uniqueStrings([
    ...input.candidate.validation.issues,
    ...(input.plan?.validation.issues || []),
  ]);
  const draft: DelayedRetestSchedulingResult = {
    studentId: input.input.studentId || 'unknown-student',
    targetAbilityId: input.input.targetAbilityId || 'unknown-ability',
    candidate: input.candidate,
    plan: input.plan,
    nextStep: input.nextStep,
    reason: input.reason,
    validation: {
      passed: issues.length === 0,
      issues,
    },
  };

  if (!isDelayedRetestSchedulingResult(draft)) {
    return {
      ...draft,
      validation: {
        passed: false,
        issues: uniqueStrings([...issues, 'DelayedRetestSchedulingResult schema validation failed.']),
      },
    };
  }
  return draft;
}

function selectLatestEvidence(evidence: AbilityEvidence[]): AbilityEvidence {
  return [...evidence].sort((left, right) => {
    const timeDifference = Date.parse(right.createdAt) - Date.parse(left.createdAt);
    if (timeDifference !== 0) return timeDifference;
    return left.id.localeCompare(right.id);
  })[0];
}

function findSourceSessions(
  sessions: LearningSessionRecord[],
  evidenceId: string,
): LearningSessionRecord[] {
  return sessions.filter((session) => session.evidenceIds.includes(evidenceId));
}

function buildStableId(prefix: string, parts: string[]): string {
  const body = parts
    .map((part) => String(part).trim().replace(/[^0-9A-Za-z\u4e00-\u9fff_-]+/g, '-'))
    .filter(Boolean)
    .join('-');
  return `${prefix}-${body}`;
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function isTimestamp(value: unknown): value is string {
  return isNonEmptyString(value) && !Number.isNaN(Date.parse(value));
}

function uniqueStrings(values: string[]): string[] {
  return [...new Set(values.filter((value) => value.trim().length > 0))];
}
