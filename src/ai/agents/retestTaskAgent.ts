import type { LearningSessionMemory } from '../schemas/learningSession.schema.ts';
import {
  type RetestTask,
  type RetestTaskGenerationResult,
  isRetestTask,
} from '../schemas/retestTask.schema.ts';

export type RetestTaskAgentInput = {
  learningSessionMemory: LearningSessionMemory;
  recentTrainingQuestions?: string[];
};

export function generateRetestTask(
  input: RetestTaskAgentInput,
): RetestTaskGenerationResult {
  const memory = input.learningSessionMemory;

  if (memory.next_recommendation.decision !== 'retest') {
    return {
      can_generate: false,
      skip_reason: `当前 next_recommendation.decision=${memory.next_recommendation.decision}，不要求生成复测任务。`,
      validation: {
        passed: true,
        issues: [],
      },
    };
  }

  const retestTask = buildRetestTask(memory);
  const validation = validateRetestTask({
    task: retestTask,
    memory,
    recentTrainingQuestions: input.recentTrainingQuestions || [],
  });

  return {
    can_generate: validation.passed,
    retest_task: retestTask,
    validation,
  };
}

function buildRetestTask(memory: LearningSessionMemory): RetestTask {
  const targetAbility = memory.target_ability;
  const taskId = `retest-${memory.session_id}-${Date.now()}`;

  if (targetAbility === '推理') {
    return {
      retest_task_id: taskId,
      target_ability: targetAbility,
      retest_goal: '验证学生能否在新文本中完成“文本线索 -> 人物心理 -> 结论表达”的迁移推理。',
      why_retest_now: `Session Outcome=${memory.session_outcome}；${memory.next_recommendation.reason}`,
      question: [
        '阅读片段：',
        '雨停后，母亲没有立刻回屋，而是蹲在院子里，把被风吹倒的小菜苗一株株扶正。她的袖口沾满了泥水，却一直没有停。第二天清晨，我发现菜畦旁多了一排小竹竿，每棵菜苗都被轻轻绑住。',
        '请结合文本，推断母亲当时的心理，并说明依据。',
      ].join('\n'),
      reference_answer: '母亲可能既心疼菜苗被风雨损伤，也珍惜自己一直照料的生活成果。依据是她雨停后没有立刻回屋，而是蹲在院子里把菜苗一株株扶正，第二天还用小竹竿固定菜苗，说明她细心、珍惜并希望菜苗继续生长。',
      scoring_points: [
        '能提取文本行为线索，如“没有立刻回屋”“一株株扶正”“袖口沾满泥水”“用小竹竿固定”。',
        '能从行为线索推断人物心理，如心疼、珍惜、牵挂、希望菜苗继续生长。',
        '能说明线索与心理判断之间的关系，而不是只复述行为。',
      ],
      success_criteria: [
        '答案回应“推断心理”这一核心要求。',
        '答案至少引用或概括一处文本依据。',
        '答案形成“文本线索 -> 人物心理 -> 结论表达”的基本推理链。',
      ],
      linked_session_id: memory.session_id,
      source_session_outcome: memory.session_outcome,
      source_next_recommendation: memory.next_recommendation.decision,
      expected_evaluation_focus: [
        '是否能够从新文本中提取有效线索。',
        '是否能够基于线索推断人物心理。',
        '是否能够说明依据与结论之间的关系。',
      ],
    };
  }

  return {
    retest_task_id: taskId,
    target_ability: targetAbility,
    retest_goal: `验证学生能否在新情境中迁移使用「${targetAbility}」能力。`,
    why_retest_now: `Session Outcome=${memory.session_outcome}；${memory.next_recommendation.reason}`,
    question: [
      '阅读新的短文本，并完成下面任务：',
      '清晨，爷爷把旧雨伞晾在门口，又仔细擦了擦伞柄上的裂痕。临出门前，他把伞递给我，只说：“路上慢点。”',
      `请结合文本完成一项「${targetAbility}」任务，说明你的判断依据。`,
    ].join('\n'),
    reference_answer: `答案应围绕「${targetAbility}」完成任务，并能够结合文本中的人物行为或关键语句说明依据。`,
    scoring_points: [
      `能回应「${targetAbility}」任务要求。`,
      '能提取文本中的关键行为或语句作为依据。',
      '能说明依据与结论之间的关系。',
    ],
    success_criteria: [
      '答案回应题目核心要求。',
      '答案包含文本依据。',
      `答案体现「${targetAbility}」能力动作。`,
    ],
    linked_session_id: memory.session_id,
    source_session_outcome: memory.session_outcome,
    source_next_recommendation: memory.next_recommendation.decision,
    expected_evaluation_focus: [
      `是否能够在新情境中使用「${targetAbility}」能力。`,
      '是否能够用文本依据支撑答案。',
      '是否能够形成可诊断的作答证据。',
    ],
  };
}

function validateRetestTask(input: {
  task: RetestTask;
  memory: LearningSessionMemory;
  recentTrainingQuestions: string[];
}): RetestTaskGenerationResult['validation'] {
  const issues: string[] = [];
  const { task, memory } = input;

  if (!isRetestTask(task)) issues.push('RetestTask should match schema.');
  if (task.target_ability !== memory.target_ability) {
    issues.push('target_ability should equal LearningSessionMemory.target_ability.');
  }
  if (task.linked_session_id !== memory.session_id) {
    issues.push('linked_session_id should equal LearningSessionMemory.session_id.');
  }
  if (task.source_session_outcome !== memory.session_outcome) {
    issues.push('source_session_outcome should equal LearningSessionMemory.session_outcome.');
  }
  if (task.source_next_recommendation !== memory.next_recommendation.decision) {
    issues.push('source_next_recommendation should equal LearningSessionMemory.next_recommendation.decision.');
  }
  if (
    !task.why_retest_now.includes(memory.session_outcome) &&
    !task.why_retest_now.includes(memory.next_recommendation.reason)
  ) {
    issues.push('why_retest_now should reference session_outcome or next_recommendation.reason.');
  }
  if (!hasNewContext(task.question, input.recentTrainingQuestions)) {
    issues.push('question should use a new text, context, or expression.');
  }
  if (!canEnterDiagnosisRuntime(task)) {
    issues.push('RetestTask should contain enough fields to enter Diagnosis Runtime.');
  }

  return {
    passed: issues.length === 0,
    issues,
  };
}

function hasNewContext(question: string, recentTrainingQuestions: string[]): boolean {
  const normalizedQuestion = normalize(question);
  if (recentTrainingQuestions.some((recent) => normalize(recent) === normalizedQuestion)) {
    return false;
  }

  const newContextSignals = ['雨停后', '母亲', '菜苗', '小竹竿', '旧雨伞', '爷爷'];

  return newContextSignals.some((signal) => question.includes(signal));
}

function canEnterDiagnosisRuntime(task: RetestTask): boolean {
  return (
    task.question.trim().length > 0 &&
    task.reference_answer.trim().length > 0 &&
    task.scoring_points.length > 0 &&
    task.success_criteria.length > 0 &&
    task.expected_evaluation_focus.length > 0
  );
}

function normalize(value: string): string {
  return value.replace(/\s+/g, '').trim();
}
