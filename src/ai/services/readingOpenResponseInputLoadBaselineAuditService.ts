import { analyzeReadingOpenResponseInputLoad, countSemanticCharacters } from
  '../agents/readingOpenResponseInputLoadAnalyzer.ts';
import { auditReadingOpenResponseTaskGroup } from
  '../agents/readingOpenResponseTaskGroupLoadAuditAgent.ts';
import { buildQuestionOptimizationBaseline } from
  '../agents/questionOptimizationBaselineAgent.ts';
import {
  TEXT_RESPONSE_LOAD_DISPOSITIONS,
  TEXT_RESPONSE_LOAD_FINDING_CODES,
  TEXT_RESPONSE_LOAD_LEVELS,
  isTextResponseFormat,
  type TextResponseLoadAnalysisCompleteness,
  type TextResponseLoadAuditResult,
  type TextResponseLoadDisposition,
  type TextResponseLoadFindingCode,
  type TextResponseLoadLevel,
  type TextResponseTaskGroupItem,
  type TextResponseTaskGroupLoadAudit,
} from '../schemas/readingOpenResponseInputLoad.schema.ts';
import type {
  FrozenQuestionResourceVersion,
  QuestionMaterialVersion,
  TextMinimumAnswerRequirement,
} from '../schemas/questionResourceAdmission.schema.ts';
import type {
  MaterialObservationPlan,
  ObservationTaskPlan,
} from '../schemas/materialObservation.schema.ts';
import {
  isTrainingTaskSequenceReason,
  type TrainingTaskSequenceReason,
} from '../schemas/trainingTaskSequencePlanning.schema.ts';
import { orderFormalResourcesForLearningSequence } from
  '../agents/learningTaskSequenceScheduler.ts';
import type { SharedFormalResourceSnapshot } from
  '../schemas/sharedFormalResourcePersistence.schema.ts';

export const READING_OPEN_RESPONSE_STAGE1_BASELINE_AUDIT_VERSION =
  'reading_open_response_stage1_baseline_audit_v1' as const;

export type ReadingOpenResponseInputLoadBaselineReport = {
  schemaVersion: typeof READING_OPEN_RESPONSE_STAGE1_BASELINE_AUDIT_VERSION;
  storeRevision: number;
  storeUpdatedAt: string;
  counts: {
    activeMaterials: number;
    activeCoreMaterials: number;
    activeTargetedExcerptMaterials: number;
    activeFormalQuestions: number;
    coreFormalQuestions: number;
    targetedExcerptFormalQuestions: number;
    textQuestions: number;
    singleChoiceQuestions: number;
    completeAnalyses: number;
    partialAnalyses: number;
    insufficientInputAnalyses: number;
    taskGroups: number;
  };
  levelDistribution: Record<TextResponseLoadLevel, number>;
  dispositionBreakdown: Record<TextResponseLoadDisposition, number>;
  findingBreakdown: Record<TextResponseLoadFindingCode, number>;
  sequenceFindingBreakdown: Record<TextResponseLoadFindingCode, number>;
  questionResults: TextResponseLoadAuditResult[];
  taskGroups: TextResponseTaskGroupLoadAudit[];
  issues: string[];
  sourceDigest: string;
  auditDigest: string;
};

export function buildReadingOpenResponseInputLoadBaselineAudit(
  snapshot: SharedFormalResourceSnapshot,
): ReadingOpenResponseInputLoadBaselineReport {
  const baseline = buildQuestionOptimizationBaseline(snapshot);
  const versionsById = new Map(snapshot.data.questionResources.versions.map((version) => (
    [version.resourceVersionId, version]
  )));
  const materialsById = new Map(snapshot.data.questionResources.materials.map((material) => (
    [material.materialId, material]
  )));
  const anchorsById = new Map(snapshot.data.materialObservations.anchors.map((anchor) => (
    [anchor.sourceAnchorId, anchor]
  )));
  const currentPlans = selectCurrentPlans(snapshot);
  const baselineItemsByTaskId = new Map(baseline.items.map((item) => (
    [item.observationTaskPlanId, item]
  )));
  const issues = [...baseline.issues];
  const questionResults: TextResponseLoadAuditResult[] = [];
  const taskGroups: TextResponseTaskGroupLoadAudit[] = [];

  for (const plan of currentPlans) {
    const groupTasks: TextResponseTaskGroupItem[] = [];
    const groupVersions: FrozenQuestionResourceVersion[] = [];
    let sequenceReason: TrainingTaskSequenceReason | undefined;
    for (const [taskIndex, task] of plan.taskPlans
      .filter((item) => item.status !== 'cancelled')
      .entries()) {
      const baselineItem = baselineItemsByTaskId.get(task.observationTaskPlanId);
      if (!baselineItem) {
        issues.push(`stage1_audit_missing_baseline_item:${task.observationTaskPlanId}`);
        continue;
      }
      const version = versionsById.get(baselineItem.resourceVersionId);
      if (!version) {
        issues.push(`stage1_audit_missing_version:${baselineItem.resourceVersionId}`);
        continue;
      }
      const rank = sequenceRank(version.tags) || taskIndex + 1;
      sequenceReason = sequenceReason || readSequenceReason(version.tags);
      const item: TextResponseTaskGroupItem = {
        questionVersionId: version.resourceVersionId,
        responseFormat: version.responseFormat,
        taskRole: version.abilityMetadata.taskRole,
        sourceAnchorIds: [...task.sourceAnchorIds],
        sequenceRank: rank,
      };
      groupVersions.push(version);
      if (isTextResponseFormat(version.responseFormat)) {
        const requirement = asTextMinimumAnswerRequirement(version);
        if (!requirement) {
          issues.push(`stage1_audit_invalid_text_requirement:${version.resourceVersionId}`);
        } else {
          const material = materialsById.get(plan.materialId);
          const result = analyzeReadingOpenResponseInputLoad({
            questionVersionId: version.resourceVersionId,
            materialVersionId: version.materialVersionId,
            title: version.title,
            questionStem: version.questionStem,
            responseFormat: version.responseFormat,
            rubric: version.rubric,
            minimumAnswerRequirement: requirement,
            abilityMetadata: version.abilityMetadata,
            expectedStudentAction: task.expectedStudentAction,
            sourceAnchorIds: task.sourceAnchorIds,
            sourceEvidenceCharacterCount: sourceEvidenceCharacterCount(
              task,
              material,
              anchorsById,
            ),
            tags: version.tags,
          });
          if (result) {
            item.auditResult = result;
            questionResults.push(result);
          }
        }
      }
      groupTasks.push(item);
    }
    const effectiveRankByQuestionVersionId = resolveEffectiveLearningRanks(groupVersions);
    taskGroups.push(auditReadingOpenResponseTaskGroup({
      materialVersionId: plan.materialVersionId,
      // Sequence governance must audit what a new Learning Session will
      // actually consume, not the historical insertion order of the plan.
      tasks: groupTasks.map((task) => ({
        ...task,
        sequenceRank: effectiveRankByQuestionVersionId.get(task.questionVersionId)
          ?? task.sequenceRank,
      })),
      sequenceReason,
    }));
  }

  const levelDistribution = zeroRecord(TEXT_RESPONSE_LOAD_LEVELS);
  const dispositionBreakdown = zeroRecord(TEXT_RESPONSE_LOAD_DISPOSITIONS);
  const findingBreakdown = zeroRecord(TEXT_RESPONSE_LOAD_FINDING_CODES);
  const sequenceFindingBreakdown = zeroRecord(TEXT_RESPONSE_LOAD_FINDING_CODES);
  const completenessBreakdown: Record<TextResponseLoadAnalysisCompleteness, number> = {
    complete: 0,
    partial: 0,
    insufficient_input: 0,
  };

  questionResults.forEach((result) => {
    completenessBreakdown[result.analysisCompleteness] += 1;
    dispositionBreakdown[result.disposition] += 1;
    if (result.profile) levelDistribution[result.profile.loadLevel] += 1;
    result.findings.forEach((finding) => { findingBreakdown[finding.code] += 1; });
  });
  taskGroups.forEach((group) => {
    group.sequenceFindings.forEach((finding) => {
      sequenceFindingBreakdown[finding.code] += 1;
    });
  });

  const sortedQuestionResults = [...questionResults]
    .sort((left, right) => left.questionVersionId.localeCompare(right.questionVersionId));
  const sortedGroups = [...taskGroups]
    .sort((left, right) => left.materialVersionId.localeCompare(right.materialVersionId));
  const activeFormalQuestions = baseline.counts.currentFormalVersions;
  const singleChoiceQuestions = activeFormalQuestions - sortedQuestionResults.length;
  const activeMaterials = snapshot.data.questionResources.materials
    .filter((material) => material.status !== 'retired');
  const activeCoreMaterials = activeMaterials
    .filter((material) => (material.usageType || 'core_reading') === 'core_reading').length;
  const activeTargetedExcerptMaterials = activeMaterials
    .filter((material) => material.usageType === 'targeted_excerpt').length;
  const usageByMaterialVersionId = new Map(activeMaterials.map((material) => (
    [material.materialVersionId, material.usageType || 'core_reading']
  )));
  const coreFormalQuestions = baseline.items.filter((item) => (
    usageByMaterialVersionId.get(item.materialVersionId) === 'core_reading'
  )).length;
  const targetedExcerptFormalQuestions = baseline.items.filter((item) => (
    usageByMaterialVersionId.get(item.materialVersionId) === 'targeted_excerpt'
  )).length;
  const reportWithoutDigest = {
    schemaVersion: READING_OPEN_RESPONSE_STAGE1_BASELINE_AUDIT_VERSION,
    storeRevision: snapshot.revision,
    storeUpdatedAt: snapshot.updatedAt,
    counts: {
      activeMaterials: baseline.counts.activeMaterials,
      activeCoreMaterials,
      activeTargetedExcerptMaterials,
      activeFormalQuestions,
      coreFormalQuestions,
      targetedExcerptFormalQuestions,
      textQuestions: sortedQuestionResults.length,
      singleChoiceQuestions,
      completeAnalyses: completenessBreakdown.complete,
      partialAnalyses: completenessBreakdown.partial,
      insufficientInputAnalyses: completenessBreakdown.insufficient_input,
      taskGroups: sortedGroups.length,
    },
    levelDistribution,
    dispositionBreakdown,
    findingBreakdown,
    sequenceFindingBreakdown,
    questionResults: sortedQuestionResults,
    taskGroups: sortedGroups,
    issues: [...new Set(issues)].sort(),
    sourceDigest: baseline.baselineDigest,
  };
  return {
    ...reportWithoutDigest,
    auditDigest: hashValue(reportWithoutDigest),
  };
}

function resolveEffectiveLearningRanks(
  versions: FrozenQuestionResourceVersion[],
): Map<string, number> {
  const ordered = versions.length > 0 && versions.every((version) => (
    version.abilityMetadata.taskRole === 'training'
  ))
    ? orderFormalResourcesForLearningSequence(versions, { taskRole: 'training' })
    : versions;
  return new Map(ordered.map((version, index) => [version.resourceVersionId, index + 1]));
}

export function renderReadingOpenResponseInputLoadBaselineMarkdown(
  report: ReadingOpenResponseInputLoadBaselineReport,
): string {
  const rows = report.questionResults.map((result) => (
    `| ${result.questionVersionId} | ${result.profile?.loadLevel || '无法完整分析'} | ${result.disposition} | ${result.findings.map((finding) => finding.code).join('、') || '无'} |`
  ));
  return [
    '# 阅读开放文本题输入负担阶段 1 基线审计报告',
    '',
    `状态：\`READ-ONLY BASELINE / ${report.issues.length === 0 ? 'PASSED' : 'WITH ISSUES'}\``,
    '',
    `Store Revision：\`${report.storeRevision}\``,
    '',
    `Source Digest：\`${report.sourceDigest}\``,
    '',
    `Audit Digest：\`${report.auditDigest}\``,
    '',
    '## 一、资源口径',
    '',
    `- 活动材料：${report.counts.activeMaterials}`,
    `  - 核心阅读材料：${report.counts.activeCoreMaterials}`,
    `  - 针对性短片段：${report.counts.activeTargetedExcerptMaterials}`,
    `- 活动正式题：${report.counts.activeFormalQuestions}`,
    `  - 核心阅读正式题：${report.counts.coreFormalQuestions}`,
    `  - 针对性短片段正式题：${report.counts.targetedExcerptFormalQuestions}`,
    `- 开放文本题：${report.counts.textQuestions}`,
    `- 单项选择题：${report.counts.singleChoiceQuestions}`,
    `- 题组：${report.counts.taskGroups}`,
    '',
    '## 二、负担分布',
    '',
    ...Object.entries(report.levelDistribution).map(([level, count]) => `- ${level}：${count}`),
    '',
    '## 三、治理分类',
    '',
    ...Object.entries(report.dispositionBreakdown).map(([key, count]) => `- ${key}：${count}`),
    '',
    '## 四、逐题结果',
    '',
    '| 正式题版本 | 负担等级 | 建议 | Finding |',
    '| --- | --- | --- | --- |',
    ...rows,
    '',
    '## 五、只读边界',
    '',
    '本报告只记录派生分析结果，不修改 Formal Version、Registry、Observation Link、Learning Session、Attempt 或 Student Ability Profile。',
    '',
    '## 六、问题',
    '',
    ...(report.issues.length > 0 ? report.issues.map((issue) => `- ${issue}`) : ['- 无。']),
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
        right.revision - left.revision
        || right.updatedAt.localeCompare(left.updatedAt)
      ))[0]
  )).filter((plan): plan is MaterialObservationPlan => Boolean(plan));
}

function asTextMinimumAnswerRequirement(
  version: FrozenQuestionResourceVersion,
): TextMinimumAnswerRequirement | null {
  const requirement = version.minimumAnswerRequirement;
  if (!('minLength' in requirement)) return null;
  return requirement;
}

function sourceEvidenceCharacterCount(
  task: ObservationTaskPlan,
  material: QuestionMaterialVersion | undefined,
  anchorsById: Map<string, { anchorType: string; excerpt?: string }>,
): number {
  const anchors = task.sourceAnchorIds.map((anchorId) => anchorsById.get(anchorId)).filter(Boolean);
  if (anchors.some((anchor) => anchor?.anchorType === 'full_text')) {
    return countSemanticCharacters(material?.content || '');
  }
  return anchors.reduce((sum, anchor) => (
    sum + countSemanticCharacters(anchor?.excerpt || '')
  ), 0);
}

function sequenceRank(tags: string[]): number | undefined {
  const value = Number(tagValue(tags, 'sequence-rank'));
  return Number.isInteger(value) && value > 0 ? value : undefined;
}

function readSequenceReason(tags: string[]): TrainingTaskSequenceReason | undefined {
  const value = tagValue(tags, 'sequence-reason');
  return isTrainingTaskSequenceReason(value) ? value : undefined;
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
