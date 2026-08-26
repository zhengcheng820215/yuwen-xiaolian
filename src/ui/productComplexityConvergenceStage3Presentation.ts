import type {
  ConvergenceFeedbackDisplayBlock,
  ConvergenceFeedbackPresentation,
  ConvergenceStage3PresentationFlag,
  CoreAbilitySummary,
} from '../ai/schemas/productComplexityConvergenceFeedbackProjection.schema.ts';

export type ConvergenceFeedbackStudentView = {
  eyebrow: string;
  blocks: Array<{
    kind: ConvergenceFeedbackDisplayBlock['kind'];
    title: string;
    text: string;
  }>;
};

export function resolveConvergenceStage3PresentationFlag(
  search = typeof window === 'undefined' ? '' : window.location.search,
): ConvergenceStage3PresentationFlag {
  const value = new URLSearchParams(search).get('stage3Feedback');
  return value === 'legacy' ? 'legacy' : 'convergence_v1';
}

export function toConvergenceFeedbackStudentView(
  presentation?: ConvergenceFeedbackPresentation,
): ConvergenceFeedbackStudentView | undefined {
  if (!presentation?.validation.passed || presentation.fallbackUsed || presentation.blocks.length === 0) {
    return undefined;
  }
  return {
    eyebrow: focusEyebrow(presentation),
    blocks: presentation.blocks.map((block) => ({
      kind: block.kind,
      title: blockTitle(block.kind),
      text: block.text,
    })),
  };
}

export function removeDuplicateRevisionNextAction(
  view: ConvergenceFeedbackStudentView | undefined,
  revisionInstruction?: string,
): ConvergenceFeedbackStudentView | undefined {
  const normalizedRevisionInstruction = normalizeInstruction(revisionInstruction);
  if (!view || !normalizedRevisionInstruction) return view;
  const blocks = view.blocks.filter((block) => (
    block.kind !== 'next_action'
    || normalizeInstruction(block.text) !== normalizedRevisionInstruction
  ));
  return blocks.length === view.blocks.length ? view : { ...view, blocks };
}

export function toCoreAbilitySummaryStudentView(summary: CoreAbilitySummary): {
  ability: string;
  statusLabel: string;
  summary: string;
} | undefined {
  if (!summary.validation.passed) return undefined;
  return {
    ability: summary.abilityId,
    statusLabel: statusLabel(summary.status),
    summary: summary.recentEvidenceSummary,
  };
}

function focusEyebrow(presentation: ConvergenceFeedbackPresentation): string {
  if (presentation.focusKind === 'revision_change') return '本题修订结果';
  if (presentation.focusKind === 'recovery_only') return '本次回答已保留';
  if (presentation.focusKind === 'confirmed_understanding') return '本题反馈';
  return '本题反馈';
}

function blockTitle(kind: ConvergenceFeedbackDisplayBlock['kind']): string {
  if (kind === 'acknowledgement') return '已经做到';
  if (kind === 'primary_gap') return '先补这一点';
  if (kind === 'next_action') return '下一步这样做';
  return '稍后继续';
}

function statusLabel(status: CoreAbilitySummary['status']): string {
  if (status === 'stable') return '表现稳定';
  if (status === 'developing') return '正在形成';
  if (status === 'needs_attention') return '需要继续练习';
  return '还需更多练习记录';
}

function normalizeInstruction(value?: string): string {
  return (value || '').trim().replace(/\s+/g, '');
}
