import type { ProfileUpdateAction } from '../ai/schemas/profileUpdateDecision.schema.ts';
import type { GrowthMemoryRecord } from '../ai/schemas/growthMemory.schema.ts';
import { GrowthMemoryStore } from '../ai/agents/growthMemoryStore.ts';
import { summarizeGrowthMemory } from '../ai/agents/growthMemorySummaryAgent.ts';
import { buildGrowthMemoryRecordFixture } from '../ai/tests/growthMemoryDebugFixtures.ts';

const studentId = 'demo-student';
const ability = '推理';

export function getPhase82GrowthMemoryDemoData() {
  const cases = getPhase82GrowthMemoryDemoCases();

  return {
    cases,
    defaultCaseId: 'status_improving',
  };
}

export function getPhase82GrowthMemoryDemoCases() {
  return [
    buildDemoCase({
      id: 'append_only',
      label: '只追加证据',
      description: 'ProfileUpdateDecision 只允许追加证据，Profile 长期状态不改变。',
      expected: 'GrowthMemoryRecord 记录本次追加证据事件，Summary 显示 continued_observation。',
      acceptancePoints: [
        'Record 能追溯 EvaluationResult 和 ProfileUpdateDecision。',
        'before / after 长期状态保持一致。',
        'Summary 只描述持续观察，不宣布能力提升。',
      ],
      actions: ['append_evidence_only', 'append_evidence_only'],
    }),
    buildDemoCase({
      id: 'retest_pending',
      label: '请求复测',
      description: '最近一次决策要求独立复测，系统需要记录待验证事项。',
      expected: 'GrowthMemorySummary 显示 retest_pending，并保留 pendingActions。',
      acceptancePoints: [
        'Record 保留 evidenceLinks 和 nextAction。',
        'Store 可以查询到该学生该能力的记录。',
        'Summary 能识别 retest_pending。',
      ],
      actions: ['append_evidence_only', 'request_retest'],
    }),
    buildDemoCase({
      id: 'fluctuating',
      label: '表现波动',
      description: '同一能力出现波动决策，Summary 应显示 fluctuating，而不是 improving。',
      expected: 'Summary 显示 fluctuating，并提示不能宣布稳定提升。',
      acceptancePoints: [
        'Record 记录 mark_fluctuating 动作。',
        'Summary recentTrend 为 fluctuating。',
        'Summary 不输出能力已经明显提升。',
      ],
      actions: ['update_confidence', 'mark_fluctuating'],
    }),
    buildDemoCase({
      id: 'confidence_increasing',
      label: '置信度增加',
      description: '连续多次只更新置信度，但还不足以改变长期状态。',
      expected: 'Summary 显示 confidence_increasing，但不自动升级长期 status。',
      acceptancePoints: [
        '连续 update_confidence 能形成历史轨迹。',
        'Summary limitations 保留反过度结论提醒。',
        'Profile 状态不应被 Summary 再次改写。',
      ],
      actions: ['update_confidence', 'update_confidence'],
    }),
    buildDemoCase({
      id: 'status_improving',
      label: '状态更新记录',
      description: '一次受控 update_status 需要保存 Profile 前后差异。',
      expected: 'Record 展示 before weak / after improving，Summary 显示 status_improving。',
      acceptancePoints: [
        'Record 能展示 Profile 前后变化。',
        'Store 保存后可按 studentId 和 abilityId 查询。',
        'Summary 只描述 status_improving 轨迹，不宣布稳定提升。',
      ],
      actions: ['update_status'],
    }),
  ];
}

function buildDemoCase(input: {
  id: string;
  label: string;
  description: string;
  expected: string;
  acceptancePoints: string[];
  actions: ProfileUpdateAction[];
}) {
  const store = new GrowthMemoryStore();
  const records = input.actions.map((action, index) => {
    const record = buildRecordForAction(action, index);
    store.save(record);
    return record;
  });
  const latestRecord = records
    .slice()
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0];
  const studentRecords = store.queryByStudentId(studentId);
  const abilityRecords = store.queryByAbilityId(ability);
  const scopedRecords = store.queryByStudentAndAbility({ studentId, abilityId: ability });
  const duplicateSave = latestRecord ? store.save(latestRecord) : undefined;
  const summary = summarizeGrowthMemory({
    studentId,
    abilityId: ability,
    records: scopedRecords,
  });

  return {
    id: input.id,
    label: input.label,
    description: input.description,
    expected: input.expected,
    acceptancePoints: input.acceptancePoints,
    records,
    latestRecord,
    storeResult: {
      totalRecords: store.list().length,
      studentRecordCount: studentRecords.length,
      abilityRecordCount: abilityRecords.length,
      scopedRecordCount: scopedRecords.length,
      duplicateInserted: duplicateSave?.inserted || false,
    },
    summary,
  };
}

function buildRecordForAction(
  action: ProfileUpdateAction,
  index: number,
): GrowthMemoryRecord {
  const createdAt = `2026-07-12T08:${String(index * 10).padStart(2, '0')}:00.000Z`;
  const baseRecord = buildGrowthMemoryRecordFixture(undefined, {
    runTime: createdAt,
    relatedSessionId: `session-phase82-demo-${index + 1}`,
  });

  const afterProfileSummary = action === 'update_status'
    ? {
        ...baseRecord.afterProfileSummary,
        abilityStatus: 'improving',
      }
    : {
        ...baseRecord.beforeProfileSummary,
      };

  return {
    ...baseRecord,
    recordId: `${baseRecord.recordId}-${action}-${index + 1}`,
    action,
    createdAt,
    beforeProfileSummary: baseRecord.beforeProfileSummary,
    afterProfileSummary,
    reason: buildReason(action),
    limitations: buildLimitations(action),
    nextAction: buildNextAction(action),
  };
}

function buildReason(action: ProfileUpdateAction): string {
  const reasonMap: Record<ProfileUpdateAction, string> = {
    no_change: '画像保持不变，仅记录本次决策。',
    append_evidence_only: '当前证据可记录，但不足以改变长期能力状态。',
    update_confidence: '出现改善迹象，仅提高后续观察置信度。',
    update_status: '证据允许受控更新为 improving，但仍需后续迁移验证。',
    mark_fluctuating: '同一能力存在波动，需要继续验证。',
    request_retest: '当前证据提示需要同能力独立复测。',
    human_review: '证据冲突较强，需要人工复核。',
  };

  return reasonMap[action];
}

function buildLimitations(action: ProfileUpdateAction): string[] {
  const common = ['GrowthMemorySummary 只描述历史轨迹，不生成新的能力评价结论。'];
  if (action === 'update_confidence') return [...common, '置信度增加不等于长期能力已经提升。'];
  if (action === 'mark_fluctuating') return [...common, '当前存在波动，不能宣布稳定提升。'];
  if (action === 'update_status') return [...common, '状态变化仍需后续独立复测或迁移验证。'];
  if (action === 'request_retest') return [...common, '需要复测后才能继续判断。'];
  return common;
}

function buildNextAction(action: ProfileUpdateAction): string | undefined {
  if (action === 'request_retest') return '安排同能力独立复测。';
  if (action === 'mark_fluctuating') return '继续验证当前波动来源。';
  if (action === 'human_review') return '需要人工复核冲突证据。';
  if (action === 'update_status') return '安排迁移验证，确认改善是否稳定。';
  return undefined;
}
