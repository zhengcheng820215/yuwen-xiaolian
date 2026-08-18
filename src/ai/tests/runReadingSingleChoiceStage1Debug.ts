import assert from 'node:assert/strict';
import {
  createQuestionCandidate,
  inspectInitialCandidateCompleteness,
  validateQuestionCandidateContent,
} from '../schemas/questionCandidate.schema.ts';
import {
  calculateQuestionEditableFieldsHash,
  type QuestionEditableFields,
} from '../schemas/workingTaskContent.schema.ts';
import {
  SINGLE_CHOICE_INTERACTION_SCHEMA_VERSION,
  buildDeterministicSingleChoiceOptionOrder,
  createStudentSingleChoiceDelivery,
  isSingleChoiceMinimumResponseRequirement,
  validateSingleChoiceInteraction,
  validateSingleChoiceStudentAnswerValue,
  type SingleChoiceInteraction,
} from '../schemas/singleChoiceInteraction.schema.ts';
import {
  isStructuredQuestionDraft,
  type QuestionAbilityMetadata,
  type QuestionResourceRubricItem,
  type QuestionSource,
} from '../schemas/questionResourceAdmission.schema.ts';
import { InMemoryQuestionResourceAdmissionRepository } from
  '../repositories/inMemoryQuestionResourceAdmissionRepository.ts';
import {
  createQuestionMaterial,
  createStructuredQuestionDraft,
  freezeQuestionResourceDraft,
  reviewQuestionResourceDraft,
  submitQuestionResourceForReview,
  validateStructuredQuestionDraft,
  type CreateStructuredQuestionDraftInput,
} from '../agents/questionResourceAdmissionAgent.ts';

const NOW = '2026-08-18T00:00:00.000Z';

type Case = { name: string; run: () => void | Promise<void> };

const cases: Case[] = [
  {
    name: 'valid interaction passes structural validation',
    run: () => assert.equal(validateSingleChoiceInteraction(validInteraction()).passed, true),
  },
  {
    name: 'single choice requires three to five options',
    run: () => {
      const interaction = validInteraction();
      interaction.options = interaction.options.slice(0, 2);
      const result = validateSingleChoiceInteraction(interaction);
      assert.equal(result.passed, false);
      assert(hasChoiceCode(result, 'choice.option_count'));
    },
  },
  {
    name: 'option identities must be stable and unique',
    run: () => {
      const interaction = validInteraction();
      interaction.options[1].optionId = interaction.options[0].optionId;
      assert(hasChoiceCode(validateSingleChoiceInteraction(interaction), 'choice.option_id_duplicate'));
    },
  },
  {
    name: 'single choice requires exactly one correct option',
    run: () => {
      const interaction = validInteraction();
      interaction.correctOptionIds = ['option-correct', 'option-surface'] as [string];
      assert(hasChoiceCode(validateSingleChoiceInteraction(interaction), 'choice.correct_option_count'));
    },
  },
  {
    name: 'every wrong option requires one rationale',
    run: () => {
      const interaction = validInteraction();
      interaction.distractorRationales.pop();
      assert(hasChoiceCode(validateSingleChoiceInteraction(interaction), 'choice.distractor_coverage'));
    },
  },
  {
    name: 'correct option cannot carry a distractor rationale',
    run: () => {
      const interaction = validInteraction();
      interaction.distractorRationales[0].optionId = 'option-correct';
      assert(hasChoiceCode(validateSingleChoiceInteraction(interaction), 'choice.correct_option_has_rationale'));
    },
  },
  {
    name: 'distractors must use independent misconception categories',
    run: () => {
      const interaction = validInteraction();
      interaction.distractorRationales[1].misconceptionCode = 'surface_reading';
      assert(hasChoiceCode(validateSingleChoiceInteraction(interaction), 'choice.misconception_duplicate'));
    },
  },
  {
    name: 'choice minimum response requirement is format aware',
    run: () => assert.equal(isSingleChoiceMinimumResponseRequirement(choiceMinimum()), true),
  },
  {
    name: 'student delivery strips answer key and rationale',
    run: () => {
      const delivery = createStudentSingleChoiceDelivery(validInteraction());
      assert.equal('correctOptionIds' in delivery, false);
      assert.equal('distractorRationales' in delivery, false);
      assert.deepEqual(Object.keys(delivery.options[0]).sort(), ['content', 'displayOrder', 'optionId']);
    },
  },
  {
    name: 'student delivery supports reordered stable option IDs',
    run: () => {
      const delivery = createStudentSingleChoiceDelivery(
        validInteraction(),
        ['option-over', 'option-correct', 'option-entity', 'option-surface'],
      );
      assert.deepEqual(delivery.options.map((option) => option.optionId), [
        'option-over', 'option-correct', 'option-entity', 'option-surface',
      ]);
      assert.deepEqual(delivery.options.map((option) => option.displayOrder), [1, 2, 3, 4]);
    },
  },
  {
    name: 'deterministic display order is stable and distributes correct labels across resources',
    run: () => {
      const interaction = validInteraction();
      const first = buildDeterministicSingleChoiceOptionOrder(interaction, 'resource-1|student-1');
      const repeated = buildDeterministicSingleChoiceOptionOrder(interaction, 'resource-1|student-1');
      assert.deepEqual(repeated, first);
      assert.deepEqual([...first].sort(), interaction.options.map((option) => option.optionId).sort());
      const correctPositions = new Set(
        Array.from({ length: 16 }, (_, index) => (
          buildDeterministicSingleChoiceOptionOrder(
            interaction,
            `resource-${index + 1}|student-1`,
          ).indexOf(interaction.correctOptionIds[0])
        )),
      );
      assert(correctPositions.size >= 3, 'Correct labels remained concentrated in one display position.');
    },
  },
  {
    name: 'invalid display order cannot silently drop options',
    run: () => assert.throws(
      () => createStudentSingleChoiceDelivery(validInteraction(), ['option-correct']),
      /display order/,
    ),
  },
  {
    name: 'structured student choice response validates against delivery',
    run: () => {
      const delivery = createStudentSingleChoiceDelivery(validInteraction());
      const result = validateSingleChoiceStudentAnswerValue({
        responseFormat: 'single_choice',
        selectedOptionIds: ['option-entity'],
        optionSetVersion: 1,
        displayedOptionOrder: delivery.options.map((option) => option.optionId),
      }, delivery);
      assert.equal(result.passed, true);
    },
  },
  {
    name: 'unknown selected option is rejected',
    run: () => {
      const delivery = createStudentSingleChoiceDelivery(validInteraction());
      const result = validateSingleChoiceStudentAnswerValue({
        responseFormat: 'single_choice',
        selectedOptionIds: ['option-unknown'],
        optionSetVersion: 1,
        displayedOptionOrder: delivery.options.map((option) => option.optionId),
      }, delivery);
      assert(hasChoiceCode(result, 'choice_response.option_unknown'));
    },
  },
  {
    name: 'complete single-choice Candidate content passes validation',
    run: () => {
      const content = validChoiceContent();
      assert.equal(validateQuestionCandidateContent(content).passed, true);
      assert.equal(inspectInitialCandidateCompleteness(content).complete, true);
      assert.doesNotThrow(() => createCandidate(content));
    },
  },
  {
    name: 'Candidate answer acceptance must match correct option ID',
    run: () => {
      const content = validChoiceContent();
      content.answerAcceptance = { acceptedOptionIds: ['option-surface'] };
      assert.equal(validateQuestionCandidateContent(content).passed, false);
      assert.throws(() => createCandidate(content), /choice.answer_acceptance_mismatch/);
    },
  },
  {
    name: 'valid single-choice Draft passes admission validation',
    run: async () => {
      const { repo, draftId } = await createChoiceDraft('valid-choice');
      const validation = await validateStructuredQuestionDraft(repo, draftId, NOW);
      assert.equal(validation.passed, true, validation.issues.map((issue) => issue.code).join(', '));
      assert.equal(isStructuredQuestionDraft(await repo.getDraft(draftId)), true);
    },
  },
  {
    name: 'legacy string options cannot enter new single-choice Draft',
    run: async () => {
      const { repo, draftId } = await createChoiceDraft('legacy-choice', {
        options: ['A', 'B', 'C', 'D'],
      });
      const validation = await validateStructuredQuestionDraft(repo, draftId, NOW);
      assert(hasResourceCode(validation, 'choice.legacy_options_not_allowed'));
    },
  },
  {
    name: 'single-choice Draft requires exact_match and structured minimum',
    run: async () => {
      const { repo, draftId } = await createChoiceDraft('bad-mode', {
        assessmentMode: 'key_points',
        minimumAnswerRequirement: {
          minLength: 1,
          requireTextEvidence: false,
          requireExplanation: false,
        },
      });
      const validation = await validateStructuredQuestionDraft(repo, draftId, NOW);
      assert(hasResourceCode(validation, 'choice.assessment_mode'));
      assert(hasResourceCode(validation, 'choice.minimum_response_requirement'));
    },
  },
  {
    name: 'freeze preserves choice identity while delivery remains sanitized',
    run: async () => {
      const { repo, draftId } = await createChoiceDraft('freeze-choice');
      const validation = await validateStructuredQuestionDraft(repo, draftId, NOW);
      assert.equal(validation.passed, true);
      await submitQuestionResourceForReview(repo, draftId, NOW);
      await reviewQuestionResourceDraft(repo, {
        draftId,
        action: 'approve',
        reviewerId: 'single-operator',
        notes: 'Adopted for Stage 1 structural verification.',
        now: NOW,
      });
      const frozen = await freezeQuestionResourceDraft(repo, draftId, NOW);
      assert.deepEqual(frozen.version.choiceInteraction, validInteraction());
      const delivery = createStudentSingleChoiceDelivery(frozen.version.choiceInteraction!);
      assert.equal(JSON.stringify(delivery).includes('option-correct'), true);
      assert.equal(JSON.stringify(delivery).includes('surface_reading'), false);
    },
  },
  {
    name: 'existing text Candidate and Draft remain valid',
    run: async () => {
      const content = validTextContent();
      assert.equal(validateQuestionCandidateContent(content).passed, true);
      assert.equal(inspectInitialCandidateCompleteness(content).complete, true);
      assert.doesNotThrow(() => createCandidate(content));
      const repo = await repositoryWithMaterial();
      const draft = await createStructuredQuestionDraft(repo, {
        ...content,
        draftId: 'draft-text-regression',
        resourceId: 'resource-text-regression',
        taskId: 'task-text-regression',
        now: NOW,
      });
      const validation = await validateStructuredQuestionDraft(repo, draft.draftId, NOW);
      assert.equal(validation.passed, true, validation.issues.map((issue) => issue.code).join(', '));
    },
  },
  {
    name: 'choice option changes affect immutable content hash',
    run: () => {
      const first = validChoiceContent();
      const second = structuredClone(first);
      second.choiceInteraction!.options[1].content = '因为他完全没有读懂文章内容';
      assert.notEqual(
        calculateQuestionEditableFieldsHash(first),
        calculateQuestionEditableFieldsHash(second),
      );
    },
  },
];

let passed = 0;
for (const testCase of cases) {
  try {
    await testCase.run();
    passed += 1;
    console.log(`PASS ${testCase.name}`);
  } catch (error) {
    console.error(`FAIL ${testCase.name}`);
    throw error;
  }
}

console.log(`Reading single-choice Stage 1 debug: ${passed}/${cases.length} passed.`);

function validInteraction(): SingleChoiceInteraction {
  return {
    schemaVersion: SINGLE_CHOICE_INTERACTION_SCHEMA_VERSION,
    selectionMode: 'single',
    options: [
      { optionId: 'option-correct', content: '父亲把树叶当作珍贵回忆，小心保存。' },
      { optionId: 'option-surface', content: '父亲只是想把书柜整理得更加整齐。' },
      { optionId: 'option-entity', content: '孩子要求父亲把树叶重新夹回书里。' },
      { optionId: 'option-over', content: '父亲准备依据树叶寻找一位失散多年的朋友。' },
    ],
    correctOptionIds: ['option-correct'],
    distractorRationales: [
      {
        optionId: 'option-surface',
        misconceptionCode: 'surface_reading',
        diagnosisMeaning: '只关注整理书柜的表面动作，忽略停留和小心保存所表达的情感。',
        evidenceBoundary: '父亲捏着树叶站了很久，最后小心夹回原处。',
      },
      {
        optionId: 'option-entity',
        misconceptionCode: 'entity_confusion',
        diagnosisMeaning: '混淆了动作主体，文本中没有孩子提出要求。',
        evidenceBoundary: '全文动作主体是父亲。',
      },
      {
        optionId: 'option-over',
        misconceptionCode: 'over_inference',
        diagnosisMeaning: '推理超过文本证据，材料没有交代寻找朋友。',
        evidenceBoundary: '文本只写发现、停留和保存树叶。',
      },
    ],
    optionSetVersion: 1,
  };
}

function choiceMinimum() {
  return {
    responseFormat: 'single_choice' as const,
    minLength: 0 as const,
    requireTextEvidence: false as const,
    requireExplanation: false as const,
    minSelections: 1 as const,
    maxSelections: 1 as const,
  };
}

function validChoiceContent(): QuestionEditableFields {
  return {
    materialVersionId: 'material-leaf:v1',
    title: '人物行为的基础理解',
    questionStem: '父亲为什么把树叶小心地夹回原处？',
    questionType: 'multiple_choice',
    responseFormat: 'single_choice',
    choiceInteraction: validInteraction(),
    assessmentMode: 'exact_match',
    answerAcceptance: { acceptedOptionIds: ['option-correct'] },
    rubric: validRubric(),
    minimumAnswerRequirement: choiceMinimum(),
    abilityMetadata: validAbilityMetadata(),
    source: validSource(),
    tags: ['observation_task:task-choice', 'reading', 'basic'],
  };
}

function validTextContent(): QuestionEditableFields {
  return {
    materialVersionId: 'material-leaf:v1',
    title: '人物心理推断',
    questionStem: '请结合文本说明父亲为什么把树叶小心地夹回原处。',
    questionType: 'reading_comprehension',
    responseFormat: 'long_text',
    assessmentMode: 'reasoning_chain',
    answerAcceptance: {
      acceptedKeywords: ['回忆', '珍惜'],
      semanticEquivalentAllowed: true,
    },
    rubric: validRubric(),
    minimumAnswerRequirement: {
      minLength: 12,
      requireTextEvidence: true,
      requireExplanation: true,
    },
    abilityMetadata: validAbilityMetadata(),
    source: validSource(),
    tags: ['observation_task:task-text', 'reading', 'analysis'],
  };
}

function createCandidate(content: QuestionEditableFields) {
  return createQuestionCandidate({
    candidateId: `candidate-${content.responseFormat}`,
    generationCommandId: `command-${content.responseFormat}`,
    generationCommandFingerprint: `fingerprint-${content.responseFormat}`,
    trainingTaskId: `task-${content.responseFormat}`,
    candidateType: 'initial',
    content,
    generationReason: 'Stage 1 schema verification.',
    changedFields: [],
    allowedFields: [],
    lockedFields: [],
    generationContext: {
      modelId: 'fixture-model',
      promptVersion: 'fixture-prompt-v1',
      promptHash: 'fixture-prompt-hash',
      ruleVersion: 'single-choice-stage1-v1',
      materialVersionId: 'material-leaf:v1',
      observationPlanVersion: 1,
      trainingTaskVersion: 1,
      generatedAt: NOW,
    },
    status: 'ready',
    createdAt: NOW,
  });
}

async function createChoiceDraft(
  suffix: string,
  overrides: Partial<CreateStructuredQuestionDraftInput> = {},
) {
  const repo = await repositoryWithMaterial();
  const content = validChoiceContent();
  const draft = await createStructuredQuestionDraft(repo, {
    ...content,
    draftId: `draft-${suffix}`,
    resourceId: `resource-${suffix}`,
    taskId: `task-${suffix}`,
    now: NOW,
    ...overrides,
  });
  return { repo, draftId: draft.draftId };
}

async function repositoryWithMaterial() {
  const repo = new InMemoryQuestionResourceAdmissionRepository();
  await createQuestionMaterial(repo, {
    materialId: 'material-leaf',
    materialVersionId: 'material-leaf:v1',
    versionNumber: 1,
    title: '旧书中的树叶',
    content: '父亲整理书柜时，从一本旧书里发现一片已经褪色的树叶。他捏着树叶站了很久，最后把它小心地夹回原处。',
    source: validSource(),
    createdAt: NOW,
  });
  return repo;
}

function validRubric(): QuestionResourceRubricItem[] {
  return [{
    itemId: 'rubric-comprehension',
    name: '理解人物行为',
    description: '根据父亲停留和保存树叶的行为判断其情感。',
    abilityId: 'comprehension',
    importance: 'critical',
    required: true,
    acceptedSignals: ['珍惜回忆', '重视树叶承载的感情'],
  }];
}

function validAbilityMetadata(): QuestionAbilityMetadata {
  return {
    abilityId: 'comprehension',
    supportingAbilityIds: ['extraction'],
    prerequisiteAbilityIds: ['extraction'],
    taskRole: 'training',
    difficulty: 'basic',
  };
}

function validSource(): QuestionSource {
  return {
    sourceType: 'manual',
    description: 'Synthetic material for Stage 1 verification.',
    copyrightNote: 'Synthetic internal fixture.',
  };
}

function hasChoiceCode(
  result: { issues: Array<{ code: string }> },
  code: string,
): boolean {
  return result.issues.some((issue) => issue.code === code);
}

function hasResourceCode(
  result: { issues: Array<{ code: string }> },
  code: string,
): boolean {
  return result.issues.some((issue) => issue.code === code);
}
