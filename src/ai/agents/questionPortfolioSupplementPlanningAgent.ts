import type { SharedFormalResourceSnapshot } from
  '../schemas/sharedFormalResourcePersistence.schema.ts';
import type { PrimaryAbilityId, QuestionResourceDifficulty } from
  '../schemas/questionResourceAdmission.schema.ts';
import { evaluateQuestionGenerationQuality } from
  './questionGenerationQualityPolicyAgent.ts';
import { buildQuestionOptimizationBaseline } from
  './questionOptimizationBaselineAgent.ts';

export const QUESTION_PORTFOLIO_SUPPLEMENT_PLAN_VERSION =
  'question-portfolio-supplement-p2-01-v1';
export const QUESTION_PORTFOLIO_SUPPLEMENT_PUBLICATION_MARKER =
  'portfolio-supplement:p2-03-v1';

export type QuestionPortfolioSupplementTarget = {
  materialId: string;
  materialVersionId: string;
  materialTitle: string;
  currentQuestionCount: number;
  currentAbilityBreakdown: Record<string, number>;
  currentDifficultyBreakdown: Record<string, number>;
  targetAbilityId: PrimaryAbilityId;
  targetDifficulty: QuestionResourceDifficulty;
  observationFocus: string;
  evidenceBoundary: string;
  planningReason: string;
};

export type QuestionPortfolioSupplementPlan = {
  planVersion: typeof QUESTION_PORTFOLIO_SUPPLEMENT_PLAN_VERSION;
  baselineDigest: string;
  baselineQuestionCount: number;
  maximumSupplementCount: 4;
  projectedMaximumQuestionCount: number;
  targets: QuestionPortfolioSupplementTarget[];
  satisfiedMaterialTitles: string[];
  deferredMaterialTitles: string[];
  issues: string[];
};

const FIRST_BATCH_SCOPE: Record<string, Pick<QuestionPortfolioSupplementTarget,
  'targetAbilityId' | 'targetDifficulty' | 'observationFocus' | 'evidenceBoundary' | 'planningReason'>> = {
  '《皇帝的新装》': {
    targetAbilityId: 'comprehension',
    targetDifficulty: 'basic',
    observationFocus: '辨认骗局被揭露前后关键人物的可见言行与事实关系',
    evidenceBoundary: '从织布、看布到游行揭露的情节中选取明确事实，不要求分析社会主题',
    planningReason: '当前3题全部为分析题；材料具有清晰情节事实，适合补充基础理解。',
  },
  '《秋天的怀念》': {
    targetAbilityId: 'summarization',
    targetDifficulty: 'basic',
    observationFocus: '梳理母亲照顾并鼓励“我”的具体行为及直接结果',
    evidenceBoundary: '只概括文中明确行动和结果，不要求分析象征、结构作用或深层含义',
    planningReason: '当前3题全部为分析题；人物行动线能够支持事实概括。',
  },
  '《散步》': {
    targetAbilityId: 'comprehension',
    targetDifficulty: 'basic',
    observationFocus: '确认散步过程中出现的分歧、人物选择与最终解决结果',
    evidenceBoundary: '依据分歧发生到一家人继续前行的直接叙述，不扩展家庭责任主题',
    planningReason: '当前为2道分析和1道推断题，缺少对核心事件的基础理解观察。',
  },
  '《狼》': {
    targetAbilityId: 'summarization',
    targetDifficulty: 'basic',
    observationFocus: '按顺序概括屠户从退让、防守到反击获胜的关键行动',
    evidenceBoundary: '聚焦屠户行动链，不重复现有“两只狼如何配合围困”的证据对象',
    planningReason: '现有理解题聚焦狼的行为；补充屠户行动线可形成不同观察价值。',
  },
};

const DEFERRED_SCOPE = [
  '《从百草园到三味书屋》',
  '《走一步，再走一步》',
  '《女娲造人》',
  '《天上的街市》',
];

export function buildQuestionPortfolioSupplementPlan(
  snapshot: SharedFormalResourceSnapshot,
): QuestionPortfolioSupplementPlan {
  const baseline = buildQuestionOptimizationBaseline(snapshot);
  const versionById = new Map(snapshot.data.questionResources.versions.map((version) => (
    [version.resourceVersionId, version]
  )));
  const issues = [...baseline.issues];
  const satisfiedMaterialTitles = Object.keys(FIRST_BATCH_SCOPE).filter((materialTitle) => (
    baseline.items.some((item) => item.materialTitle === materialTitle
      && versionById.get(item.resourceVersionId)?.tags.includes(
        QUESTION_PORTFOLIO_SUPPLEMENT_PUBLICATION_MARKER,
      ))
  ));
  const targets = Object.entries(FIRST_BATCH_SCOPE).map(([materialTitle, scope]) => {
    if (satisfiedMaterialTitles.includes(materialTitle)) return null;
    const items = baseline.items.filter((item) => item.materialTitle === materialTitle);
    if (!items.length) {
      issues.push(`p2_01_target_material_missing:${materialTitle}`);
      return null;
    }
    const versions = items.map((item) => versionById.get(item.resourceVersionId)).filter(Boolean);
    if (versions.length !== items.length) {
      issues.push(`p2_01_target_version_missing:${materialTitle}`);
    }
    const blocked = versions.filter((version) => version && evaluateQuestionGenerationQuality({
      candidate: version,
      peerQuestions: versions.filter((peer) => peer && peer !== version),
      includePortfolioGuidance: false,
    }).status === 'blocked');
    if (blocked.length) issues.push(`p2_01_target_has_blocked_question:${materialTitle}`);
    const abilities = countBy(versions.map((version) => version!.abilityMetadata.abilityId));
    const difficulties = countBy(versions.map((version) => version!.abilityMetadata.difficulty));
    if (difficulties.basic) issues.push(`p2_01_target_already_has_basic_question:${materialTitle}`);
    return {
      materialId: items[0].materialId,
      materialVersionId: items[0].materialVersionId,
      materialTitle,
      currentQuestionCount: items.length,
      currentAbilityBreakdown: abilities,
      currentDifficultyBreakdown: difficulties,
      ...scope,
    } satisfies QuestionPortfolioSupplementTarget;
  }).filter((item): item is QuestionPortfolioSupplementTarget => Boolean(item));
  if (targets.length > 4) issues.push('p2_01_supplement_limit_exceeded');
  if (new Set(targets.map((item) => item.observationFocus)).size !== targets.length) {
    issues.push('p2_01_observation_focus_duplicated');
  }
  return {
    planVersion: QUESTION_PORTFOLIO_SUPPLEMENT_PLAN_VERSION,
    baselineDigest: baseline.baselineDigest,
    baselineQuestionCount: baseline.counts.currentFormalVersions,
    maximumSupplementCount: 4,
    projectedMaximumQuestionCount: baseline.counts.currentFormalVersions + targets.length,
    targets,
    satisfiedMaterialTitles,
    deferredMaterialTitles: [...DEFERRED_SCOPE],
    issues,
  };
}

function countBy(values: string[]): Record<string, number> {
  return values.reduce<Record<string, number>>((result, value) => {
    result[value] = (result[value] || 0) + 1;
    return result;
  }, {});
}
