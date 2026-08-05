export type LegacyWorkflowExitAuditStatus =
  | 'ready'
  | 'migration_required'
  | 'blocked';

export type LegacyWorkflowExitAuditInput = {
  canonicalCandidateWorkflow: boolean;
  reachableLegacyEntryCount: number;
  reachableLegacyHandlerCount: number;
  candidateFeatureFlagCount: number;
  workingContentMergedIntoForm: boolean;
  migratableWorkingContentCount: number;
  protectedWorkingContentCount: number;
  unprotectedWorkingContentCount: number;
};

export type LegacyWorkflowExitAuditResult = {
  status: LegacyWorkflowExitAuditStatus;
  blockingReasons: string[];
  migrationItemCount: number;
};

export function resolveLegacyWorkflowExitAudit(
  input: LegacyWorkflowExitAuditInput,
): LegacyWorkflowExitAuditResult {
  const blockingReasons: string[] = [];

  if (!input.canonicalCandidateWorkflow) {
    blockingReasons.push('candidate_workflow_not_canonical');
  }
  if (input.reachableLegacyEntryCount > 0) {
    blockingReasons.push('reachable_legacy_entries');
  }
  if (input.reachableLegacyHandlerCount > 0) {
    blockingReasons.push('reachable_legacy_handlers');
  }
  if (input.candidateFeatureFlagCount > 0) {
    blockingReasons.push('candidate_feature_flags_remain');
  }
  if (input.workingContentMergedIntoForm) {
    blockingReasons.push('working_content_merged_into_form');
  }
  if (input.unprotectedWorkingContentCount > 0) {
    blockingReasons.push('unprotected_working_content');
  }

  const migrationItemCount = Math.max(0, input.migratableWorkingContentCount)
    + Math.max(0, input.protectedWorkingContentCount);

  if (blockingReasons.length > 0) {
    return { status: 'blocked', blockingReasons, migrationItemCount };
  }
  if (migrationItemCount > 0) {
    return { status: 'migration_required', blockingReasons, migrationItemCount };
  }
  return { status: 'ready', blockingReasons, migrationItemCount: 0 };
}
