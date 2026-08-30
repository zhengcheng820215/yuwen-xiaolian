import type {
  BuildKnowledgePracticeEntryInput,
  FormalInventoryInput,
  FormalLearningEntryInput,
  KnowledgePracticeEntryProjection,
  StudentContentInventoryProjection,
  StudentHubAction,
  StudentLearningHubProjection,
} from './studentLearningHubTypes.ts';
import { STUDENT_LEARNING_HUB_PROJECTION_VERSION } from './studentLearningHubTypes.ts';

export const KNOWLEDGE_HOME_PATH = '/learning/knowledge';
export const KNOWLEDGE_RESULT_PATH = '/learning/knowledge/result';
export const KNOWLEDGE_MISTAKES_PATH = '/learning/knowledge/mistakes';

export function knowledgeQuizPath(category?: string): string {
  return `/learning/knowledge/quiz/${encodeURIComponent(category || 'all')}`;
}

export function buildKnowledgePracticeEntryProjection(
  input: BuildKnowledgePracticeEntryInput,
): KnowledgePracticeEntryProjection {
  const count = safeCount(input.approvedQuestionCount);
  const categories = safeCount(input.availableCategoryCount);
  const active = input.activeSession?.status === 'active' ? input.activeSession : null;
  const activeProjection = active ? {
    sessionId: active.id,
    mode: active.mode,
    ...(active.category ? { category: active.category } : {}),
    currentPosition: Math.min(active.queue.length, Math.max(1, active.currentIndex + 1)),
    totalItems: active.queue.length,
  } : undefined;

  if (input.hydrationStatus === 'loading') {
    return base('loading', count, categories, activeProjection, '正在恢复本机练习进度。');
  }
  if (input.hydrationStatus === 'read_only') {
    return base('store_read_only', count, categories, activeProjection, '检测到较新版本练习记录，当前版本不会覆盖它。');
  }
  if (input.recoveryError) {
    return base('store_recovery_required', count, categories, activeProjection,
      input.recoveryError.studentMessage || '本机练习进度需要处理后才能继续。');
  }
  if (activeProjection) {
    return base('active_session', count, categories, activeProjection,
      `基础知识巩固已进行到第 ${activeProjection.currentPosition} / ${activeProjection.totalItems} 题。`);
  }
  if (count === 0) {
    return base('content_insufficient', count, categories, undefined, '基础知识巩固内容暂不可用，正式阅读训练不受影响。');
  }
  return base('ready_to_start', count, categories, undefined, `当前有 ${count} 道已审核基础知识题可用于分组练习。`);
}

export function buildStudentContentInventoryProjection(input: {
  formal: FormalInventoryInput;
  knowledge: Pick<KnowledgePracticeEntryProjection, 'approvedQuestionCount' | 'availableCategoryCount'>;
}): StudentContentInventoryProjection {
  const formal = input.formal.status === 'available' ? {
    status: 'available' as const,
    ...(finiteCount(input.formal.currentCount) ? { currentCount: input.formal.currentCount } : {}),
    ...(finiteCount(input.formal.activeMaterialCount) ? { activeMaterialCount: input.formal.activeMaterialCount } : {}),
    ...(finiteCount(input.formal.consumableCount) ? { consumableCount: input.formal.consumableCount } : {}),
  } : { status: input.formal.status };
  return {
    formal,
    knowledge: {
      approvedCount: safeCount(input.knowledge.approvedQuestionCount),
      categoryCount: safeCount(input.knowledge.availableCategoryCount),
    },
  };
}

export function projectStudentLearningHub(input: {
  formal: FormalLearningEntryInput;
  knowledge: KnowledgePracticeEntryProjection;
  inventory: StudentContentInventoryProjection;
}): StudentLearningHubProjection {
  const entry = input.formal.entry;
  const formalActive = Boolean(entry?.hasActiveSession && (
    entry.canEnterWorkspace
    || ['recovering_submission', 'review_required'].includes(entry.status || '')
  ));
  const formalStartable = Boolean(entry?.canEnterWorkspace);
  const knowledgeActive = input.knowledge.status === 'active_session';
  const knowledgeStartable = input.knowledge.status === 'ready_to_start';
  const actions: StudentHubAction[] = [];

  if (formalActive) actions.push({ kind: 'continue_formal', label: entry!.primaryActionText });
  if (knowledgeActive) actions.push({ kind: 'continue_knowledge', label: '继续基础知识巩固', path: input.knowledge.primaryPath });
  if (!formalActive && formalStartable) actions.push({ kind: 'start_formal', label: entry!.primaryActionText });
  if (!knowledgeActive && knowledgeStartable) actions.push({ kind: 'start_knowledge', label: '开始基础知识巩固', path: input.knowledge.primaryPath });
  if (input.formal.recoveryAction) actions.push({
    kind: 'recover_formal',
    label: input.formal.recoveryAction.label,
    ...(input.formal.recoveryAction.path ? { path: input.formal.recoveryAction.path } : {}),
  });
  if (['store_read_only', 'store_recovery_required'].includes(input.knowledge.status)) {
    actions.push({ kind: 'recover_knowledge', label: '查看本机练习状态', path: KNOWLEDGE_HOME_PATH });
  }

  const primaryAction = actions[0] || { kind: 'none' as const, label: '暂无可执行任务' };
  const notices: string[] = [];
  if (formalActive && knowledgeActive) notices.push('阅读训练和基础知识巩固的进度分别保存；当前优先继续阅读训练。');
  if (input.inventory.formal.status !== 'available') notices.push('正式内容数量暂不可读取，系统不会使用固定数字替代当前事实。');
  notices.push('基础知识巩固只记录本轮表现，不直接形成长期能力结论。');

  return {
    projectionVersion: STUDENT_LEARNING_HUB_PROJECTION_VERSION,
    formal: input.formal,
    knowledge: input.knowledge,
    primaryAction,
    secondaryActions: actions.slice(1),
    inventory: input.inventory,
    notices,
  };
}

export function resolveLegacyStudentRoute(pathname: string, category?: string): string | null {
  if (pathname === '/practice') return '/learning';
  if (pathname === '/practice/knowledge') return KNOWLEDGE_HOME_PATH;
  if (pathname === '/result') return KNOWLEDGE_RESULT_PATH;
  if (pathname === '/mistakes') return KNOWLEDGE_MISTAKES_PATH;
  if (pathname === '/profile') return '/learning';
  if (pathname.startsWith('/quiz/')) return knowledgeQuizPath(category || decodeURIComponent(pathname.slice('/quiz/'.length)));
  return null;
}

function base(
  status: KnowledgePracticeEntryProjection['status'],
  approvedQuestionCount: number,
  availableCategoryCount: number,
  activeSession: KnowledgePracticeEntryProjection['activeSession'],
  studentMessage: string,
): KnowledgePracticeEntryProjection {
  return {
    status,
    approvedQuestionCount,
    availableCategoryCount,
    ...(activeSession ? { activeSession } : {}),
    primaryPath: activeSession
      ? knowledgeQuizPath(activeSession.mode === 'mixed' ? 'all' : activeSession.category)
      : KNOWLEDGE_HOME_PATH,
    studentMessage,
  };
}

function safeCount(value: number): number {
  return finiteCount(value) ? value : 0;
}

function finiteCount(value: number | undefined): value is number {
  return Number.isInteger(value) && Number(value) >= 0;
}
