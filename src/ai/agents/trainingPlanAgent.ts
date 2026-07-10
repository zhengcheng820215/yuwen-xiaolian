import type {
  AbilityEvidenceSummary,
  WeaknessRankingItem,
} from './weaknessRankingAgent.ts';
import {
  normalizeTrainingPlan,
  TRAINING_PLAN_DAY_COUNT,
  type TrainingPlan,
  type TrainingPlanDay,
  type TrainingPlanEvidenceLink,
} from '../schemas/trainingPlan.schema.ts';

export type TrainingPlanInput = {
  studentId: string;
  weaknessRanking: WeaknessRankingItem[];
  evidenceSummary: AbilityEvidenceSummary[];
  generatedAt?: string;
};

export function generateTrainingPlan(input: TrainingPlanInput): TrainingPlan {
  const topWeaknesses = input.weaknessRanking.slice(0, TRAINING_PLAN_DAY_COUNT);
  const primaryTargetAbility = topWeaknesses[0]?.ability || '待训练能力';
  const days = buildTrainingDays(topWeaknesses, input.evidenceSummary);

  return normalizeTrainingPlan({
    student_id: input.studentId,
    generated_at: input.generatedAt,
    primary_target_ability: primaryTargetAbility,
    summary: buildPlanSummary(topWeaknesses),
    days,
  });
}

function buildTrainingDays(
  topWeaknesses: WeaknessRankingItem[],
  evidenceSummary: AbilityEvidenceSummary[],
): TrainingPlanDay[] {
  const fallbackWeakness = topWeaknesses[0];

  return Array.from({ length: TRAINING_PLAN_DAY_COUNT }, (_, index) => {
    const day = index + 1;
    const weakness = topWeaknesses[index] || fallbackWeakness;
    const summary = evidenceSummary.find((item) => item.ability === weakness?.ability);

    return {
      day,
      training_goal: buildTrainingGoal(weakness, day),
      target_ability: weakness?.ability || '待训练能力',
      targetSkill: buildTargetSkill(weakness?.ability, summary),
      strategy: buildTrainingStrategy(summary, day),
      reason_from_evidence: buildReasonFromEvidence(weakness, summary),
      focus_skills: buildFocusSkills(weakness?.ability, weakness?.suggestedTrainingFocus),
      tasks: buildTasks(weakness?.ability, day),
      practice_type: buildPracticeType(day),
      success_criteria: buildSuccessCriteria(weakness?.ability, day),
      successCriteria: {
        measurable: true,
        description: buildMeasurableSuccessCriteria(weakness?.ability, day),
      },
      evidence_links: weakness ? [buildEvidenceLink(weakness)] : [],
    };
  });
}

function buildPlanSummary(topWeaknesses: WeaknessRankingItem[]): string {
  if (topWeaknesses.length === 0) {
    return '当前没有足够的 weakness evidence 生成阶段训练计划。';
  }

  const abilities = topWeaknesses.map((item) => item.ability).join('、');
  return `本阶段优先围绕 ${abilities} 进行 3 天最小训练闭环，首要训练能力为「${topWeaknesses[0].ability}」。`;
}

function buildTrainingGoal(weakness: WeaknessRankingItem | undefined, day: number): string {
  const ability = weakness?.ability || '待训练能力';
  const goals: Record<string, string> = {
    推理: '能够先找文本线索，再写出从线索到结论的完整推理链。',
    表达: '能够用「观点 + 依据 + 说明」组织完整、清楚的答案。',
    信息提取: '能够稳定定位关键词、限定条件和对应文本依据。',
    概括: '能够提取核心事件和主要信息，删除无关细节。',
    理解: '能够结合语境解释词句、人物行为或文本含义。',
    分析: '能够围绕分析对象找依据，并说明依据如何支持结论。',
  };

  return `第 ${day} 天训练目标：${goals[ability] || `围绕「${ability}」完成一次可验证的能力训练。`}`;
}

function buildReasonFromEvidence(
  weakness: WeaknessRankingItem | undefined,
  summary: AbilityEvidenceSummary | undefined,
): string {
  if (!weakness) return '当前 Top Weakness 为空，暂无法形成明确训练理由。';

  const rootCause = summary?.rootCauses[0] || weakness.reasons[0] || '多条 evidence 指向该能力需要优先训练。';
  return `Phase 3.1 显示「${weakness.ability}」有 ${weakness.weaknessCount} 条 weakness evidence，平均置信度 ${formatPercent(weakness.averageConfidence)}；主要依据：${rootCause}`;
}

function buildTargetSkill(
  ability = '',
  summary: AbilityEvidenceSummary | undefined,
): string {
  const reasonText = [
    ...(summary?.reasonTags || []),
    ...(summary?.rootCauses || []),
    ...(summary?.details || []),
  ].join('\n');

  if (ability === '推理') {
    if (/文本依据|线索|missing_skill/.test(reasonText)) return '文本证据 -> 观点推断';
    return '证据 -> 关系 -> 结论的推理链构建';
  }
  if (ability === '表达') return '观点 -> 依据 -> 说明的答案组织';
  if (ability === '信息提取') return '关键词定位与限定条件识别';
  if (ability === '概括') return '核心事件筛选与压缩表达';
  if (ability === '理解') return '语境信息 -> 深层含义转换';
  if (ability === '分析') return '文本依据 -> 作用或原因说明';

  return `${ability || '目标能力'}具体技能`;
}

function buildTrainingStrategy(
  summary: AbilityEvidenceSummary | undefined,
  day: number,
): string {
  const reasonTags = summary?.reasonTags || [];
  const primaryReason = reasonTags[0] || '';
  const rules: Record<string, string> = {
    missing_skill: '基础能力建立：先补齐完成任务所需的关键步骤。',
    incomplete_understanding: '增加理解深度：从表层信息推进到语境和深层含义。',
    reasoning_error: '纠正推理链：训练“证据 -> 关系 -> 结论”的完整过程。',
    expression_issue: '答案组织训练：训练“观点 + 依据 + 说明”的表达结构。',
    knowledge_gap: '知识补充：补齐完成题目所需的语文知识或概念。',
    unstable_performance: '重复验证训练：通过同类和变式任务观察稳定性。',
  };
  const phaseStrategy: Record<number, string> = {
    1: 'Day 1 建立能力：理解方法并拆出关键步骤。',
    2: 'Day 2 强化能力：在同类任务中应用方法。',
    3: 'Day 3 迁移验证：换场景完成变式任务。',
  };

  return `${rules[primaryReason] || '针对薄弱证据选择训练策略。'} ${phaseStrategy[day]}`;
}

function buildFocusSkills(ability = '', suggestedTrainingFocus = ''): string[] {
  const predefined: Record<string, string[]> = {
    推理: ['文本线索提取', '证据到结论的连接', '推理链完整表达'],
    表达: ['观点明确', '补充文本依据', '依据后的说明展开'],
    信息提取: ['关键词定位', '限定条件标注', '对应文本证据提取'],
    概括: ['核心事件筛选', '删除次要细节', '一句话概括'],
    理解: ['语境还原', '词句含义转换', '人物情感判断'],
    分析: ['分析对象确认', '文本依据提取', '作用或原因说明'],
  };

  if (predefined[ability]) return predefined[ability];
  if (suggestedTrainingFocus) return suggestedTrainingFocus.split('+').map((item) => item.trim()).filter(Boolean);
  return [`${ability || '目标能力'}专项训练`];
}

function buildTasks(ability = '', day: number): string[] {
  const commonByDay: Record<number, string> = {
    1: '先复盘一条对应 evidence，指出原答案缺少的关键能力步骤。',
    2: '完成一组同能力短任务，并用固定步骤写出思考过程。',
    3: '完成一组变式任务，检查是否能减少提示并独立完成。',
  };
  const abilityTasks: Record<string, string[]> = {
    推理: ['列出 2-3 条文本线索。', '写出「线索 -> 判断 -> 结论」三步链条。', '检查结论是否超出文本依据。'],
    表达: ['先写一句明确观点。', '补充一条文本依据。', '用一句话说明依据如何支持观点。'],
    信息提取: ['圈出题干关键词。', '标出限定条件。', '从文本中摘出对应依据。'],
    概括: ['划掉无关细节。', '保留人物、事件、结果。', '压缩成一句完整概括。'],
    理解: ['找出相关上下文。', '改写关键句含义。', '说明人物或文本的深层意思。'],
    分析: ['确定分析对象。', '找出支持依据。', '说明依据体现的作用、原因或情感。'],
  };

  return [
    commonByDay[day],
    ...(abilityTasks[ability] || [`完成 1 次「${ability || '目标能力'}」专项练习。`, '写出完成任务时使用的步骤。']),
  ];
}

function buildPracticeType(day: number): string {
  if (day === 1) return 'evidence_review_and_method_building';
  if (day === 2) return 'targeted_short_practice';
  return 'variant_practice_and_minimal_retest';
}

function buildSuccessCriteria(ability = '', day: number): string[] {
  const base = [
    `学生能够说清本次「${ability || '目标能力'}」训练练的是哪一步。`,
    '学生答案中能看到明确的文本依据或思考步骤。',
  ];

  if (day === 1) {
    return [...base, '学生能够指出原 evidence 暴露的问题，并说出修正方法。'];
  }

  if (day === 2) {
    return [...base, '学生能在提示下完成同能力任务，并补足关键步骤。'];
  }

  return [...base, '学生能在较少提示下完成变式任务，形成可进入后续 retest 的表现记录。'];
}

function buildMeasurableSuccessCriteria(ability = '', day: number): string {
  if (day === 1) {
    return `学生能够说出「${ability || '目标能力'}」的关键步骤，并完成一次带提示的修正。`;
  }

  if (day === 2) {
    return `学生能够在同类任务中使用目标技能，答案中出现明确文本依据或思考步骤。`;
  }

  return `学生能够在变式任务中独立使用目标技能，形成可进入复测的作答证据。`;
}

function buildEvidenceLink(weakness: WeaknessRankingItem): TrainingPlanEvidenceLink {
  return {
    ability: weakness.ability,
    weaknessCount: weakness.weaknessCount,
    averageConfidence: weakness.averageConfidence,
    reasons: weakness.reasons,
  };
}

function formatPercent(value: number): string {
  return `${Math.round(value * 100)}%`;
}
