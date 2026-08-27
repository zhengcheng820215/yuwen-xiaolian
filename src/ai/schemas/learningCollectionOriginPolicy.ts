export const LEARNING_COLLECTION_ORIGIN_POLICY_VERSION =
  'learning_collection_origin_policy_v1' as const;

export type LearningCollectionDataOrigin =
  | 'real_learning'
  | 'internal_acceptance';

export type TrialLearningCollectionOriginPolicy = {
  policyVersion: typeof LEARNING_COLLECTION_ORIGIN_POLICY_VERSION;
  trialWindowId: string;
  internalAcceptanceSessionIds: readonly string[];
  basis: 'explicit_historical_compatibility';
};

const trialPolicies: readonly TrialLearningCollectionOriginPolicy[] = [
  {
    policyVersion: LEARNING_COLLECTION_ORIGIN_POLICY_VERSION,
    trialWindowId: 'real-trial-0ea5b6805a2a-1787804931126',
    internalAcceptanceSessionIds: [
      'learning-session-20260827043207642',
      'learning-session-20260827044711284',
    ],
    basis: 'explicit_historical_compatibility',
  },
];

export function resolveTrialLearningCollectionOriginPolicy(
  trialWindowId?: string,
): TrialLearningCollectionOriginPolicy | undefined {
  if (!trialWindowId) return undefined;
  return trialPolicies.find((policy) => policy.trialWindowId === trialWindowId);
}
