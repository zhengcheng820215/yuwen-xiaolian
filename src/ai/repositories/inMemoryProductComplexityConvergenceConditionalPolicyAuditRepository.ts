import type { ProductComplexityConvergenceConditionalPolicyAuditRepository } from './productComplexityConvergenceConditionalPolicyAuditRepository.ts';
import type { ConvergenceConditionalPolicyDecision } from '../schemas/productComplexityConvergenceConditionalPolicy.schema.ts';

export class InMemoryProductComplexityConvergenceConditionalPolicyAuditRepository
implements ProductComplexityConvergenceConditionalPolicyAuditRepository {
  private readonly decisions = new Map<string, ConvergenceConditionalPolicyDecision>();

  async save(decision: ConvergenceConditionalPolicyDecision): Promise<void> {
    if (!this.decisions.has(decision.decisionId)) this.decisions.set(decision.decisionId, clone(decision));
  }

  async get(decisionId: string): Promise<ConvergenceConditionalPolicyDecision | undefined> {
    const value = this.decisions.get(decisionId);
    return value ? clone(value) : undefined;
  }

  async list(): Promise<ConvergenceConditionalPolicyDecision[]> {
    return [...this.decisions.values()].map(clone);
  }

  async clear(): Promise<void> { this.decisions.clear(); }
}

function clone<T>(value: T): T { return structuredClone(value); }
