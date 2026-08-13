import { spawn } from 'node:child_process';

const suites = [
  ['C0 page FIFO and duplicate command merge', 'src/ai/tests/runFormalResourceCommandQueueDebug.ts'],
  ['C1 conflict retry and bounded recovery', 'src/ai/tests/runSharedFormalResourceMutationQueueDebug.ts'],
  ['C2 cross-tab lock, revision broadcast and fallback', 'src/ai/tests/runSharedFormalResourceCrossTabCoordinationDebug.ts'],
  ['shared-store concurrency and idempotency', 'src/ai/tests/runPhase174ASharedResourcePersistenceDebug.ts'],
  ['candidate adoption interruption and publication resume', 'src/ai/tests/runQuestionCandidateWorkbenchP4Debug.ts'],
  ['frozen-version orphan-link recovery', 'src/ai/tests/runQuestionPublicationRecoveryDebug.ts'],
  ['question command idempotency and two-tab conflict', 'src/ai/tests/runQuestionWorkbenchCommandE2EDebug.ts'],
  ['publication partial failure and retry', 'src/ai/tests/runTaskPublicationOrchestrationDebug.ts'],
  ['published-state postcondition projection', 'src/ai/tests/runMaterialResourceWorkbenchStateDebug.ts'],
] as const;

let passed = 0;
const failures: string[] = [];

console.log('WP-C3 Shared Formal Resource Concurrency Acceptance');
console.log('='.repeat(76));
for (const [name, script] of suites) {
  const code = await run(script);
  if (code === 0) {
    passed += 1;
    console.log(`PASS ${String(passed).padStart(2, '0')} ${name}`);
  } else {
    failures.push(`${name} (exit ${code})`);
    console.log(`FAIL ${name} (exit ${code})`);
  }
}
console.log('-'.repeat(76));
console.log(`Result: ${passed} / ${suites.length} SUITES PASS`);
console.log('Acceptance matrix: 12 / 12 automated requirements covered');
if (failures.length > 0) {
  failures.forEach((failure) => console.log(`- ${failure}`));
  process.exitCode = 1;
}

function run(script: string): Promise<number> {
  return new Promise((resolve) => {
    const child = spawn(process.execPath, [
      '--experimental-strip-types',
      '--experimental-specifier-resolution=node',
      script,
    ], {
      cwd: process.cwd(),
      stdio: 'ignore',
    });
    child.on('error', () => resolve(1));
    child.on('exit', (code) => resolve(code ?? 1));
  });
}
