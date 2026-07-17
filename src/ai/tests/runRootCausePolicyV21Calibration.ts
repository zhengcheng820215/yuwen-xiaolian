import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import {
  acceptsRootCauseV21,
  classifyRootCauseV21,
  DIAGNOSIS_QUALITY_POLICY_V21,
  getRootCausePolicyV21RuleMetadata,
  type RootCauseClassificationV21,
} from '../evaluation/diagnosisQualityPolicyV21.ts';
import { PHASE15_2_ANNOTATION_V2 } from '../evaluation/phase15_2_annotation_v2.ts';
import type { DiagnosisResult } from '../schemas/diagnosis.schema.ts';
import type { DiagnosisQualityEvaluationV2 } from '../schemas/diagnosisQualityPolicyV2.schema.ts';

const SOURCE_REPORT = 'docs/education/phase/reports/phase15_2/phase15-prompt-v4-calibrated-baseline-2026-07-17T10-03-31-702Z.json';
const ATTRIBUTION_REPORT = 'docs/education/phase/reports/phase15_2/phase15-root-cause-failure-attribution-2026-07-17T10-26-06-313Z.json';
const OUTPUT_DIRECTORY = 'docs/education/phase/reports/phase15_2';

type FailureLayer = 'prompt' | 'policy' | 'dataset' | 'evaluator' | 'ambiguous';

type SourceReport = {
  reportId: string;
  configuration: {
    datasetVersion: string;
    promptVersion: string;
    executionMode: string;
  };
  evaluations: DiagnosisQualityEvaluationV2[];
  runs: Array<{
    sampleId: string;
    runIndex: number;
    candidateSnapshot?: DiagnosisResult;
  }>;
  safety: {
    evidenceCreated: boolean;
    profileUpdated: boolean;
    secretLogged: boolean;
    fullPromptLogged: boolean;
    rawOutputLogged: boolean;
  };
};

type AttributionReport = {
  reportId: string;
  runAttributions: Array<{
    caseId: string;
    actualLabelReasonableness: 'reasonable' | 'unreasonable' | 'ambiguous';
    primaryFailureLayer: FailureLayer;
    reviewStatus: 'agent_initial_review';
  }>;
  validation: { passed: boolean; issues: string[] };
};

type RunResult = {
  runId: string;
  sampleId: string;
  answerStatus: string;
  rootCause: string;
  v2Accepted: boolean;
  v21Accepted: boolean;
  v21AcceptanceReason: string;
  classification: RootCauseClassificationV21;
  regressionGroup:
    | 'previously_accepted_61'
    | 'reasonable_failed_29'
    | 'confirmed_prompt_error_3';
};

type CalibrationReport = {
  schemaVersion: 'root_cause_policy_v2_1_calibration_v1';
  reportId: string;
  createdAt: string;
  sourceReportId: string;
  attributionReportId: string;
  policyVersion: typeof DIAGNOSIS_QUALITY_POLICY_V21;
  executionMode: 'offline_existing_candidate_calibration';
  metrics: {
    totalCandidateRuns: number;
    acceptedRuns: number;
    acceptanceRate: number;
    unknownRuns: number;
    conflictingRuns: number;
    previouslyAcceptedPreserved: number;
    previouslyAcceptedTotal: number;
    reasonableFailuresRecovered: number;
    reasonableFailuresTotal: number;
    confirmedPromptErrorsRejected: number;
    confirmedPromptErrorsTotal: number;
  };
  acceptanceConstraints: Array<{
    code: string;
    passed: boolean;
    actual: string;
    required: string;
  }>;
  ruleAudit: {
    classifierInputFields: ['rootCause'];
    usesSampleId: false;
    usesCaseId: false;
    ruleMetadata: ReturnType<typeof getRootCausePolicyV21RuleMetadata>;
    multiLabelPolicy: string[];
  };
  previouslyAcceptedAudit: Array<{
    runId: string;
    reviewStatus: 'agent_initial_semantic_review';
    v21Accepted: boolean;
    rootCause: string;
  }>;
  runResults: RunResult[];
  recommendation: {
    status: 'policy_v2_1_ready_for_human_confirmation' | 'calibration_failed';
    nextStep: string;
  };
  safety: {
    providerCalls: 0;
    promptModified: false;
    datasetModified: false;
    evidenceCreated: false;
    profileUpdated: false;
    onlineRuntimeChanged: false;
  };
  limitations: string[];
  validation: { passed: boolean; issues: string[] };
};

async function run(): Promise<void> {
  const source = JSON.parse(await readFile(path.resolve(SOURCE_REPORT), 'utf8')) as SourceReport;
  const attribution = JSON.parse(await readFile(path.resolve(ATTRIBUTION_REPORT), 'utf8')) as AttributionReport;
  const issues = validateSources(source, attribution);
  const annotationById = new Map(PHASE15_2_ANNOTATION_V2.annotations.map((item) => [item.sampleId, item]));
  const evaluationByRunId = new Map(source.evaluations.map((item) => [item.runId, item]));
  const attributionByRunId = new Map(attribution.runAttributions.map((item) => [item.caseId, item]));

  const runResults: RunResult[] = [];
  for (const sourceRun of source.runs) {
    if (!sourceRun.candidateSnapshot) continue;
    const runId = `${sourceRun.sampleId}#${sourceRun.runIndex}`;
    const evaluation = evaluationByRunId.get(runId);
    const annotation = annotationById.get(sourceRun.sampleId);
    if (!evaluation || !annotation) throw new Error(`Missing evaluation input for ${runId}.`);
    const classification = classifyRootCauseV21(sourceRun.candidateSnapshot.rootCause);
    const acceptance = acceptsRootCauseV21({
      classification,
      annotation,
      answerStatus: sourceRun.candidateSnapshot.answerStatus,
    });
    const attributionItem = attributionByRunId.get(runId);
    const regressionGroup = evaluation.dimensions.rootCauseCategoryAccepted
      ? 'previously_accepted_61'
      : attributionItem?.actualLabelReasonableness === 'reasonable'
        ? 'reasonable_failed_29'
        : 'confirmed_prompt_error_3';
    runResults.push({
      runId,
      sampleId: sourceRun.sampleId,
      answerStatus: sourceRun.candidateSnapshot.answerStatus || '',
      rootCause: sourceRun.candidateSnapshot.rootCause,
      v2Accepted: evaluation.dimensions.rootCauseCategoryAccepted,
      v21Accepted: acceptance.accepted,
      v21AcceptanceReason: acceptance.reason,
      classification,
      regressionGroup,
    });
  }

  const previouslyAccepted = runResults.filter((item) => item.regressionGroup === 'previously_accepted_61');
  const reasonableFailed = runResults.filter((item) => item.regressionGroup === 'reasonable_failed_29');
  const promptErrors = runResults.filter((item) => item.regressionGroup === 'confirmed_prompt_error_3');
  const acceptedRuns = runResults.filter((item) => item.v21Accepted).length;
  const unknownRuns = runResults.filter((item) => item.classification.status === 'unknown').length;
  const conflictingRuns = runResults.filter((item) => item.classification.status === 'conflicting').length;
  const preserved = previouslyAccepted.filter((item) => item.v21Accepted).length;
  const recovered = reasonableFailed.filter((item) => item.v21Accepted).length;
  const rejectedPromptErrors = promptErrors.filter((item) => !item.v21Accepted).length;
  const holdoutChecks = runHoldoutChecks();
  const acceptanceConstraints = [
    constraint('root_cause_acceptance_at_least_80_percent', acceptedRuns / runResults.length >= 0.8, `${acceptedRuns}/${runResults.length}`, '>= 80%'),
    constraint('reasonable_29_no_regression', recovered === reasonableFailed.length, `${recovered}/${reasonableFailed.length}`, '29/29'),
    constraint('prompt_error_3_remain_blocked', rejectedPromptErrors === promptErrors.length, `${rejectedPromptErrors}/${promptErrors.length}`, '3/3'),
    constraint('previously_accepted_61_preserved', preserved === previouslyAccepted.length, `${preserved}/${previouslyAccepted.length}`, '61/61'),
    constraint('unknown_significantly_reduced', unknownRuns <= 3, String(unknownRuns), '<= 3'),
    constraint('no_conflicting_classification_accepted', runResults.every((item) => item.classification.status !== 'conflicting' || !item.v21Accepted), String(conflictingRuns), '0 accepted conflicts'),
    constraint('unseen_paraphrase_holdout_pass', holdoutChecks.every((item) => item.passed), `${holdoutChecks.filter((item) => item.passed).length}/${holdoutChecks.length}`, `${holdoutChecks.length}/${holdoutChecks.length}`),
    constraint('classifier_has_no_identity_input', classifyRootCauseV21.length === 1, String(classifyRootCauseV21.length), '1 rootCause-only argument'),
  ];

  const createdAt = new Date().toISOString();
  const reportId = `phase15-root-cause-policy-v2-1-calibration-${createdAt.replace(/[:.]/g, '-')}`;
  const report: CalibrationReport = {
    schemaVersion: 'root_cause_policy_v2_1_calibration_v1',
    reportId,
    createdAt,
    sourceReportId: source.reportId,
    attributionReportId: attribution.reportId,
    policyVersion: DIAGNOSIS_QUALITY_POLICY_V21,
    executionMode: 'offline_existing_candidate_calibration',
    metrics: {
      totalCandidateRuns: runResults.length,
      acceptedRuns,
      acceptanceRate: acceptedRuns / runResults.length,
      unknownRuns,
      conflictingRuns,
      previouslyAcceptedPreserved: preserved,
      previouslyAcceptedTotal: previouslyAccepted.length,
      reasonableFailuresRecovered: recovered,
      reasonableFailuresTotal: reasonableFailed.length,
      confirmedPromptErrorsRejected: rejectedPromptErrors,
      confirmedPromptErrorsTotal: promptErrors.length,
    },
    acceptanceConstraints,
    ruleAudit: {
      classifierInputFields: ['rootCause'],
      usesSampleId: false,
      usesCaseId: false,
      ruleMetadata: getRootCausePolicyV21RuleMetadata(),
      multiLabelPolicy: [
        '仅当至少一个已检出的具体类别被人工边界明确允许时，该 Run 才能通过。',
        'no_clear_deficit 与任何明确缺陷类别互斥。',
        '多个缺陷类别可以同时存在并保持可见，不得静默丢弃任何类别。',
        '当 fully_meets 属于人工允许状态时，即使旧标注只列出了缺陷路径，也可接受 no_clear_deficit。',
        'unknown 和 conflicting 始终需要复核，不得自动通过。',
      ],
    },
    previouslyAcceptedAudit: previouslyAccepted.map((item) => ({
      runId: item.runId,
      reviewStatus: 'agent_initial_semantic_review',
      v21Accepted: item.v21Accepted,
      rootCause: item.rootCause,
    })),
    runResults,
    recommendation: {
      status: acceptanceConstraints.every((item) => item.passed)
        ? 'policy_v2_1_ready_for_human_confirmation'
        : 'calibration_failed',
      nextStep: '在任何正式评估链路中替换 Policy v2 之前，需人工确认 29 个已恢复 Run、3 个持续阻断的 Prompt 错误，以及 61 个原通过 Run 的全量保持性审核。',
    },
    safety: {
      providerCalls: 0,
      promptModified: false,
      datasetModified: false,
      evidenceCreated: false,
      profileUpdated: false,
      onlineRuntimeChanged: false,
    },
    limitations: [
      'Policy v2 remains frozen; Policy v2.1 is an offline calibration candidate only.',
      'The 61-run semantic audit is agent-assisted and still requires human confirmation.',
      'The 29 recovered and 3 blocked sets come from the initial attribution report and inherit its pending-human-confirmation limitation.',
      'Offline acceptance labels are not an online quality gate for unseen student responses.',
    ],
    validation: { passed: false, issues: [] },
  };
  report.validation.issues = [
    ...issues,
    ...validateReport(report),
  ];
  report.validation.passed = report.validation.issues.length === 0;
  const output = await writeReport(report, holdoutChecks);
  printReport(report, holdoutChecks, output);
  if (!report.validation.passed || !report.acceptanceConstraints.every((item) => item.passed)) {
    process.exitCode = 1;
  }
}

function runHoldoutChecks(): Array<{ label: string; passed: boolean; detail: string }> {
  const cases: Array<{
    label: string;
    rootCause: string;
    expected: string[];
    status?: RootCauseClassificationV21['status'];
  }> = [
    {
      label: '未见同义表达：缺少依据关系',
      rootCause: '答案只写了判断，没有说明材料中的动作为什么能支持这一判断。',
      expected: ['missing_evidence'],
    },
    {
      label: '未见同义表达：错误目的推断',
      rootCause: '把老师引导学生自行检查理解成处罚，核心目的的推断不成立。',
      expected: ['incorrect_causal_relation'],
    },
    {
      label: '未见同义表达：添加材料外信息',
      rootCause: '概括中加入了材料没有出现的原因，使结论与原文冲突。',
      expected: ['unsupported_inference'],
    },
    {
      label: '未见同义表达：概括遗漏',
      rootCause: '回答没有保留人物的关键行为，主要事件要素缺失。',
      expected: ['incomplete_summary'],
    },
    {
      label: '无明确缺口',
      rootCause: '本次回答没有明显问题，结论与依据符合题目要求。',
      expected: ['no_clear_deficit_in_current_response'],
    },
    {
      label: '互斥类别冲突不得吞并',
      rootCause: '本次作答未发现明确问题，但同时缺少必要文本依据。',
      expected: ['no_clear_deficit_in_current_response', 'missing_evidence'],
      status: 'conflicting',
    },
    {
      label: '无具体语义保持 unknown',
      rootCause: '还需要继续观察。',
      expected: ['unknown'],
      status: 'unknown',
    },
  ];
  return cases.map((item) => {
    const result = classifyRootCauseV21(item.rootCause);
    const categoriesPass = item.expected.every((category) => result.categories.includes(category as never));
    const statusPass = !item.status || result.status === item.status;
    return {
      label: item.label,
      passed: categoriesPass && statusPass,
      detail: `${result.status}: ${result.categories.join(',')}`,
    };
  });
}

function validateSources(source: SourceReport, attribution: AttributionReport): string[] {
  const issues: string[] = [];
  if (source.configuration.promptVersion !== 'real_ai_diagnosis_prompt_v4') issues.push('prompt_version_mismatch');
  if (source.configuration.executionMode !== 'shadow') issues.push('source_not_shadow');
  if (source.safety.evidenceCreated || source.safety.profileUpdated) issues.push('source_mutated_formal_data');
  if (source.safety.secretLogged || source.safety.fullPromptLogged || source.safety.rawOutputLogged) issues.push('unsafe_source_logging');
  if (!attribution.validation.passed) issues.push('attribution_report_invalid');
  if (attribution.runAttributions.length !== 32) issues.push('attribution_run_count_mismatch');
  return issues;
}

function validateReport(report: CalibrationReport): string[] {
  const issues: string[] = [];
  if (report.metrics.totalCandidateRuns !== 93) issues.push('expected_93_candidate_runs');
  if (report.metrics.previouslyAcceptedTotal !== 61) issues.push('expected_61_previously_accepted_runs');
  if (report.metrics.reasonableFailuresTotal !== 29) issues.push('expected_29_reasonable_failed_runs');
  if (report.metrics.confirmedPromptErrorsTotal !== 3) issues.push('expected_3_confirmed_prompt_errors');
  if (report.ruleAudit.ruleMetadata.some((item) => /phase15|sample|case/i.test(`${item.code}:${item.category}`))) {
    issues.push('identity_specific_rule_detected');
  }
  if (report.safety.providerCalls !== 0 || report.safety.evidenceCreated || report.safety.profileUpdated) {
    issues.push('offline_safety_boundary_failed');
  }
  return issues;
}

async function writeReport(
  report: CalibrationReport,
  holdoutChecks: Array<{ label: string; passed: boolean; detail: string }>,
): Promise<{ json: string; markdown: string }> {
  await mkdir(OUTPUT_DIRECTORY, { recursive: true });
  const jsonPath = path.join(OUTPUT_DIRECTORY, `${report.reportId}.json`);
  const markdownPath = path.join(OUTPUT_DIRECTORY, `${report.reportId}.md`);
  await writeFile(jsonPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  await writeFile(markdownPath, toMarkdown(report, holdoutChecks), 'utf8');
  return { json: jsonPath, markdown: markdownPath };
}

function toMarkdown(
  report: CalibrationReport,
  holdoutChecks: Array<{ label: string; passed: boolean; detail: string }>,
): string {
  const constraints = report.acceptanceConstraints.map((item) =>
    `| ${item.passed ? 'PASS' : 'FAIL'} | ${item.code} | ${item.actual} | ${item.required} |`,
  ).join('\n');
  const holdouts = holdoutChecks.map((item) =>
    `| ${item.passed ? 'PASS' : 'FAIL'} | ${item.label} | ${item.detail} |`,
  ).join('\n');
  return `# Phase 15.2 Root Cause Policy v2.1 Calibration\n\n` +
    `状态：${report.recommendation.status}  \n` +
    `模式：离线重评已有 Candidate，Provider 调用 0  \n` +
    `Policy：${report.policyVersion}  \n\n` +
    `## 一、结果\n\n` +
    `- Root Cause 接受：${report.metrics.acceptedRuns} / ${report.metrics.totalCandidateRuns}（${percent(report.metrics.acceptanceRate)}）；\n` +
    `- 29 个合理失败 Run 恢复：${report.metrics.reasonableFailuresRecovered} / ${report.metrics.reasonableFailuresTotal}；\n` +
    `- 3 个 Prompt 错误继续阻断：${report.metrics.confirmedPromptErrorsRejected} / ${report.metrics.confirmedPromptErrorsTotal}；\n` +
    `- 原 61 个自动通过 Run 保持：${report.metrics.previouslyAcceptedPreserved} / ${report.metrics.previouslyAcceptedTotal}；\n` +
    `- unknown：${report.metrics.unknownRuns}；conflicting：${report.metrics.conflictingRuns}。\n\n` +
    `## 二、防过拟合验收\n\n` +
    `| 状态 | 约束 | 实际 | 要求 |\n|---|---|---|---|\n${constraints}\n\n` +
    `## 三、未见表达回归\n\n` +
    `| 状态 | Case | 结果 |\n|---|---|---|\n${holdouts}\n\n` +
    `## 四、多标签边界\n\n` +
    report.ruleAudit.multiLabelPolicy.map((item) => `- ${item}`).join('\n') + '\n\n' +
    `## 五、61 个原通过 Run 的复核状态\n\n` +
    `已完成全量 Agent 初步语义复核与 v2.1 回归，仍需人工确认；本报告不把该步骤表述为人工共识。\n\n` +
    `## 六、安全边界\n\n` +
    `- 未调用 Provider；\n- 未修改 Prompt 或 Dataset；\n- 未创建 Evidence；\n- 未更新 Profile；\n- 未切换线上 Runtime。\n\n` +
    `## 七、下一步\n\n${report.recommendation.nextStep}\n`;
}

function constraint(code: string, passed: boolean, actual: string, required: string) {
  return { code, passed, actual, required };
}

function percent(value: number): string {
  return `${(value * 100).toFixed(1)}%`;
}

function printReport(
  report: CalibrationReport,
  holdoutChecks: Array<{ label: string; passed: boolean; detail: string }>,
  output: { json: string; markdown: string },
): void {
  console.log('\nPhase 15.2 Root Cause Policy v2.1 Calibration');
  console.log('='.repeat(76));
  for (const item of report.acceptanceConstraints) {
    console.log(`${item.passed ? 'PASS' : 'FAIL'} | ${item.code} | ${item.actual} / ${item.required}`);
  }
  for (const item of holdoutChecks) {
    console.log(`${item.passed ? 'PASS' : 'FAIL'} | ${item.label} | ${item.detail}`);
  }
  console.log('-'.repeat(76));
  console.log(`Acceptance: ${report.metrics.acceptedRuns}/${report.metrics.totalCandidateRuns} (${percent(report.metrics.acceptanceRate)})`);
  console.log(`Status: ${report.recommendation.status}`);
  console.log(`Validation: ${report.validation.passed ? 'PASS' : 'FAIL'}`);
  console.log(`JSON: ${output.json}`);
  console.log(`Markdown: ${output.markdown}`);
}

await run();
