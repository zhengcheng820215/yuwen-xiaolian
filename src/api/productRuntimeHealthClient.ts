import { isProductRuntimeHealth, type ProductRuntimeHealth } from '../ai/schemas/productRuntimeHealth.schema.ts';
import type { ProductRuntimeReasonCode } from '../ai/schemas/productRuntimeBaselineAudit.schema.ts';

export type ProductRuntimeHealthReadResult =
  | { state: 'available'; health: ProductRuntimeHealth }
  | { state: 'unreachable'; reasonCode: 'runtime_unreachable' }
  | { state: 'timeout'; reasonCode: 'runtime_health_timeout' }
  | { state: 'invalid'; reasonCode: 'audit_evidence_incomplete' };

export async function readProductRuntimeHealth(options: {
  timeoutMs?: number;
  fetcher?: typeof fetch;
} = {}): Promise<ProductRuntimeHealthReadResult> {
  const timeoutMs = options.timeoutMs ?? 1_500;
  if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) return { state: 'invalid', reasonCode: 'audit_evidence_incomplete' };
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await (options.fetcher || fetch)('/__runtime/health', {
      method: 'GET', cache: 'no-store', signal: controller.signal,
    });
    const body = await response.json();
    if (!isProductRuntimeHealth(body)) return { state: 'invalid', reasonCode: 'audit_evidence_incomplete' };
    return { state: 'available', health: body };
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') return { state: 'timeout', reasonCode: 'runtime_health_timeout' };
    return { state: 'unreachable', reasonCode: 'runtime_unreachable' };
  } finally { clearTimeout(timer); }
}

export function healthReadReasonCodes(result: ProductRuntimeHealthReadResult): ProductRuntimeReasonCode[] {
  return result.state === 'available' ? result.health.summaryReasonCodes : [result.reasonCode];
}
