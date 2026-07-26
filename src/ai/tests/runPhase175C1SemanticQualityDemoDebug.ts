import { getPhase175C1SemanticQualityDemoData } from '../../api/phase175C1SemanticQualityDemo.ts';

function main(): void {
  const demo = getPhase175C1SemanticQualityDemoData();
  const completed = requiredCase(demo, 'completed');
  const warning = requiredCase(demo, 'warning');
  const providerFailed = requiredCase(demo, 'provider-failed');
  const safeExit = requiredCase(demo, 'safe-exit');

  const checks: Array<[string, boolean]> = [
    ['01 Demo exposes four acceptance cases', demo.cases.length === 4],
    ['02 completed semantic assessment has seven findings', completed.semantic.findings.length === 7],
    ['03 completed case is ready for review', completed.bundle.decision === 'ready_for_review'],
    ['04 completed case allows approve and freeze', completed.actions.approve && completed.actions.freeze],
    ['05 semantic warning is preserved', warning.bundle.warningCodes.includes('semantic.discriminativePower.warning')],
    ['06 warning case remains reviewable', warning.bundle.decision === 'review_with_warnings'],
    ['07 provider failure creates no guessed findings', providerFailed.semantic.findings.length === 0],
    ['08 provider failure blocks approve and freeze', !providerFailed.actions.approve && !providerFailed.actions.freeze],
    ['09 provider failure is semantic_unavailable', providerFailed.bundle.decision === 'semantic_unavailable'],
    ['10 timeout still allows revision_required', safeExit.actions.revisionRequired],
    ['11 timeout still allows reject', safeExit.actions.reject],
    ['12 timeout does not allow approve', !safeExit.actions.approve],
  ];

  checks.forEach(([name, passed]) => {
    if (!passed) throw new Error(`FAIL ${name}`);
    console.log(`PASS ${name}`);
  });
  console.log(`\nPhase 17.5C1 Demo Debug: ${checks.length}/${checks.length} PASS`);
}

function requiredCase(
  demo: ReturnType<typeof getPhase175C1SemanticQualityDemoData>,
  id: string,
) {
  const value = demo.cases.find((item) => item.id === id);
  if (!value) throw new Error(`Missing demo case: ${id}`);
  return value;
}

main();
