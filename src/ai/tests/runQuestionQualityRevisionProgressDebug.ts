import {
  buildQuestionQualityRepairQueue,
  createQuestionQualityRevisionProgress,
  markCurrentQuestionQualityIssueModified,
  markQuestionQualityIssuesModified,
  parseQuestionQualityRevisionProgress,
  reconcileQuestionQualityRevisionProgress,
} from '../../pages/questionQualityRevisionProgress.ts';
import type { QuestionQualityAssessment } from '../schemas/questionQualityAssessment.schema.ts';

function assessment(
  revision: number,
  checks: Array<'materialGrounding' | 'discriminativePower'>,
): QuestionQualityAssessment {
  return {
    assessmentId: `draft-1:assessment:${revision}`,
    draftId: 'draft-1',
    resourceId: 'resource-1',
    assessedDraftRevision: revision,
    validationId: `validation-${revision}`,
    checks: {
      materialGrounding: checks.includes('materialGrounding') ? 'warning' : 'pass',
      observationClarity: 'pass',
      observationDistinctness: 'pass',
      discriminativePower: checks.includes('discriminativePower') ? 'warning' : 'pass',
      difficultyCoherence: 'pass',
      rubricAlignment: 'pass',
      scopeClarity: 'pass',
    },
    decision: checks.length ? 'pass_with_warnings' : 'pass',
    warnings: checks.map((check) => ({
      code: `warning.${check}`,
      check,
      severity: 'warning',
      message: `请处理 ${check}`,
      evidenceRefs: ['question'],
    })),
    assessedAt: new Date().toISOString(),
    ruleVersion: 'question_quality_rules_v3',
    version: 'phase17_5a_v1',
  };
}

function assert(condition: unknown, message: string): void {
  if (!condition) throw new Error(message);
}

const initial = reconcileQuestionQualityRevisionProgress(
  createQuestionQualityRevisionProgress('draft-1'),
  assessment(1, ['materialGrounding', 'discriminativePower']),
);
assert(initial.items.every((item) => item.status === 'pending'), 'New warnings should be pending.');

const modified = markQuestionQualityIssuesModified(
  initial,
  assessment(1, ['materialGrounding', 'discriminativePower']),
  ['materialGrounding'],
);
assert(
  modified?.items.find((item) => item.check === 'materialGrounding')?.status === 'modified_pending_recheck',
  'Affected warning should wait for recheck.',
);
assert(
  modified?.items.find((item) => item.check === 'discriminativePower')?.status === 'pending',
  'Unrelated warning should remain pending.',
);
const repairQueue = buildQuestionQualityRepairQueue(modified);
assert(
  repairQueue.current?.check === 'discriminativePower',
  'Repair queue should advance after the first issue is modified.',
);
assert(
  repairQueue.awaitingRecheck[0]?.check === 'materialGrounding',
  'Modified issue should wait for the shared recheck.',
);

const rechecked = reconcileQuestionQualityRevisionProgress(
  modified,
  assessment(2, ['materialGrounding']),
);
assert(
  rechecked.items.find((item) => item.check === 'materialGrounding')?.recheckCount === 1,
  'Unresolved modified warning should count one recheck.',
);
assert(
  rechecked.items.find((item) => item.check === 'discriminativePower')?.status === 'resolved',
  'Missing warning should become resolved.',
);
assert(
  reconcileQuestionQualityRevisionProgress(rechecked, assessment(2, ['materialGrounding']))
    .items.find((item) => item.check === 'materialGrounding')?.recheckCount === 1,
  'Reloading the same assessment must be idempotent.',
);

const resolvedQueue = buildQuestionQualityRepairQueue(rechecked);
assert(
  resolvedQueue.resolved.some((item) => item.check === 'discriminativePower'),
  'Repair queue should retain issues resolved in the latest recheck.',
);

const sequentialInitial = reconcileQuestionQualityRevisionProgress(
  createQuestionQualityRevisionProgress('draft-1'),
  assessment(3, ['materialGrounding', 'discriminativePower']),
);
const unrelatedEdit = markCurrentQuestionQualityIssueModified(
  sequentialInitial,
  assessment(3, ['materialGrounding', 'discriminativePower']),
  ['discriminativePower'],
);
assert(
  unrelatedEdit?.items.every((item) => item.status === 'pending'),
  'Editing a later issue must not advance the current issue.',
);

const firstHandled = markCurrentQuestionQualityIssueModified(
  sequentialInitial,
  assessment(3, ['materialGrounding', 'discriminativePower']),
  ['materialGrounding', 'discriminativePower'],
);
assert(
  firstHandled?.items.find((item) => item.check === 'materialGrounding')?.status === 'modified_pending_recheck',
  'The current issue should wait for recheck after a related edit.',
);
assert(
  firstHandled?.items.find((item) => item.check === 'discriminativePower')?.status === 'pending',
  'A broad field edit must not mark later issues as handled.',
);
const repeatedEdit = markCurrentQuestionQualityIssueModified(
  firstHandled,
  assessment(3, ['materialGrounding', 'discriminativePower']),
  ['materialGrounding', 'discriminativePower'],
  'materialGrounding',
);
assert(
  repeatedEdit?.items.find((item) => item.check === 'discriminativePower')?.status === 'pending',
  'Repeated typing for the active issue must not advance a later issue.',
);
assert(
  buildQuestionQualityRepairQueue(firstHandled).current?.check === 'discriminativePower',
  'The next issue should become active after the current issue is handled.',
);

const secondHandled = markCurrentQuestionQualityIssueModified(
  firstHandled,
  assessment(3, ['materialGrounding', 'discriminativePower']),
  ['discriminativePower'],
);
assert(
  buildQuestionQualityRepairQueue(secondHandled).pending.length === 0,
  'All issues should wait for one shared recheck after sequential edits.',
);

const restored = parseQuestionQualityRevisionProgress(
  JSON.stringify(secondHandled),
  'draft-1',
);
assert(
  restored?.items.every((item) => item.status === 'modified_pending_recheck'),
  'Persisted repair progress should survive a reload.',
);

const partiallyResolved = reconcileQuestionQualityRevisionProgress(
  restored,
  assessment(4, ['discriminativePower']),
);
assert(
  partiallyResolved.items.find((item) => item.check === 'materialGrounding')?.status === 'resolved',
  'A warning absent from the recheck should be resolved.',
);
assert(
  partiallyResolved.items.find((item) => item.check === 'discriminativePower')?.recheckCount === 1,
  'A warning that survives the recheck should record one failed attempt.',
);

console.log('Question quality revision progress: 18/18 checks passed.');
