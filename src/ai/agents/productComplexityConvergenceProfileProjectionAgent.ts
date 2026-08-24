import {
  isStudentAbilityProfile,
  type AbilityStatus,
  type AbilityStatusItem,
  type StudentAbilityProfile,
} from '../schemas/studentAbilityProfile.schema.ts';
import {
  PRODUCT_COMPLEXITY_CONVERGENCE_STAGE3_SCHEMA_VERSION,
  buildCoreAbilitySummaryProjectionId,
  isCoreAbilitySummary,
  type CoreAbilitySummary,
  type CoreAbilitySummaryStatus,
} from '../schemas/productComplexityConvergenceFeedbackProjection.schema.ts';

const INTERNAL_LANGUAGE = /\b(?:Diagnosis|Evidence|Profile|Policy|Hash|Confidence|Scheduler|Pipeline)\b|正式诊断|证据准入|画像管线|置信度|策略版本|调度器|内部代码/i;

export function projectCoreAbilitySummaries(
  profile: StudentAbilityProfile,
): CoreAbilitySummary[] {
  if (!isStudentAbilityProfile(profile)) return [];
  return profile.ability_status
    .map((item) => projectItem(profile, item))
    .filter((item): item is CoreAbilitySummary => Boolean(item && isCoreAbilitySummary(item)));
}

function projectItem(
  profile: StudentAbilityProfile,
  item: AbilityStatusItem,
): CoreAbilitySummary | undefined {
  const evidenceLinks = item.evidence_links.filter((link) => (
    link.ability === item.ability
    && link.evidenceId.trim().length > 0
    && link.observation.trim().length > 0
  ));
  if (evidenceLinks.length === 0) return undefined;
  const summary = safeSummary(item.summary)
    || safeSummary(profile.improvement_signals.find((signal) => signal.ability === item.ability)?.signal);
  if (!summary) return undefined;
  const result: CoreAbilitySummary = {
    schemaVersion: PRODUCT_COMPLEXITY_CONVERGENCE_STAGE3_SCHEMA_VERSION,
    projectionId: buildCoreAbilitySummaryProjectionId({
      studentId: profile.studentId,
      abilityId: item.ability,
      sourceProfileGeneratedAt: profile.generatedAt,
    }),
    persistenceRole: 'profile_read_model',
    studentId: profile.studentId,
    sourceProfileGeneratedAt: profile.generatedAt,
    abilityId: item.ability,
    status: mapStatus(item.status),
    confidence: item.status === 'insufficient_evidence' || evidenceLinks.length === 1 ? 'low' : 'medium',
    recentEvidenceSummary: summary,
    lastUpdatedAt: profile.generatedAt,
    sourceEvidenceCount: evidenceLinks.length,
    validation: {
      passed: true,
      sourceProfileValid: true,
      noNewAbilityInference: true,
      noUnsupportedPrecision: true,
      issues: [],
    },
  };
  return result;
}

function mapStatus(status: AbilityStatus): CoreAbilitySummaryStatus {
  if (status === 'stable_positive') return 'stable';
  if (status === 'improving') return 'developing';
  if (status === 'weak') return 'needs_attention';
  return 'uncertain';
}

function safeSummary(value?: string): string | undefined {
  const text = value?.trim().replace(/\s+/g, ' ');
  if (!text || INTERNAL_LANGUAGE.test(text)) return undefined;
  return text;
}
