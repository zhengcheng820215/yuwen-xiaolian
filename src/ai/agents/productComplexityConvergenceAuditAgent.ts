import {
  CONDITIONAL_CAPABILITY_TYPES,
  CONVERGENCE_FINDING_CODES,
  PRODUCT_COMPLEXITY_CONVERGENCE_STAGE0_AUDIT_VERSION,
  isConditionalCapabilityAuditInput,
  isConvergenceSurfaceAuditInput,
  type ConditionalCapabilityAuditInput,
  type ConditionalCapabilityAuditResult,
  type ConvergenceAuditFinding,
  type ConvergenceFindingCode,
  type ConvergenceSurfaceAuditInput,
  type ConvergenceSurfaceAuditResult,
} from '../schemas/productComplexityConvergenceAudit.schema.ts';

const BENEFIT_CODES = new Set([
  'resolve_revision_gap',
  'isolate_atomic_gap',
  'verify_independent_retention',
  'verify_transfer',
  'repair_resource_risk',
  'review_calibration_evidence',
]);

const INTERNAL_TERM_PATTERNS = [
  /\bcandidate\b/i, /\bhash\b/i, /\bgate\b/i, /\bschema\b/i,
  /\brevision id\b/i, /\bregistry\b/i, /\bdebug\b/i,
];

export function auditConvergenceSurface(
  input: ConvergenceSurfaceAuditInput,
): ConvergenceSurfaceAuditResult {
  if (!isConvergenceSurfaceAuditInput(input)) throw new Error('convergence_surface_audit_input_invalid');
  const findings: ConvergenceAuditFinding[] = [];
  const ordinaryAudience = input.audience !== 'internal';

  if (ordinaryAudience) {
    for (const element of input.elements) {
      if (INTERNAL_TERM_PATTERNS.some((pattern) => pattern.test(element.text))) {
        findings.push(finding('internal_term_exposed', input.surfaceId, [element.elementId],
          '普通页面暴露了内部工程对象或身份。'));
      }
      if (/调度|scheduler/i.test(element.text)) {
        findings.push(finding('scheduler_explanation_exposed', input.surfaceId, [element.elementId],
          '普通页面解释了内部调度过程。'));
      }
      if (/画像管线|profile pipeline|证据管线/i.test(element.text)) {
        findings.push(finding('profile_pipeline_exposed', input.surfaceId, [element.elementId],
          '普通页面解释了内部画像或证据处理过程。'));
      }
    }
  }

  const primaryByIntent = groupBy(input.elements.filter((item) => item.kind === 'primary_action'),
    (item) => item.intent || normalizeText(item.text));
  Object.values(primaryByIntent).filter((items) => items.length > 1).forEach((items) => {
    findings.push(finding('duplicate_primary_action', input.surfaceId,
      items.map((item) => item.elementId), '同一用户意图出现多个主操作。'));
  });

  const factGroups = groupBy(input.elements.filter((item) => Boolean(item.factKey)),
    (item) => item.factKey!);
  Object.values(factGroups).filter((items) => items.length > 1).forEach((items) => {
    findings.push(finding('duplicate_state_message', input.surfaceId,
      items.map((item) => item.elementId), '多个页面元素重复表达同一状态事实。'));
  });

  input.elements.forEach((element) => {
    if (element.kind === 'status' && element.actionable === false) {
      findings.push(finding('non_actionable_status', input.surfaceId, [element.elementId],
        '该状态不能改变用户当前判断或动作。'));
    }
    if (element.kind === 'conditional_entry' && element.conditionActive === false) {
      findings.push(finding('conditional_feature_visible_without_trigger', input.surfaceId,
        [element.elementId], '条件能力未触发却占据普通页面。'));
    }
    if (element.kind === 'error' && (!element.nextAction || element.actionable === false)) {
      findings.push(finding('error_without_local_action', input.surfaceId, [element.elementId],
        '错误没有提供当前可执行的恢复动作。'));
    }
    if (element.kind === 'error' && element.location === 'remote') {
      findings.push(finding('hidden_error_location', input.surfaceId, [element.elementId],
        '错误远离触发操作，当前视口难以发现。'));
    }
    if (element.factSource === 'parallel_derived') {
      findings.push(finding('parallel_fact_source_risk', input.surfaceId, [element.elementId],
        '页面正在自行派生第二套事实。'));
    }
  });

  if (input.feedback && (input.feedback.issueCount > 1 || input.feedback.guidanceCount > 1)) {
    findings.push(finding('feedback_overloaded', input.surfaceId, [],
      '一次反馈包含多个主要缺口或多个下一步动作。'));
  }
  if (input.feedback?.expressionMode === 'fixed_template') {
    findings.push(finding('fixed_feedback_template', input.surfaceId, [],
      '反馈固定投射模板结构，未根据当前事实减负。'));
  }

  return { surfaceId: input.surfaceId, route: input.route, stateId: input.stateId,
    audience: input.audience, findings: uniqueFindings(findings) };
}

export function auditConditionalCapability(
  input: ConditionalCapabilityAuditInput,
): ConditionalCapabilityAuditResult {
  if (!isConditionalCapabilityAuditInput(input)) throw new Error('conditional_capability_audit_input_invalid');
  const findings: ConvergenceAuditFinding[] = [];
  if (!input.triggerActive && input.entryVisible) {
    findings.push(finding('conditional_feature_visible_without_trigger', input.pathId, [],
      `${input.capability} 未触发却可见。`));
  }
  if (input.triggerActive && (!input.exitAvailable || !input.noActionFallbackAvailable
    || !input.recoveryAvailable)) {
    findings.push(finding('conditional_exit_missing', input.pathId, [],
      `${input.capability} 缺少退出、无动作或恢复路径。`));
  }
  if (input.capability === 'targeted' && (input.recursiveDepth || 0) > 1) {
    findings.push(finding('targeted_loop_risk', input.pathId, [],
      'Targeted 训练出现递归插入风险。'));
  }
  if (input.benefitCode && !BENEFIT_CODES.has(input.benefitCode)) {
    findings.push(finding('benefit_code_unstructured', input.pathId, [],
      '预期收益仍以非结构化值参与判断。'));
  }
  if (input.factSource === 'parallel_derived') {
    findings.push(finding('parallel_fact_source_risk', input.pathId, [],
      '条件能力使用了第二套事实来源。'));
  }
  if (input.retirementCompatibility === false) {
    findings.push(finding('retirement_compatibility_missing', input.pathId, [],
      '能力关闭或退役时缺少兼容路径。'));
  }
  return { pathId: input.pathId, capability: input.capability,
    findings: uniqueFindings(findings) };
}

export function finding(
  code: ConvergenceFindingCode,
  sourceId: string,
  elementIds: string[],
  explanation: string,
): ConvergenceAuditFinding {
  const policy = FINDING_POLICY[code];
  return { code, priority: policy.priority, recommendationStage: policy.stage,
    sourceId, elementIds, explanation };
}

export const FINDING_POLICY: Record<ConvergenceFindingCode, {
  priority: ConvergenceAuditFinding['priority']; stage: ConvergenceAuditFinding['recommendationStage'];
}> = {
  internal_term_exposed: { priority: 'P1', stage: 1 },
  non_actionable_status: { priority: 'P2', stage: 1 },
  duplicate_primary_action: { priority: 'P1', stage: 1 },
  duplicate_state_message: { priority: 'P2', stage: 1 },
  conditional_feature_visible_without_trigger: { priority: 'P1', stage: 1 },
  scheduler_explanation_exposed: { priority: 'P2', stage: 1 },
  profile_pipeline_exposed: { priority: 'P2', stage: 1 },
  error_without_local_action: { priority: 'P0', stage: 1 },
  hidden_error_location: { priority: 'P1', stage: 1 },
  feedback_overloaded: { priority: 'P1', stage: 3 },
  fixed_feedback_template: { priority: 'P2', stage: 3 },
  conditional_exit_missing: { priority: 'P0', stage: 2 },
  targeted_loop_risk: { priority: 'P0', stage: 2 },
  benefit_code_unstructured: { priority: 'P2', stage: 2 },
  parallel_fact_source_risk: { priority: 'P0', stage: 2 },
  retirement_compatibility_missing: { priority: 'P2', stage: 4 },
};

function normalizeText(value: string): string { return value.trim().toLowerCase().replace(/\s+/g, ' '); }
function groupBy<T>(items: T[], key: (item: T) => string): Record<string, T[]> {
  return items.reduce<Record<string, T[]>>((result, item) => {
    const value = key(item); (result[value] ||= []).push(item); return result;
  }, {});
}
function uniqueFindings(items: ConvergenceAuditFinding[]): ConvergenceAuditFinding[] {
  const seen = new Set<string>();
  return items.filter((item) => {
    const key = `${item.code}:${item.sourceId}:${item.elementIds.join(',')}`;
    if (seen.has(key)) return false; seen.add(key); return true;
  });
}

export function isKnownConditionalCapability(value: string): boolean {
  return (CONDITIONAL_CAPABILITY_TYPES as readonly string[]).includes(value);
}
export function isKnownConvergenceFindingCode(value: string): boolean {
  return (CONVERGENCE_FINDING_CODES as readonly string[]).includes(value);
}
export const CONVERGENCE_AUDIT_SCHEMA_VERSION =
  PRODUCT_COMPLEXITY_CONVERGENCE_STAGE0_AUDIT_VERSION;
