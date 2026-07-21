import { resolvePhase163DiagnosisCredential } from '../../server/phase163DiagnosisBoundary.ts';

type Check = { name: string; passed: boolean; details: string };
const checks: Check[] = [];

const environmentResult = await resolvePhase163DiagnosisCredential({
  environment: {
    USER: 'test-student-runtime',
    DEEPSEEK_API_KEY: '  environment-secret  ',
  },
  keychainReader: async () => {
    throw new Error('Keychain must not be read when an environment key exists.');
  },
});
checks.push(check(
  'B1 环境变量优先且不读取钥匙串',
  environmentResult.source === 'environment' && environmentResult.apiKey === 'environment-secret',
  `source=${environmentResult.source}`,
));

let observedAccount = '';
let observedService = '';
const keychainResult = await resolvePhase163DiagnosisCredential({
  environment: {
    USER: 'test-student-runtime',
    DEEPSEEK_KEYCHAIN_SERVICE: 'test-deepseek-service',
  },
  keychainReader: async (account, service) => {
    observedAccount = account;
    observedService = service;
    return '  keychain-secret  ';
  },
});
checks.push(check(
  'B2 环境变量缺失时使用受控钥匙串',
  keychainResult.source === 'macos_keychain' &&
    keychainResult.apiKey === 'keychain-secret' &&
    observedAccount === 'test-student-runtime' &&
    observedService === 'test-deepseek-service',
  `source=${keychainResult.source}, account=${observedAccount}, service=${observedService}`,
));

const unavailableResult = await resolvePhase163DiagnosisCredential({
  environment: { USER: 'test-student-runtime' },
  keychainReader: async () => undefined,
});
checks.push(check(
  'B3 Key 缺失时明确返回 unavailable',
  unavailableResult.source === 'unavailable' && !unavailableResult.apiKey,
  `source=${unavailableResult.source}`,
));

console.log('\nPhase 16.3 Diagnosis Application Boundary Debug');
console.log('='.repeat(76));
for (const item of checks) {
  console.log(`${item.passed ? 'PASS' : 'FAIL'} | ${item.name}`);
  console.log(`       ${item.details}`);
}
console.log('-'.repeat(76));
console.log(`Result: ${checks.filter((item) => item.passed).length} / ${checks.length} PASS`);

if (checks.some((item) => !item.passed)) process.exitCode = 1;

function check(name: string, passed: boolean, details: string): Check {
  return { name, passed, details };
}
