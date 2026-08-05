import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const testDirectory = fileURLToPath(new URL('.', import.meta.url));
const testSuites = [
  ['P0', 'runAuthoringFieldContractDebug.ts'],
  ['P0-P1', 'runTaskProductionStateDebug.ts'],
  ['P1', 'runQuestionWorkflowProjectionDebug.ts'],
  ['P1', 'runMaterialResourceWorkbenchStateDebug.ts'],
  ['P1-P2', 'runTrainingTaskGroupPlanningE2EDebug.ts'],
  ['P2', 'runMaterialResourceWorkbenchSelectionStateDebug.ts'],
  ['P2', 'runMaterialResourceProductionDebug.ts'],
  ['P2', 'runQuestionWorkbenchPresentationStateDebug.ts'],
  ['P2-P3', 'runQuestionCandidateWorkflowDebug.ts'],
  ['P2-P3', 'runQuestionCandidateOptimizationAgentDebug.ts'],
  ['P3', 'runQuestionCandidateWorkbenchP3Debug.ts'],
  ['P3', 'runTaskProductionCommandRuntimeDebug.ts'],
  ['P3', 'runMaterialResourceProductionCommandDebug.ts'],
  ['P3', 'runMaterialQuestionReviewSubmissionDebug.ts'],
  ['P3-P4', 'runQuestionWorkbenchCommandE2EDebug.ts'],
  ['P3-P4', 'runQuestionCandidateWorkbenchP4Debug.ts'],
  ['P3-P4', 'runTaskGroupSubmissionDebug.ts'],
  ['P4', 'runQuestionQualityRevisionProgressDebug.ts'],
  ['P4', 'runQuestionWorkbenchLoadingDebug.ts'],
  ['P4-P5', 'runTaskPublicationOrchestrationDebug.ts'],
  ['P4-P5', 'runQuestionCandidateWorkbenchP5Debug.ts'],
  ['P5', 'runQuestionPublicationRecoveryDebug.ts'],
  ['P6', 'runPhase173LearningEntryIntegrationDebug.ts'],
  ['P6', 'runQuestionCandidateWorkbenchP6Debug.ts'],
  ['P6', 'runQuestionWorkbenchLegacyClosureDebug.ts'],
  ['P7', 'runProductColorSemanticsDebug.ts'],
] as const;

console.log('Unified Resource Production P0-P7 Final Integration Debug');
console.log('='.repeat(84));

for (const [index, [phase, testFile]] of testSuites.entries()) {
  const testPath = new URL(testFile, import.meta.url);
  const result = spawnSync(
    process.execPath,
    [
      '--experimental-strip-types',
      '--experimental-specifier-resolution=node',
      fileURLToPath(testPath),
    ],
    {
      cwd: testDirectory,
      encoding: 'utf8',
      env: {
        ...process.env,
        NODE_NO_WARNINGS: '1',
      },
    },
  );

  if (result.status !== 0) {
    if (result.stdout) {
      process.stdout.write(result.stdout);
    }
    if (result.stderr) {
      process.stderr.write(result.stderr);
    }
    console.error(
      `FAIL ${String(index + 1).padStart(2, '0')} [${phase}] ${testFile}`,
    );
    process.exit(result.status ?? 1);
  }

  console.log(
    `PASS ${String(index + 1).padStart(2, '0')} [${phase}] ${testFile}`,
  );
}

console.log('-'.repeat(84));
console.log(
  `Result: ${testSuites.length} / ${testSuites.length} P0-P7 integration suites PASS`,
);
