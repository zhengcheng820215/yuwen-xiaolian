export const REINFORCEMENT_LINK_STATUSES = ['draft', 'approved', 'retired'] as const;
export type ReinforcementLinkStatus = typeof REINFORCEMENT_LINK_STATUSES[number];

export type ReinforcementLink = {
  schemaVersion: 1;
  id: string;
  contentVersion: number;
  status: ReinforcementLinkStatus;
  variantGroupId: string;
  sourceQuestionId: string;
  reinforcementQuestionId: string;
  applicableMisconceptionCodes?: string[];
  reviewFocus: string;
  reviewedAt?: string;
  reviewNote?: string;
};

export type ReinforcementNotScheduledReason =
  | 'response_correct'
  | 'not_base_item'
  | 'already_scheduled'
  | 'session_limit_reached'
  | 'source_group_missing'
  | 'approved_link_missing'
  | 'misconception_not_applicable'
  | 'candidate_already_in_session'
  | 'candidate_unavailable';

export type ReinforcementDecision =
  | {
      outcome: 'scheduled';
      sourceQuestionId: string;
      reinforcementQuestionId: string;
      queueItemId: string;
      insertionIndex: number;
      linkId: string;
    }
  | { outcome: 'not_scheduled'; reason: ReinforcementNotScheduledReason };
