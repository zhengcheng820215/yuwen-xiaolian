import {
  freezeConvergenceConditionalSessionPolicy,
  type ConvergenceConditionalCapabilityFlags,
  type ConvergenceConditionalSessionPolicySnapshot,
} from '../schemas/productComplexityConvergenceConditionalPolicy.schema.ts';

export interface ConvergenceConditionalSessionPolicyRepository {
  get(learningSessionId: string): Promise<ConvergenceConditionalSessionPolicySnapshot | undefined>;
  save(snapshot: ConvergenceConditionalSessionPolicySnapshot): Promise<void>;
}

export class InMemoryConvergenceConditionalSessionPolicyRepository
implements ConvergenceConditionalSessionPolicyRepository {
  private readonly snapshots = new Map<string, ConvergenceConditionalSessionPolicySnapshot>();

  async get(learningSessionId: string): Promise<ConvergenceConditionalSessionPolicySnapshot | undefined> {
    const value = this.snapshots.get(learningSessionId);
    return value ? structuredClone(value) : undefined;
  }

  async save(snapshot: ConvergenceConditionalSessionPolicySnapshot): Promise<void> {
    if (!this.snapshots.has(snapshot.learningSessionId)) {
      this.snapshots.set(snapshot.learningSessionId, structuredClone(snapshot));
    }
  }
}

export async function resolveConvergenceConditionalSessionPolicy(input: {
  learningSessionId: string;
  requestedFlags?: Partial<ConvergenceConditionalCapabilityFlags>;
  repository: ConvergenceConditionalSessionPolicyRepository;
  now?: () => string;
}): Promise<ConvergenceConditionalSessionPolicySnapshot> {
  const existing = await input.repository.get(input.learningSessionId);
  if (existing) return existing;
  const snapshot = freezeConvergenceConditionalSessionPolicy({
    learningSessionId: input.learningSessionId,
    flags: input.requestedFlags,
    frozenAt: (input.now || (() => new Date().toISOString()))(),
  });
  await input.repository.save(snapshot);
  return snapshot;
}
