import {
  buildQuestionSemanticQualityPrompt,
  buildQuestionSemanticQualityRepairPrompt,
} from '../prompts/buildQuestionSemanticQualityPrompt.ts';
import {
  DiagnosisProviderError,
  type DiagnosisProviderAdapter,
} from '../providers/diagnosisProviderAdapter.ts';
import type {
  QuestionMaterialVersion,
  ResourceValidationResult,
  StructuredQuestionDraft,
} from '../schemas/questionResourceAdmission.schema.ts';
import {
  QUESTION_QUALITY_CHECKS,
  QUESTION_QUALITY_RULE_VERSION,
  type QuestionQualityAssessment,
  type QuestionQualityCheck,
} from '../schemas/questionQualityAssessment.schema.ts';
import {
  QUESTION_QUALITY_MERGE_RULE_VERSION,
  QUESTION_SEMANTIC_QUALITY_OUTPUT_SCHEMA_VERSION,
  QUESTION_SEMANTIC_QUALITY_PROMPT_VERSION,
  QUESTION_SEMANTIC_QUALITY_RULE_VERSION,
  assertBundleIdentityAligned,
  cloneSemanticQualityValue,
  validateSemanticFindings,
  type QuestionQualityAssessmentBundle,
  type QuestionQualityReviewAction,
  type QuestionSemanticQualityAssessment,
  type SemanticAssessmentStatus,
  type SemanticQualityFinding,
} from '../schemas/questionSemanticQualityAssessment.schema.ts';

export type QuestionSemanticQualityProviderConfig = {
  providerId: string;
  modelId: string;
  timeoutMs: number;
  temperature?: number;
  maxOutputTokens?: number;
};

export type RunQuestionSemanticQualityAssessmentInput = {
  requestId: string;
  draft: StructuredQuestionDraft;
  validation: ResourceValidationResult;
  material: QuestionMaterialVersion;
  deterministicAssessment: QuestionQualityAssessment;
  provider: QuestionSemanticQualityProviderConfig;
  promptVersion?: string;
  semanticRuleVersion?: string;
  outputSchemaVersion?: string;
  startedAt?: string;
};

export type QuestionSemanticQualityAssessmentSessionCache = {
  getCompleted(
    semanticRequestKey: string,
  ): Promise<QuestionSemanticQualityAssessment | null>;
  remember(
    assessment: QuestionSemanticQualityAssessment,
  ): Promise<QuestionSemanticQualityAssessment>;
};

export type RunQuestionSemanticQualityAssessmentDependencies = {
  provider: DiagnosisProviderAdapter;
  cache?: QuestionSemanticQualityAssessmentSessionCache;
  now?: () => string;
};

export class InMemoryQuestionSemanticQualityAssessmentSessionCache
implements QuestionSemanticQualityAssessmentSessionCache {
  private readonly completedByRequestKey =
    new Map<string, QuestionSemanticQualityAssessment>();

  async getCompleted(
    semanticRequestKey: string,
  ): Promise<QuestionSemanticQualityAssessment | null> {
    return cloneSemanticQualityValue(
      this.completedByRequestKey.get(semanticRequestKey) || null,
    );
  }

  async remember(
    assessment: QuestionSemanticQualityAssessment,
  ): Promise<QuestionSemanticQualityAssessment> {
    if (assessment.status === 'completed') {
      const existing = this.completedByRequestKey.get(
        assessment.semanticRequestKey,
      );
      if (existing) return cloneSemanticQualityValue(existing);
      this.completedByRequestKey.set(
        assessment.semanticRequestKey,
        cloneSemanticQualityValue(assessment),
      );
    }
    return cloneSemanticQualityValue(assessment);
  }
}

export async function runQuestionSemanticQualityAssessment(
  input: RunQuestionSemanticQualityAssessmentInput,
  dependencies: RunQuestionSemanticQualityAssessmentDependencies,
): Promise<QuestionSemanticQualityAssessment> {
  assertSemanticAssessmentInput(input, dependencies.provider);
  const now = dependencies.now || (() => new Date().toISOString());
  const promptVersion =
    input.promptVersion || QUESTION_SEMANTIC_QUALITY_PROMPT_VERSION;
  const semanticRuleVersion =
    input.semanticRuleVersion || QUESTION_SEMANTIC_QUALITY_RULE_VERSION;
  const outputSchemaVersion =
    input.outputSchemaVersion || QUESTION_SEMANTIC_QUALITY_OUTPUT_SCHEMA_VERSION;
  const semanticRequestKey = buildSemanticRequestKey({
    draft: input.draft,
    validation: input.validation,
    material: input.material,
    deterministicAssessment: input.deterministicAssessment,
    provider: input.provider,
    promptVersion,
    semanticRuleVersion,
    outputSchemaVersion,
  });
  const cached = await dependencies.cache?.getCompleted(semanticRequestKey);
  if (cached) return cached;

  const startedAt = input.startedAt || now();
  const semanticAssessmentId = buildSemanticAssessmentId(
    semanticRequestKey,
    input.requestId,
  );
  const prompt = buildQuestionSemanticQualityPrompt({
    draft: input.draft,
    material: input.material,
    promptVersion,
    outputSchemaVersion,
  });

  try {
    const first = await dependencies.provider.diagnose({
      requestId: input.requestId,
      attempt: 1,
      prompt,
      model: input.provider.modelId,
      temperature: input.provider.temperature ?? 0,
      maxOutputTokens: input.provider.maxOutputTokens ?? 1800,
      timeoutMs: input.provider.timeoutMs,
    });
    const firstFindings = parseSemanticFindings(first.rawOutput);
    if (firstFindings) {
      return remember(dependencies.cache, completedAssessment({
        input,
        semanticAssessmentId,
        semanticRequestKey,
        findings: firstFindings.findings,
        limitations: firstFindings.limitations,
        promptVersion,
        semanticRuleVersion,
        outputSchemaVersion,
        startedAt,
        completedAt: now(),
      }));
    }

    const repair = await dependencies.provider.diagnose({
      requestId: input.requestId,
      attempt: 2,
      prompt: buildQuestionSemanticQualityRepairPrompt({
        originalPrompt: prompt,
        invalidOutput: first.rawOutput,
        outputSchemaVersion,
      }),
      model: input.provider.modelId,
      temperature: 0,
      maxOutputTokens: input.provider.maxOutputTokens ?? 1800,
      timeoutMs: input.provider.timeoutMs,
    });
    const repairedFindings = parseSemanticFindings(repair.rawOutput);
    if (repairedFindings) {
      return remember(dependencies.cache, completedAssessment({
        input,
        semanticAssessmentId,
        semanticRequestKey,
        findings: repairedFindings.findings,
        limitations: repairedFindings.limitations,
        promptVersion,
        semanticRuleVersion,
        outputSchemaVersion,
        startedAt,
        completedAt: now(),
      }));
    }
    return failureAssessment({
      input,
      semanticAssessmentId,
      semanticRequestKey,
      status: 'invalid_output',
      limitation: 'Provider output remained structurally invalid after one repair request.',
      promptVersion,
      semanticRuleVersion,
      outputSchemaVersion,
      startedAt,
      completedAt: now(),
    });
  } catch (error) {
    const status: SemanticAssessmentStatus = (
      error instanceof DiagnosisProviderError &&
      error.category === 'timeout'
    ) ? 'timeout' : 'provider_failed';
    return failureAssessment({
      input,
      semanticAssessmentId,
      semanticRequestKey,
      status,
      limitation: status === 'timeout'
        ? 'Semantic quality provider request timed out.'
        : 'Semantic quality provider was unavailable.',
      promptVersion,
      semanticRuleVersion,
      outputSchemaVersion,
      startedAt,
      completedAt: now(),
    });
  }
}

export function mergeQuestionQualityAssessments(input: {
  deterministic: QuestionQualityAssessment;
  semantic: QuestionSemanticQualityAssessment;
  createdAt?: string;
  mergeRuleVersion?: string;
}): QuestionQualityAssessmentBundle {
  assertBundleIdentityAligned(input.deterministic, input.semantic);
  const mergeRuleVersion =
    input.mergeRuleVersion || QUESTION_QUALITY_MERGE_RULE_VERSION;
  const warningCodes = [
    ...input.deterministic.warnings.map((warning) => warning.code),
  ];
  const effectiveChecks = {
    ...input.deterministic.checks,
  };

  if (input.semantic.status !== 'completed') {
    warningCodes.push(`semantic.${input.semantic.status}`);
    return {
      bundleId: buildBundleId(
        input.deterministic.assessmentId,
        input.semantic.semanticAssessmentId,
        mergeRuleVersion,
      ),
      draftId: input.deterministic.draftId,
      resourceId: input.deterministic.resourceId,
      assessedDraftRevision: input.deterministic.assessedDraftRevision,
      validationId: input.deterministic.validationId,
      deterministicAssessmentId: input.deterministic.assessmentId,
      semanticAssessmentId: input.semantic.semanticAssessmentId,
      effectiveChecks,
      decision: 'semantic_unavailable',
      warningCodes: unique(warningCodes),
      deterministicRuleVersion: input.deterministic.ruleVersion,
      semanticRuleVersion: input.semantic.semanticRuleVersion,
      mergeRuleVersion,
      createdAt: input.createdAt || new Date().toISOString(),
    };
  }

  let semanticStrongWarning = false;
  input.semantic.findings.forEach((finding) => {
    if (finding.status === 'pass') return;
    effectiveChecks[finding.check] = 'warning';
    warningCodes.push(`semantic.${finding.check}.${finding.status}`);
    if (finding.status === 'strong_warning') semanticStrongWarning = true;
  });
  const hasFail = effectiveChecks.materialGrounding === 'fail';
  const hasWarning = QUESTION_QUALITY_CHECKS.some(
    (check) => effectiveChecks[check] === 'warning',
  );
  const decision = hasFail || semanticStrongWarning
    ? 'revision_recommended'
    : hasWarning
      ? 'review_with_warnings'
      : 'ready_for_review';

  return {
    bundleId: buildBundleId(
      input.deterministic.assessmentId,
      input.semantic.semanticAssessmentId,
      mergeRuleVersion,
    ),
    draftId: input.deterministic.draftId,
    resourceId: input.deterministic.resourceId,
    assessedDraftRevision: input.deterministic.assessedDraftRevision,
    validationId: input.deterministic.validationId,
    deterministicAssessmentId: input.deterministic.assessmentId,
    semanticAssessmentId: input.semantic.semanticAssessmentId,
    effectiveChecks,
    decision,
    warningCodes: unique(warningCodes),
    deterministicRuleVersion: input.deterministic.ruleVersion,
    semanticRuleVersion: input.semantic.semanticRuleVersion,
    mergeRuleVersion,
    createdAt: input.createdAt || new Date().toISOString(),
  };
}

export function canApplyQualityReviewAction(
  bundle: QuestionQualityAssessmentBundle,
  action: QuestionQualityReviewAction,
): boolean {
  return bundle.decision !== 'semantic_unavailable' || action !== 'approve';
}

export function canFreezeWithQualityBundle(
  bundle: QuestionQualityAssessmentBundle,
): boolean {
  return bundle.decision !== 'semantic_unavailable';
}

export function buildSemanticRequestKey(input: {
  draft: StructuredQuestionDraft;
  validation: ResourceValidationResult;
  material: QuestionMaterialVersion;
  deterministicAssessment: Pick<QuestionQualityAssessment, 'assessmentId'>;
  provider: QuestionSemanticQualityProviderConfig;
  promptVersion: string;
  semanticRuleVersion: string;
  outputSchemaVersion: string;
}): string {
  return `semantic-request-${fingerprint([
    input.draft.draftId,
    input.draft.revision,
    input.validation.validationId,
    input.material.materialVersionId,
    input.deterministicAssessment.assessmentId,
    input.provider.providerId,
    input.provider.modelId,
    input.promptVersion,
    input.semanticRuleVersion,
    input.outputSchemaVersion,
  ].join('|'))}`;
}

function assertSemanticAssessmentInput(
  input: RunQuestionSemanticQualityAssessmentInput,
  provider: DiagnosisProviderAdapter,
): void {
  if (
    !input.validation.passed ||
    input.validation.draftId !== input.draft.draftId ||
    input.validation.resourceId !== input.draft.resourceId ||
    input.validation.validatedDraftRevision !== input.draft.revision ||
    input.draft.latestValidationId !== input.validation.validationId
  ) {
    throw new Error('Semantic quality assessment requires current passed validation.');
  }
  if (
    !input.draft.materialVersionId ||
    input.draft.materialVersionId !== input.material.materialVersionId
  ) {
    throw new Error('Semantic quality assessment requires the current material version.');
  }
  const deterministic = input.deterministicAssessment;
  if (
    deterministic.draftId !== input.draft.draftId ||
    deterministic.resourceId !== input.draft.resourceId ||
    deterministic.assessedDraftRevision !== input.draft.revision ||
    deterministic.validationId !== input.validation.validationId ||
    deterministic.ruleVersion !== QUESTION_QUALITY_RULE_VERSION
  ) {
    throw new Error('Semantic quality assessment requires current deterministic assessment.');
  }
  if (
    !input.requestId.trim() ||
    !input.provider.providerId.trim() ||
    !input.provider.modelId.trim() ||
    input.provider.timeoutMs <= 0
  ) {
    throw new Error('Semantic quality assessment provider configuration is invalid.');
  }
  if (provider.providerName !== input.provider.providerId) {
    throw new Error('Semantic quality provider identity does not match configuration.');
  }
}

function parseSemanticFindings(rawOutput: string): {
  findings: SemanticQualityFinding[];
  limitations: string[];
} | null {
  const parsed = parseJsonObject(rawOutput);
  if (!parsed) return null;
  const findings = validateSemanticFindings(
    parsed.findings,
    allowedEvidenceRefPrefixes(),
  );
  const limitations = Array.isArray(parsed.limitations) &&
    parsed.limitations.every((item) => typeof item === 'string' && item.trim())
    ? parsed.limitations as string[]
    : null;
  if (!findings || !limitations) return null;
  return { findings, limitations: [...limitations] };
}

function parseJsonObject(rawOutput: string): Record<string, unknown> | null {
  const trimmed = rawOutput.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
  const candidates = [trimmed];
  const start = trimmed.indexOf('{');
  const end = trimmed.lastIndexOf('}');
  if (start >= 0 && end > start) candidates.push(trimmed.slice(start, end + 1));
  for (const candidate of candidates) {
    try {
      const parsed = JSON.parse(candidate) as unknown;
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        return parsed as Record<string, unknown>;
      }
    } catch {
      // Try the next structurally plausible candidate.
    }
  }
  return null;
}

function allowedEvidenceRefPrefixes(): string[] {
  return [
    'material.title',
    'material.content',
    'draft.questionStem',
    'draft.questionType',
    'draft.responseFormat',
    'draft.options',
    'draft.choiceInteraction',
    'draft.answerAcceptance',
    'draft.rubric',
    'draft.minimumAnswerRequirement',
    'draft.abilityMetadata',
  ];
}

function completedAssessment(input: {
  input: RunQuestionSemanticQualityAssessmentInput;
  semanticAssessmentId: string;
  semanticRequestKey: string;
  findings: SemanticQualityFinding[];
  limitations: string[];
  promptVersion: string;
  semanticRuleVersion: string;
  outputSchemaVersion: string;
  startedAt: string;
  completedAt: string;
}): QuestionSemanticQualityAssessment {
  return {
    semanticAssessmentId: input.semanticAssessmentId,
    semanticRequestKey: input.semanticRequestKey,
    requestId: input.input.requestId,
    draftId: input.input.draft.draftId,
    resourceId: input.input.draft.resourceId,
    assessedDraftRevision: input.input.draft.revision,
    validationId: input.input.validation.validationId,
    materialVersionId: input.input.material.materialVersionId,
    deterministicAssessmentId: input.input.deterministicAssessment.assessmentId,
    status: 'completed',
    findings: cloneSemanticQualityValue(input.findings),
    limitations: [...input.limitations],
    providerId: input.input.provider.providerId,
    modelId: input.input.provider.modelId,
    promptVersion: input.promptVersion,
    semanticRuleVersion: input.semanticRuleVersion,
    outputSchemaVersion: input.outputSchemaVersion,
    startedAt: input.startedAt,
    completedAt: input.completedAt,
  };
}

function failureAssessment(input: {
  input: RunQuestionSemanticQualityAssessmentInput;
  semanticAssessmentId: string;
  semanticRequestKey: string;
  status: Exclude<SemanticAssessmentStatus, 'completed'>;
  limitation: string;
  promptVersion: string;
  semanticRuleVersion: string;
  outputSchemaVersion: string;
  startedAt: string;
  completedAt: string;
}): QuestionSemanticQualityAssessment {
  return {
    semanticAssessmentId: input.semanticAssessmentId,
    semanticRequestKey: input.semanticRequestKey,
    requestId: input.input.requestId,
    draftId: input.input.draft.draftId,
    resourceId: input.input.draft.resourceId,
    assessedDraftRevision: input.input.draft.revision,
    validationId: input.input.validation.validationId,
    materialVersionId: input.input.material.materialVersionId,
    deterministicAssessmentId: input.input.deterministicAssessment.assessmentId,
    status: input.status,
    findings: [],
    limitations: [input.limitation],
    providerId: input.input.provider.providerId,
    modelId: input.input.provider.modelId,
    promptVersion: input.promptVersion,
    semanticRuleVersion: input.semanticRuleVersion,
    outputSchemaVersion: input.outputSchemaVersion,
    startedAt: input.startedAt,
    completedAt: input.completedAt,
  };
}

async function remember(
  cache: QuestionSemanticQualityAssessmentSessionCache | undefined,
  assessment: QuestionSemanticQualityAssessment,
): Promise<QuestionSemanticQualityAssessment> {
  return cache ? cache.remember(assessment) : assessment;
}

function buildSemanticAssessmentId(
  semanticRequestKey: string,
  requestId: string,
): string {
  return `semantic-assessment-${fingerprint(`${semanticRequestKey}|${requestId}`)}`;
}

function buildBundleId(
  deterministicAssessmentId: string,
  semanticAssessmentId: string,
  mergeRuleVersion: string,
): string {
  return `quality-bundle-${fingerprint([
    deterministicAssessmentId,
    semanticAssessmentId,
    mergeRuleVersion,
  ].join('|'))}`;
}

function fingerprint(value: string): string {
  let hash = 0x811c9dc5;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(36);
}

function unique(values: string[]): string[] {
  return [...new Set(values)];
}
