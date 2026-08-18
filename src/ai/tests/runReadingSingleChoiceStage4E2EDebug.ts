import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { interpretComplementaryLearningObservations } from '../agents/complementaryLearningObservationAgent.ts';
import {
  prepareFormalResourceRuntimeTask,
  validateFormalResourceLearningTrace,
} from '../agents/formalResourceRuntimeIntegrationAgent.ts';
import {
  createMaterialProductionPlan,
  createQuestionDraftFromObservationTask,
  linkFrozenResourceToObservationTask,
  reviewMaterialObservationPlan,
  submitMaterialObservationPlanForReview,
} from '../agents/materialObservationApplicationService.ts';
import {
  createQuestionMaterial,
  freezeQuestionResourceDraft,
  reviewQuestionResourceDraft,
  submitQuestionResourceForReview,
  validateStructuredQuestionDraft,
  type CreateStructuredQuestionDraftInput,
} from '../agents/questionResourceAdmissionAgent.ts';
import {
  createPhase17ProductCapabilitySnapshot,
  createPhase17ResourceCoveragePolicy,
  generateResourceCoverage,
} from '../agents/resourceCoverageAgent.ts';
import { runSingleChoiceDiagnosis } from '../agents/singleChoiceDiagnosisAgent.ts';
import {
  createFormalResourceBootstrapTaskRequest,
  matchCurrentFormalResource,
  resolveFormalResourceBootstrapMatch,
} from '../agents/phase173FormalResourceMatchingService.ts';
import { runTaskEvidenceReturnAgent } from '../agents/taskEvidenceReturnAgent.ts';
import { runTaskExecutionAgent } from '../agents/taskExecutionAgent.ts';
import { createDiagnosisProviderConfigSnapshot } from '../agents/realLLMRuntimeFoundationAgent.ts';
import { InMemoryMaterialObservationRepository } from '../repositories/inMemoryMaterialObservationRepository.ts';
import { InMemoryQuestionResourceAdmissionRepository } from '../repositories/inMemoryQuestionResourceAdmissionRepository.ts';
import type { DiagnosisResult } from '../schemas/diagnosis.schema.ts';
import type { MaterialProductionTaskInput } from '../agents/materialObservationApplicationService.ts';
import type { IndependentLearningObservation } from '../schemas/complementaryLearningObservation.schema.ts';
import type { MaterialObservationPlan } from '../schemas/materialObservation.schema.ts';
import type {
  FrozenQuestionResourceVersion,
  QuestionMaterialVersion,
  QuestionResourceRubricItem,
} from '../schemas/questionResourceAdmission.schema.ts';
import { RESOURCE_MATCH_QUALITY_SCHEMA_VERSION, type QualityGatedExecutableTask } from '../schemas/resourceMatchQuality.schema.ts';
import { SINGLE_CHOICE_INTERACTION_SCHEMA_VERSION, type SingleChoiceInteraction } from '../schemas/singleChoiceInteraction.schema.ts';
import type { TaskEvidenceReturnResult } from '../schemas/taskEvidenceReturn.schema.ts';

const NOW = '2026-08-18T15:00:00.000Z';
const SUBMITTED_AT = '2026-08-18T15:05:00.000Z';
const STUDENT_ID = 'student-single-choice-stage4';
const STORE_PATH = '.local-data/formal-resource-store.json';

type Repositories = {
  resources: InMemoryQuestionResourceAdmissionRepository;
  observations: InMemoryMaterialObservationRepository;
};

type PublishedTask = {
  order: number;
  version: FrozenQuestionResourceVersion;
  observationTaskPlanId: string;
};

type MaterialChain = Repositories & {
  material: QuestionMaterialVersion;
  plan: MaterialObservationPlan;
  tasks: PublishedTask[];
};

type ExecutedObservation = {
  observation: IndependentLearningObservation;
  evidence: TaskEvidenceReturnResult;
  tracePassed: boolean;
};

type DebugCase = { name: string; run: () => void | Promise<void> };

const materials = await loadRealMaterials(['《狼》', '《天上的街市》']);
const wolf = await buildMaterialChain(materials.get('《狼》')!, wolfSpecification());
const street = await buildMaterialChain(materials.get('《天上的街市》')!, streetSpecification());

const cases: DebugCase[] = [
  {
    name: 'S4-01 two current corpus materials keep their real version identity',
    run: () => {
      assert.equal(wolf.material.materialVersionId, 'material-b38614ee-a55:v3');
      assert.equal(street.material.materialVersionId, 'material-c90bbd38-7fe:v3');
      assert.notEqual(wolf.material.metadata?.genre, street.material.metadata?.genre);
    },
  },
  {
    name: 'S4-02 real plans preserve role-driven order instead of forcing choice first',
    run: () => {
      assert.deepEqual(wolf.tasks.map((item) => item.version.responseFormat), ['single_choice', 'long_text']);
      assert.deepEqual(street.tasks.map((item) => item.version.responseFormat), ['long_text', 'single_choice']);
    },
  },
  {
    name: 'S4-03 publication is idempotent and leaves one current Frozen Version and Active Link',
    run: async () => {
      for (const chain of [wolf, street]) {
        for (const item of chain.tasks) {
          const duplicate = await freezeQuestionResourceDraft(chain.resources, item.version.sourceDraftId, SUBMITTED_AT);
          assert.equal(duplicate.inserted, false);
          assert.equal(duplicate.version.resourceVersionId, item.version.resourceVersionId);
          const registry = await chain.resources.getRegistryEntry(item.version.resourceId);
          const links = await chain.observations.listLinks(item.version.resourceId);
          assert.equal(registry?.currentFrozenVersionId, item.version.resourceVersionId);
          assert.equal(links.filter((link) => link.status === 'active').length, 1);
        }
      }
    },
  },
  {
    name: 'S4-04 closed capability snapshot blocks choice while v2 default gate admits it',
    run: async () => {
      const source = await coverageSource([wolf, street]);
      const policy = createPhase17ResourceCoveragePolicy({ createdAt: NOW });
      const closed = generateResourceCoverage({
        source,
        policy,
        capabilitySnapshot: createPhase17ProductCapabilitySnapshot({
          createdAt: NOW,
          questionTypes: { multiple_choice: 'resource_only' },
          responseFormats: { single_choice: 'resource_only' },
        }),
        generatedAt: NOW,
      });
      const open = generateResourceCoverage({
        source,
        policy,
        capabilitySnapshot: createPhase17ProductCapabilitySnapshot({ createdAt: NOW }),
        generatedAt: NOW,
      });
      assert.equal(closed.status, 'complete');
      assert.equal(open.status, 'complete');
      assert(closed.report?.rejectedRecords.some((item) => item.issueCodes.includes('response_format_not_product_executable')));
      assert.equal(open.report?.rejectedRecords.some((item) => item.issueCodes.includes('response_format_not_product_executable')), false);
      const comprehension = open.report?.cells.find((cell) => cell.key.abilityId === 'comprehension' && cell.key.taskRole === 'training');
      assert.equal(comprehension?.responseFormatBreakdown.single_choice, 2, JSON.stringify({
        cell: comprehension,
        rejected: open.report?.rejectedRecords,
      }));
      assert.equal(comprehension?.questionTypeBreakdown.multiple_choice, 2);
    },
  },
  {
    name: 'S4-05 both real choice resources pass formal source resolution and Learning preparation',
    run: async () => {
      for (const chain of [wolf, street]) {
        const choice = chain.tasks.find((item) => item.version.responseFormat === 'single_choice')!;
        const prepared = await prepare(chain, choice.version);
        assert.equal(prepared.status, 'prepared', prepared.issues.join(', '));
        assert.equal(prepared.sourceResolution.status, 'ready');
        assert.equal(prepared.taskPreparation?.concreteTaskResult.concreteTask?.responseFormat, 'single_choice');
        const serializedDelivery = JSON.stringify(prepared.taskPreparation?.concreteTaskResult.concreteTask?.singleChoiceDelivery);
        assert.equal(serializedDelivery.includes('correctOptionIds'), false);
        assert.equal(serializedDelivery.includes('distractorRationales'), false);
      }
    },
  },
  {
    name: 'S4-05A Learning option order is stable per student and varied across students',
    run: async () => {
      const choice = wolf.tasks.find((item) => item.version.responseFormat === 'single_choice')!;
      const first = await prepare(wolf, choice.version, 'student-order-1');
      const repeated = await prepare(wolf, choice.version, 'student-order-1');
      const firstOrder = first.taskPreparation?.concreteTaskResult.concreteTask?.singleChoiceDelivery?.options
        .map((option) => option.optionId);
      const repeatedOrder = repeated.taskPreparation?.concreteTaskResult.concreteTask?.singleChoiceDelivery?.options
        .map((option) => option.optionId);
      assert.deepEqual(repeatedOrder, firstOrder);

      const correctOptionId = choice.version.choiceInteraction!.correctOptionIds[0];
      const positions = new Set<number>();
      for (let index = 0; index < 12; index += 1) {
        const prepared = await prepare(wolf, choice.version, `student-order-${index + 1}`);
        const options = prepared.taskPreparation?.concreteTaskResult.concreteTask?.singleChoiceDelivery?.options || [];
        positions.add(options.findIndex((option) => option.optionId === correctOptionId));
      }
      assert(positions.size >= 3, 'Learning kept the correct answer in one display position.');
    },
  },
  {
    name: 'S4-05B formal matching uses the frozen response format instead of forcing open response',
    run: async () => {
      const choice = wolf.tasks.find((item) => item.version.responseFormat === 'single_choice')!;
      const request = createFormalResourceBootstrapTaskRequest(
        STUDENT_ID,
        NOW,
        choice.version.abilityMetadata.abilityId,
        choice.version.abilityMetadata.taskRole,
      );
      const matched = await matchCurrentFormalResource({
        taskRequest: request,
        studentId: STUDENT_ID,
        resourceRepository: wolf.resources,
        observationRepository: wolf.observations,
        recentHistory: emptyHistory(),
        bootstrapMaterialId: choice.version.materialId,
        requiredResourceVersionId: choice.version.resourceVersionId,
        evaluatedAt: NOW,
      });
      assert.equal(matched.status, 'matched', JSON.stringify(matched));
      assert.equal(matched.resourceVersion?.responseFormat, 'single_choice');
      assert(matched.matchEvaluation?.existingMatchResult?.matchReasons.includes('responseMode matches.'));
      assert(matched.matchEvaluation?.existingMatchResult?.matchReasons.includes('questionType matches.'));
    },
  },
  {
    name: 'S4-05C a fresh training session selects the entry choice and can still fall back to text',
    run: async () => {
      const versions = await wolf.resources.listVersions();
      const fresh = await resolveFormalResourceBootstrapMatch({
        studentId: STUDENT_ID,
        versions,
        resourceRepository: wolf.resources,
        observationRepository: wolf.observations,
        recentHistory: emptyHistory(),
        evaluatedAt: NOW,
        reusePreviouslyUsedWhenExhausted: true,
      });
      assert.equal(fresh.matched.status, 'matched', JSON.stringify(fresh.matched));
      assert.equal(fresh.matched.resourceVersion?.responseFormat, 'single_choice');

      const choice = fresh.matched.resourceVersion!;
      const fallback = await resolveFormalResourceBootstrapMatch({
        studentId: STUDENT_ID,
        versions,
        resourceRepository: wolf.resources,
        observationRepository: wolf.observations,
        recentHistory: {
          ...emptyHistory(),
          recentTaskIds: [choice.taskId],
          recentResourceIds: [choice.resourceId],
          recentResourceVersionIds: [choice.resourceVersionId],
        },
        evaluatedAt: NOW,
        reusePreviouslyUsedWhenExhausted: true,
      });
      assert.equal(fallback.matched.status, 'matched', JSON.stringify(fallback.matched));
      assert.notEqual(fallback.matched.resourceVersion?.resourceVersionId, choice.resourceVersionId);
      assert.notEqual(fallback.matched.resourceVersion?.responseFormat, 'single_choice');
    },
  },
  {
    name: 'S4-06 wrong choice creates rationale-specific diagnosis and complete formal trace',
    run: async () => {
      const choice = wolf.tasks[0];
      const result = await executeChoice(wolf, choice.version, 'wolf-surface');
      assert.equal(result.observation.performance, 'weak');
      assert.equal(result.tracePassed, true);
      assert.match(result.evidence.diagnosisResult?.diagnosisSummary || '', /表面|忽略前文/);
      assert.equal(JSON.stringify(result.evidence.diagnosisResult).includes('wolf-correct'), false);
    },
  },
  {
    name: 'S4-07 correct choice remains conservative and does not claim mastery',
    run: async () => {
      const choice = street.tasks[1];
      const result = await executeChoice(street, choice.version, 'street-correct');
      assert.equal(result.observation.performance, 'strong');
      assert.equal(result.tracePassed, true);
      assert.match(result.evidence.diagnosisResult?.rootCause || '', /仍需|继续观察/);
      assert((result.evidence.diagnosisResult?.confidence || 1) < 0.8);
    },
  },
  {
    name: 'S4-08 structured version mismatch is blocked before Diagnosis and Evidence',
    run: async () => {
      const choice = wolf.tasks[0];
      const prepared = await prepare(wolf, choice.version);
      const concrete = prepared.taskPreparation!.concreteTaskResult.concreteTask!;
      const readiness = prepared.taskPreparation!.concreteTaskResult.readiness;
      const delivery = concrete.singleChoiceDelivery!;
      const execution = runTaskExecutionAgent({
        concreteTask: concrete,
        readiness,
        studentAnswer: {
          singleChoiceAnswer: {
            responseFormat: 'single_choice',
            selectedOptionIds: ['wolf-correct'],
            optionSetVersion: delivery.optionSetVersion + 1,
            displayedOptionOrder: delivery.options.map((option) => option.optionId),
          },
          submittedAt: SUBMITTED_AT,
        },
        startedAt: NOW,
      });
      assert.equal(execution.taskExecutionResult?.canEnterDiagnosisRuntime, false);
      assert(execution.responseValidity?.reasons.length, JSON.stringify(execution.responseValidity));
    },
  },
  {
    name: 'S4-09 text and choice attempts remain independent and support complementary routing',
    run: async () => {
      const wolfChoice = await executeChoice(wolf, wolf.tasks[0].version, 'wolf-surface');
      const wolfText = await executeText(wolf, wolf.tasks[1].version, 'strong');
      const streetText = await executeText(street, street.tasks[0].version, 'weak');
      const streetChoice = await executeChoice(street, street.tasks[1].version, 'street-correct');
      const wolfDecision = interpretComplementaryLearningObservations({ choice: wolfChoice.observation, text: wolfText.observation });
      const streetDecision = interpretComplementaryLearningObservations({ choice: streetChoice.observation, text: streetText.observation });
      assert.equal(wolfDecision.trainingRoute, 'diagnostic_verification');
      assert.equal(streetDecision.trainingRoute, 'constructed_response_training');
      assert.equal(new Set(wolfDecision.sourceEvidenceIds).size, 2);
      assert.equal(new Set(streetDecision.sourceEvidenceIds).size, 2);
      assert.equal('mergedScore' in wolfDecision, false);
      assert.equal('mergedScore' in streetDecision, false);
    },
  },
  {
    name: 'S4-10 all four complementary routes remain available after the gate opens',
    run: () => {
      const matrix = [
        ['weak', 'weak', 'prerequisite_foundation'],
        ['strong', 'weak', 'constructed_response_training'],
        ['weak', 'strong', 'diagnostic_verification'],
        ['strong', 'strong', 'retest_or_transfer'],
      ] as const;
      for (const [choicePerformance, textPerformance, route] of matrix) {
        const result = interpretComplementaryLearningObservations({
          choice: observation('single_choice', choicePerformance, `choice-${choicePerformance}-${textPerformance}`),
          text: observation('text', textPerformance, `text-${choicePerformance}-${textPerformance}`),
        });
        assert.equal(result.trainingRoute, route);
      }
    },
  },
];

let passed = 0;
const failures: string[] = [];
console.log('Reading single-choice Stage 4 real-material E2E debug');
console.log('='.repeat(78));
for (const testCase of cases) {
  try {
    await testCase.run();
    passed += 1;
    console.log(`PASS ${testCase.name}`);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    failures.push(`${testCase.name}: ${message}`);
    console.error(`FAIL ${testCase.name}: ${message}`);
    if (error instanceof Error && error.stack) console.error(error.stack);
  }
}
console.log('-'.repeat(78));
console.log(`Result: ${passed}/${cases.length} PASS`);
console.log(`Stage 4 Engineering E2E: ${failures.length === 0 ? 'PASS' : 'FAIL'}`);
console.log('Source: current formal corpus material versions; repositories isolated in memory; no product data mutated.');
if (failures.length > 0) {
  failures.forEach((failure) => console.error(`- ${failure}`));
  process.exitCode = 1;
}

async function loadRealMaterials(titles: string[]): Promise<Map<string, QuestionMaterialVersion>> {
  const raw = JSON.parse(await readFile(STORE_PATH, 'utf8')) as {
    data?: { questionResources?: { materials?: QuestionMaterialVersion[] } };
  };
  const all = raw.data?.questionResources?.materials || [];
  const result = new Map<string, QuestionMaterialVersion>();
  for (const title of titles) {
    const material = all
      .filter((item) => item.title === title && item.status !== 'retired')
      .sort((left, right) => right.versionNumber - left.versionNumber)[0];
    assert(material, `Current real material not found: ${title}`);
    assert.notEqual(material.metadata?.provenanceStatus, 'test_only', `${title} is test-only and cannot support Stage 4.`);
    result.set(title, material);
  }
  return result;
}

async function buildMaterialChain(
  sourceMaterial: QuestionMaterialVersion,
  specification: { tasks: MaterialProductionTaskInput[]; drafts: Array<ReturnType<typeof choiceDraft> | ReturnType<typeof textDraft>> },
): Promise<MaterialChain> {
  const resources = new InMemoryQuestionResourceAdmissionRepository();
  const observations = new InMemoryMaterialObservationRepository();
  const material = await createQuestionMaterial(resources, {
    materialId: sourceMaterial.materialId,
    materialVersionId: sourceMaterial.materialVersionId,
    versionNumber: sourceMaterial.versionNumber,
    status: sourceMaterial.status,
    parentMaterialVersionId: sourceMaterial.parentMaterialVersionId,
    revisionNote: sourceMaterial.revisionNote,
    title: sourceMaterial.title,
    content: sourceMaterial.content,
    source: sourceMaterial.source,
    metadata: sourceMaterial.metadata,
    createdAt: sourceMaterial.createdAt,
    updatedAt: sourceMaterial.updatedAt,
  });
  const created = await createMaterialProductionPlan(resources, observations, {
    materialVersionId: material.materialVersionId,
    tasks: specification.tasks,
    now: NOW,
  });
  assert.equal(created.validation.passed, true, created.validation.issues.map((item) => item.code).join(', '));
  await submitMaterialObservationPlanForReview(resources, observations, created.plan.materialObservationPlanId, NOW);
  await reviewMaterialObservationPlan(observations, {
    planId: created.plan.materialObservationPlanId,
    action: 'approve',
    reviewerId: 'single-operator-adoption',
    notes: '采用完整 AI 任务组；不进行人工改题。',
    now: NOW,
  });
  const plan = (await observations.getPlan(created.plan.materialObservationPlanId))!;
  const tasks: PublishedTask[] = [];
  for (let index = 0; index < plan.taskPlans.length; index += 1) {
    const taskPlan = plan.taskPlans[index];
    const content = specification.drafts[index];
    assert(content, `Missing draft specification at index ${index}.`);
    const draft = await createQuestionDraftFromObservationTask(resources, observations, {
      planId: plan.materialObservationPlanId,
      observationTaskPlanId: taskPlan.observationTaskPlanId,
      content,
    });
    const validation = await validateStructuredQuestionDraft(resources, draft.draftId, NOW);
    assert.equal(validation.passed, true, validation.issues.map((item) => item.code).join(', '));
    await submitQuestionResourceForReview(resources, draft.draftId, NOW);
    await reviewQuestionResourceDraft(resources, {
      draftId: draft.draftId,
      action: 'approve',
      reviewerId: 'single-operator-adoption',
      notes: '采用完整 AI Candidate，不进行人工字段编辑。',
      now: NOW,
    });
    const frozen = await freezeQuestionResourceDraft(resources, draft.draftId, NOW);
    const linked = await linkFrozenResourceToObservationTask(resources, observations, {
      planId: plan.materialObservationPlanId,
      observationTaskPlanId: taskPlan.observationTaskPlanId,
      resourceVersionId: frozen.version.resourceVersionId,
      linkedAt: NOW,
    });
    assert.equal(linked.link.status, 'active', linked.issues.join(', '));
    tasks.push({ order: index + 1, version: frozen.version, observationTaskPlanId: taskPlan.observationTaskPlanId });
  }
  return { resources, observations, material, plan, tasks };
}

function wolfSpecification() {
  const choice = interaction('wolf', [
    ['wolf-correct', '为了借助柴草堆形成依托，避免腹背受敌。'],
    ['wolf-surface', '因为他只是想在麦场里休息片刻。'],
    ['wolf-cause', '因为狼已经停止追赶，他可以放心放下担子。'],
    ['wolf-over', '因为他计划点燃柴草堆把两只狼烧死。'],
  ], 'wolf-correct', [
    ['wolf-surface', 'surface_reading', '只看到“麦场”和“奔倚”，忽略前文“恐前后受其敌”。', '核对第三段奔倚积薪前的处境说明。'],
    ['wolf-cause', 'causal_reversal', '把屠户防御后的局面倒置成狼先停止追赶。', '核对“并驱如故”与“弛担持刀”的先后。'],
    ['wolf-over', 'over_inference', '加入了材料没有出现的点火计划。', '第三段只写倚靠、卸担和持刀。'],
  ]);
  return {
    tasks: [
      task('causality', 'comprehension', 'basic', '判断屠户奔倚积薪的直接原因', '根据处境与动作选择最符合文本的原因', '以低输入负担确认局部因果理解。'),
      task('plot', 'inference', 'intermediate', '解释一狼假寐在情节中的作用', '引用前后动作，解释假寐与诱敌的关系', '在基础因果判断后进入证据组织与推理。'),
    ],
    drafts: [
      choiceDraft('wolf', '屠户为什么“奔倚”积薪堆下？', choice, 'comprehension'),
      textDraft('wolf', '“一狼假寐”在屠户识破两狼计谋的过程中起到什么作用？请结合前后动作说明。', 'inference', ['假寐', '诱敌', '隧入', '前后夹击']),
    ],
  };
}

function streetSpecification() {
  const choice = interaction('street', [
    ['street-correct', '诗人把传说中的阻隔想象得更轻，从而突出自由美好的生活。'],
    ['street-surface', '诗人只是在准确说明天河真实的宽度。'],
    ['street-entity', '牛郎织女认为人间的街灯不够明亮。'],
    ['street-scope', '诗人借此证明所有神话传说都不可信。'],
  ], 'street-correct', [
    ['street-surface', 'surface_reading', '把想象性诗句当成客观测量，忽略“我想”“定然”的语境。', '核对第二至四节由街灯展开的想象。'],
    ['street-entity', 'entity_confusion', '混淆了想象者与诗中人物，判断主体错误。', '“我想”表明想象主体是诗人。'],
    ['street-scope', 'scope_shift', '把局部诗意改写扩大为对全部神话的判断。', '判断范围应限于诗中对天河和牛女生活的改写。'],
  ]);
  return {
    tasks: [
      task('language', 'analysis', 'intermediate', '分析街灯与明星互喻如何开启想象', '结合首节意象转换分析表达作用', '本材料先观察整体诗意转换，不固定让单选排第一。'),
      task('theme', 'comprehension', 'intermediate', '辨析浅浅天河所承载的生活想象', '依据诗句选择最符合想象方向的理解', '在整体分析后用低输入任务辨析局部理解。'),
    ],
    drafts: [
      textDraft('street', '开头把“街灯”和“明星”相互比喻，对全诗想象的展开有什么作用？', 'analysis', ['街灯', '明星', '联想', '天上街市']),
      choiceDraft('street', '“浅浅的天河”“不甚宽广”主要表现了诗人怎样的想象？', choice, 'comprehension'),
    ],
  };
}

function task(
  primaryDimension: MaterialProductionTaskInput['primaryDimension'],
  abilityId: MaterialProductionTaskInput['abilityId'],
  difficulty: MaterialProductionTaskInput['difficulty'],
  questionStem: string,
  expectedStudentAction: string,
  designReason: string,
): MaterialProductionTaskInput {
  return {
    primaryDimension,
    abilityId,
    taskRole: 'training',
    difficulty,
    anchorType: 'full_text',
    questionStem,
    expectedStudentAction,
    designReason,
  };
}

function emptyHistory() {
  return {
    studentId: STUDENT_ID,
    recentTaskIds: [],
    recentResourceIds: [],
    recentResourceVersionIds: [],
    recentMaterialIds: [],
    recentExecutionSessionIds: [],
    historyWindowEndedAt: NOW,
  };
}

function choiceDraft(
  suffix: string,
  questionStem: string,
  choiceInteraction: SingleChoiceInteraction,
  abilityId: QuestionResourceRubricItem['abilityId'],
): Omit<CreateStructuredQuestionDraftInput, 'materialVersionId' | 'abilityMetadata' | 'tags'> & { tags?: string[] } {
  return {
    draftId: `stage4-${suffix}-choice-draft`,
    resourceId: `stage4-${suffix}-choice-resource`,
    taskId: `stage4-${suffix}-choice-task`,
    title: '基础理解辨析',
    questionStem,
    questionType: 'multiple_choice',
    responseFormat: 'single_choice',
    choiceInteraction,
    assessmentMode: 'exact_match',
    answerAcceptance: { acceptedOptionIds: [...choiceInteraction.correctOptionIds] },
    rubric: [rubric('依据材料完成基础判断', abilityId, `stage4-${suffix}-choice-rubric`, false)],
    minimumAnswerRequirement: {
      responseFormat: 'single_choice',
      minLength: 0,
      requireTextEvidence: false,
      requireExplanation: false,
      minSelections: 1,
      maxSelections: 1,
    },
    source: { sourceType: 'ai_assisted', description: 'Stage 4 真实材料单选验收 Candidate。' },
    tags: ['reading', 'stage4_acceptance'],
    now: NOW,
  };
}

function textDraft(
  suffix: string,
  questionStem: string,
  abilityId: QuestionResourceRubricItem['abilityId'],
  acceptedKeywords: string[],
): Omit<CreateStructuredQuestionDraftInput, 'materialVersionId' | 'abilityMetadata' | 'tags'> & { tags?: string[] } {
  return {
    draftId: `stage4-${suffix}-text-draft`,
    resourceId: `stage4-${suffix}-text-resource`,
    taskId: `stage4-${suffix}-text-task`,
    title: '文本解释与证据组织',
    questionStem,
    questionType: 'reading_comprehension',
    responseFormat: 'long_text',
    assessmentMode: 'reasoning_chain',
    answerAcceptance: { acceptedKeywords, semanticEquivalentAllowed: true, normalizationRules: ['trim', 'ignore_punctuation'] },
    rubric: [rubric('结合文本形成解释', abilityId, `stage4-${suffix}-text-rubric`, true)],
    minimumAnswerRequirement: { responseFormat: 'long_text', minLength: 18, requireTextEvidence: true, requireExplanation: true },
    source: { sourceType: 'ai_assisted', description: 'Stage 4 真实材料文本互补验收 Candidate。' },
    tags: ['reading', 'stage4_acceptance'],
    now: NOW,
  };
}

function rubric(
  name: string,
  abilityId: QuestionResourceRubricItem['abilityId'],
  itemId: string,
  textEvidence: boolean,
): QuestionResourceRubricItem {
  return {
    itemId,
    name,
    description: name,
    abilityId,
    importance: 'critical',
    required: true,
    evidenceRequirement: { requireTextEvidence: textEvidence, requireExplanation: textEvidence },
    acceptedSignals: [name],
  };
}

function interaction(
  suffix: string,
  options: Array<[string, string]>,
  correctOptionId: string,
  rationales: Array<[string, SingleChoiceInteraction['distractorRationales'][number]['misconceptionCode'], string, string]>,
): SingleChoiceInteraction {
  return {
    schemaVersion: SINGLE_CHOICE_INTERACTION_SCHEMA_VERSION,
    selectionMode: 'single',
    options: options.map(([optionId, content]) => ({ optionId, content })),
    correctOptionIds: [correctOptionId],
    distractorRationales: rationales.map(([optionId, misconceptionCode, diagnosisMeaning, evidenceBoundary]) => ({ optionId, misconceptionCode, diagnosisMeaning, evidenceBoundary })),
    optionSetVersion: suffix === 'wolf' ? 1 : 2,
  };
}

async function coverageSource(chains: MaterialChain[]) {
  const registryEntries = (await Promise.all(chains.map((chain) => chain.resources.listRegistryEntries()))).flat();
  const frozenVersions = (await Promise.all(chains.map((chain) => chain.resources.listVersions()))).flat();
  const validations = (await Promise.all(frozenVersions.map((version) => (
    chains.find((chain) => chain.material.materialVersionId === version.materialVersionId)!
      .resources.getValidation(version.validationId)
  )))).filter((item): item is NonNullable<typeof item> => Boolean(item));
  const reviews = (await Promise.all(chains.map((chain) => chain.resources.listReviews()))).flat();
  return { registryEntries, frozenVersions, validations, reviews, materials: chains.map((chain) => chain.material) };
}

async function prepare(
  chain: MaterialChain,
  version: FrozenQuestionResourceVersion,
  studentId = STUDENT_ID,
) {
  return prepareFormalResourceRuntimeTask({
    resourceVersionId: version.resourceVersionId,
    qualityGatedTask: qualityTask(version, studentId),
    resourceRepository: chain.resources,
    observationRepository: chain.observations,
    createdAt: NOW,
  });
}

function qualityTask(
  version: FrozenQuestionResourceVersion,
  studentId = STUDENT_ID,
): QualityGatedExecutableTask {
  return {
    traceId: `stage4-trace-${version.resourceVersionId}`,
    executableTask: {
      executableTaskId: `stage4-executable-${version.resourceVersionId}`,
      studentId,
      sourceType: 'resource_match',
      sourceTaskId: version.taskId,
      taskRole: version.abilityMetadata.taskRole,
      targetAbilityId: version.abilityMetadata.abilityId,
      validationGoal: `观察 ${version.abilityMetadata.abilityId} 的当前表现。`,
      contentRef: version.materialVersionId || 'missing-material',
      questionRef: version.resourceVersionId,
      rubricRef: version.validationId,
      sourceTaskRequestId: `stage4-request-${version.taskId}`,
      sourceFulfillmentRequestId: `stage4-fulfillment-${version.taskId}`,
      limitations: [],
      createdAt: NOW,
    },
    resourceId: version.resourceId,
    resourceVersionId: version.resourceVersionId,
    taskId: version.taskId,
    materialId: version.materialId,
    materialVersionId: version.materialVersionId,
    constraintsId: `stage4-constraints-${version.taskId}`,
    resourceMatchQualityEvaluationId: `stage4-quality-${version.taskId}`,
    createdAt: NOW,
    schemaVersion: RESOURCE_MATCH_QUALITY_SCHEMA_VERSION,
  };
}

async function executeChoice(chain: MaterialChain, version: FrozenQuestionResourceVersion, selectedOptionId: string): Promise<ExecutedObservation> {
  const prepared = await prepare(chain, version);
  assert.equal(prepared.status, 'prepared', prepared.issues.join(', '));
  const concrete = prepared.taskPreparation!.concreteTaskResult.concreteTask!;
  const readiness = prepared.taskPreparation!.concreteTaskResult.readiness;
  const delivery = concrete.singleChoiceDelivery!;
  const execution = runTaskExecutionAgent({
    concreteTask: concrete,
    readiness,
    studentAnswer: {
      singleChoiceAnswer: {
        responseFormat: 'single_choice',
        selectedOptionIds: [selectedOptionId],
        optionSetVersion: delivery.optionSetVersion,
        displayedOptionOrder: delivery.options.map((option) => option.optionId),
      },
      submittedAt: SUBMITTED_AT,
      elapsedSeconds: 35,
    },
    startedAt: NOW,
  });
  assert.equal(execution.taskExecutionResult?.canEnterDiagnosisRuntime, true);
  const runtime = runSingleChoiceDiagnosis({
    concreteTask: concrete,
    taskExecutionResult: execution.taskExecutionResult!,
    executionMode: 'live',
    requestId: `stage4-diagnosis-${version.taskId}-${selectedOptionId}`,
    providerConfig: createDiagnosisProviderConfigSnapshot({ provider: 'none', model: 'deterministic', createdAt: NOW }),
    commitOnSuccess: true,
    startedAt: NOW,
  });
  const evidence = runTaskEvidenceReturnAgent({
    concreteTask: concrete,
    taskExecutionResult: execution.taskExecutionResult!,
    diagnosisResult: runtime.formalDiagnosisCommit?.diagnosisResult,
    diagnosisResultId: runtime.formalDiagnosisCommit?.formalDiagnosisId,
    returnedAt: SUBMITTED_AT,
  });
  assert.equal(evidence.status, 'evidence_returned');
  const trace = validateFormalResourceLearningTrace({
    sourceContext: prepared.sourceResolution.sourceContext!,
    concreteTask: concrete,
    diagnosisResult: runtime.formalDiagnosisCommit?.diagnosisResult,
    evidenceReturnResult: evidence,
  });
  assert.equal(trace.passed, true, trace.issues.join(', '));
  return {
    observation: {
      responseFormat: 'single_choice',
      studentId: concrete.studentId,
      materialVersionId: version.materialVersionId!,
      taskId: concrete.taskId,
      attemptId: execution.studentResponse!.responseId,
      diagnosisId: runtime.formalDiagnosisCommit!.formalDiagnosisId,
      evidenceId: evidence.abilityEvidence[0].id,
      abilityIds: [concrete.targetAbilityId, ...(runtime.formalDiagnosisCommit?.diagnosisResult.relatedAbilities || [])],
      performance: runtime.formalDiagnosisCommit!.diagnosisResult.correct ? 'strong' : 'weak',
      observedAt: SUBMITTED_AT,
    },
    evidence,
    tracePassed: trace.passed,
  };
}

async function executeText(chain: MaterialChain, version: FrozenQuestionResourceVersion, performance: 'strong' | 'weak'): Promise<ExecutedObservation> {
  const prepared = await prepare(chain, version);
  assert.equal(prepared.status, 'prepared', prepared.issues.join(', '));
  const concrete = prepared.taskPreparation!.concreteTaskResult.concreteTask!;
  const readiness = prepared.taskPreparation!.concreteTaskResult.readiness;
  const answerText = performance === 'strong'
    ? version.resourceId.includes('wolf')
      ? '前狼假寐吸引屠户注意，后狼趁机从积薪后打洞，两处动作共同揭示了两狼前后夹击的计谋。'
      : '街灯与明星的相互比喻把地上景象连接到天空，并由此自然展开天上街市的想象。'
    : version.resourceId.includes('street')
      ? '街灯和明星只是两种景物，我认为开头没有推动后文想象。'
      : '假寐只是写狼睡着了，我认为这个动作没有其他作用。';
  const execution = runTaskExecutionAgent({
    concreteTask: concrete,
    readiness,
    studentAnswer: { answerText, submittedAt: SUBMITTED_AT, elapsedSeconds: 95 },
    startedAt: NOW,
  });
  assert.equal(execution.taskExecutionResult?.canEnterDiagnosisRuntime, true);
  const diagnosis = textDiagnosis(concrete.targetAbilityId, performance);
  const diagnosisId = `stage4-text-diagnosis-${version.taskId}-${performance}`;
  const evidence = runTaskEvidenceReturnAgent({
    concreteTask: concrete,
    taskExecutionResult: execution.taskExecutionResult!,
    diagnosisResult: diagnosis,
    diagnosisResultId: diagnosisId,
    returnedAt: SUBMITTED_AT,
  });
  assert.equal(evidence.status, 'evidence_returned');
  const trace = validateFormalResourceLearningTrace({
    sourceContext: prepared.sourceResolution.sourceContext!,
    concreteTask: concrete,
    diagnosisResult: diagnosis,
    evidenceReturnResult: evidence,
  });
  assert.equal(trace.passed, true, trace.issues.join(', '));
  return {
    observation: {
      responseFormat: 'text',
      studentId: concrete.studentId,
      materialVersionId: version.materialVersionId!,
      taskId: concrete.taskId,
      attemptId: execution.studentResponse!.responseId,
      diagnosisId,
      evidenceId: evidence.abilityEvidence[0].id,
      abilityIds: [concrete.targetAbilityId, ...(diagnosis.relatedAbilities || [])],
      performance,
      observedAt: SUBMITTED_AT,
    },
    evidence,
    tracePassed: trace.passed,
  };
}

function textDiagnosis(mainAbility: string, performance: 'strong' | 'weak'): DiagnosisResult {
  const strong = performance === 'strong';
  return {
    taskType: 'open_response',
    correct: null,
    strategyUsed: 'stage4_deterministic_text_acceptance',
    answerStatus: strong ? 'fully_meets' : 'does_not_meet',
    scoreBand: strong ? 'high' : 'low',
    rubricItems: [],
    matchedRubricItems: strong ? ['文本依据', '解释关系'] : [],
    missingRubricItems: strong ? [] : ['文本依据', '解释关系'],
    mainAbility,
    relatedAbilities: mainAbility === 'comprehension' ? [] : ['comprehension'],
    surfaceError: strong ? '本次回答完成了材料依据与结论之间的解释。' : '本次回答没有使用材料依据完成解释。',
    rootCause: strong ? '本次文本任务表现成立，仍需跨任务观察稳定性。' : '当前只形成文本组织不足的待验证判断。',
    errorType: strong ? '待验证' : '分析错误',
    abilityEvidence: [strong ? '本次回答包含材料依据与解释关系。' : '本次回答未形成可核对的材料依据。'],
    diagnosisSummary: strong ? '本次文本解释达到要求。' : '本次文本解释尚未达到要求。',
    nextTraining: strong ? '进入复测或迁移观察。' : '继续完成同目标的证据组织训练。',
    confidence: 0.75,
  };
}

function observation(
  responseFormat: 'single_choice' | 'text',
  performance: 'strong' | 'weak',
  suffix: string,
): IndependentLearningObservation {
  return {
    responseFormat,
    studentId: STUDENT_ID,
    materialVersionId: wolf.material.materialVersionId,
    taskId: `stage4-${responseFormat}-${suffix}`,
    attemptId: `stage4-attempt-${responseFormat}-${suffix}`,
    diagnosisId: `stage4-diagnosis-${responseFormat}-${suffix}`,
    evidenceId: `stage4-evidence-${responseFormat}-${suffix}`,
    abilityIds: ['comprehension'],
    performance,
    observedAt: SUBMITTED_AT,
  };
}
