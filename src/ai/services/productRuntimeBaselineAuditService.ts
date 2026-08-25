import { evaluateQuestionGenerationQuality } from '../agents/questionGenerationQualityPolicyAgent.ts';
import { buildQuestionOptimizationBaseline } from '../agents/questionOptimizationBaselineAgent.ts';
import type { SharedFormalResourceSnapshot } from '../schemas/sharedFormalResourcePersistence.schema.ts';
import type { QuestionEditableFields } from '../schemas/workingTaskContent.schema.ts';
import {
  DYNAMIC_FORMAL_RESOURCE_BASELINE_VERSION,
  PRODUCT_RUNTIME_BASELINE_AUDIT_VERSION,
  PRODUCT_RUNTIME_REASON_CODES,
  PRODUCT_RUNTIME_REASON_REGISTRY_VERSION,
  type DynamicFormalResourceBaseline,
  type ProductRuntimeBaselineAudit,
  type ProductRuntimeBaselineFinding,
  type ProductRuntimeProtectedSnapshot,
  type ProductRuntimeReasonCode,
  type ProductRuntimeReasonDefinition,
  type RuntimeDependencyInventoryItem,
  type RuntimeIdentityInputAudit,
  type RuntimeRouteAudit,
} from '../schemas/productRuntimeBaselineAudit.schema.ts';

export type ProductRuntimeBaselineAuditInput = {
  auditId: string;
  startedAt: string;
  completedAt: string;
  gitCommit: string;
  worktreeState: 'clean' | 'dirty';
  snapshotBefore: SharedFormalResourceSnapshot;
  snapshotAfter: SharedFormalResourceSnapshot;
  protectedBefore: ProductRuntimeProtectedSnapshot;
  protectedAfter: ProductRuntimeProtectedSnapshot;
  dependencies: RuntimeDependencyInventoryItem[];
  identityInputAudit: RuntimeIdentityInputAudit;
  routeAudits: RuntimeRouteAudit[];
  fixedBaselineEvidence?: string[];
};

const reasonMeta: Record<ProductRuntimeReasonCode, Omit<ProductRuntimeReasonDefinition,
  'registryVersion' | 'code' | 'internalDescription'>> = {
  runtime_unreachable: meta('runtime', 'blocked', 'blocked', 'restart_required', 'not_started'),
  runtime_health_timeout: meta('runtime', 'blocked', 'blocked', 'retryable', 'unknown_requires_check'),
  runtime_port_conflict: meta('runtime', 'blocked', 'blocked', 'restart_required', 'not_started'),
  runtime_identity_insufficient: meta('runtime', 'degraded', 'none', 'reentry_required', 'preserved'),
  formal_store_unreadable: meta('formal_store', 'blocked', 'blocked', 'retryable', 'unknown_requires_check'),
  formal_store_uninitialized: meta('formal_store', 'blocked', 'blocked', 'not_applicable', 'not_started'),
  formal_resource_boundary_unavailable: meta('formal_store', 'blocked', 'blocked', 'restart_required', 'preserved'),
  formal_resource_baseline_inconsistent: meta('formal_store', 'blocked', 'blocked', 'reentry_required', 'preserved'),
  no_learning_task_available: meta('task', 'information', 'none', 'not_applicable', 'preserved'),
  task_identity_mismatch: meta('task', 'blocked', 'blocked', 'retryable', 'preserved'),
  learning_session_recovery_required: meta('session', 'information', 'none', 'retryable', 'preserved'),
  learning_session_identity_mismatch: meta('session', 'blocked', 'blocked', 'retryable', 'unknown_requires_check'),
  submission_recovery_required: meta('submission', 'information', 'none', 'retryable', 'preserved'),
  submission_identity_mismatch: meta('submission', 'blocked', 'blocked', 'retryable', 'preserved'),
  ai_provider_not_configured: meta('ai', 'degraded', 'conditional', 'retryable', 'preserved'),
  ai_provider_unreachable: meta('ai', 'degraded', 'conditional', 'retryable', 'preserved'),
  ai_provider_status_not_checked: meta('ai', 'information', 'conditional', 'not_applicable', 'preserved'),
  trial_identity_mismatch: meta('trial', 'degraded', 'none', 'reentry_required', 'preserved'),
  trial_reentry_required: meta('trial', 'information', 'none', 'reentry_required', 'preserved'),
  trial_observation_unavailable: meta('trial', 'degraded', 'none', 'retryable', 'preserved'),
  audit_evidence_incomplete: meta('audit', 'degraded', 'none', 'not_applicable', 'preserved'),
  audit_zero_write_violation: meta('audit', 'blocked', 'blocked', 'not_applicable', 'unknown_requires_check'),
};

export function buildDefaultProductRuntimeReasonRegistry(): ProductRuntimeReasonDefinition[] {
  return PRODUCT_RUNTIME_REASON_CODES.map((code) => ({
    registryVersion: PRODUCT_RUNTIME_REASON_REGISTRY_VERSION,
    code,
    ...reasonMeta[code],
    internalDescription: code.replaceAll('_', ' '),
  }));
}

export function buildDynamicFormalResourceBaseline(
  snapshot: SharedFormalResourceSnapshot,
  observedAt = new Date().toISOString(),
): DynamicFormalResourceBaseline {
  const baseline = buildQuestionOptimizationBaseline(snapshot);
  const materials = snapshot.data.questionResources.materials.filter((item) => item.status !== 'retired');
  const versionById = new Map(snapshot.data.questionResources.versions
    .map((item) => [item.resourceVersionId, item]));
  const registryByResourceId = new Map(snapshot.data.questionResources.registryEntries
    .filter((item) => item.status === 'active').map((item) => [item.resourceId, item]));
  const current = baseline.items.map((item) => ({
    item,
    version: versionById.get(item.resourceVersionId),
    registry: registryByResourceId.get(item.resourceId),
  })).filter((item) => Boolean(item.version));
  const editable = current.map((item) => ({
    materialVersionId: item.item.materialVersionId,
    resourceVersionId: item.item.resourceVersionId,
    content: toEditable(item.version!),
  }));
  const quality = editable.map((item) => evaluateQuestionGenerationQuality({
    candidate: item.content,
    peerQuestions: editable.filter((peer) => peer.materialVersionId === item.materialVersionId
      && peer.resourceVersionId !== item.resourceVersionId).map((peer) => peer.content),
    includePortfolioGuidance: false,
  }));
  const responseFormatBreakdown = countBy(current, (item) => item.version!.responseFormat);
  const difficultyBreakdown = countBy(current, (item) => item.registry?.difficulty || 'unknown');
  const coreReadingMaterialCount = materials.filter((item) => (item.usageType || 'core_reading') === 'core_reading').length;
  const resultWithoutDigest = {
    schemaVersion: DYNAMIC_FORMAL_RESOURCE_BASELINE_VERSION,
    observedAt,
    storeInitialized: snapshot.initialized,
    storeRevision: snapshot.revision,
    storeUpdatedAt: snapshot.updatedAt,
    activeMaterialCount: materials.length,
    coreReadingMaterialCount,
    targetedExcerptMaterialCount: materials.length - coreReadingMaterialCount,
    currentPlanCount: baseline.counts.currentPlans,
    currentTaskCount: baseline.counts.currentTasks,
    activeObservationLinkCount: baseline.counts.activeObservationLinks,
    activeRegistryEntryCount: baseline.counts.activeRegistryEntries,
    currentFormalVersionCount: baseline.counts.currentFormalVersions,
    frozenQualityTraceCount: baseline.counts.frozenQualityTraces,
    learningConsumableQuestionCount: baseline.counts.learningConsumableQuestions,
    latestQuality: {
      ready: quality.filter((item) => item.status === 'ready').length,
      guided: quality.filter((item) => item.status === 'ready_with_guidance').length,
      blocked: quality.filter((item) => item.status === 'blocked').length,
    },
    responseFormatBreakdown,
    difficultyBreakdown,
    issueCodes: [...baseline.issues],
  };
  const { observedAt: _observedAt, ...baselineFacts } = resultWithoutDigest;
  return { ...resultWithoutDigest, baselineDigest: stableHash(baselineFacts) };
}

export function buildProductRuntimeProtectedSnapshot(
  snapshot: SharedFormalResourceSnapshot,
  patch: Partial<ProductRuntimeProtectedSnapshot> = {},
): ProductRuntimeProtectedSnapshot {
  return {
    formalResourceDigest: stableHash(snapshot.data),
    formalResourceRevision: snapshot.revision,
    learningDigest: 'learning:not_checked',
    calibrationDigest: 'calibration:not_checked',
    trialDigest: 'trial:not_checked',
    ...patch,
  };
}

export function buildRuntimeIdentityInputAudit(input: {
  gitCommit: string;
  worktreeState: 'clean' | 'dirty';
  launchGitCommit?: string;
  currentBuildVersion?: string;
  launchBuildVersion?: string;
  buildVersionContentAddressed?: boolean;
}): RuntimeIdentityInputAudit {
  const commitComparable = Boolean(input.gitCommit && input.launchGitCommit);
  const mismatch = commitComparable && !commitsEqual(input.gitCommit, input.launchGitCommit!);
  const insufficient = !commitComparable || !input.currentBuildVersion || !input.launchBuildVersion;
  const reasonCodes: ProductRuntimeReasonCode[] = [];
  if (mismatch) reasonCodes.push('trial_identity_mismatch', 'trial_reentry_required');
  if (insufficient || !input.buildVersionContentAddressed) reasonCodes.push('runtime_identity_insufficient');
  return {
    status: mismatch ? 'mismatch' : insufficient ? 'insufficient_evidence' : 'aligned',
    gitCommit: input.gitCommit,
    worktreeState: input.worktreeState,
    launchGitCommit: input.launchGitCommit,
    currentBuildVersion: input.currentBuildVersion,
    launchBuildVersion: input.launchBuildVersion,
    buildVersionUniqueness: input.buildVersionContentAddressed
      ? 'content_addressed' : input.currentBuildVersion ? 'fixed_or_unverified' : 'not_available',
    trialReentryRequired: mismatch || insufficient || !input.buildVersionContentAddressed,
    learningAllowed: true,
    recommendedEffectiveMode: 'off',
    reasonCodes: [...new Set(reasonCodes)],
  };
}

export function buildProductRuntimeBaselineAudit(
  input: ProductRuntimeBaselineAuditInput,
): ProductRuntimeBaselineAudit {
  const formalResourceBaseline = buildDynamicFormalResourceBaseline(input.snapshotBefore, input.completedAt);
  const zeroWriteComparison = {
    before: structuredClone(input.protectedBefore),
    after: structuredClone(input.protectedAfter),
    formalResourceWriteCount: changed(input.protectedBefore.formalResourceDigest, input.protectedAfter.formalResourceDigest),
    attemptWriteCount: 0,
    evidenceWriteCount: 0,
    profileWriteCount: 0,
    realCalibrationDenominatorWriteCount: changed(input.protectedBefore.calibrationDigest, input.protectedAfter.calibrationDigest),
    trialStateWriteCount: changed(input.protectedBefore.trialDigest, input.protectedAfter.trialDigest),
    verified: stableHash(input.protectedBefore) === stableHash(input.protectedAfter),
  };
  const findings = deriveFindings(input, formalResourceBaseline, zeroWriteComparison.verified);
  const reasonCodes = [...new Set([
    ...input.dependencies.map((item) => item.reasonCode).filter(Boolean),
    ...input.identityInputAudit.reasonCodes,
    ...input.routeAudits.flatMap((item) => item.reasonCodes),
    ...(!zeroWriteComparison.verified ? ['audit_zero_write_violation' as const] : []),
  ] as ProductRuntimeReasonCode[])].sort();
  const failed = !zeroWriteComparison.verified || formalResourceBaseline.issueCodes.length > 0;
  const reportWithoutDigest = {
    schemaVersion: PRODUCT_RUNTIME_BASELINE_AUDIT_VERSION,
    auditId: input.auditId,
    startedAt: input.startedAt,
    completedAt: input.completedAt,
    mode: 'read_only' as const,
    git: { commit: input.gitCommit, worktreeState: input.worktreeState },
    dependencies: structuredClone(input.dependencies),
    formalResourceBaseline,
    identityInputAudit: structuredClone(input.identityInputAudit),
    routeAudits: structuredClone(input.routeAudits),
    reasonCodes,
    zeroWriteComparison,
    findings,
    status: failed ? 'failed' as const : findings.length ? 'passed_with_findings' as const : 'passed' as const,
  };
  const digestFacts = {
    ...reportWithoutDigest,
    startedAt: undefined,
    completedAt: undefined,
    dependencies: reportWithoutDigest.dependencies.map(({ checkedAt: _checkedAt, ...item }) => item),
    formalResourceBaseline: {
      ...reportWithoutDigest.formalResourceBaseline,
      observedAt: undefined,
    },
  };
  return { ...reportWithoutDigest, reportDigest: stableHash(digestFacts) };
}

export function renderProductRuntimeBaselineAuditMarkdown(report: ProductRuntimeBaselineAudit): string {
  const baseline = report.formalResourceBaseline;
  return [
    '# 产品运行可靠性 WP-R0：运行基线只读审计报告', '',
    `状态：\`${report.status.toUpperCase()}\``, '',
    `Git：\`${report.git.commit}\`（${report.git.worktreeState}）`, '',
    `Report Digest：\`${report.reportDigest}\``, '',
    '## 一、动态正式资源基线', '',
    `- Store Revision：${baseline.storeRevision}`,
    `- 活动材料：${baseline.activeMaterialCount}（core ${baseline.coreReadingMaterialCount} / targeted ${baseline.targetedExcerptMaterialCount}）`,
    `- Current / Registry / Version / Link / Trace / Consumable：${baseline.currentTaskCount} / ${baseline.activeRegistryEntryCount} / ${baseline.currentFormalVersionCount} / ${baseline.activeObservationLinkCount} / ${baseline.frozenQualityTraceCount} / ${baseline.learningConsumableQuestionCount}`,
    `- 最新质量：ready ${baseline.latestQuality.ready} / guidance ${baseline.latestQuality.guided} / blocked ${baseline.latestQuality.blocked}`, '',
    '## 二、依赖状态', '',
    ...report.dependencies.map((item) => `- ${item.dependencyId}：${item.status}${item.reasonCode ? `（${item.reasonCode}）` : ''}`), '',
    '## 三、运行身份', '',
    `- 状态：${report.identityInputAudit.status}`,
    `- Trial 重新准入：${report.identityInputAudit.trialReentryRequired ? 'required' : 'not_required'}`,
    `- 建议 Observation Mode：${report.identityInputAudit.recommendedEffectiveMode}`, '',
    '## 四、Finding', '',
    ...(report.findings.length ? report.findings.map((item) => `- [${item.priority}] ${item.code} → ${item.authorizedNextWorkPackage}：${item.explanation}`) : ['- 无。']), '',
    '## 五、零写入', '',
    `- 前后快照：${report.zeroWriteComparison.verified ? '一致' : '不一致'}`,
    `- Formal / Attempt / Evidence / Profile / Calibration / Trial：${report.zeroWriteComparison.formalResourceWriteCount} / ${report.zeroWriteComparison.attemptWriteCount} / ${report.zeroWriteComparison.evidenceWriteCount} / ${report.zeroWriteComparison.profileWriteCount} / ${report.zeroWriteComparison.realCalibrationDenominatorWriteCount} / ${report.zeroWriteComparison.trialStateWriteCount}`, '',
    '本报告不启动 Runtime、不修复页面、不修改 Trial，也不形成教育效果结论。', '',
  ].join('\n');
}

export function stableHash(value: unknown): string {
  const text = JSON.stringify(normalize(value));
  let hash = 0x811c9dc5;
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return `fnv1a-${(hash >>> 0).toString(16).padStart(8, '0')}`;
}

function deriveFindings(
  input: ProductRuntimeBaselineAuditInput,
  baseline: DynamicFormalResourceBaseline,
  zeroWriteVerified: boolean,
): ProductRuntimeBaselineFinding[] {
  const findings: ProductRuntimeBaselineFinding[] = [];
  const add = (code: ProductRuntimeBaselineFinding['code'], priority: ProductRuntimeBaselineFinding['priority'], wp: ProductRuntimeBaselineFinding['authorizedNextWorkPackage'], explanation: string, evidenceCodes: string[]) => {
    findings.push({ findingId: `${code}:${stableHash(evidenceCodes)}`, code, priority,
      authorizedNextWorkPackage: wp, explanation, evidenceCodes });
  };
  if (input.dependencies.some((item) => item.status === 'not_running')) {
    add('runtime_not_running', 'P0', 'WP-R1', '当前 Runtime 未运行或不可连接。', ['dependency:runtime:not_running']);
  }
  if (input.routeAudits.some((item) => item.reasonCodes.includes('runtime_unreachable')
    && item.visibleState.includes('正式任务'))) {
    add('runtime_state_projection_ambiguous', 'P1', 'WP-R2', '页面把 Runtime 不可达投射成正式任务读取失败。', ['route:learning:projection']);
  }
  if (input.identityInputAudit.status === 'mismatch') {
    add('trial_build_identity_stale', 'P1', 'WP-R3', '当前 Git 与 Trial Launch Record 不一致。', ['identity:git:mismatch']);
  }
  if (input.identityInputAudit.buildVersionUniqueness !== 'content_addressed') {
    add('build_identity_not_content_addressed', 'P1', 'WP-R3', '当前 Build Version 不能唯一证明源码和产物。', ['identity:build:unverified']);
  }
  if (input.fixedBaselineEvidence?.length) {
    add('fixed_baseline_assertion', 'P2', 'WP-R6', '旧审计仍包含历史固定数量断言。', input.fixedBaselineEvidence);
  }
  if (input.dependencies.some((item) => ['not_checked', 'insufficient_evidence'].includes(item.status))) {
    add('dependency_status_unknown', 'P2', 'WP-R1', '至少一项运行依赖缺少充分证据。', ['dependency:status:unknown']);
  }
  if (baseline.issueCodes.length || !zeroWriteVerified) {
    add('audit_contract_gap', 'P0', 'WP-R1', '动态正式基线或零写入约束未满足。', [...baseline.issueCodes, 'zero-write']);
  }
  return findings.sort((left, right) => `${left.priority}:${left.code}`.localeCompare(`${right.priority}:${right.code}`));
}

function toEditable(version: SharedFormalResourceSnapshot['data']['questionResources']['versions'][number]): QuestionEditableFields {
  return {
    materialVersionId: version.materialVersionId,
    title: version.title,
    questionStem: version.questionStem,
    questionType: version.questionType,
    responseFormat: version.responseFormat,
    options: version.options,
    choiceInteraction: version.choiceInteraction,
    assessmentMode: version.assessmentMode,
    answerAcceptance: version.answerAcceptance,
    rubric: version.rubric,
    minimumAnswerRequirement: version.minimumAnswerRequirement,
    abilityMetadata: version.abilityMetadata,
    source: version.source,
    tags: version.tags,
  };
}

function meta(
  domain: ProductRuntimeReasonDefinition['domain'],
  severity: ProductRuntimeReasonDefinition['severity'],
  coreLearningImpact: ProductRuntimeReasonDefinition['coreLearningImpact'],
  retryability: ProductRuntimeReasonDefinition['retryability'],
  dataPreservation: ProductRuntimeReasonDefinition['dataPreservation'],
): Omit<ProductRuntimeReasonDefinition, 'registryVersion' | 'code' | 'internalDescription'> {
  return { domain, severity, coreLearningImpact, retryability, dataPreservation };
}

function countBy<T>(values: T[], key: (value: T) => string): Record<string, number> {
  return values.reduce<Record<string, number>>((result, value) => {
    const current = key(value);
    result[current] = (result[current] || 0) + 1;
    return result;
  }, {});
}

function commitsEqual(left: string, right: string): boolean {
  return left === right || left.startsWith(right) || right.startsWith(left);
}

function changed(left: string, right: string): number { return left === right ? 0 : 1; }

function normalize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(normalize);
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(Object.entries(value)
    .filter(([, child]) => child !== undefined)
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, child]) => [key, normalize(child)]));
}
