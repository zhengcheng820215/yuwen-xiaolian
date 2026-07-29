import {
  AUTHORING_FIELD_CONTRACTS,
  AUTHORING_FIELD_CONTRACT_VERSION,
  PLAN_CONTROLLED_FIELD_CONTRACTS,
  alignQuestionDraftInputWithPlan,
  assessAuthoringFieldResponsibilities,
  getAuthoringFieldAdaptation,
  getAuthoringFieldValues,
  getAuthoringValidationPath,
  getPlanControlledValidationPath,
  getQualityCheckEditLocation,
  getQualityChecksForUiField,
  getQualityIssueEditorTargetIds,
  readObservationTaskReference,
  validateAuthoringAiOutput,
  validateAuthorizedAuthoringFieldChanges,
} from '../contracts/authoringFieldContract.ts';
import type { ObservationTaskPlan } from '../schemas/materialObservation.schema.ts';
import type { StructuredQuestionDraft } from '../schemas/questionResourceAdmission.schema.ts';

function main(): void {
  const draft = createDraft();
  const task = createTask();

  assert(
    Object.keys(AUTHORING_FIELD_CONTRACTS).join(',') ===
      'abilityTarget,specificTrainingPoint,questionStem,studentTask,observationTarget',
    'Five authoring field contracts are not stable.',
  );
  assert(
    PLAN_CONTROLLED_FIELD_CONTRACTS.taskRole.planPath === 'taskPlans[].taskRole' &&
      PLAN_CONTROLLED_FIELD_CONTRACTS.difficulty.planPath === 'taskPlans[].difficulty',
    'Plan-controlled field paths are incomplete.',
  );

  const reference = readObservationTaskReference(draft.tags);
  assert(reference.planId === 'plan-1', 'Plan reference was not read from the draft.');
  assert(reference.observationTaskPlanId === task.observationTaskPlanId, 'Task reference mismatch.');

  const fields = getAuthoringFieldValues(draft, task);
  assert(fields.abilityTarget === 'summarization', 'Ability target did not use the Plan value.');
  assert(fields.specificTrainingPoint === '按事件顺序概括', 'Specific training point mismatch.');
  assert(fields.questionStem === draft.questionStem, 'Question stem did not use the Draft value.');
  assert(fields.studentTask === task.expectedStudentAction, 'Student task mismatch.');
  assert(fields.observationTarget === task.observationFocus?.definition, 'Observation target mismatch.');
  assert(
    assessAuthoringFieldResponsibilities(fields).length === 0,
    'Semantically related but responsibility-separated fields were incorrectly warned.',
  );

  const adapted = getAuthoringFieldAdaptation(draft, task);
  assert(
    adapted.provenance.abilityTarget.source === 'plan' &&
      adapted.provenance.questionStem.source === 'draft',
    'Authoring field provenance is not explicit.',
  );
  const legacyAdapted = getAuthoringFieldAdaptation(draft, null);
  assert(
    legacyAdapted.provenance.abilityTarget.source === 'legacy_adapter' &&
      legacyAdapted.provenance.abilityTarget.needsHumanReview,
    'Legacy ability fallback is not marked for human review.',
  );

  const aligned = alignQuestionDraftInputWithPlan(draft, task);
  assert(aligned.abilityMetadata.abilityId === task.abilityId, 'Ability alignment failed.');
  assert(aligned.abilityMetadata.taskRole === task.taskRole, 'Task-role alignment failed.');
  assert(aligned.abilityMetadata.difficulty === task.difficulty, 'Difficulty alignment failed.');
  assert(aligned.rubric[0].abilityId === task.abilityId, 'Primary rubric ability was not aligned.');
  assert(aligned.rubric[1].abilityId === 'analysis', 'Unrelated rubric ability was modified.');

  assert(
    getAuthoringValidationPath('questionStem') === 'questionStem' &&
      getPlanControlledValidationPath('abilityId') === 'abilityMetadata.abilityId',
    'Validator paths diverged from the authoring contracts.',
  );
  assert(
    getQualityChecksForUiField('questionStem').includes('materialGrounding') &&
      getQualityChecksForUiField('difficulty').includes('difficultyCoherence'),
    'UI field quality impact mapping is incomplete.',
  );
  assert(
    getQualityCheckEditLocation('difficultyCoherence') ===
      '训练设置 → 难度；基础内容 → 题目',
    'Quality issue edit copy diverged from the contract.',
  );
  assert(
    getQualityIssueEditorTargetIds('difficultyCoherence', {
      planReviewMode: true,
    })[0] === 'question-training-targets',
    'Plan-review difficulty issue does not locate the Plan-controlled settings.',
  );
  assert(
    getQualityIssueEditorTargetIds('rubricAlignment', {
      planReviewMode: true,
      rubricTargetId: 'question-rubric-item-1',
    })[0] === 'question-rubric-item-1',
    'Rubric issue does not locate the selected rubric item.',
  );

  const duplicateFields = {
    ...fields,
    questionStem: '概括骗子从出现到获得皇帝信任的主要步骤。',
    studentTask: '概括骗子从出现到获得皇帝信任的主要步骤。',
  };
  const responsibilityIssues = assessAuthoringFieldResponsibilities(duplicateFields);
  assert(
    responsibilityIssues.some(
      (issue) => issue.fields.includes('questionStem') && issue.fields.includes('studentTask'),
    ),
    'Responsibility overlap did not produce a warning.',
  );
  assert(
    responsibilityIssues.every((issue) => issue.severity === 'warning'),
    'Responsibility overlap must remain non-blocking.',
  );
  assert(
    assessAuthoringFieldResponsibilities({
      questionStem: fields.questionStem,
      studentTask: undefined,
    }).length === 0,
    'Incomplete legacy fields must not crash responsibility assessment.',
  );

  const validAiOutput = validateAuthoringAiOutput({
    authoringContractVersion: AUTHORING_FIELD_CONTRACT_VERSION,
    abilityId: 'summarization',
    specificTrainingPoint: '按事件发展顺序概括主要过程',
    questionStem: '结合全文，概括骗子获得皇帝信任的主要步骤。',
    studentTask: '提取关键事件，并按照发生顺序组织答案。',
    observationTarget: '判断学生是否覆盖主要事件、顺序完整且事件关系准确。',
  });
  assert(validAiOutput.valid && validAiOutput.warnings.length === 0, 'Valid AI output was rejected.');

  const invalidAiOutput = validateAuthoringAiOutput({
    authoringContractVersion: AUTHORING_FIELD_CONTRACT_VERSION,
    abilityId: '概括',
    specificTrainingPoint: '概括',
    questionStem: '概括骗子获得皇帝信任的主要步骤。',
    studentTask: '概括骗子获得皇帝信任的主要步骤。',
    observationTarget: '概括骗子获得皇帝信任的主要步骤。',
  });
  assert(
    !invalidAiOutput.valid &&
      invalidAiOutput.errors.some((error) => error.includes('稳定 ID')),
    'Free-text ability output was not rejected.',
  );

  const localizedChangeErrors = validateAuthorizedAuthoringFieldChanges(
    fields,
    {
      ...fields,
      questionStem: '结合全文，按顺序概括骗子获得皇帝信任的主要步骤。',
    },
    ['questionStem'],
  );
  assert(localizedChangeErrors.length === 0, 'Authorized localized AI change was rejected.');
  const unauthorizedChangeErrors = validateAuthorizedAuthoringFieldChanges(
    fields,
    {
      ...fields,
      questionStem: '结合全文，按顺序概括骗子获得皇帝信任的主要步骤。',
      observationTarget: '新的观察目标',
    },
    ['questionStem'],
  );
  assert(
    unauthorizedChangeErrors.some((error) => error.includes('观察目标')),
    'Unauthorized AI field change was not rejected.',
  );

  console.log('PASS Phase 17 authoring field contract');
}

function createTask(): ObservationTaskPlan {
  return {
    observationTaskPlanId: 'observation-task-1',
    materialObservationPlanId: 'plan-1',
    materialId: 'material-1',
    materialVersionId: 'material-1:v1',
    primaryDimension: 'plot',
    observationFocus: {
      focusCode: 'plot_sequence',
      displayName: '按事件顺序概括',
      definition: '是否覆盖主要事件、顺序完整且关系准确。',
      scope: 'plan_local',
    },
    abilityId: 'summarization',
    taskRole: 'training',
    difficulty: 'basic',
    sourceAnchorIds: ['anchor-1'],
    observationGoal: '结合全文，概括骗子获得皇帝信任的主要步骤。',
    expectedStudentAction: '提取关键事件，并按照发生顺序组织答案。',
    designReason: '观察学生按事件顺序概括主要过程的能力。',
    status: 'planned',
  };
}

function createDraft(): StructuredQuestionDraft {
  return {
    draftId: 'draft-1',
    resourceId: 'resource-1',
    taskId: 'task-1',
    proposedVersionNumber: 1,
    materialVersionId: 'material-1:v1',
    title: '骗子取得信任的过程',
    questionStem: '结合全文，概括骗子获得皇帝信任的主要步骤。',
    questionType: 'reading_comprehension',
    responseFormat: 'long_text',
    assessmentMode: 'key_points',
    answerAcceptance: {
      acceptedKeywords: ['设局', '索要钱财', '假装工作', '骗取信任'],
      semanticEquivalentAllowed: true,
      normalizationRules: ['trim'],
    },
    rubric: [
      {
        itemId: 'rubric-1',
        name: '事件顺序完整',
        abilityId: 'inference',
        importance: 'critical',
        required: true,
        acceptedSignals: ['主要事件完整', '顺序正确'],
      },
      {
        itemId: 'rubric-2',
        name: '说明人物心理',
        abilityId: 'analysis',
        importance: 'supporting',
        required: false,
        acceptedSignals: ['虚荣', '恐惧'],
      },
    ],
    minimumAnswerRequirement: {
      minLength: 20,
      requireTextEvidence: true,
      requireExplanation: true,
    },
    abilityMetadata: {
      abilityId: 'inference',
      supportingAbilityIds: ['extraction'],
      prerequisiteAbilityIds: ['comprehension'],
      taskRole: 'observation',
      difficulty: 'intermediate',
      gradeRange: '七至九年级',
    },
    source: {
      sourceType: 'ai_assisted',
      description: '由材料观测计划生成。',
    },
    tags: ['observation_plan:plan-1', 'observation_task:observation-task-1'],
    status: 'drafted',
    revision: 1,
    createdAt: '2026-07-29T10:00:00.000Z',
    updatedAt: '2026-07-29T10:00:00.000Z',
    version: 'phase16_1a_v1',
    schemaVersion: 'question_resource_admission_v1',
  };
}

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

main();
