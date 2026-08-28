import type { ProductComplexityConvergenceConditionalPolicyAuditRepository } from './productComplexityConvergenceConditionalPolicyAuditRepository.ts';
import type { ConvergenceConditionalPolicyDecision } from '../schemas/productComplexityConvergenceConditionalPolicy.schema.ts';

const DATABASE_NAME = 'yuwen-xiaolian-product-complexity-convergence-stage2';
const DATABASE_VERSION = 1;
const STORE_NAME = 'conditional-policy-audit-decisions';

export class IndexedDBProductComplexityConvergenceConditionalPolicyAuditRepository
implements ProductComplexityConvergenceConditionalPolicyAuditRepository {
  private readonly databaseName: string;

  constructor(databaseName = DATABASE_NAME) {
    this.databaseName = databaseName;
  }

  async save(decision: ConvergenceConditionalPolicyDecision): Promise<void> {
    const database = await this.open();
    try { await requestDone(database.transaction(STORE_NAME, 'readwrite').objectStore(STORE_NAME).put(clone(decision))); }
    finally { database.close(); }
  }

  async get(decisionId: string): Promise<ConvergenceConditionalPolicyDecision | undefined> {
    const database = await this.open();
    try { return await requestDone(database.transaction(STORE_NAME, 'readonly').objectStore(STORE_NAME).get(decisionId)); }
    finally { database.close(); }
  }

  async list(): Promise<ConvergenceConditionalPolicyDecision[]> {
    const database = await this.open();
    try { return await requestDone(database.transaction(STORE_NAME, 'readonly').objectStore(STORE_NAME).getAll()); }
    finally { database.close(); }
  }

  async clear(): Promise<void> {
    const database = await this.open();
    try { await requestDone(database.transaction(STORE_NAME, 'readwrite').objectStore(STORE_NAME).clear()); }
    finally { database.close(); }
  }

  private async open(): Promise<IDBDatabase> {
    return await new Promise((resolve, reject) => {
      const request = indexedDB.open(this.databaseName, DATABASE_VERSION);
      request.onerror = () => reject(request.error || new Error('Conditional policy audit database failed to open.'));
      request.onupgradeneeded = () => {
        if (!request.result.objectStoreNames.contains(STORE_NAME)) {
          request.result.createObjectStore(STORE_NAME, { keyPath: 'decisionId' });
        }
      };
      request.onsuccess = () => resolve(request.result);
    });
  }
}

function requestDone<T = undefined>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error('Conditional policy audit operation failed.'));
  });
}

function clone<T>(value: T): T { return structuredClone(value); }
