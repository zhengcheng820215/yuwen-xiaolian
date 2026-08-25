import type { ProductRuntimeUserProjection } from '../ai/schemas/productRuntimeUserProjection.schema.ts';

export type ProductRuntimeRecoveryNoticeView = {
  tone: 'neutral' | 'information' | 'recoverable' | 'blocked';
  title: string;
  situationText: string;
  preservationText: string;
  primaryActionLabel?: string;
  secondaryActionLabel?: string;
};

export function toProductRuntimeRecoveryNoticeView(
  projection: ProductRuntimeUserProjection,
): ProductRuntimeRecoveryNoticeView {
  return {
    tone: projection.tone,
    title: sanitize(projection.title),
    situationText: sanitize(projection.situationText),
    preservationText: sanitize(projection.preservationText),
    primaryActionLabel: projection.primaryAction.emphasis === 'primary'
      ? sanitize(projection.primaryAction.label) : undefined,
    secondaryActionLabel: projection.secondaryAction ? sanitize(projection.secondaryAction.label) : undefined,
  };
}

function sanitize(value: string): string {
  if (/(revision|registry|command\s*id|quality\s*trace|checkpoint|reason\s*code|runtime_[a-z_]+|[A-Z_]{4,})/i.test(value)) {
    return '当前操作暂时无法继续，请返回后重新尝试。';
  }
  return value;
}
