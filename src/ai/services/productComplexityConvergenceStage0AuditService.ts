import {
  auditConditionalCapability,
  auditConvergenceSurface,
} from '../agents/productComplexityConvergenceAuditAgent.ts';
import {
  CONVERGENCE_FINDING_CODES,
  PRODUCT_COMPLEXITY_CONVERGENCE_CONTRACT_VERSION,
  PRODUCT_COMPLEXITY_CONVERGENCE_STAGE0_AUDIT_VERSION,
  type ConditionalCapabilityAuditInput,
  type ConvergenceFindingPriority,
  type ConvergenceProtectedSnapshot,
  type ConvergenceRecommendationStage,
  type ConvergenceSurfaceAuditInput,
  type ProductComplexityConvergenceStage0Report,
} from '../schemas/productComplexityConvergenceAudit.schema.ts';

export type ProductComplexityStage0AuditSource = {
  surfaces: ConvergenceSurfaceAuditInput[];
  capabilityPaths: ConditionalCapabilityAuditInput[];
  protectedSnapshot: ConvergenceProtectedSnapshot;
};

export function buildProductComplexityConvergenceStage0Audit(
  source: ProductComplexityStage0AuditSource,
  readAfter: () => ConvergenceProtectedSnapshot = () => structuredClone(source.protectedSnapshot),
): ProductComplexityConvergenceStage0Report {
  const beforeSnapshot = structuredClone(source.protectedSnapshot);
  const surfaceResults = source.surfaces.map((item) => auditConvergenceSurface(structuredClone(item)));
  const capabilityResults = source.capabilityPaths.map((item) => (
    auditConditionalCapability(structuredClone(item))
  ));
  const afterSnapshot = structuredClone(readAfter());
  const findings = [
    ...surfaceResults.flatMap((item) => item.findings),
    ...capabilityResults.flatMap((item) => item.findings),
  ];
  const findingBreakdown = zeroRecord(CONVERGENCE_FINDING_CODES);
  const priorityBreakdown: Record<ConvergenceFindingPriority, number> = { P0: 0, P1: 0, P2: 0, P3: 0 };
  const stageBreakdown: Record<ConvergenceRecommendationStage, number> = { 1: 0, 2: 0, 3: 0, 4: 0 };
  findings.forEach((item) => {
    findingBreakdown[item.code] += 1;
    priorityBreakdown[item.priority] += 1;
    stageBreakdown[item.recommendationStage] += 1;
  });
  const reportWithoutDigest = {
    schemaVersion: PRODUCT_COMPLEXITY_CONVERGENCE_STAGE0_AUDIT_VERSION,
    contractVersion: PRODUCT_COMPLEXITY_CONVERGENCE_CONTRACT_VERSION,
    runtimeScope: 'read_only_audit' as const,
    surfaceResults,
    capabilityResults,
    findingBreakdown,
    priorityBreakdown,
    stageBreakdown,
    beforeSnapshot,
    afterSnapshot,
    zeroWriteVerified: stableHash(beforeSnapshot) === stableHash(afterSnapshot),
    limitations: [
      '阶段 0 Finding 只进入 Internal Acceptance 与只读报告。',
      'Finding 不进入 Candidate 门禁、Scheduler、Diagnosis、Evidence、Profile 或 Calibration。',
      '本报告不形成学生能力、教育效果或正式题质量结论。',
      '阶段 0 不自动修复页面、条件能力触发策略或正式资源。',
    ],
  };
  return { ...reportWithoutDigest, auditDigest: stableHash(reportWithoutDigest) };
}

export function buildDefaultProductComplexityStage0AuditSource(): ProductComplexityStage0AuditSource {
  const schemaVersion = PRODUCT_COMPLEXITY_CONVERGENCE_STAGE0_AUDIT_VERSION;
  return {
    protectedSnapshot: createEmptyProtectedSnapshot(),
    surfaces: [
      {
        schemaVersion, surfaceId: 'authoring-workbench-ready',
        route: '/material-resource-workbench', stateId: 'candidate_ready', audience: 'authoring_user',
        elements: [
          { elementId: 'status-ready', kind: 'status', text: '可以发布', actionable: true,
            factKey: 'candidate-readiness', factSource: 'canonical_projection' },
          { elementId: 'adopt-publish', kind: 'primary_action', text: '采用并发布',
            intent: 'adopt_and_publish', factSource: 'canonical_projection' },
          { elementId: 'regenerate', kind: 'secondary_action', text: '重新生成题目',
            intent: 'regenerate', factSource: 'canonical_projection' },
        ],
      },
      {
        schemaVersion, surfaceId: 'authoring-workbench-error',
        route: '/material-resource-workbench', stateId: 'publication_failed', audience: 'authoring_user',
        elements: [
          { elementId: 'publication-error', kind: 'error', text: '发布未完成，当前候选已保留。',
            actionable: true, nextAction: '继续发布', location: 'local', factSource: 'canonical_projection' },
        ],
      },
      {
        schemaVersion, surfaceId: 'authoring-workbench-generating',
        route: '/material-resource-workbench', stateId: 'generating_candidates',
        audience: 'authoring_user', elements: [
          { elementId: 'generating-status', kind: 'status', text: '正在生成任务方案…',
            actionable: true, factSource: 'canonical_projection' },
        ],
      },
      {
        schemaVersion, surfaceId: 'authoring-workbench-publishing',
        route: '/material-resource-workbench', stateId: 'publishing', audience: 'authoring_user',
        elements: [
          { elementId: 'publishing-status', kind: 'status', text: '正在发布…',
            actionable: true, factSource: 'canonical_projection' },
        ],
      },
      {
        schemaVersion, surfaceId: 'authoring-workbench-published',
        route: '/material-resource-workbench', stateId: 'published', audience: 'authoring_user',
        elements: [
          { elementId: 'published-status', kind: 'status', text: '已发布',
            actionable: true, factSource: 'canonical_projection' },
          { elementId: 'published-disclosure', kind: 'secondary_action', text: '展开详情',
            intent: 'toggle_disclosure', factSource: 'canonical_projection' },
        ],
      },
      {
        schemaVersion, surfaceId: 'learning-entry', route: '/learning', stateId: 'ready',
        audience: 'learning_student', elements: [
          { elementId: 'enter-learning', kind: 'primary_action', text: '开始学习',
            intent: 'enter_learning', factSource: 'canonical_projection' },
        ],
      },
      {
        schemaVersion, surfaceId: 'learning-single-choice', route: '/learning',
        stateId: 'single_choice_answering', audience: 'learning_student', elements: [
          { elementId: 'single-choice-submit', kind: 'primary_action', text: '提交选择',
            intent: 'submit_single_choice', factSource: 'canonical_projection' },
        ],
      },
      {
        schemaVersion, surfaceId: 'learning-open-text', route: '/learning',
        stateId: 'open_text_answering', audience: 'learning_student', elements: [
          { elementId: 'open-text-submit', kind: 'primary_action', text: '提交本轮回答',
            intent: 'submit_open_text', factSource: 'canonical_projection' },
        ],
      },
      {
        schemaVersion, surfaceId: 'learning-feedback', route: '/learning', stateId: 'feedback',
        audience: 'learning_student', elements: [
          { elementId: 'feedback-main', kind: 'feedback', text: '先回到材料中找到相关动作，再说明动作和判断之间的关系。',
            factSource: 'canonical_projection' },
          { elementId: 'next-task', kind: 'primary_action', text: '进入下一题',
            intent: 'next_task', factSource: 'canonical_projection' },
        ], feedback: { issueCount: 1, guidanceCount: 1, expressionMode: 'adaptive' },
      },
      {
        schemaVersion, surfaceId: 'learning-hint', route: '/learning', stateId: 'hint_open',
        audience: 'learning_student', elements: [
          { elementId: 'hint-guidance', kind: 'explanation',
            text: '留意人物动作与前后变化之间的联系。', factSource: 'canonical_projection' },
        ],
      },
      {
        schemaVersion, surfaceId: 'learning-revision', route: '/learning', stateId: 'revision_offered',
        audience: 'learning_student', elements: [
          { elementId: 'revision-entry', kind: 'conditional_entry', text: '根据反馈修订一次',
            conditionActive: true, factSource: 'canonical_projection' },
          { elementId: 'revision-action', kind: 'primary_action', text: '开始修订',
            intent: 'start_revision', factSource: 'canonical_projection' },
        ],
      },
      {
        schemaVersion, surfaceId: 'learning-targeted', route: '/learning', stateId: 'targeted_active',
        audience: 'learning_student', elements: [
          { elementId: 'targeted-task', kind: 'conditional_entry', text: '专项练习',
            conditionActive: true, factSource: 'canonical_projection' },
        ],
      },
      {
        schemaVersion, surfaceId: 'learning-independent-validation', route: '/learning',
        stateId: 'retest_or_transfer_active', audience: 'learning_student', elements: [
          { elementId: 'validation-task', kind: 'conditional_entry', text: '继续完成这道题',
            conditionActive: true, factSource: 'canonical_projection' },
        ],
      },
      {
        schemaVersion, surfaceId: 'internal-acceptance', route: '/internal/acceptance',
        stateId: 'audit', audience: 'internal', elements: [
          { elementId: 'internal-heading', kind: 'heading',
            text: 'Candidate Gate / Registry Hash Debug', factSource: 'canonical_projection' },
        ],
      },
      {
        schemaVersion, surfaceId: 'learning-complete', route: '/learning',
        stateId: 'group_complete', audience: 'learning_student', elements: [
          { elementId: 'return-learning-entry', kind: 'primary_action', text: '返回学习入口',
            intent: 'return_learning_entry', factSource: 'canonical_projection' },
        ],
      },
    ],
    capabilityPaths: [
      capability('revision', { triggerActive: false, entryVisible: false }),
      capability('targeted', { triggerActive: true, entryVisible: true, recursiveDepth: 1,
        benefitCode: 'isolate_atomic_gap' }),
      capability('retest', { triggerActive: false, entryVisible: false,
        benefitCode: 'verify_independent_retention' }),
      capability('transfer', { triggerActive: false, entryVisible: false,
        benefitCode: 'verify_transfer' }),
      capability('governance', { triggerActive: false, entryVisible: false,
        benefitCode: 'repair_resource_risk' }),
      capability('calibration', { triggerActive: false, entryVisible: false,
        benefitCode: 'review_calibration_evidence' }),
    ],
  };
}

export function createEmptyProtectedSnapshot(
  patch: Partial<ConvergenceProtectedSnapshot> = {},
): ConvergenceProtectedSnapshot {
  return {
    formalResourceDigest: 'formal:unchanged', registryDigest: 'registry:unchanged', storeRevision: 0,
    learningSessionDigest: 'session:unchanged', learningAttemptDigest: 'attempt:unchanged',
    evidenceDigest: 'evidence:unchanged', profileDigest: 'profile:unchanged',
    calibrationDigest: 'calibration:unchanged', learningProgressDigest: 'progress:unchanged',
    ...patch,
  };
}

export function renderProductComplexityConvergenceStage0Markdown(
  report: ProductComplexityConvergenceStage0Report,
): string {
  const findings = [
    ...report.surfaceResults.flatMap((item) => item.findings),
    ...report.capabilityResults.flatMap((item) => item.findings),
  ];
  return [
    '# 产品复杂度收口阶段 0：只读复杂度审计报告', '',
    `状态：\`${report.zeroWriteVerified ? 'READ-ONLY VERIFIED' : 'WRITE DRIFT DETECTED'}\``, '',
    `Audit Digest：\`${report.auditDigest}\``, '',
    '## 一、覆盖范围', '',
    `- 普通与内部页面状态：${report.surfaceResults.length}`,
    `- 条件能力路径：${report.capabilityResults.length}`, '',
    '## 二、风险分级', '',
    ...Object.entries(report.priorityBreakdown).map(([key, value]) => `- ${key}：${value}`), '',
    '## 三、阶段去向', '',
    ...Object.entries(report.stageBreakdown).map(([key, value]) => `- 阶段 ${key}：${value}`), '',
    '## 四、Finding', '',
    ...(findings.length ? findings.map((item) => (
      `- [${item.priority}] ${item.code}（阶段 ${item.recommendationStage}）：${item.explanation}`
    )) : ['- 当前冻结清单未发现复杂度 Finding。']), '',
    '## 五、零写入证明', '',
    `- 审计前后不可变快照：${report.zeroWriteVerified ? '一致' : '不一致'}`, '',
    '## 六、限制', '', ...report.limitations.map((item) => `- ${item}`), '',
  ].join('\n');
}

export function stableHash(value: unknown): string {
  const text = JSON.stringify(normalize(value)); let hash = 0x811c9dc5;
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index); hash = Math.imul(hash, 0x01000193);
  }
  return `fnv1a-${(hash >>> 0).toString(16).padStart(8, '0')}`;
}

function capability(
  capabilityName: ConditionalCapabilityAuditInput['capability'],
  patch: Partial<ConditionalCapabilityAuditInput>,
): ConditionalCapabilityAuditInput {
  return {
    schemaVersion: PRODUCT_COMPLEXITY_CONVERGENCE_STAGE0_AUDIT_VERSION,
    capability: capabilityName, pathId: `${capabilityName}-default`, audience: 'learning_student',
    triggerActive: false, entryVisible: false, exitAvailable: true,
    noActionFallbackAvailable: true, recoveryAvailable: true,
    factSource: 'canonical_projection', retirementCompatibility: true, ...patch,
  };
}
function zeroRecord<T extends readonly string[]>(keys: T): Record<T[number], number> {
  return Object.fromEntries(keys.map((key) => [key, 0])) as Record<T[number], number>;
}
function normalize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(normalize);
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(Object.entries(value).filter(([, child]) => child !== undefined)
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, child]) => [key, normalize(child)]));
}
