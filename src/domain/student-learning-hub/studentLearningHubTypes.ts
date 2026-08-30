import type { PracticeMode, PracticeSession } from '../knowledge-practice/practice/practiceSessionTypes.ts';

export const STUDENT_LEARNING_HUB_PROJECTION_VERSION = 'student_learning_hub_projection_v1' as const;

export type KnowledgePracticeEntryStatus =
  | 'loading'
  | 'ready_to_start'
  | 'active_session'
  | 'content_insufficient'
  | 'store_read_only'
  | 'store_recovery_required';

export type KnowledgePracticeEntryProjection = {
  status: KnowledgePracticeEntryStatus;
  approvedQuestionCount: number;
  availableCategoryCount: number;
  activeSession?: {
    sessionId: string;
    mode: PracticeMode;
    category?: string;
    currentPosition: number;
    totalItems: number;
  };
  primaryPath: string;
  studentMessage: string;
};

export type FormalLearningEntryInput = {
  entry?: {
    status?: string;
    hasActiveSession: boolean;
    canEnterWorkspace: boolean;
    primaryAction: string;
    primaryActionText: string;
  } | null;
  recoveryAction?: {
    actionId: string;
    label: string;
    path?: string;
  } | null;
};

export type StudentHubActionKind =
  | 'continue_formal'
  | 'continue_knowledge'
  | 'start_formal'
  | 'start_knowledge'
  | 'recover_formal'
  | 'recover_knowledge'
  | 'none';

export type StudentHubAction = {
  kind: StudentHubActionKind;
  label: string;
  path?: string;
};

export type StudentContentInventoryProjection = {
  formal: {
    status: 'available' | 'unavailable' | 'unknown';
    currentCount?: number;
    activeMaterialCount?: number;
    consumableCount?: number;
  };
  knowledge: {
    approvedCount: number;
    categoryCount: number;
  };
};

export type StudentLearningHubProjection = {
  projectionVersion: typeof STUDENT_LEARNING_HUB_PROJECTION_VERSION;
  formal: FormalLearningEntryInput;
  knowledge: KnowledgePracticeEntryProjection;
  primaryAction: StudentHubAction;
  secondaryActions: StudentHubAction[];
  inventory: StudentContentInventoryProjection;
  notices: string[];
};

export type BuildKnowledgePracticeEntryInput = {
  hydrationStatus: 'loading' | 'ready' | 'read_only';
  persistenceStatus?: string;
  recoveryError?: { code?: string; studentMessage?: string } | null;
  activeSession?: PracticeSession | null;
  approvedQuestionCount: number;
  availableCategoryCount: number;
};

export type FormalInventoryInput = {
  status: 'available' | 'unavailable' | 'unknown';
  currentCount?: number;
  activeMaterialCount?: number;
  consumableCount?: number;
};
