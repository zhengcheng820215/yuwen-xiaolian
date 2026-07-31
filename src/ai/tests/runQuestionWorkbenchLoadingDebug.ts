import assert from 'node:assert/strict';
import {
  isCompletedQuestionQualityContext,
  resolvePersistedQuestionQualityCheckState,
  selectPreferredPersistedQuestionQualityContext,
} from '../agents/questionQualityContextSelection.ts';
import { loadQuestionWorkbenchWithRetry } from '../../pages/questionWorkbenchLoading.ts';

const cases: Array<{ name: string; run: () => Promise<void> }> = [
  {
    name: '瞬时读取失败后自动恢复',
    run: async () => {
      let attempts = 0;
      const waits: number[] = [];
      const result = await loadQuestionWorkbenchWithRetry(
        async () => {
          attempts += 1;
          if (attempts < 3) throw new Error('temporary read failure');
          return 'ready';
        },
        {
          retryDelaysMs: [10, 20],
          wait: async (delayMs) => { waits.push(delayMs); },
        },
      );

      assert.equal(result, 'ready');
      assert.equal(attempts, 3);
      assert.deepEqual(waits, [10, 20]);
    },
  },
  {
    name: '持续失败时保留最后一次错误',
    run: async () => {
      let attempts = 0;
      const expected = new Error('persistent read failure');

      await assert.rejects(
        () => loadQuestionWorkbenchWithRetry(
          async () => {
            attempts += 1;
            throw expected;
          },
          {
            retryDelaysMs: [10, 20],
            wait: async () => undefined,
          },
        ),
        (error) => error === expected,
      );
      assert.equal(attempts, 3);
    },
  },
  {
    name: '同一 Revision 下完整检查链优先于较新的孤立记录',
    run: async () => {
      const incomplete = {
        id: 'newer-incomplete',
        semantic: { status: 'provider_failed' as const },
        bundle: { decision: 'semantic_unavailable' as const },
      };
      const complete = {
        id: 'older-complete',
        semantic: { status: 'completed' as const },
        bundle: { decision: 'ready_for_review' as const },
      };

      assert.equal(isCompletedQuestionQualityContext(incomplete), false);
      assert.equal(isCompletedQuestionQualityContext(complete), true);
      assert.equal(
        selectPreferredPersistedQuestionQualityContext([incomplete, complete])?.id,
        'older-complete',
      );
    },
  },
  {
    name: '只有失败检查链时保留记录并允许后续重试',
    run: async () => {
      const unavailable = {
        id: 'semantic-unavailable',
        semantic: { status: 'timeout' as const },
        bundle: { decision: 'semantic_unavailable' as const },
      };

      assert.equal(
        selectPreferredPersistedQuestionQualityContext([unavailable])?.id,
        'semantic-unavailable',
      );
      assert.equal(isCompletedQuestionQualityContext(unavailable), false);
      assert.equal(resolvePersistedQuestionQualityCheckState(unavailable), 'incomplete');
      assert.equal(resolvePersistedQuestionQualityCheckState(null), 'missing');
    },
  },
  {
    name: '只有完整语义链才能投影为完整检查',
    run: async () => {
      const completed = {
        semantic: { status: 'completed' as const },
        bundle: { decision: 'ready_for_review' as const },
      };
      const partial = {
        semantic: { status: 'completed' as const },
        bundle: { decision: 'semantic_unavailable' as const },
      };

      assert.equal(resolvePersistedQuestionQualityCheckState(completed), 'complete');
      assert.equal(resolvePersistedQuestionQualityCheckState(partial), 'incomplete');
    },
  },
];

let passed = 0;
for (const testCase of cases) {
  await testCase.run();
  passed += 1;
  console.log(`PASS ${testCase.name}`);
}
console.log(`Question workbench loading debug: ${passed}/${cases.length} passed.`);
