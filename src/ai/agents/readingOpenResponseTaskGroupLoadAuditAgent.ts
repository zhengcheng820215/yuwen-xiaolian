import {
  TEXT_RESPONSE_LOAD_LEVELS,
  isTextResponseFormat,
  type TextResponseLoadAuditFinding,
  type TextResponseLoadLevel,
  type TextResponseTaskGroupAuditInput,
  type TextResponseTaskGroupItem,
  type TextResponseTaskGroupLoadAudit,
} from '../schemas/readingOpenResponseInputLoad.schema.ts';
import type { TrainingTaskSequenceReason } from
  '../schemas/trainingTaskSequencePlanning.schema.ts';

const LEGAL_SEQUENCE_REASONS = new Set<TrainingTaskSequenceReason>([
  'holistic_judgment_required',
  'independent_expression_baseline',
  'retest_after_training',
  'transfer_in_new_context',
  'no_qualified_single_choice',
]);

const LEVEL_RANK: Record<TextResponseLoadLevel, number> = {
  entry_short: 1,
  focused_short: 2,
  developing: 3,
  integrated: 4,
};

export function auditReadingOpenResponseTaskGroup(
  input: TextResponseTaskGroupAuditInput,
): TextResponseTaskGroupLoadAudit {
  const tasks = stableOrder(input.tasks);
  const textTasks = tasks.filter((task) => (
    isTextResponseFormat(task.responseFormat) && Boolean(task.auditResult)
  ));
  const singleChoiceCount = tasks.filter((task) => task.responseFormat === 'single_choice').length;
  const legalSequence = isLegalSequenceException(input.sequenceReason, tasks);
  const sequenceFindings: TextResponseLoadAuditFinding[] = [];

  if (!legalSequence) {
    const firstTextIndex = tasks.findIndex((task) => (
      isTextResponseFormat(task.responseFormat) && Boolean(task.auditResult?.profile)
    ));
    const firstText = firstTextIndex >= 0 ? tasks[firstTextIndex] : undefined;
    const firstLevel = firstText?.auditResult?.profile?.loadLevel;
    const hasPrelude = firstTextIndex > 0 && tasks.slice(0, firstTextIndex)
      .some((task) => task.responseFormat === 'single_choice');
    if (firstLevel && LEVEL_RANK[firstLevel] >= 3 && !hasPrelude) {
      sequenceFindings.push(finding(
        'missing_entry_path',
        'warning',
        ['taskGroup.order', firstText!.questionVersionId],
        '题组首道文本题直接进入较高负担，且前面没有明确的低负担理解入口。',
      ));
    }

    let previous: TextResponseTaskGroupItem | undefined;
    for (const task of tasks) {
      // A qualified single-choice prelude is the accessible reading entry,
      // equivalent to a focused low-input task for sequence auditing. This
      // keeps the audit aligned with the Stage 3 gate: choice -> developing is
      // a valid gradient, while choice -> integrated still needs a rationale.
      const currentRank = task.responseFormat === 'single_choice'
        ? 2
        : task.auditResult?.profile
          ? LEVEL_RANK[task.auditResult.profile.loadLevel]
          : undefined;
      if (currentRank === undefined) continue;
      if (previous) {
        const previousRank = previous.responseFormat === 'single_choice'
          ? 2
          : previous.auditResult?.profile
            ? LEVEL_RANK[previous.auditResult.profile.loadLevel]
            : undefined;
        if (
          previousRank !== undefined
          && (
            (previous.responseFormat === 'single_choice' && currentRank === 4)
            || isUnexplainedJump(previousRank, currentRank)
          )
        ) {
          sequenceFindings.push(finding(
            'unexplained_load_jump',
            'warning',
            [previous.questionVersionId, task.questionVersionId, 'taskGroup.order'],
            '相邻任务之间出现较大的输入负担跃迁，且没有记录合法的顺序理由。',
          ));
        }
      }
      previous = task;
    }
  }

  for (let leftIndex = 0; leftIndex < textTasks.length; leftIndex += 1) {
    for (let rightIndex = leftIndex + 1; rightIndex < textTasks.length; rightIndex += 1) {
      const left = textTasks[leftIndex];
      const right = textTasks[rightIndex];
      if (
        left.auditResult?.profile?.primaryAction === right.auditResult?.profile?.primaryAction
        && anchorsSubstantiallyOverlap(left.sourceAnchorIds, right.sourceAnchorIds)
      ) {
        sequenceFindings.push(finding(
          'duplicate_load_observation',
          'info',
          [left.questionVersionId, right.questionVersionId, 'sourceAnchorIds'],
          '两道题在高度重合的证据范围内执行相同主要动作，建议检查观察价值是否重复。',
        ));
      }
    }
  }

  const levelDistribution = Object.fromEntries(
    TEXT_RESPONSE_LOAD_LEVELS.map((level) => [level, 0]),
  ) as Record<TextResponseLoadLevel, number>;
  textTasks.forEach((task) => {
    const level = task.auditResult?.profile?.loadLevel;
    if (level) levelDistribution[level] += 1;
  });

  return {
    materialVersionId: input.materialVersionId,
    orderedQuestionVersionIds: tasks.map((task) => task.questionVersionId),
    textQuestionCount: textTasks.length,
    singleChoiceCount,
    levelDistribution,
    sequenceFindings: dedupeFindings(sequenceFindings),
    questionResults: textTasks
      .map((task) => task.auditResult)
      .filter((result): result is NonNullable<typeof result> => Boolean(result)),
  };
}

function stableOrder(tasks: TextResponseTaskGroupItem[]): TextResponseTaskGroupItem[] {
  return tasks.map((task, index) => ({ task, index }))
    .sort((left, right) => (
      (left.task.sequenceRank ?? Number.MAX_SAFE_INTEGER)
      - (right.task.sequenceRank ?? Number.MAX_SAFE_INTEGER)
      || left.index - right.index
      || left.task.questionVersionId.localeCompare(right.task.questionVersionId)
    ))
    .map(({ task }) => task);
}

function isLegalSequenceException(
  reason: TrainingTaskSequenceReason | undefined,
  tasks: TextResponseTaskGroupItem[],
): boolean {
  if (reason && LEGAL_SEQUENCE_REASONS.has(reason)) return true;
  return tasks.length > 0 && tasks.every((task) => (
    task.taskRole === 'retest' || task.taskRole === 'transfer'
  ));
}

function isUnexplainedJump(previousRank: number, currentRank: number): boolean {
  if (currentRank <= previousRank) return false;
  // A low-input entry may move directly to a developing task. The gradient
  // contract prevents unreasonable overload; it does not require every load
  // label to appear as a mechanical template.
  if (previousRank === 1 && currentRank === 3) return false;
  if (previousRank === 2 && currentRank === 4) return false;
  return currentRank - previousRank > 1;
}

function anchorsSubstantiallyOverlap(left: string[], right: string[]): boolean {
  if (left.length === 0 || right.length === 0) return false;
  const leftSet = new Set(left);
  const rightSet = new Set(right);
  const intersection = [...leftSet].filter((item) => rightSet.has(item)).length;
  return intersection / Math.min(leftSet.size, rightSet.size) >= 0.8;
}

function finding(
  code: TextResponseLoadAuditFinding['code'],
  severity: TextResponseLoadAuditFinding['severity'],
  evidencePaths: string[],
  explanation: string,
): TextResponseLoadAuditFinding {
  return {
    code,
    severity,
    evidencePaths: [...new Set(evidencePaths)].sort(),
    explanation,
    recommendedDisposition: code === 'duplicate_load_observation'
      ? 'decompose_or_refocus'
      : 'copy_or_length_adjustment',
  };
}

function dedupeFindings(
  findings: TextResponseLoadAuditFinding[],
): TextResponseLoadAuditFinding[] {
  return [...new Map(findings.map((item) => [
    `${item.code}:${item.evidencePaths.join('|')}`,
    item,
  ])).values()].sort((left, right) => (
    left.code.localeCompare(right.code)
    || left.evidencePaths.join('|').localeCompare(right.evidencePaths.join('|'))
  ));
}
