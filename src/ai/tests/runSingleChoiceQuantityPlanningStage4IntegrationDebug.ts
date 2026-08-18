import { spawnSync } from 'node:child_process';

type Suite = {
  name: string;
  file: string;
};

const suites: Suite[] = [
  {
    name: 'task sequence planning and Learning scheduling',
    file: 'src/ai/tests/runTrainingTaskSequencePlanningDebug.ts',
  },
  {
    name: 'quantity planning',
    file: 'src/ai/tests/runSingleChoiceQuantityPlanningDebug.ts',
  },
  {
    name: 'generation and adoption contract',
    file: 'src/ai/tests/runReadingSingleChoiceStage2Debug.ts',
  },
  {
    name: 'Learning diagnosis and evidence',
    file: 'src/ai/tests/runReadingSingleChoiceStage3Debug.ts',
  },
  {
    name: 'real-material publication and Learning E2E',
    file: 'src/ai/tests/runReadingSingleChoiceStage4E2EDebug.ts',
  },
  {
    name: 'supplement publication state isolation',
    file: 'src/ai/tests/runMaterialResourceWorkbenchStateDebug.ts',
  },
  {
    name: 'production interaction semantics',
    file: 'src/ai/tests/runProductColorSemanticsDebug.ts',
  },
];

let passed = 0;
const failures: string[] = [];

console.log('Single-choice quantity planning Stage 4 integration debug');
console.log('='.repeat(78));

for (const suite of suites) {
  const result = spawnSync(process.execPath, [
    '--experimental-strip-types',
    '--experimental-specifier-resolution=node',
    suite.file,
  ], {
    cwd: process.cwd(),
    encoding: 'utf8',
    env: process.env,
  });

  if (result.status === 0) {
    passed += 1;
    const summary = lastMeaningfulLine(result.stdout);
    console.log(`PASS ${suite.name}${summary ? ` — ${summary}` : ''}`);
    continue;
  }

  const detail = [result.stdout, result.stderr].filter(Boolean).join('\n').trim();
  failures.push(`${suite.name}: ${detail || `exit ${result.status ?? 'unknown'}`}`);
  console.error(`FAIL ${suite.name}`);
}

console.log('-'.repeat(78));
console.log(`Result: ${passed}/${suites.length} PASS`);
console.log(`Quantity Planning Stage 4: ${failures.length === 0 ? 'PASS' : 'FAIL'}`);

if (failures.length > 0) {
  for (const failure of failures) console.error(failure);
  process.exitCode = 1;
}

function lastMeaningfulLine(output: string) {
  return output
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .at(-1) || '';
}
