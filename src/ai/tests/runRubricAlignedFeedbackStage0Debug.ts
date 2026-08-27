import assert from 'node:assert/strict';
import { SharedFormalResourceStore } from '../../server/sharedFormalResourceStore.ts';
import {
  RUBRIC_FEEDBACK_PROJECTION_SCHEMA_VERSION,
  STUDENT_VISIBLE_FEEDBACK_GROUNDING_SCHEMA_VERSION,
  containsForbiddenStudentVisibleKey,
  isRubricFeedbackProjection,
  isStudentVisibleFeedbackGrounding,
  type RubricFeedbackProjection,
} from '../schemas/rubricFeedbackProjection.schema.ts';
import { buildFormalQuestionHintFeedbackBatchAudit } from
  '../services/formalQuestionHintFeedbackBatchAuditService.ts';

const checks: Array<{ name: string; passed: boolean }> = [];

check('projection schema accepts diagnosis-grounded partial coverage', () => {
  assert.equal(isRubricFeedbackProjection(validProjection()), true);
});

check('partial coverage cannot be inferred without formal diagnosis identity', () => {
  const projection = validProjection();
  delete projection.items[0].sourceLinks.diagnosisId;
  assert.equal(isRubricFeedbackProjection(projection), false);
});

check('primary item must be an actionable partial or missing item', () => {
  const projection = validProjection();
  projection.primaryItemId = 'rubric-achieved';
  assert.equal(isRubricFeedbackProjection(projection), false);
});

check('student-visible grounding accepts minimum necessary information', () => {
  assert.equal(isStudentVisibleFeedbackGrounding({
    groundingVersion: STUDENT_VISIBLE_FEEDBACK_GROUNDING_SCHEMA_VERSION,
    acknowledgedStudentAction: '你已经写出了人物情感判断。',
    primaryObservedGap: 'conclusion_without_evidence',
    safeClueLocator: '回到母亲自己的处境和她照顾“我”的行为进行对照。',
    nextThinkingAction: '想一想这两个信息形成了怎样的反差。',
    feedbackDepth: 'thinking_prompt',
    sourceProjectionId: 'projection-stage0-valid',
  }), true);
});

check('student-visible grounding rejects complete rubric answer material', () => {
  const leaked = {
    groundingVersion: STUDENT_VISIBLE_FEEDBACK_GROUNDING_SCHEMA_VERSION,
    feedbackDepth: 'thinking_prompt',
    sourceProjectionId: 'projection-stage0-leaked',
    acceptedSignals: ['病重', '仍照顾我', '隐忍', '无私', '深爱孩子'],
  };
  assert.equal(containsForbiddenStudentVisibleKey(leaked), true);
  assert.equal(isStudentVisibleFeedbackGrounding(leaked), false);
});

const store = new SharedFormalResourceStore();
const before = await store.read();
if (!before.initialized) throw new Error('Shared formal resource store is not initialized.');
const beforeSerialized = JSON.stringify(before.data);
const report = buildFormalQuestionHintFeedbackBatchAudit(before, '2026-08-27T00:00:00.000Z');

check('every current formal question has one rubric feedback readiness result', () => {
  assert.equal(report.items.length, report.currentQuestionCount);
  assert(report.items.every((item) => (
    ['ready', 'limited', 'blocked'].includes(item.rubricFeedbackReadiness.status)
    && item.rubricFeedbackReadiness.studentVisibleProjectionPolicy === 'minimum_necessary_only'
  )));
  assert.equal(
    report.summary.rubricFeedbackReady
      + report.summary.rubricFeedbackLimited
      + report.summary.rubricFeedbackBlocked,
    report.currentQuestionCount,
  );
});

check('stage 0 audit does not simulate diagnosis or student coverage', () => {
  assert(report.items.every((item) => (
    !('coverageStatus' in item.rubricFeedbackReadiness)
    && !('primaryItemId' in item.rubricFeedbackReadiness)
  )));
});

const after = await store.read();
check('stage 0 audit leaves shared formal resources unchanged', () => {
  assert.equal(after.revision, before.revision);
  assert.equal(JSON.stringify(after.data), beforeSerialized);
});

console.log(JSON.stringify({
  stage: 'rubric-aligned-feedback-stage0',
  schemaVersion: RUBRIC_FEEDBACK_PROJECTION_SCHEMA_VERSION,
  mode: 'read-only',
  storeRevision: before.revision,
  currentQuestionCount: report.currentQuestionCount,
  rubricFeedbackReadiness: {
    ready: report.summary.rubricFeedbackReady,
    limited: report.summary.rubricFeedbackLimited,
    blocked: report.summary.rubricFeedbackBlocked,
  },
  findingBreakdown: report.findingBreakdown,
  checks,
  result: `${checks.filter((item) => item.passed).length}/${checks.length} PASS`,
}, null, 2));

function validProjection(): RubricFeedbackProjection {
  return {
    projectionVersion: RUBRIC_FEEDBACK_PROJECTION_SCHEMA_VERSION,
    projectionId: 'projection-stage0-valid',
    questionVersionId: 'question-version-stage0',
    rubricVersion: 'rubric-v1',
    primaryItemId: 'rubric-partial',
    projectionStatus: 'ready',
    items: [
      {
        rubricItemId: 'rubric-partial',
        requirementId: 'requirement-evidence',
        importance: 'critical',
        coverageStatus: 'partially_achieved',
        studentEvidenceRefs: ['response-fragment-1'],
        taskRelation: '需要用文本事实支持人物判断。',
        observedGap: 'conclusion_without_evidence',
        nextThinkingAction: '回到人物处境和行为进行对照。',
        sourceLinks: {
          questionVersionId: 'question-version-stage0',
          rubricVersion: 'rubric-v1',
          diagnosisId: 'diagnosis-stage0',
          responseId: 'response-stage0',
          requirementId: 'requirement-evidence',
        },
      },
      {
        rubricItemId: 'rubric-achieved',
        requirementId: 'requirement-conclusion',
        importance: 'important',
        coverageStatus: 'achieved',
        studentEvidenceRefs: ['response-fragment-2'],
        taskRelation: '需要形成明确人物判断。',
        sourceLinks: {
          questionVersionId: 'question-version-stage0',
          rubricVersion: 'rubric-v1',
          diagnosisId: 'diagnosis-stage0',
          responseId: 'response-stage0',
          requirementId: 'requirement-conclusion',
        },
      },
    ],
  };
}

function check(name: string, run: () => void): void {
  run();
  checks.push({ name, passed: true });
}
