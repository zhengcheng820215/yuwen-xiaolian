export type RetestTask = {
  retest_task_id: string;
  target_ability: string;
  retest_goal: string;
  why_retest_now: string;
  question: string;
  reference_answer: string;
  scoring_points: string[];
  success_criteria: string[];
  linked_session_id: string;
  source_session_outcome: string;
  source_next_recommendation: string;
  expected_evaluation_focus: string[];
};

export type RetestTaskGenerationResult = {
  can_generate: boolean;
  retest_task?: RetestTask;
  skip_reason?: string;
  validation: {
    passed: boolean;
    issues: string[];
  };
};

export function isRetestTask(value: unknown): value is RetestTask {
  if (!value || typeof value !== 'object') return false;

  const task = value as RetestTask;

  return (
    isNonEmptyString(task.retest_task_id) &&
    isNonEmptyString(task.target_ability) &&
    isNonEmptyString(task.retest_goal) &&
    isNonEmptyString(task.why_retest_now) &&
    isNonEmptyString(task.question) &&
    isNonEmptyString(task.reference_answer) &&
    isNonEmptyString(task.linked_session_id) &&
    isNonEmptyString(task.source_session_outcome) &&
    isNonEmptyString(task.source_next_recommendation) &&
    isNonEmptyStringArray(task.scoring_points) &&
    isNonEmptyStringArray(task.success_criteria) &&
    isNonEmptyStringArray(task.expected_evaluation_focus)
  );
}

export function isRetestTaskGenerationResult(
  value: unknown,
): value is RetestTaskGenerationResult {
  if (!value || typeof value !== 'object') return false;

  const result = value as RetestTaskGenerationResult;

  if (typeof result.can_generate !== 'boolean') return false;
  if (!isValidation(result.validation)) return false;

  if (result.can_generate) {
    return isRetestTask(result.retest_task);
  }

  return (
    result.retest_task === undefined &&
    isNonEmptyString(result.skip_reason)
  );
}

function isValidation(value: unknown): value is RetestTaskGenerationResult['validation'] {
  if (!value || typeof value !== 'object') return false;

  const validation = value as RetestTaskGenerationResult['validation'];

  return (
    typeof validation.passed === 'boolean' &&
    Array.isArray(validation.issues) &&
    validation.issues.every((issue) => typeof issue === 'string')
  );
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function isNonEmptyStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.length > 0 && value.every(isNonEmptyString);
}
