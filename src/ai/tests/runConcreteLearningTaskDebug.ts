import { instantiateConcreteLearningTask } from '../agents/concreteLearningTaskAgent.ts';
import {
  isConcreteLearningTask,
  isTaskReadinessValidation,
  type ConcreteLearningTaskInstantiationResult,
} from '../schemas/concreteLearningTask.schema.ts';
import { branchTaskFulfillment } from '../agents/taskFulfillmentBranchingAgent.ts';
import { matchTaskResources } from '../agents/taskResourceMatchingAgent.ts';
import {
  buildFulfillmentRequestFixture,
  buildMockTaskResources,
  phase84RunAt,
} from './taskFulfillmentDebugFixtures.ts';

type DebugCase = {
  id: string;
  title: string;
  result: ConcreteLearningTaskInstantiationResult;
  expectedCanExecute: boolean;
  expectedIssueCode?: string;
};

function runConcreteLearningTaskDebug(): void {
  const resources = buildMockTaskResources();
  const matchedRequest = buildFulfillmentRequestFixture();
  const noMatchRequest = buildFulfillmentRequestFixture({
    targetAbilityId: '推理',
    requiredCapabilities: ['open_response', 'ability_observation', 'transfer_reasoning_probe'],
  });
  const matchedResult = matchTaskResources({
    fulfillmentRequest: matchedRequest,
    availableTaskResources: resources,
  });
  const noMatchResult = matchTaskResources({
    fulfillmentRequest: noMatchRequest,
    availableTaskResources: resources.filter((resource) => resource.taskRole !== 'retest'),
  });
  const matchedBranch = branchTaskFulfillment({
    fulfillmentRequest: matchedRequest,
    matchResult: matchedResult,
    availableTaskResources: resources,
    createdAt: phase84RunAt,
  });
  const noMatchBranch = branchTaskFulfillment({
    fulfillmentRequest: noMatchRequest,
    matchResult: noMatchResult,
    availableTaskResources: resources,
    createdAt: phase84RunAt,
  });

  if (!matchedBranch.executableTask) throw new Error('Debug fixture failed: missing executableTask.');
  if (!noMatchBranch.generationRequest) throw new Error('Debug fixture failed: missing generationRequest.');

  const matchedSuccess = instantiateConcreteLearningTask({
    executableTask: matchedBranch.executableTask,
    createdAt: phase84RunAt,
  });
  const generationSuccess = instantiateConcreteLearningTask({
    generationRequest: noMatchBranch.generationRequest,
    studentId: noMatchRequest.studentId,
    createdAt: phase84RunAt,
  });
  const missingAssessmentBasis = instantiateConcreteLearningTask({
    executableTask: matchedBranch.executableTask,
    createdAt: phase84RunAt,
    overrides: {
      referenceAnswer: undefined,
      scoringPoints: [],
      rubric: [],
      questionMetadata: {
        subject: '语文',
        questionType: '推理',
        assessmentMode: 'reasoning_chain',
        mainAbility: '推理',
        relatedAbilities: ['信息提取', '理解', '表达'],
        abilityPath: ['信息提取', '推理链构建', '结论表达'],
        rubric: [],
      },
    },
  });
  const abilityMismatch = instantiateConcreteLearningTask({
    executableTask: matchedBranch.executableTask,
    createdAt: phase84RunAt,
    overrides: {
      questionMetadata: {
        subject: '语文',
        questionType: '信息提取',
        assessmentMode: 'key_points',
        mainAbility: '信息提取',
        relatedAbilities: ['理解', '表达'],
        abilityPath: ['定位信息', '提取关键词'],
        rubric: [
          {
            id: 'information_location',
            name: '信息定位',
            description: '是否找到文本中的直接信息。',
            ability: '信息提取',
            weight: 100,
          },
        ],
      },
    },
  });
  const sourceNotTraceable = instantiateConcreteLearningTask({
    executableTask: matchedBranch.executableTask,
    createdAt: phase84RunAt,
    overrides: {
      sourceTaskRequestId: undefined,
      sourceExecutableTaskId: undefined,
      sourceTaskGenerationRequestId: undefined,
    },
  });
  const missingReadingText = instantiateConcreteLearningTask({
    executableTask: matchedBranch.executableTask,
    createdAt: phase84RunAt,
    overrides: {
      readingText: undefined,
    },
  });

  const cases: DebugCase[] = [
    {
      id: 'case_1_matched_resource',
      title: 'matched resource -> executable concrete task',
      result: matchedSuccess,
      expectedCanExecute: true,
    },
    {
      id: 'case_2_generation_request',
      title: 'generation request -> mock concrete task',
      result: generationSuccess,
      expectedCanExecute: true,
    },
    {
      id: 'case_3_missing_assessment_basis',
      title: 'missing referenceAnswer / scoringPoints / rubric',
      result: missingAssessmentBasis,
      expectedCanExecute: false,
      expectedIssueCode: 'MISSING_ASSESSMENT_BASIS',
    },
    {
      id: 'case_4_ability_mismatch',
      title: 'target ability mismatch',
      result: abilityMismatch,
      expectedCanExecute: false,
      expectedIssueCode: 'TARGET_ABILITY_MISMATCH',
    },
    {
      id: 'case_5_source_not_traceable',
      title: 'source ids are missing',
      result: sourceNotTraceable,
      expectedCanExecute: false,
      expectedIssueCode: 'SOURCE_NOT_TRACEABLE',
    },
    {
      id: 'case_6_missing_reading_text',
      title: 'reading task missing readingText',
      result: missingReadingText,
      expectedCanExecute: false,
      expectedIssueCode: 'MISSING_DISPLAY_CONTENT',
    },
  ];

  const failures = validateCases(cases);
  printReport(cases, failures);
}

function validateCases(cases: DebugCase[]): string[] {
  const failures: string[] = [];

  for (const item of cases) {
    const { result, expectedCanExecute, expectedIssueCode } = item;
    if (!isTaskReadinessValidation(result.readiness)) failures.push(`${item.id}: readiness schema invalid.`);
    if (result.readiness.canExecute !== expectedCanExecute) {
      failures.push(`${item.id}: expected canExecute=${expectedCanExecute}, got ${result.readiness.canExecute}.`);
    }
    if (expectedCanExecute && (!result.concreteTask || !isConcreteLearningTask(result.concreteTask))) {
      failures.push(`${item.id}: expected valid ConcreteLearningTask.`);
    }
    if (expectedIssueCode && !result.readiness.issues.some((issue) => issue.code === expectedIssueCode)) {
      failures.push(`${item.id}: expected issue ${expectedIssueCode}.`);
    }
    if (
      result.concreteTask &&
      result.readiness.canExecute &&
      !result.readiness.checks.canEnterDiagnosisRuntime
    ) {
      failures.push(`${item.id}: executable task must be diagnosis-ready.`);
    }
  }

  return failures;
}

function printReport(cases: DebugCase[], failures: string[]): void {
  console.log('\nPhase 9.1 Concrete Learning Task Debug');
  console.log('======================================');

  for (const item of cases) {
    const task = item.result.concreteTask;
    const readiness = item.result.readiness;
    console.log(`\n[${readiness.canExecute === item.expectedCanExecute ? 'PASS' : 'FAIL'}] ${item.id}`);
    console.log(`title: ${item.title}`);
    console.log(`inputType: ${item.result.inputType}`);
    console.log(`sourceTaskRequestId: ${task?.sourceTaskRequestId || 'missing'}`);
    console.log(`targetAbilityId: ${task?.targetAbilityId || 'missing'}`);
    console.log(`taskRole: ${task?.taskRole || 'missing'}`);
    console.log(`validationGoal: ${task?.validationGoal || 'missing'}`);
    console.log(`generatedTaskId: ${task?.taskId || 'missing'}`);
    console.log(`readingText exists: ${Boolean(task?.readingText)}`);
    console.log(`question exists: ${Boolean(task?.question)}`);
    console.log(`referenceAnswer exists: ${Boolean(task?.referenceAnswer)}`);
    console.log(`scoringPoints count: ${task?.scoringPoints.length || 0}`);
    console.log(`rubric count: ${task?.rubric.length || 0}`);
    console.log(`questionMetadata.mainAbility: ${task?.questionMetadata.mainAbility || 'missing'}`);
    console.log(`expectedDiagnosisFocus: ${(task?.expectedDiagnosisFocus || []).join(' / ') || 'missing'}`);
    console.log(`checks: ${JSON.stringify(readiness.checks)}`);
    console.log(`canExecute: ${readiness.canExecute}`);
    console.log(`issues: ${readiness.issues.map((issue) => issue.code).join(', ') || 'none'}`);
  }

  console.log('\nAcceptance');
  console.log('----------');
  if (failures.length === 0) {
    console.log('[PASS] Phase 9.1 concrete learning task debug passed.');
    return;
  }

  console.log('[FAIL] Phase 9.1 debug failed.');
  for (const failure of failures) console.log(`- ${failure}`);
  throw new Error('Phase 9.1 debug check failed.');
}

runConcreteLearningTaskDebug();
