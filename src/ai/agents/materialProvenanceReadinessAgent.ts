import type {
  QuestionMaterialVersion,
} from '../schemas/questionResourceAdmission.schema.ts';

export const MATERIAL_PROVENANCE_READINESS_POLICY_VERSION =
  'material-provenance-readiness-p1-03-v1';

export type MaterialProvenanceTodoCode =
  | 'catalog_evidence_missing'
  | 'edition_missing'
  | 'text_verification_pending'
  | 'text_verification_rejected'
  | 'rights_evidence_pending'
  | 'rights_restricted'
  | 'verification_actor_missing'
  | 'verification_time_missing';

export type MaterialProvenanceReadinessItem = {
  materialId: string;
  materialVersionId: string;
  title: string;
  catalogEvidenceRecorded: boolean;
  exactTextVerified: boolean;
  rightsResolved: boolean;
  internalPilotEligible: boolean;
  scaleReleaseEligible: boolean;
  todoCodes: MaterialProvenanceTodoCode[];
};

export type MaterialProvenanceReadinessReport = {
  policyVersion: typeof MATERIAL_PROVENANCE_READINESS_POLICY_VERSION;
  materialCount: number;
  catalogEvidenceRecordedCount: number;
  exactTextVerifiedCount: number;
  rightsResolvedCount: number;
  internalPilotEligibleCount: number;
  scaleReleaseEligibleCount: number;
  items: MaterialProvenanceReadinessItem[];
};

export function assessMaterialProvenanceReadiness(
  materials: QuestionMaterialVersion[],
): MaterialProvenanceReadinessReport {
  const items = materials
    .filter((material) => material.status !== 'retired')
    .map(assessMaterial)
    .sort((left, right) => left.title.localeCompare(right.title, 'zh-CN'));
  return {
    policyVersion: MATERIAL_PROVENANCE_READINESS_POLICY_VERSION,
    materialCount: items.length,
    catalogEvidenceRecordedCount: count(items, 'catalogEvidenceRecorded'),
    exactTextVerifiedCount: count(items, 'exactTextVerified'),
    rightsResolvedCount: count(items, 'rightsResolved'),
    internalPilotEligibleCount: count(items, 'internalPilotEligible'),
    scaleReleaseEligibleCount: count(items, 'scaleReleaseEligible'),
    items,
  };
}

function assessMaterial(material: QuestionMaterialVersion): MaterialProvenanceReadinessItem {
  const metadata = material.metadata;
  const review = metadata?.provenanceReview;
  const catalogEvidenceRecorded = Boolean(
    metadata?.curriculumUnit?.trim() && review?.sourceLocator?.trim(),
  );
  const verificationActorRecorded = Boolean(review?.verifiedBy?.trim());
  const verificationTimeRecorded = Boolean(review?.verifiedAt?.trim());
  const exactTextVerified = Boolean(
    review?.textVerificationStatus === 'verified'
    && metadata?.edition?.trim()
    && review.textSourceLocator?.trim()
    && verificationActorRecorded
    && verificationTimeRecorded,
  );
  const rightsResolved = Boolean(
    ['cleared', 'public_domain'].includes(review?.rightsStatus || '')
    && review?.rightsEvidenceLocator?.trim()
    && verificationActorRecorded
    && verificationTimeRecorded,
  );
  const internalPilotEligible = Boolean(
    material.content.trim()
    && catalogEvidenceRecorded
    && review?.textVerificationStatus !== 'rejected'
    && review?.rightsStatus !== 'restricted',
  );
  const scaleReleaseEligible = Boolean(
    metadata?.provenanceStatus === 'verified'
    && exactTextVerified
    && rightsResolved,
  );
  const todoCodes: MaterialProvenanceTodoCode[] = [];
  if (!catalogEvidenceRecorded) todoCodes.push('catalog_evidence_missing');
  if (!metadata?.edition?.trim()) todoCodes.push('edition_missing');
  if (review?.textVerificationStatus === 'rejected') {
    todoCodes.push('text_verification_rejected');
  } else if (!exactTextVerified) {
    todoCodes.push('text_verification_pending');
  }
  if (review?.rightsStatus === 'restricted') {
    todoCodes.push('rights_restricted');
  } else if (!rightsResolved) {
    todoCodes.push('rights_evidence_pending');
  }
  if ((review?.textVerificationStatus === 'verified'
      || ['cleared', 'public_domain'].includes(review?.rightsStatus || ''))
    && !verificationActorRecorded) {
    todoCodes.push('verification_actor_missing');
  }
  if ((review?.textVerificationStatus === 'verified'
      || ['cleared', 'public_domain'].includes(review?.rightsStatus || ''))
    && !verificationTimeRecorded) {
    todoCodes.push('verification_time_missing');
  }
  return {
    materialId: material.materialId,
    materialVersionId: material.materialVersionId,
    title: material.title,
    catalogEvidenceRecorded,
    exactTextVerified,
    rightsResolved,
    internalPilotEligible,
    scaleReleaseEligible,
    todoCodes,
  };
}

function count(
  items: MaterialProvenanceReadinessItem[],
  key: keyof Pick<MaterialProvenanceReadinessItem,
    | 'catalogEvidenceRecorded'
    | 'exactTextVerified'
    | 'rightsResolved'
    | 'internalPilotEligible'
    | 'scaleReleaseEligible'>,
): number {
  return items.filter((item) => item[key]).length;
}
