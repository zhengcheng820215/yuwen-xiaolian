import {
  PRODUCT_COMPLEXITY_CONVERGENCE_STAGE1_SURFACE_PROJECTION_VERSION,
  AUTHORING_SURFACE_STATES,
  LEARNING_SURFACE_STATES,
  type AuthoringSurfaceFacts,
  type LearningSurfaceFacts,
  type ProductSurfaceAction,
  type ProductSurfaceProjection,
  type ProductSurfaceRecovery,
} from '../schemas/productComplexityConvergenceSurfaceProjection.schema.ts';

const action = (
  actionId: string,
  commandId: string,
  label: string,
  emphasis: ProductSurfaceAction['emphasis'] = 'primary',
  disabled = false,
  busy = false,
): ProductSurfaceAction => ({ actionId, commandId, label, emphasis, disabled, busy });

export function projectAuthoringSurface(facts: AuthoringSurfaceFacts): ProductSurfaceProjection {
  const state = (AUTHORING_SURFACE_STATES as readonly string[]).includes(facts.state)
    ? facts.state : 'recoverable_failure';
  const base = projection(facts.surfaceId, 'authoring_user', state);
  if (state === 'no_candidate') return {
    ...base, title: '训练任务', status: { tone: 'neutral', label: '尚未生成' },
    primaryAction: facts.canGenerate === false ? undefined : action('generate', 'generate_training_tasks', '生成训练任务'),
  };
  if (state === 'generating') return {
    ...base, title: '训练任务', status: { tone: 'progress', label: '正在生成' },
    primaryAction: action('generate', 'generate_training_tasks', '正在生成', 'primary', true, true),
  };
  if (state === 'candidate_ready') return {
    ...base, title: '待采用方案', status: { tone: 'success', label: '可以采用' },
    primaryAction: facts.canAdoptAndPublish === false ? undefined
      : action('adopt-publish', 'adopt_and_publish', '采用并发布'),
    secondaryActions: facts.canRegenerate === false ? []
      : [action('regenerate', 'regenerate_candidate', '重新优化', 'secondary')],
  };
  if (state === 'publishing') return {
    ...base, title: '训练任务', status: { tone: 'progress', label: '正在发布' },
    primaryAction: action('adopt-publish', 'adopt_and_publish', '正在发布', 'primary', true, true),
  };
  if (state === 'published') return {
    ...base, title: '训练任务', status: {
      tone: 'success', label: '已发布',
      detail: facts.publishedTaskCount ? `已发布 ${facts.publishedTaskCount} 道题` : undefined,
    },
    disclosureSections: [{ disclosureId: 'details', label: '展开详情', expanded: false }],
  };
  if (state === 'version_conflict') return {
    ...base, title: '内容已更新', status: { tone: 'warning', label: '需要刷新' },
    localRecovery: recovery('conflict', '当前内容已更新，请刷新后继续。',
      preservationText(facts.preservedContent), 'refresh', 'refresh_current_state', '刷新当前状态', facts.internalErrorRef),
  };
  return {
    ...base, title: '操作未完成', status: { tone: 'error', label: '需要重试' },
    localRecovery: recovery('temporary', '本次操作没有完成，请重新尝试。',
      preservationText(facts.preservedContent), 'retry', 'retry_current_operation', '重新尝试', facts.internalErrorRef),
  };
}

export function projectLearningSurface(facts: LearningSurfaceFacts): ProductSurfaceProjection {
  const state = (LEARNING_SURFACE_STATES as readonly string[]).includes(facts.state)
    ? facts.state : 'recoverable_failure';
  const base = projection(facts.surfaceId, 'learning_student', state);
  const question = currentQuestionLabel(facts.currentQuestionNumber, facts.totalQuestionCount);
  if (state === 'entry') return {
    ...base, title: '学习', status: { tone: 'neutral', label: '可以开始' },
    primaryAction: facts.canContinue === false ? undefined : action('start', 'start_or_resume_learning', '开始学习'),
  };
  if (['task', 'targeted', 'retest', 'transfer'].includes(state)) return {
    ...base,
    title: state === 'targeted' ? '针对练习' : question || '题目',
    status: question ? { tone: 'progress', label: question } : undefined,
    primaryAction: facts.canSubmit === false ? undefined : action('submit', 'submit_current_answer', '提交本题答案'),
    secondaryActions: facts.canSaveDraft === false ? []
      : [action('save-draft', 'save_current_draft', '保存草稿', 'secondary')],
    disclosureSections: facts.hintAvailable ? [{ disclosureId: 'hint', label: '需要提示时查看', expanded: Boolean(facts.hintExpanded) }] : [],
  };
  if (state === 'feedback') {
    const next = nextQuestionLabel(facts.currentQuestionNumber, facts.totalQuestionCount);
    return {
      ...base, title: '本题反馈', status: { tone: 'success', label: '本题已完成' },
      primaryAction: facts.canContinue === false || !next ? undefined
        : action('continue', 'continue_to_next_question', next),
    };
  }
  if (state === 'revision') return {
    ...base, title: '根据反馈修订', status: { tone: 'progress', label: '可以修改一次' },
    primaryAction: facts.canRevise === false ? undefined : action('revise', 'submit_answer_revision', '提交修订'),
  };
  if (state === 'complete') return {
    ...base, title: '本次学习已完成', status: { tone: 'success', label: '已完成' },
    primaryAction: action('return', 'return_to_learning_entry', '返回学习入口'),
  };
  return {
    ...base, title: '暂时无法继续', status: { tone: 'error', label: '需要重试' },
    localRecovery: recovery('temporary', '学习状态暂时无法读取，请重新尝试。',
      '已完成的作答和草稿不会丢失。', 'retry', 'retry_learning_state', '重新尝试', facts.internalErrorRef),
  };
}

export function nextQuestionLabel(current?: number, total?: number): string | undefined {
  if (!Number.isInteger(current) || !Number.isInteger(total) || current! >= total! || current! < 1) return undefined;
  return `进入第 ${current! + 1} 题（共 ${total} 题）`;
}

export function currentQuestionLabel(current?: number, total?: number): string | undefined {
  if (!Number.isInteger(current) || !Number.isInteger(total) || current! < 1 || current! > total!) return undefined;
  return `第 ${current} 题（共 ${total} 题）`;
}

function projection(surfaceId: string, audience: ProductSurfaceProjection['audience'], stateId: string): ProductSurfaceProjection {
  return {
    projectionVersion: PRODUCT_COMPLEXITY_CONVERGENCE_STAGE1_SURFACE_PROJECTION_VERSION,
    surfaceId, audience, stateId, secondaryActions: [], disclosureSections: [],
  };
}

function recovery(
  errorCategory: ProductSurfaceRecovery['errorCategory'], userMessage: string,
  preservationMessage: string, actionId: string, commandId: string, label: string,
  internalErrorRef?: string,
): ProductSurfaceRecovery {
  return { errorCategory, userMessage, preservationMessage,
    action: action(actionId, commandId, label), internalErrorRef };
}

function preservationText(value: AuthoringSurfaceFacts['preservedContent']): string {
  if (value === 'candidate') return '当前待采用方案已经保留。';
  if (value === 'draft') return '当前草稿已经保留。';
  if (value === 'published') return '已发布内容保持不变。';
  return '现有正式内容不会被改变。';
}
