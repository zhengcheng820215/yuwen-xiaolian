import type { KnowledgeQuestion } from '../questions/knowledgeQuestionTypes.ts';
import type { ProgressionRules, ReviewedProgressionQuestion } from './knowledgePointProgression.ts';

export type ProgressionQuestionReview = ReviewedProgressionQuestion & {
  role: 'independent' | 'reinforcement' | 'transfer' | 'probe';
  independenceReviewed: boolean;
};

export type ProgressionContentManifest = {
  knowledgePointId: string;
  knowledgePointLabel: string;
  category: string;
  mappingVersion: string;
  ruleVersion: string;
  reviewStatus: 'pending' | 'approved';
  reviewedBy?: string;
  reviewedAt?: string;
  bands: { band: number; cognitiveDemand: string; transitionFromPrevious?: string }[];
  questions: ProgressionQuestionReview[];
  reinforcementPairs: [string, string][];
};

export type ProgressionReadinessIssue = {
  code: string;
  detail: string;
};

export type ProgressionContentReadiness = {
  ready: boolean;
  rules: ProgressionRules;
  eligibleQuestions: ReviewedProgressionQuestion[];
  protectedQuestionIds: string[];
  issues: ProgressionReadinessIssue[];
};

/** Structural admission only. Human reviewers must still judge cognitive demand and answer leakage. */
export function auditProgressionContent(
  manifest: ProgressionContentManifest,
  bank: KnowledgeQuestion[],
): ProgressionContentReadiness {
  const issues: ProgressionReadinessIssue[] = [];
  const add = (code: string, detail: string): void => { issues.push({ code, detail }); };
  const byId = new Map(bank.map((question) => [question.id, question]));
  const bands = [...new Set(manifest.bands.map((entry) => entry.band))].sort((a, b) => a - b);
  if (!manifest.knowledgePointId || !manifest.knowledgePointLabel || !manifest.category
    || !manifest.mappingVersion || !manifest.ruleVersion) add('mapping_incomplete', manifest.knowledgePointId);
  if (manifest.reviewStatus !== 'approved' || !manifest.reviewedBy || !manifest.reviewedAt
    || !Number.isFinite(Date.parse(manifest.reviewedAt))) add('review_pending', manifest.knowledgePointId);
  if (bands.length !== manifest.bands.length || bands.length < 2
    || bands.some((band, index) => !Number.isInteger(band) || band < 1 || (index > 0 && band !== bands[index - 1] + 1))) {
    add('bands_not_adjacent', manifest.knowledgePointId);
  }
  for (const [index, entry] of manifest.bands.entries()) {
    if (!entry.cognitiveDemand.trim() || (index > 0 && !entry.transitionFromPrevious?.trim())) {
      add('band_rationale_missing', String(entry.band));
    }
  }

  const seenIds = new Set<string>();
  for (const item of manifest.questions) {
    if (seenIds.has(item.id)) add('question_review_duplicate', item.id);
    seenIds.add(item.id);
    const bankQuestion = byId.get(item.id);
    if (!bankQuestion || bankQuestion.contentStatus !== 'approved'
      || bankQuestion.contentVersion !== item.contentVersion
      || bankQuestion.category !== manifest.category
      || bankQuestion.knowledgePoint !== manifest.knowledgePointLabel
      || item.knowledgePointId !== manifest.knowledgePointId
      || item.category !== manifest.category
      || !item.approved || !bands.includes(item.band)
      || bankQuestion.variantGroupId !== item.variantGroupId) {
      add('question_not_matching_approved_bank', item.id);
    }
    if (!item.independenceReviewed) add('independence_review_missing', item.id);
    if (item.role === 'independent' && !item.independentEligible) add('independent_role_ineligible', item.id);
    if (item.role === 'reinforcement' && item.independentEligible) add('reinforcement_marked_independent', item.id);
  }

  for (const band of bands) {
    const independent = manifest.questions.filter((item) => item.band === band && item.role === 'independent'
      && item.independentEligible && item.independenceReviewed);
    const independentGroups = new Set(independent.map((item) => item.variantGroupId || item.id));
    if (independentGroups.size < 3) add('independent_pool_too_small', String(band));
    if (!independent.some((item) => item.retentionEligible)) add('retention_item_missing', String(band));
  }
  const byReviewedId = new Map(manifest.questions.map((item) => [item.id, item]));
  const hasValidPair = manifest.reinforcementPairs.some(([sourceId, variantId]) => {
    const source = byReviewedId.get(sourceId);
    const variant = byReviewedId.get(variantId);
    return source && variant && source.id !== variant.id && source.band === variant.band
      && source.variantGroupId && source.variantGroupId === variant.variantGroupId
      && variant.role === 'reinforcement' && !variant.independentEligible;
  });
  if (!hasValidPair) add('reinforcement_pair_missing', manifest.knowledgePointId);
  if (!manifest.questions.some((item) => item.role === 'transfer' && item.independenceReviewed)) {
    add('transfer_item_missing', manifest.knowledgePointId);
  }

  const ready = issues.length === 0;
  return {
    ready,
    rules: {
      knowledgePointId: manifest.knowledgePointId,
      category: manifest.category,
      availableBands: bands,
      contentApprovedForProgression: ready,
      mappingVersion: manifest.mappingVersion,
      ruleVersion: manifest.ruleVersion,
    },
    eligibleQuestions: ready ? manifest.questions.filter((item) => item.role === 'independent') : [],
    protectedQuestionIds: ready ? manifest.questions.map((item) => item.id) : [],
    issues,
  };
}
