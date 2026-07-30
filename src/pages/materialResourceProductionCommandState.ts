export const MATERIAL_PRODUCTION_COMMANDS = {
  regenerateSingleTask: 'regenerateSingleTask',
  planSupplementCandidates: 'planSupplementCandidates',
  planReplacementGroup: 'planReplacementGroup',
  adoptCandidates: 'adoptCandidates',
  savePlanRevision: 'savePlanRevision',
  runPlanValidation: 'runPlanValidation',
  submitForQuestionReview: 'submitForQuestionReview',
} as const;

export type MaterialProductionCommand =
  typeof MATERIAL_PRODUCTION_COMMANDS[keyof typeof MATERIAL_PRODUCTION_COMMANDS];

export type MaterialProductionCommandContext = {
  hasMaterial: boolean;
  hasPlan: boolean;
  aiServiceReady: boolean;
  generatorBusy: boolean;
  commandBusy: boolean;
  taskEditorDirty: boolean;
  taskCount: number;
  taskLimit: number;
  editableIssueCount: number;
  candidateReady: boolean;
  validationPassed: boolean;
  submissionReady: boolean;
};

export type MaterialProductionCommandAvailability = {
  enabled: boolean;
  reason: string;
};

export function getMaterialProductionCommandAvailability(
  command: MaterialProductionCommand,
  context: MaterialProductionCommandContext,
): MaterialProductionCommandAvailability {
  if (context.commandBusy || context.generatorBusy) {
    return unavailable('当前操作尚未完成，请稍候。');
  }
  if (!context.hasMaterial) {
    return unavailable('请先选择或保存一篇素材。');
  }

  switch (command) {
    case MATERIAL_PRODUCTION_COMMANDS.regenerateSingleTask:
      if (!context.hasPlan) return unavailable('请先保存训练任务版本。');
      if (!context.aiServiceReady) return unavailable('AI 服务当前不可用。');
      if (context.taskEditorDirty) return unavailable('请先保存当前任务组修改，再重新生成此任务。');
      return available();

    case MATERIAL_PRODUCTION_COMMANDS.planSupplementCandidates:
      if (!context.hasPlan) return unavailable('请先保存当前任务组。');
      if (!context.aiServiceReady) return unavailable('AI 服务当前不可用。');
      if (context.taskEditorDirty) return unavailable('请先保存当前任务组修改，再补充候选任务。');
      if (context.taskCount >= context.taskLimit) return unavailable(`当前任务组已达到 ${context.taskLimit} 个任务。`);
      return available();

    case MATERIAL_PRODUCTION_COMMANDS.planReplacementGroup:
      if (!context.aiServiceReady) return unavailable('AI 服务当前不可用。');
      if (context.taskEditorDirty) return unavailable('请先保存当前任务组修改，再重新规划候选任务组。');
      return available();

    case MATERIAL_PRODUCTION_COMMANDS.adoptCandidates:
      if (!context.candidateReady) return unavailable('当前没有可采用的候选任务。');
      if (context.taskEditorDirty) return unavailable('当前编辑区已有未保存修改，请先保存或放弃修改。');
      return available();

    case MATERIAL_PRODUCTION_COMMANDS.savePlanRevision:
      if (context.taskCount === 0) return unavailable('请先通过 AI 规划并采用训练任务。');
      if (context.editableIssueCount > 0) return unavailable('请先修正编辑区中的必填问题。');
      if (context.hasPlan && !context.taskEditorDirty) return unavailable('当前任务组没有需要保存的修改。');
      return available();

    case MATERIAL_PRODUCTION_COMMANDS.runPlanValidation:
      if (!context.hasPlan) return unavailable('请先保存训练任务版本。');
      if (context.taskEditorDirty) return unavailable('当前修改尚未保存，不能检查旧版本。');
      return available();

    case MATERIAL_PRODUCTION_COMMANDS.submitForQuestionReview:
      if (!context.hasPlan) return unavailable('请先保存训练任务版本。');
      if (context.taskEditorDirty) return unavailable('请先保存并重新检查当前修改。');
      if (!context.validationPassed) return unavailable('当前版本尚未通过结构检查。');
      if (!context.submissionReady) return unavailable('当前版本仍有进入审核前的检查项未完成。');
      return available();

    default:
      return unavailable('当前操作不可用。');
  }
}

function available(): MaterialProductionCommandAvailability {
  return { enabled: true, reason: '' };
}

function unavailable(reason: string): MaterialProductionCommandAvailability {
  return { enabled: false, reason };
}
