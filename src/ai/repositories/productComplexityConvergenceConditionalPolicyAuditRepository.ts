import type {
  ConvergenceConditionalPolicyDecision,
} from '../schemas/productComplexityConvergenceConditionalPolicy.schema.ts';

export interface ProductComplexityConvergenceConditionalPolicyAuditRepository {
  save(decision: ConvergenceConditionalPolicyDecision): Promise<void>;
  get(decisionId: string): Promise<ConvergenceConditionalPolicyDecision | undefined>;
  list(): Promise<ConvergenceConditionalPolicyDecision[]>;
  clear(): Promise<void>;
}
