import type {
  AbilityEvidence,
  AbilityEvidenceType,
} from '../schemas/abilityEvidence.schema.ts';

export type AbilityEvidenceSummary = {
  ability: string;
  weaknessCount: number;
  positiveCount: number;
  growthCount: number;
  insufficientCount: number;
  averageConfidence: number;
  rootCauses: string[];
  observations: string[];
};

export type WeaknessRankingItem = {
  ability: string;
  priority: number;
  weaknessCount: number;
  positiveCount: number;
  insufficientCount: number;
  averageConfidence: number;
  reasons: string[];
  suggestedTrainingFocus: string;
};

export function summarizeAbilityEvidence(evidenceList: AbilityEvidence[]): AbilityEvidenceSummary[] {
  const grouped = new Map<string, AbilityEvidence[]>();

  for (const evidence of evidenceList) {
    const group = grouped.get(evidence.ability) || [];
    group.push(evidence);
    grouped.set(evidence.ability, group);
  }

  return [...grouped.entries()]
    .map(([ability, items]) => {
      const confidenceValues = items.map((item) => item.confidence);
      const averageConfidence = confidenceValues.length > 0
        ? confidenceValues.reduce((sum, value) => sum + value, 0) / confidenceValues.length
        : 0;

      return {
        ability,
        weaknessCount: countByType(items, 'weakness'),
        positiveCount: countByType(items, 'positive'),
        growthCount: countByType(items, 'growth'),
        insufficientCount: countByType(items, 'insufficient'),
        averageConfidence,
        rootCauses: unique(items.map((item) => item.rootCause).filter(Boolean) as string[]),
        observations: unique(items.map((item) => item.observation).filter(Boolean)),
      };
    })
    .sort((left, right) => left.ability.localeCompare(right.ability, 'zh-Hans-CN'));
}

export function rankWeaknesses(evidenceList: AbilityEvidence[], limit = 3): WeaknessRankingItem[] {
  return rankWeaknessSummaries(summarizeAbilityEvidence(evidenceList), limit);
}

export function rankWeaknessSummaries(
  summaries: AbilityEvidenceSummary[],
  limit = 3,
): WeaknessRankingItem[] {
  return summaries
    .filter((summary) => summary.weaknessCount > 0)
    .map((summary) => {
      const priority = calculatePriority(summary);
      return {
        ability: summary.ability,
        priority,
        weaknessCount: summary.weaknessCount,
        positiveCount: summary.positiveCount + summary.growthCount,
        insufficientCount: summary.insufficientCount,
        averageConfidence: summary.averageConfidence,
        reasons: buildReasons(summary),
        suggestedTrainingFocus: suggestTrainingFocus(summary),
      };
    })
    .sort((left, right) => {
      if (right.priority !== left.priority) return right.priority - left.priority;
      if (right.weaknessCount !== left.weaknessCount) return right.weaknessCount - left.weaknessCount;
      return right.averageConfidence - left.averageConfidence;
    })
    .slice(0, limit);
}

function countByType(items: AbilityEvidence[], evidenceType: AbilityEvidenceType): number {
  return items.filter((item) => item.evidenceType === evidenceType).length;
}

function calculatePriority(summary: AbilityEvidenceSummary): number {
  return round(
    summary.weaknessCount * 10 +
    summary.averageConfidence * 5 -
    (summary.positiveCount + summary.growthCount) * 3,
  );
}

function buildReasons(summary: AbilityEvidenceSummary): string[] {
  const reasons = [
    `${summary.ability} 出现 ${summary.weaknessCount} 条薄弱证据。`,
  ];

  if (summary.positiveCount > 0 || summary.growthCount > 0) {
    reasons.push(`同时存在 ${summary.positiveCount + summary.growthCount} 条正向或成长证据，说明该能力可能是不稳定而非完全缺失。`);
  }

  for (const rootCause of summary.rootCauses.slice(0, 2)) {
    reasons.push(`重复观察到：${rootCause}`);
  }

  if (summary.insufficientCount > 0) {
    reasons.push(`${summary.insufficientCount} 条证据不足记录不参与薄弱主排序，仅提示需要补充有效作答。`);
  }

  return reasons;
}

function suggestTrainingFocus(summary: AbilityEvidenceSummary): string {
  const rootCauseText = summary.rootCauses.join('\n');

  if (summary.ability === '推理') return '文本线索提取 + 推理链表达训练';
  if (summary.ability === '表达') return '观点 + 依据 + 说明的结构化表达训练';
  if (summary.ability === '概括') return '核心事件提取 + 主要内容概括训练';
  if (summary.ability === '信息提取') return '关键词定位 + 限定条件标注训练';
  if (summary.ability === '理解') return '语境理解 + 深层含义转换训练';
  if (summary.ability === '分析') return '文本依据 + 分析说明训练';

  if (/文本依据|线索/.test(rootCauseText)) return '文本依据提取与组织训练';
  if (/推理链/.test(rootCauseText)) return '推理链表达训练';
  if (/表达|完整/.test(rootCauseText)) return '结构化表达训练';

  return `围绕「${summary.ability}」能力进行针对训练`;
}

function unique(values: string[]): string[] {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))];
}

function round(value: number): number {
  return Math.round(value * 100) / 100;
}
