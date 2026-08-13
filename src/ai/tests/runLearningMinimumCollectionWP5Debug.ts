import { InMemoryQuestionCalibrationProjectionRepository } from '../repositories/inMemoryLearningCollectionRepositories.ts';
import type { QuestionCalibrationProjectionRepository } from '../repositories/questionCalibrationProjectionRepository.ts';
import { QuestionCalibrationProjectionService } from '../services/questionCalibrationProjectionService.ts';
import type { QuestionCalibrationProjectionInput } from '../services/questionCalibrationProjectionService.ts';

const NOW = '2026-08-13T12:00:00.000Z';
const reports: Array<{ name: string; passed: boolean; detail: string }> = [];

async function main(): Promise<void> {
  const repository = new InMemoryQuestionCalibrationProjectionRepository();
  const service = new QuestionCalibrationProjectionService(repository);
  const eligible = await service.project(input());
  check('WP5-1 required Rubric 3/4 形成 0.75', eligible.record.status === 'eligible' && eligible.record.itemScore === 0.75, `${eligible.record.status}/${eligible.record.itemScore}`);
  check('WP5-2 单轮不伪造 totalScore', eligible.record.totalScore === undefined && eligible.record.totalScoreStatus === 'unavailable_single_round' && eligible.record.assessmentWindowId === undefined, eligible.record.totalScoreStatus);
  check('WP5-3 eligible 输出匿名 Attempt', Boolean(eligible.anonymousAttempt) && eligible.anonymousAttempt?.itemScore === 0.75 && eligible.anonymousAttempt.subjectKey.startsWith('learning-calibration-subject-'), eligible.anonymousAttempt?.subjectKey || 'missing');
  check('WP5-4 匿名输出移除学习链身份', eligible.anonymousAttempt !== undefined && !['studentId', 'operationId', 'learningRoundId', 'responseId', 'formalDiagnosisId'].some((key) => key in eligible.anonymousAttempt!), Object.keys(eligible.anonymousAttempt || {}).join('|'));
  const repeat = await service.project(input());
  check('WP5-5 重复投影幂等', repeat.status === 'unchanged' && (await repository.listByRound('student-local-primary-v1', 'round-1')).length === 1, repeat.status);

  const invalid = await newService().project(input({ attemptId: 'attempt-invalid', responseValidityStatus: 'irrelevant' }));
  check('WP5-6 无效回答被排除', invalid.record.status === 'excluded_invalid_response' && !invalid.anonymousAttempt, invalid.record.status);
  const incomplete = await newService().project(input({ attemptId: 'attempt-incomplete', roundCompleted: false, completedAt: undefined }));
  check('WP5-7 未完成轮次被排除', incomplete.record.status === 'excluded_incomplete_round', incomplete.record.status);
  const missingDiagnosis = await newService().project(input({ attemptId: 'attempt-no-diagnosis', formalDiagnosisCommitted: false, formalDiagnosisId: undefined }));
  check('WP5-8 缺少正式诊断被排除', missingDiagnosis.record.status === 'excluded_missing_formal_diagnosis', missingDiagnosis.record.status);
  const unscorable = await newService().project(input({ attemptId: 'attempt-unscorable', rubricItems: [] }));
  check('WP5-9 无 required Rubric 被排除', unscorable.record.status === 'excluded_unscorable', unscorable.record.status);
  const nonProduct = await newService().project(input({ attemptId: 'attempt-demo', runtimeScope: 'demo', studentId: 'student-phase16-integration-demo' }));
  check('WP5-10 Demo 不能进入有效样本', nonProduct.record.status === 'excluded_non_product_scope' && !nonProduct.anonymousAttempt, nonProduct.record.status);
  const mismatch = await newService().project(input({ attemptId: 'attempt-mismatch', identityIssues: ['projection_resource_version_mismatch'] }));
  check('WP5-11 身份或版本错绑 projection_failed', mismatch.record.status === 'projection_failed', mismatch.record.issues.join('|'));

  const upgradeRepository = new InMemoryQuestionCalibrationProjectionRepository();
  const upgradeService = new QuestionCalibrationProjectionService(upgradeRepository);
  const pending = await upgradeService.project(input({ attemptId: 'attempt-upgrade', roundCompleted: false, completedAt: undefined, formalDiagnosisCommitted: false, formalDiagnosisId: undefined, rubricItems: undefined }));
  const upgraded = await upgradeService.project(input({ attemptId: 'attempt-upgrade' }));
  check('WP5-12 权威事实补齐后受控升级 eligible', pending.record.status === 'excluded_incomplete_round' && upgraded.status === 'updated' && upgraded.record.status === 'eligible', `${pending.record.status}->${upgraded.record.status}`);
  check('WP5-13 升级记录保留历史状态 Issue', upgraded.record.issues.includes('resolved_previous_status:excluded_incomplete_round'), upgraded.record.issues.join('|'));
  const weaker = await upgradeService.project(input({ attemptId: 'attempt-upgrade', roundCompleted: false, completedAt: undefined }));
  check('WP5-14 eligible 不被弱状态覆盖', weaker.status === 'unchanged' && weaker.record.status === 'eligible', `${weaker.status}/${weaker.record.status}`);

  const failingRepository: QuestionCalibrationProjectionRepository = {
    save: async () => { throw new Error('projection_store_failure'); },
    getByAttemptId: async () => undefined,
    listByStudent: async () => [],
    listAll: async () => [],
    listByRound: async () => [],
    listEligibleByResourceVersion: async () => [],
    clear: async () => {},
  };
  const failed = await new QuestionCalibrationProjectionService(failingRepository).project(input({ attemptId: 'attempt-store-failure' }));
  check('WP5-15 Projection Repository 失败不向主链抛错', failed.status === 'failed' && failed.issues.includes('projection_store_failure'), failed.issues.join('|'));

  const anotherVersion = await service.project(input({ attemptId: 'attempt-version-2', resourceVersionId: 'resource-version-2' }));
  check('WP5-16 题目换版按 resourceVersionId 隔离', (await repository.listEligibleByResourceVersion('resource-version-1')).length === 1 && (await repository.listEligibleByResourceVersion('resource-version-2')).length === 1 && anotherVersion.anonymousAttempt?.resourceVersionId === 'resource-version-2', anotherVersion.record.resourceVersionId);

  console.log('\nReal Learning Minimum Collection WP5 Debug');
  console.log('='.repeat(78));
  reports.forEach((report) => { console.log(`${report.passed ? 'PASS' : 'FAIL'} | ${report.name}`); console.log(`       ${report.detail}`); });
  const passed = reports.filter((report) => report.passed).length;
  console.log('-'.repeat(78));
  console.log(`Result: ${passed} / ${reports.length} PASS`);
  if (passed !== reports.length) throw new Error('WP5 Debug failed.');
}

function newService() {
  return new QuestionCalibrationProjectionService(new InMemoryQuestionCalibrationProjectionRepository());
}

function input(overrides: Partial<QuestionCalibrationProjectionInput> = {}): QuestionCalibrationProjectionInput {
  return {
    attemptId: 'attempt-1', runtimeScope: 'product', studentId: 'student-local-primary-v1', operationId: 'operation-1',
    learningSessionId: 'session-1', learningRoundId: 'round-1', responseId: 'response-1', responseValidityStatus: 'valid',
    roundCompleted: true, completedAt: NOW, formalDiagnosisId: 'diagnosis-1', formalDiagnosisCommitted: true,
    rubricItems: [
      { id: 'r1', label: '一', ability: 'analysis', required: true, matched: true },
      { id: 'r2', label: '二', ability: 'analysis', required: true, matched: true },
      { id: 'r3', label: '三', ability: 'analysis', required: true, matched: true },
      { id: 'r4', label: '四', ability: 'analysis', required: true, matched: false },
      { id: 'optional', label: '附加', ability: 'expression', required: false, matched: true },
    ],
    resourceVersionId: 'resource-version-1', projectedAt: NOW, ...overrides,
  };
}

function check(name: string, passed: boolean, detail: string): void { reports.push({ name, passed, detail }); }
main().catch((error) => { console.error(error instanceof Error ? error.message : String(error)); process.exitCode = 1; });
