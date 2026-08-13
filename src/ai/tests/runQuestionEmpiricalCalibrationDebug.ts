import { calibrateQuestionFromAnonymousAttempts } from '../agents/questionEmpiricalCalibrationAgent.ts';

const resourceVersionId = 'formal-question:v1';
const now = new Date().toISOString();
const awaiting = calibrateQuestionFromAnonymousAttempts({ resourceVersionId, attempts: [], generatedAt: now });
assert(awaiting.status === 'awaiting_data', 'Zero samples must stay awaiting_data.');
assert(awaiting.meanItemScore === undefined, 'Zero samples must not expose fake metrics.');

const insufficient = calibrateQuestionFromAnonymousAttempts({
  resourceVersionId,
  generatedAt: now,
  attempts: Array.from({ length: 10 }, (_, index) => ({
    attemptId: `insufficient-${index}`,
    resourceVersionId,
    itemScore: index % 2,
    totalScore: index,
    valid: true,
    completedAt: now,
  })),
});
assert(insufficient.status === 'insufficient_sample', 'Fewer than 30 samples must stay insufficient_sample.');
assert(insufficient.meanItemScore === undefined, 'Insufficient samples must not expose calibration metrics.');

const calibrated = calibrateQuestionFromAnonymousAttempts({
  resourceVersionId,
  generatedAt: now,
  attempts: Array.from({ length: 30 }, (_, index) => ({
    attemptId: `calibrated-${index}`,
    resourceVersionId,
    itemScore: index >= 15 ? 1 : 0,
    totalScore: index,
    valid: true,
    completedAt: now,
  })),
});
assert(calibrated.status === 'calibrated', 'Thirty valid samples should enable trial calibration.');
assert(calibrated.meanItemScore === 0.5, 'Mean item score should be calculated from real samples.');
assert(calibrated.highLowDiscrimination === 1, 'High-low discrimination should use real group scores.');

console.log(JSON.stringify({
  passed: 6,
  total: 6,
  emptyStatus: awaiting.status,
  insufficientStatus: insufficient.status,
  calibratedStatus: calibrated.status,
}, null, 2));

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}
