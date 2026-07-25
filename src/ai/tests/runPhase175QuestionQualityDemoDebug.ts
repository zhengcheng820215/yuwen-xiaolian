import { getPhase175QuestionQualityDemoData } from '../../api/phase175QuestionQualityDemo.ts';

function main(): void {
  const demo = getPhase175QuestionQualityDemoData();
  const byId = new Map(demo.cases.map((item) => [item.id, item]));
  const checks: Array<[string, boolean]> = [
    ['01 demo exposes four acceptance cases', demo.cases.length === 4],
    ['02 pass case uses formal pass decision', byId.get('pass')?.assessment.decision === 'pass'],
    ['03 warning case uses formal warning decision', byId.get('warning')?.assessment.decision === 'pass_with_warnings'],
    ['04 revision case recommends revision', byId.get('revision')?.assessment.decision === 'revision_recommended'],
    ['05 pass assessment is current', byId.get('pass')?.isCurrent === true],
    ['06 warning remains advisory', byId.get('warning')?.humanReviewAllowed === true],
    ['07 revision recommendation remains advisory', byId.get('revision')?.humanReviewAllowed === true],
    ['08 stale assessment is no longer current', byId.get('stale')?.isCurrent === false],
    ['09 stale assessment blocks review entry', byId.get('stale')?.humanReviewAllowed === false],
  ];

  let passed = 0;
  console.log('Phase 17.5B Question Quality Demo Debug');
  for (const [name, ok] of checks) {
    if (!ok) {
      console.error(`FAIL ${name}`);
      process.exitCode = 1;
      continue;
    }
    passed += 1;
    console.log(`PASS ${name}`);
  }
  console.log(`\nResult: ${passed}/${checks.length} passed`);
}

main();
