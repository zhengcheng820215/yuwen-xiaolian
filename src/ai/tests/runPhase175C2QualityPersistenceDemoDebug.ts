import {
  getPhase175C2QualityPersistenceDemoData,
} from '../../api/phase175C2QualityPersistenceDemo.ts';

function main(): void {
  const demo = getPhase175C2QualityPersistenceDemoData();
  const recovery = requiredCase(demo, 'restart-recovery');
  const revision = requiredCase(demo, 'revision-invalidation');
  const trace = requiredCase(demo, 'frozen-trace');
  const rollback = requiredCase(demo, 'atomic-rollback');
  const legacy = requiredCase(demo, 'legacy-rule-blocked');

  const checks: Array<[string, boolean]> = [
    ['01 Demo exposes five C2 acceptance cases', demo.cases.length === 5],
    ['02 restart recovery keeps three persisted collections', recovery.facts.every((fact) => fact.before === fact.after)],
    ['03 restart recovery does not regenerate conclusions', recovery.acceptancePoints.some((point) => point.includes('不重新生成'))],
    ['04 draft revision change blocks current consumption', revision.decision === 'blocked'],
    ['05 stale assessment remains historical', revision.facts.some((fact) => fact.after === '仅历史')],
    ['06 freeze trace includes five source stages', trace.traceChain.length === 5],
    ['07 freeze creates version registry and trace together', trace.facts.every((fact) => fact.after !== '0' && fact.after !== '无')],
    ['08 failed commit is rolled back', rollback.decision === 'rolled_back'],
    ['09 rollback leaves no formal object', rollback.facts.every((fact) => fact.after === '0' || fact.after === '无')],
    ['10 legacy rule is blocked', legacy.decision === 'blocked'],
    ['11 every displayed fact is an accepted fact', demo.cases.every((item) => item.facts.every((fact) => fact.passed))],
    ['12 Demo declares isolated storage boundary', demo.storageBoundary.includes('不写入真实题目录入工作台')],
  ];

  checks.forEach(([name, passed]) => {
    if (!passed) throw new Error(`FAIL ${name}`);
    console.log(`PASS ${name}`);
  });
  console.log(`\nPhase 17.5C2 Demo Debug: ${checks.length}/${checks.length} PASS`);
}

function requiredCase(
  demo: ReturnType<typeof getPhase175C2QualityPersistenceDemoData>,
  id: string,
) {
  const value = demo.cases.find((item) => item.id === id);
  if (!value) throw new Error(`Missing demo case: ${id}`);
  return value;
}

main();
