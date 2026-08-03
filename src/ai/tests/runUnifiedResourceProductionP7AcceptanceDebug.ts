import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const testDirectory = fileURLToPath(new URL('.', import.meta.url));
const testFiles = [
  'runTaskProductionStateDebug.ts',
  'runTaskProductionCommandRuntimeDebug.ts',
  'runTaskPublicationOrchestrationDebug.ts',
  'runQuestionWorkflowProjectionDebug.ts',
  'runMaterialResourceProductionDebug.ts',
  'runMaterialResourceProductionCommandDebug.ts',
  'runMaterialQuestionReviewSubmissionDebug.ts',
  'runQuestionWorkbenchCommandE2EDebug.ts',
  'runQuestionPublicationRecoveryDebug.ts',
  'runQuestionWorkbenchPresentationStateDebug.ts',
  'runProductColorSemanticsDebug.ts',
  'runPhase173LearningEntryIntegrationDebug.ts',
  'runQuestionWorkbenchLegacyClosureDebug.ts',
] as const;

console.log('Unified Resource Production P7 Acceptance Debug');
console.log('='.repeat(72));

for (const [index, testFile] of testFiles.entries()) {
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
    console.error(`FAIL ${String(index + 1).padStart(2, '0')} ${testFile}`);
    process.exit(result.status ?? 1);
  }

  console.log(`PASS ${String(index + 1).padStart(2, '0')} ${testFile}`);
}

console.log('-'.repeat(72));
console.log(`Result: ${testFiles.length} / ${testFiles.length} P7 suites PASS`);
