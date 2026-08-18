import {
  createStructuredRuntimeError,
  isStructuredRuntimeError,
  normalizeRuntimeError,
} from '../errors/structuredRuntimeError.ts';
import { createWorkbenchErrorNotice } from '../../api/workbenchErrorNotice.ts';

const cases: Array<{ name: string; run: () => void }> = [
  { name: '01 explicit structured error preserves identity', run: explicitIdentity },
  { name: '02 revision conflict maps to reload action', run: revisionConflict },
  { name: '03 immutable conflict maps to new revision', run: immutableConflict },
  { name: '04 stale validation maps to stable code', run: staleValidation },
  { name: '05 missing quality assessment is actionable', run: missingAssessment },
  { name: '06 shared store failure blocks formal write', run: sharedStoreFailure },
  { name: '07 unknown error remains traceable', run: unknownError },
  { name: '08 workbench notice exposes recovery contract', run: workbenchNotice },
  { name: '09 shared revision conflict is retryable and has no fake object id', run: sharedRevisionConflict },
  { name: '10 duplicate task stems use an actionable Chinese notice', run: duplicateTaskStemNotice },
  { name: '11 shared store timeout remains a safe continuation', run: sharedStoreTimeout },
];

function main() {
  let passed = 0;
  const failures: string[] = [];

  console.log('Structured Runtime Error Contract Debug');
  for (const testCase of cases) {
    try {
      testCase.run();
      passed += 1;
      console.log(`PASS ${testCase.name}`);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      failures.push(`${testCase.name}: ${message}`);
      console.error(`FAIL ${testCase.name}: ${message}`);
    }
  }

  console.log(`\nResult: ${passed}/${cases.length} cases passed.`);
  if (failures.length > 0) {
    console.error(failures.join('\n'));
    process.exitCode = 1;
  }
}

function explicitIdentity() {
  const error = createStructuredRuntimeError({
    code: 'FORMAL_RESOURCE_IMMUTABLE_CONFLICT',
    message: 'Cannot overwrite.',
    operation: 'assessment.save',
    objectId: 'assessment-001',
    recoverability: 'new_revision_required',
  });
  assert(isStructuredRuntimeError(error), 'error should be structured');
  assert(error.toJSON().objectId === 'assessment-001', 'object identity should be serialized');
}

function revisionConflict() {
  const error = normalizeRuntimeError(
    new Error('Material Observation Plan revision conflict: plan-001'),
  );
  assert(error.code === 'FORMAL_RESOURCE_REVISION_CONFLICT', 'revision code mismatch');
  assert(error.recoverability === 'reload_required', 'revision recovery mismatch');
  assert(error.objectId === 'plan-001', 'plan identity should be extracted');
}

function immutableConflict() {
  const error = normalizeRuntimeError(
    new Error('Question quality assessment is immutable: assessment-001'),
  );
  assert(error.code === 'FORMAL_RESOURCE_IMMUTABLE_CONFLICT', 'immutable code mismatch');
  assert(error.recoverability === 'new_revision_required', 'immutable recovery mismatch');
}

function staleValidation() {
  const error = normalizeRuntimeError(new Error('Draft validation is stale.'));
  assert(error.code === 'VALIDATION_STALE', 'stale validation code mismatch');
}

function missingAssessment() {
  const error = normalizeRuntimeError(
    new Error('Current Question Quality Assessment is required.'),
    { objectId: 'draft-001' },
  );
  assert(error.code === 'QUALITY_ASSESSMENT_REQUIRED', 'quality code mismatch');
  assert(error.objectId === 'draft-001', 'draft identity mismatch');
}

function sharedStoreFailure() {
  const error = normalizeRuntimeError(
    new Error('Shared formal resource service unavailable.'),
  );
  assert(error.code === 'SHARED_STORE_UNAVAILABLE', 'shared store code mismatch');
  assert(error.recoverability === 'service_required', 'shared store recovery mismatch');
}

function sharedStoreTimeout() {
  const notice = createWorkbenchErrorNotice(
    new Error('共享资源服务读取超时，请重新尝试。'),
  );
  assert(notice.errorCode === 'SHARED_STORE_TIMEOUT', 'shared store timeout code mismatch');
  assert(notice.recoverability === 'retry_safe', 'shared store timeout must remain retry-safe');
  assert(notice.message.includes('请继续发布'), 'timeout notice must preserve the publishing intent');
  assert(notice.recoveryMessage === '可以直接重试。', 'timeout notice must expose one safe retry action');
}

function unknownError() {
  const error = normalizeRuntimeError(new Error('Unexpected transport response.'));
  assert(error.code === 'RUNTIME_OPERATION_FAILED', 'fallback code mismatch');
  assert(error.message === 'Unexpected transport response.', 'original message should remain');
}

function workbenchNotice() {
  const notice = createWorkbenchErrorNotice(
    createStructuredRuntimeError({
      code: 'VALIDATION_STALE',
      message: 'Validation expired.',
      operation: 'question.freeze',
      objectId: 'draft-002',
      recoverability: 'user_action_required',
    }),
  );
  assert(notice.errorCode === 'VALIDATION_STALE', 'notice error code mismatch');
  assert(notice.operation === 'question.freeze', 'notice operation mismatch');
  assert(notice.objectId === 'draft-002', 'notice object mismatch');
  assert(notice.recoveryMessage.length > 0, 'notice should include recovery guidance');
}

function sharedRevisionConflict() {
  const error = normalizeRuntimeError(
    new Error('Shared resource revision conflict: expected 41, actual 42.'),
  );
  assert(error.code === 'SHARED_STORE_REVISION_CONFLICT', 'shared revision code mismatch');
  assert(error.recoverability === 'retry_safe', 'shared revision recovery mismatch');
  assert(error.objectId === undefined, 'expected must not be exposed as an object id');
}

function duplicateTaskStemNotice() {
  const notice = createWorkbenchErrorNotice(
    new Error('Observation Tasks in one batch require distinct question stems.'),
  );
  assert(notice.message.includes('重复题干'), 'duplicate task stems should be explained in Chinese');
  assert(notice.message.includes('重新生成补充候选'), 'notice should expose the only recovery action');
}

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

main();
