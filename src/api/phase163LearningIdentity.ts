export const PHASE163_PRODUCT_STUDENT_ID = 'student-local-primary-v1';
export const PHASE163_DEMO_STUDENT_ID = 'student-phase16-integration-demo';

// Compatibility alias for the formal single-student product path.
export const PHASE163_LEARNING_STUDENT_ID = PHASE163_PRODUCT_STUDENT_ID;
export const PHASE163_LEARNING_TIMEZONE = 'Asia/Shanghai';

export type Phase163RuntimeScope = 'product' | 'demo' | 'unknown';

export type Phase163RuntimeIdentity = {
  studentId?: string;
  operationId?: string;
  learningSessionId?: string;
  learningRoundId?: string;
};

const DEMO_ID_MARKERS = [
  'phase16-3-demo-',
  'phase16-3b-debug',
  'phase16-3c-demo-',
];

export function resolvePhase163RuntimeScope(identity: Phase163RuntimeIdentity): Phase163RuntimeScope {
  const identifiers = [
    identity.operationId,
    identity.learningSessionId,
    identity.learningRoundId,
  ].filter((value): value is string => Boolean(value));
  if (
    identity.studentId === PHASE163_DEMO_STUDENT_ID ||
    identifiers.some((value) => DEMO_ID_MARKERS.some((marker) => value.includes(marker)))
  ) return 'demo';
  if (identity.studentId === PHASE163_PRODUCT_STUDENT_ID) return 'product';
  return 'unknown';
}

export function isPhase163ProductRuntimeIdentity(identity: Phase163RuntimeIdentity): boolean {
  return resolvePhase163RuntimeScope(identity) === 'product';
}

export function assertPhase163ProductRuntimeIdentity(identity: Phase163RuntimeIdentity): void {
  if (!isPhase163ProductRuntimeIdentity(identity)) {
    throw new Error('Formal learning entry rejected a non-product runtime record.');
  }
}
