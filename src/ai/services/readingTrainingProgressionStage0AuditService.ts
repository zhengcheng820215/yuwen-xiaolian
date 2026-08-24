import { buildQuestionOptimizationBaseline } from
  '../agents/questionOptimizationBaselineAgent.ts';
import {
  auditReadingTaskGroupProgression,
  projectLegacyTaskLoadSemantics,
} from '../agents/readingTrainingProgressiveLoadAuditAgent.ts';
import { orderFormalResourcesForLearningSequence } from
  '../agents/learningTaskSequenceScheduler.ts';
import {
  buildReadingOpenResponseInputLoadBaselineAudit,
} from './readingOpenResponseInputLoadBaselineAuditService.ts';
import {
  PROGRESSION_AUDIT_FINDING_CODES,
  READING_TRAINING_PROGRESSIVE_LOAD_POLICY_VERSION,
  READING_TRAINING_PROGRESSIVE_LOAD_STAGE0_AUDIT_VERSION,
  type ProgressionAuditFindingCode,
  type ReadingTrainingProgressionStage0Report,
} from '../schemas/readingTrainingProgressionAudit.schema.ts';
import type {
  MaterialObservationPlan,
  ObservationTaskPlan,
} from '../schemas/materialObservation.schema.ts';
import type { FrozenQuestionResourceVersion } from
  '../schemas/questionResourceAdmission.schema.ts';
import type { SharedFormalResourceSnapshot } from
  '../schemas/sharedFormalResourcePersistence.schema.ts';
import {
  isTrainingTaskSequenceReason,
  isTrainingTaskSequenceStrategy,
  type TrainingTaskSequenceReason,
  type TrainingTaskSequenceStrategy,
} from '../schemas/trainingTaskSequencePlanning.schema.ts';

export function buildReadingTrainingProgressionStage0Audit(
  snapshot: SharedFormalResourceSnapshot,
): ReadingTrainingProgressionStage0Report {
  const baseline = buildQuestionOptimizationBaseline(snapshot);
  const textBaseline = buildReadingOpenResponseInputLoadBaselineAudit(snapshot);
  const versionsById = new Map(snapshot.data.questionResources.versions.map((version) => (
    [version.resourceVersionId, version]
  )));
  const materialsById = new Map(snapshot.data.questionResources.materials.map((material) => (
    [material.materialId, material]
  )));
  const baselineByTaskId = new Map(baseline.items.map((item) => (
    [item.observationTaskPlanId, item]
  )));
  const textAuditByVersionId = new Map(textBaseline.questionResults.map((item) => (
    [item.questionVersionId, item]
  )));
  const issues = [...baseline.issues, ...textBaseline.issues];

  const groups = selectCurrentPlans(snapshot).map((plan) => {
    const taskByVersionId = new Map<string, ObservationTaskPlan>();
    const versions: FrozenQuestionResourceVersion[] = [];
    for (const task of plan.taskPlans.filter((item) => item.status !== 'cancelled')) {
      const baselineItem = baselineByTaskId.get(task.observationTaskPlanId);
      if (!baselineItem) {
        issues.push(`stage0_missing_baseline_item:${task.observationTaskPlanId}`);
        continue;
      }
      const version = versionsById.get(baselineItem.resourceVersionId);
      if (!version) {
        issues.push(`stage0_missing_formal_version:${baselineItem.resourceVersionId}`);
        continue;
      }
      versions.push(version);
      taskByVersionId.set(version.resourceVersionId, task);
    }
    const orderedVersions = versions.length > 0 && versions.every((version) => (
      version.abilityMetadata.taskRole === 'training'
    ))
      ? orderFormalResourcesForLearningSequence(versions, { taskRole: 'training' })
      : [...versions];
    const material = materialsById.get(plan.materialId);
    const projections = orderedVersions.map((version) => {
      const task = taskByVersionId.get(version.resourceVersionId);
      return projectLegacyTaskLoadSemantics({
        version,
        observationTaskPlanId: task?.observationTaskPlanId,
        sourceAnchorIds: task?.sourceAnchorIds,
        textLoadAudit: textAuditByVersionId.get(version.resourceVersionId),
      });
    });
    const strategy = resolveSequenceStrategy(orderedVersions);
    const sequenceReason = resolveSequenceReason(orderedVersions);
    return auditReadingTaskGroupProgression({
      materialId: plan.materialId,
      materialVersionId: plan.materialVersionId,
      materialTitle: material?.title || plan.materialId,
      usageType: material?.usageType === 'targeted_excerpt'
        ? 'targeted_excerpt'
        : 'core_reading',
      strategy,
      sequenceReason,
      projections,
    });
  }).sort((left, right) => left.materialTitle.localeCompare(right.materialTitle, 'zh-CN'));

  const findingBreakdown = zeroRecord(PROGRESSION_AUDIT_FINDING_CODES);
  groups.forEach((group) => group.findings.forEach((item) => {
    findingBreakdown[item.code] += 1;
  }));
  const projections = groups.flatMap((group) => group.projections);
  const activeMaterials = snapshot.data.questionResources.materials
    .filter((material) => material.status !== 'retired');
  const activeCoreMaterials = activeMaterials.filter((material) => (
    (material.usageType || 'core_reading') === 'core_reading'
  )).length;
  const reportWithoutDigest = {
    schemaVersion: READING_TRAINING_PROGRESSIVE_LOAD_STAGE0_AUDIT_VERSION,
    policyVersion: READING_TRAINING_PROGRESSIVE_LOAD_POLICY_VERSION,
    storeRevision: snapshot.revision,
    storeUpdatedAt: snapshot.updatedAt,
    counts: {
      activeMaterials: activeMaterials.length,
      activeCoreMaterials,
      activeTargetedExcerptMaterials: activeMaterials.length - activeCoreMaterials,
      activeFormalQuestions: baseline.counts.currentFormalVersions,
      projectedQuestions: projections.length,
      completeProjections: projections.filter((item) => item.completeness === 'complete').length,
      partialProjections: projections.filter((item) => item.completeness === 'partial').length,
      insufficientProjections: projections.filter((item) => item.completeness === 'insufficient').length,
      coreTaskGroups: groups.filter((item) => item.usageType === 'core_reading').length,
      targetedExcerptGroups: groups.filter((item) => item.usageType === 'targeted_excerpt').length,
      traceableGroups: groups.filter((item) => item.breakPointObservability === 'traceable').length,
      partialGroups: groups.filter((item) => item.breakPointObservability === 'partial').length,
      notAssessableGroups: groups.filter((item) => item.breakPointObservability === 'not_assessable').length,
    },
    findingBreakdown,
    groups,
    issues: [...new Set(issues)].sort(),
    limitations: [
      '阶段 0 仅生成 legacy_projection，不写回 Observation Plan、TrainingTask 或正式资源。',
      'breakPointObservability 只表示题组结构是否支持未来归因，不形成学生能力结论。',
      '低置信度与跨观察线程任务不得用于推断学生从哪一层开始失稳。',
      'Targeted Excerpt 按单次具体动作审计，不要求形成完整核心题组梯度。',
    ],
    sourceDigest: baseline.baselineDigest,
  };
  return {
    ...reportWithoutDigest,
    auditDigest: hashValue(reportWithoutDigest),
  };
}

export function renderReadingTrainingProgressionStage0Markdown(
  report: ReadingTrainingProgressionStage0Report,
): string {
  const groupRows = report.groups.map((group) => (
    `| ${group.materialTitle} | ${group.projections.length} | ${group.projections.map((item) => item.sequenceRole).join(' → ') || '无'} | ${group.breakPointObservability} | ${group.findings.map((item) => item.code).join('、') || '无'} |`
  ));
  return [
    '# 阅读训练递进负担模型阶段 0 真实题库只读审计报告',
    '',
    `状态：\`READ-ONLY / ${report.issues.length === 0 ? 'PASSED' : 'WITH LEGACY ISSUES'}\``,
    '',
    `Store Revision：\`${report.storeRevision}\``,
    '',
    `Source Digest：\`${report.sourceDigest}\``,
    '',
    `Audit Digest：\`${report.auditDigest}\``,
    '',
    '## 一、覆盖口径',
    '',
    `- 活动材料：${report.counts.activeMaterials}`,
    `- 活动正式题：${report.counts.activeFormalQuestions}`,
    `- 已投影正式题：${report.counts.projectedQuestions}`,
    `- 完整 / 部分 / 不足投影：${report.counts.completeProjections} / ${report.counts.partialProjections} / ${report.counts.insufficientProjections}`,
    `- 核心题组 / 针对性短片段：${report.counts.coreTaskGroups} / ${report.counts.targetedExcerptGroups}`,
    '',
    '## 二、结构可解释性',
    '',
    `- 可追踪：${report.counts.traceableGroups}`,
    `- 部分可追踪：${report.counts.partialGroups}`,
    `- 当前不可评估：${report.counts.notAssessableGroups}`,
    '',
    '## 三、Finding 汇总',
    '',
    ...Object.entries(report.findingBreakdown).map(([code, count]) => `- ${code}：${count}`),
    '',
    '## 四、题组审计',
    '',
    '| 材料 | 题数 | Learning 实际负担顺序 | 失稳点可解释性 | Finding |',
    '| --- | ---: | --- | --- | --- |',
    ...groupRows,
    '',
    '## 五、迁移限制',
    '',
    ...report.limitations.map((item) => `- ${item}`),
    '',
    '## 六、现有数据问题',
    '',
    ...(report.issues.length > 0 ? report.issues.map((item) => `- ${item}`) : ['- 无。']),
    '',
    '## 七、只读结论',
    '',
    '本报告没有修改 Frozen Resource、Registry、Observation Link、Learning Session、Attempt、Diagnosis、Evidence 或 Student Ability Profile。Finding 仅用于阶段 1 之后的模型设计和 successor Candidate 治理排序。',
    '',
  ].join('\n');
}

function selectCurrentPlans(snapshot: SharedFormalResourceSnapshot): MaterialObservationPlan[] {
  const materialIds = new Set(snapshot.data.questionResources.materials
    .filter((material) => material.status !== 'retired')
    .map((material) => material.materialId));
  return [...materialIds].map((materialId) => (
    [...snapshot.data.materialObservations.plans]
      .filter((plan) => plan.materialId === materialId && plan.status === 'reviewed')
      .sort((left, right) => (
        right.revision - left.revision || right.updatedAt.localeCompare(left.updatedAt)
      ))[0]
  )).filter((plan): plan is MaterialObservationPlan => Boolean(plan));
}

function resolveSequenceStrategy(
  versions: FrozenQuestionResourceVersion[],
): TrainingTaskSequenceStrategy {
  const explicit = versions.map((version) => tagValue(version.tags, 'sequence-strategy'))
    .find(isTrainingTaskSequenceStrategy);
  if (explicit) return explicit;
  if (versions.some((version) => version.abilityMetadata.taskRole !== 'training')) {
    return 'role_driven';
  }
  return 'entry_first';
}

function resolveSequenceReason(
  versions: FrozenQuestionResourceVersion[],
): TrainingTaskSequenceReason | undefined {
  return versions.map((version) => tagValue(version.tags, 'sequence-reason'))
    .find(isTrainingTaskSequenceReason);
}

function tagValue(tags: string[], prefix: string): string | undefined {
  return tags.find((tag) => tag.startsWith(`${prefix}:`))?.slice(prefix.length + 1);
}

function zeroRecord<T extends readonly string[]>(keys: T): Record<T[number], number> {
  return Object.fromEntries(keys.map((key) => [key, 0])) as Record<T[number], number>;
}

function hashValue(value: unknown): string {
  const serialized = JSON.stringify(normalize(value));
  let hash = 0x811c9dc5;
  for (let index = 0; index < serialized.length; index += 1) {
    hash ^= serialized.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return `fnv1a-${(hash >>> 0).toString(16).padStart(8, '0')}`;
}

function normalize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(normalize);
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(Object.entries(value)
    .filter(([, child]) => child !== undefined)
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, child]) => [key, normalize(child)]));
}
