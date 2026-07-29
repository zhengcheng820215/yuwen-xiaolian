export type Phase175C2PersistenceFact = {
  label: string;
  before: string;
  after: string;
  passed: boolean;
};

export type Phase175C2DemoCase = {
  id: string;
  label: string;
  description: string;
  expected: string;
  decision: 'restored' | 'blocked' | 'traced' | 'rolled_back';
  facts: Phase175C2PersistenceFact[];
  traceChain: string[];
  acceptancePoints: string[];
};

export type Phase175C2QualityPersistenceDemoData = {
  defaultCaseId: string;
  cases: Phase175C2DemoCase[];
  debugSummary: string;
  storageBoundary: string;
};

export function getPhase175C2QualityPersistenceDemoData():
Phase175C2QualityPersistenceDemoData {
  return {
    defaultCaseId: 'restart-recovery',
    debugSummary: '17.5C2 自动化 Debug 22/22 通过',
    storageBoundary: '受控验收快照，不写入真实题目录入工作台',
    cases: [
      {
        id: 'restart-recovery',
        label: '重启后恢复',
        description: '质量评估写入 Shared Store 后，模拟服务重启并重新读取正式质量事实。',
        expected: 'Assessment、Semantic Assessment 与 Bundle 的身份和数量保持一致。',
        decision: 'restored',
        facts: [
          { label: 'Deterministic Assessment', before: '1', after: '1', passed: true },
          { label: 'Semantic Assessment', before: '1', after: '1', passed: true },
          { label: 'Assessment Bundle', before: '1', after: '1', passed: true },
        ],
        traceChain: [
          'Draft r1',
          'Validation',
          'Deterministic Assessment',
          'Semantic Assessment',
          'Quality Bundle',
        ],
        acceptancePoints: [
          '重启前后 Assessment 身份相同',
          'Bundle 不依赖页面内存继续存在',
          '恢复过程不重新生成质量结论',
        ],
      },
      {
        id: 'revision-invalidation',
        label: 'Revision 失效阻断',
        description: '题目从 r1 修改为 r2 后，旧 Revision 的评估仍保留为历史事实，但不能继续授权当前审核。',
        expected: 'r1 可追溯但不可消费；r2 缺少当前评估时审核与 Freeze 均被阻断。',
        decision: 'blocked',
        facts: [
          { label: '历史 r1 Assessment', before: '当前', after: '仅历史', passed: true },
          { label: 'r2 当前 Bundle', before: '不存在', after: '不存在', passed: true },
          { label: '审核 / Freeze', before: '允许', after: '已阻断', passed: true },
        ],
        traceChain: ['Draft r1', 'Quality Bundle r1', 'Draft edit → r2', 'Current gate blocked'],
        acceptancePoints: [
          '旧评估不会被删除或伪装成 r2 评估',
          'Draft Revision 是正式消费身份的一部分',
          '重新评估前不能静默进入审核发布',
        ],
      },
      {
        id: 'frozen-trace',
        label: 'Freeze 质量追溯',
        description: '审核通过后，资源版本、Registry Current Head 与 Frozen Quality Trace 在同一次提交中形成。',
        expected: '正式资源能够反查当时采用的 Validation、Assessment、Bundle 与 Review。',
        decision: 'traced',
        facts: [
          { label: 'Resource Version', before: '0', after: '1', passed: true },
          { label: 'Registry Current Head', before: '无', after: 'v1', passed: true },
          { label: 'Frozen Quality Trace', before: '0', after: '1', passed: true },
        ],
        traceChain: [
          'Question Draft r1',
          'Validation',
          'Quality Bundle',
          'Human Review',
          'Frozen Resource v1',
        ],
        acceptancePoints: [
          '正式版本和质量追溯不会分离',
          'Trace 保留规则版本和来源对象 ID',
          '重复 Freeze 返回同一正式版本和 Trace',
        ],
      },
      {
        id: 'atomic-rollback',
        label: '写入失败完整回滚',
        description: '模拟 Freeze 原子提交中途失败，确认不会留下半完成的正式资源。',
        expected: 'Resource Version、Registry Head 与 Quality Trace 均不增加。',
        decision: 'rolled_back',
        facts: [
          { label: 'Resource Version', before: '0', after: '0', passed: true },
          { label: 'Registry Current Head', before: '无', after: '无', passed: true },
          { label: 'Frozen Quality Trace', before: '0', after: '0', passed: true },
        ],
        traceChain: ['Freeze request', 'Atomic commit failed', 'Transaction rollback', 'Formal state unchanged'],
        acceptancePoints: [
          '不会出现已发布但缺少质量追溯的资源',
          '失败不推进 Registry Current Head',
          '修复后可重新执行，不需要清理半成品',
        ],
      },
      {
        id: 'legacy-rule-blocked',
        label: '旧规则结果阻断',
        description: 'Revision 与 Validation 相同，但 Assessment 使用旧质量规则版本。',
        expected: '旧规则结果可保留查看，但不能授权当前 Review 或 Freeze。',
        decision: 'blocked',
        facts: [
          { label: 'Draft Revision', before: 'r1', after: 'r1', passed: true },
          { label: 'Rule Version', before: 'legacy', after: 'legacy', passed: true },
          { label: '当前消费资格', before: '不满足', after: '已阻断', passed: true },
        ],
        traceChain: ['Draft r1', 'Legacy Rule Assessment', 'Current rule identity check', 'Review blocked'],
        acceptancePoints: [
          'Revision 相同不代表评估仍然有效',
          '规则版本属于当前质量事实身份',
          '系统要求重新运行当前规则，不伪造兼容结果',
        ],
      },
    ],
  };
}
