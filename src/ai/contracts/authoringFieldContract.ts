import type {
  MaterialObservationPlan,
  ObservationTaskPlan,
} from '../schemas/materialObservation.schema.ts';
import type {
  QuestionResourceDifficulty,
  PrimaryAbilityId,
  StructuredQuestionDraft,
} from '../schemas/questionResourceAdmission.schema.ts';
import {
  PRIMARY_ABILITY_IDS,
} from '../schemas/questionResourceAdmission.schema.ts';
import type { QuestionQualityCheck } from '../schemas/questionQualityAssessment.schema.ts';
import type { RecommendedTaskRole } from '../schemas/nextLearningStrategy.schema.ts';

export const AUTHORING_FIELD_CONTRACT_VERSION = 'authoring_field_contract_v1' as const;

export type AuthoringFieldKey =
  | 'abilityTarget'
  | 'specificTrainingPoint'
  | 'questionStem'
  | 'studentTask'
  | 'observationTarget';

export type AuthoringFieldContract = {
  key: AuthoringFieldKey;
  label: string;
  uiField: string;
  planPath: string;
  draftPath?: string;
  validationPath: string;
  aiOutputPath: string;
  editorTargetIds: string[];
  qualityChecks: QuestionQualityCheck[];
};

export const AUTHORING_FIELD_CONTRACTS: Record<AuthoringFieldKey, AuthoringFieldContract> = {
  abilityTarget: {
    key: 'abilityTarget',
    label: '能力目标',
    uiField: 'abilityId',
    planPath: 'taskPlans[].abilityId',
    draftPath: 'abilityMetadata.abilityId',
    validationPath: 'abilityMetadata.abilityId',
    aiOutputPath: 'abilityId',
    editorTargetIds: ['question-training-targets'],
    qualityChecks: ['observationClarity', 'observationDistinctness', 'rubricAlignment'],
  },
  specificTrainingPoint: {
    key: 'specificTrainingPoint',
    label: '具体训练点',
    uiField: 'specificTrainingPoint',
    planPath: 'taskPlans[].observationFocus.displayName',
    validationPath: 'taskPlans[].observationFocus.displayName',
    aiOutputPath: 'specificTrainingPoint',
    editorTargetIds: ['question-training-targets'],
    qualityChecks: ['observationClarity', 'observationDistinctness'],
  },
  questionStem: {
    key: 'questionStem',
    label: '题目',
    uiField: 'questionStem',
    planPath: 'taskPlans[].observationGoal',
    draftPath: 'questionStem',
    validationPath: 'questionStem',
    aiOutputPath: 'questionStem',
    editorTargetIds: ['question-stem-editor'],
    qualityChecks: [
      'materialGrounding',
      'observationClarity',
      'observationDistinctness',
      'rubricAlignment',
      'scopeClarity',
    ],
  },
  studentTask: {
    key: 'studentTask',
    label: '学生任务',
    uiField: 'studentTask',
    planPath: 'taskPlans[].expectedStudentAction',
    validationPath: 'taskPlans[].expectedStudentAction',
    aiOutputPath: 'studentTask',
    editorTargetIds: ['question-training-targets'],
    qualityChecks: ['observationClarity', 'scopeClarity'],
  },
  observationTarget: {
    key: 'observationTarget',
    label: '观察目标',
    uiField: 'observationTarget',
    planPath: 'taskPlans[].observationFocus.definition',
    validationPath: 'taskPlans[].observationFocus.definition',
    aiOutputPath: 'observationTarget',
    editorTargetIds: ['question-training-targets'],
    qualityChecks: ['observationClarity', 'observationDistinctness', 'rubricAlignment'],
  },
};

export type AuthoringFieldValues = {
  abilityTarget: StructuredQuestionDraft['abilityMetadata']['abilityId'];
  specificTrainingPoint: string;
  questionStem: string;
  studentTask: string;
  observationTarget: string;
};

export type AuthoringContentFieldKey = Exclude<AuthoringFieldKey, 'abilityTarget'>;

export type AuthoringFieldSource =
  | 'plan'
  | 'draft'
  | 'legacy_adapter'
  | 'unavailable';

export type AuthoringFieldProvenance = {
  source: AuthoringFieldSource;
  sourcePath: string | null;
  needsHumanReview: boolean;
};

export type AuthoringFieldAdaptation = {
  values: AuthoringFieldValues;
  provenance: Record<AuthoringFieldKey, AuthoringFieldProvenance>;
};

export type AuthoringFieldResponsibilityIssue = {
  code: 'authoring_field_role_overlap';
  severity: 'warning';
  fields: [AuthoringContentFieldKey, AuthoringContentFieldKey];
  message: string;
  currentContent: string;
  suggestion: string;
  editorTargetIds: string[];
};

export type AuthoringAiOutput = {
  authoringContractVersion: typeof AUTHORING_FIELD_CONTRACT_VERSION;
  abilityId: PrimaryAbilityId;
  specificTrainingPoint: string;
  questionStem: string;
  studentTask: string;
  observationTarget: string;
};

export type AuthoringAiOutputValidation = {
  valid: boolean;
  output: AuthoringAiOutput | null;
  errors: string[];
  warnings: AuthoringFieldResponsibilityIssue[];
};

export type PlanControlledQuestionSettings = {
  abilityId: StructuredQuestionDraft['abilityMetadata']['abilityId'];
  taskRole: RecommendedTaskRole;
  difficulty: QuestionResourceDifficulty;
};

export type PlanControlledFieldKey = keyof PlanControlledQuestionSettings;

export type PlanControlledFieldContract = {
  key: PlanControlledFieldKey;
  label: string;
  uiField: string;
  planPath: string;
  draftPath: string;
  validationPath: string;
};

export const PLAN_CONTROLLED_FIELD_CONTRACTS: Record<
  PlanControlledFieldKey,
  PlanControlledFieldContract
> = {
  abilityId: {
    key: 'abilityId',
    label: '能力目标',
    uiField: 'abilityId',
    planPath: 'taskPlans[].abilityId',
    draftPath: 'abilityMetadata.abilityId',
    validationPath: 'abilityMetadata.abilityId',
  },
  taskRole: {
    key: 'taskRole',
    label: '任务用途',
    uiField: 'taskRole',
    planPath: 'taskPlans[].taskRole',
    draftPath: 'abilityMetadata.taskRole',
    validationPath: 'abilityMetadata.taskRole',
  },
  difficulty: {
    key: 'difficulty',
    label: '难度',
    uiField: 'difficulty',
    planPath: 'taskPlans[].difficulty',
    draftPath: 'abilityMetadata.difficulty',
    validationPath: 'abilityMetadata.difficulty',
  },
};

export type ObservationTaskReference = {
  planId: string | null;
  observationTaskPlanId: string | null;
};

export const AUTHORING_QUALITY_CHECKS_BY_UI_FIELD: Record<string, QuestionQualityCheck[]> = {
  materialVersionId: ['materialGrounding'],
  title: ['observationClarity', 'observationDistinctness'],
  questionType: ['scopeClarity', 'rubricAlignment', 'discriminativePower'],
  responseFormat: ['scopeClarity', 'rubricAlignment', 'discriminativePower'],
  optionsText: ['scopeClarity', 'rubricAlignment'],
  assessmentMode: ['rubricAlignment', 'discriminativePower'],
  acceptedAnswersText: ['rubricAlignment', 'discriminativePower'],
  acceptedKeywordsText: ['rubricAlignment', 'discriminativePower'],
  semanticEquivalentAllowed: ['rubricAlignment'],
  minLength: ['scopeClarity', 'difficultyCoherence'],
  requireTextEvidence: ['materialGrounding', 'rubricAlignment'],
  requireExplanation: ['rubricAlignment', 'discriminativePower'],
  taskRole: ['observationClarity'],
  difficulty: ['difficultyCoherence'],
  ...Object.fromEntries(
    Object.values(AUTHORING_FIELD_CONTRACTS)
      .map((contract) => [contract.uiField, contract.qualityChecks]),
  ),
};

const QUALITY_CHECK_PRIMARY_FIELD: Record<QuestionQualityCheck, AuthoringFieldKey | 'rubric'> = {
  materialGrounding: 'questionStem',
  observationClarity: 'questionStem',
  observationDistinctness: 'questionStem',
  discriminativePower: 'rubric',
  difficultyCoherence: 'questionStem',
  rubricAlignment: 'rubric',
  scopeClarity: 'questionStem',
};

const QUALITY_CHECK_EDIT_LOCATION: Record<QuestionQualityCheck, string> = {
  materialGrounding: '基础内容 → 题目',
  observationClarity: '基础内容 → 题目；训练设置 → 能力目标与具体训练点',
  observationDistinctness: '基础内容 → 题目；评分标准 → 评分项',
  discriminativePower: '评分标准 → 评分项1（可继续增加评分项）',
  difficultyCoherence: '训练设置 → 难度；基础内容 → 题目',
  rubricAlignment: '基础内容 → 题目；评分标准 → 评分项',
  scopeClarity: '基础内容 → 题目',
};

export function readObservationTaskReference(
  tags: string[] | undefined,
): ObservationTaskReference {
  return {
    planId: readTagValue(tags, 'observation_plan:'),
    observationTaskPlanId: readTagValue(tags, 'observation_task:'),
  };
}

export function findObservationTaskPlan(
  plan: MaterialObservationPlan | null | undefined,
  reference: ObservationTaskReference,
): ObservationTaskPlan | null {
  if (!plan || !reference.observationTaskPlanId) return null;
  return plan.taskPlans.find(
    (task) => task.observationTaskPlanId === reference.observationTaskPlanId,
  ) || null;
}

export function getPlanControlledQuestionSettings(
  task: ObservationTaskPlan,
): PlanControlledQuestionSettings {
  return {
    abilityId: task.abilityId,
    taskRole: task.taskRole,
    difficulty: task.difficulty,
  };
}

export function getAuthoringFieldValues(
  draft: StructuredQuestionDraft,
  task: ObservationTaskPlan | null,
): AuthoringFieldValues {
  return getAuthoringFieldAdaptation(draft, task).values;
}

export function getAuthoringFieldAdaptation(
  draft: StructuredQuestionDraft,
  task: ObservationTaskPlan | null,
): AuthoringFieldAdaptation {
  const hasPlanTask = Boolean(task);
  return {
    values: {
      abilityTarget: task?.abilityId || draft.abilityMetadata.abilityId,
      specificTrainingPoint: task?.observationFocus?.displayName?.trim() || '',
      questionStem: draft.questionStem,
      studentTask: task?.expectedStudentAction?.trim() || '',
      observationTarget: task?.observationFocus?.definition?.trim() || '',
    },
    provenance: {
      abilityTarget: hasPlanTask
        ? planSource(AUTHORING_FIELD_CONTRACTS.abilityTarget.planPath)
        : {
          source: 'legacy_adapter',
          sourcePath: AUTHORING_FIELD_CONTRACTS.abilityTarget.draftPath || null,
          needsHumanReview: true,
        },
      specificTrainingPoint: hasPlanTask
        ? planSource(AUTHORING_FIELD_CONTRACTS.specificTrainingPoint.planPath)
        : unavailableSource(),
      questionStem: {
        source: 'draft',
        sourcePath: AUTHORING_FIELD_CONTRACTS.questionStem.draftPath || null,
        needsHumanReview: false,
      },
      studentTask: hasPlanTask
        ? planSource(AUTHORING_FIELD_CONTRACTS.studentTask.planPath)
        : unavailableSource(),
      observationTarget: hasPlanTask
        ? planSource(AUTHORING_FIELD_CONTRACTS.observationTarget.planPath)
        : unavailableSource(),
    },
  };
}

export function assessAuthoringFieldResponsibilities(
  values: Partial<Record<AuthoringContentFieldKey, unknown>>,
): AuthoringFieldResponsibilityIssue[] {
  const fields: AuthoringContentFieldKey[] = [
    'specificTrainingPoint',
    'questionStem',
    'studentTask',
    'observationTarget',
  ];
  const issues: AuthoringFieldResponsibilityIssue[] = [];

  fields.forEach((field, index) => {
    fields.slice(index + 1).forEach((otherField) => {
      const value = normalizeResponsibilityValue(values[field]);
      const otherValue = normalizeResponsibilityValue(values[otherField]);
      if (!value || !otherValue || !isHighResponsibilityOverlap(value, otherValue)) return;
      if (
        normalizeResponsibilityText(value) !== normalizeResponsibilityText(otherValue) &&
        satisfiesFieldResponsibility(field, value) &&
        satisfiesFieldResponsibility(otherField, otherValue)
      ) return;

      issues.push({
        code: 'authoring_field_role_overlap',
        severity: 'warning',
        fields: [field, otherField],
        message: `${AUTHORING_FIELD_CONTRACTS[field].label}与${AUTHORING_FIELD_CONTRACTS[otherField].label}职责过于相似`,
        currentContent: `${AUTHORING_FIELD_CONTRACTS[field].label}：${value}；${AUTHORING_FIELD_CONTRACTS[otherField].label}：${otherValue}`,
        suggestion: buildResponsibilitySuggestion(field, otherField),
        editorTargetIds: Array.from(new Set([
          ...AUTHORING_FIELD_CONTRACTS[field].editorTargetIds,
          ...AUTHORING_FIELD_CONTRACTS[otherField].editorTargetIds,
        ])),
      });
    });
  });

  return issues;
}

function normalizeResponsibilityValue(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

export function validateAuthoringAiOutput(value: unknown): AuthoringAiOutputValidation {
  const errors: string[] = [];
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return {
      valid: false,
      output: null,
      errors: ['AI 输出必须是字段化对象。'],
      warnings: [],
    };
  }

  const candidate = value as Record<string, unknown>;
  if (candidate.authoringContractVersion !== AUTHORING_FIELD_CONTRACT_VERSION) {
    errors.push(`authoringContractVersion 必须为 ${AUTHORING_FIELD_CONTRACT_VERSION}。`);
  }
  if (
    typeof candidate.abilityId !== 'string' ||
    !PRIMARY_ABILITY_IDS.includes(candidate.abilityId as PrimaryAbilityId)
  ) {
    errors.push('abilityId 必须是能力注册表中的稳定 ID。');
  }

  const textFields: AuthoringContentFieldKey[] = [
    'specificTrainingPoint',
    'questionStem',
    'studentTask',
    'observationTarget',
  ];
  textFields.forEach((field) => {
    if (typeof candidate[field] !== 'string' || !candidate[field].trim()) {
      errors.push(`${AUTHORING_FIELD_CONTRACTS[field].aiOutputPath} 必须是非空文本。`);
    }
  });

  if (errors.length) {
    return { valid: false, output: null, errors, warnings: [] };
  }

  const output: AuthoringAiOutput = {
    authoringContractVersion: AUTHORING_FIELD_CONTRACT_VERSION,
    abilityId: candidate.abilityId as PrimaryAbilityId,
    specificTrainingPoint: (candidate.specificTrainingPoint as string).trim(),
    questionStem: (candidate.questionStem as string).trim(),
    studentTask: (candidate.studentTask as string).trim(),
    observationTarget: (candidate.observationTarget as string).trim(),
  };
  return {
    valid: true,
    output,
    errors: [],
    warnings: assessAuthoringFieldResponsibilities({
      abilityTarget: output.abilityId,
      specificTrainingPoint: output.specificTrainingPoint,
      questionStem: output.questionStem,
      studentTask: output.studentTask,
      observationTarget: output.observationTarget,
    }),
  };
}

export function validateAuthorizedAuthoringFieldChanges(
  before: AuthoringFieldValues,
  after: AuthoringFieldValues,
  authorizedFields: AuthoringFieldKey[],
): string[] {
  const authorized = new Set(authorizedFields);
  return (Object.keys(AUTHORING_FIELD_CONTRACTS) as AuthoringFieldKey[])
    .filter((field) => before[field] !== after[field] && !authorized.has(field))
    .map((field) => `${AUTHORING_FIELD_CONTRACTS[field].label}不在本次 AI 修改授权范围内。`);
}

export function alignQuestionDraftInputWithPlan<
  T extends Pick<StructuredQuestionDraft, 'abilityMetadata' | 'rubric'>
>(
  draft: T,
  task: ObservationTaskPlan,
): T {
  const expected = getPlanControlledQuestionSettings(task);
  const previousAbilityId = draft.abilityMetadata.abilityId;
  return {
    ...draft,
    abilityMetadata: {
      ...draft.abilityMetadata,
      ...expected,
    },
    rubric: draft.rubric.map((item) => (
      item.abilityId === previousAbilityId
        ? { ...item, abilityId: expected.abilityId }
        : item
    )),
  };
}

export function getQualityChecksForUiField(uiField: string): QuestionQualityCheck[] {
  return AUTHORING_QUALITY_CHECKS_BY_UI_FIELD[uiField] || [];
}

export function getAuthoringValidationPath(field: AuthoringFieldKey): string {
  return AUTHORING_FIELD_CONTRACTS[field].validationPath;
}

export function getPlanControlledValidationPath(field: PlanControlledFieldKey): string {
  return PLAN_CONTROLLED_FIELD_CONTRACTS[field].validationPath;
}

export function getQualityCheckEditLocation(check: QuestionQualityCheck): string {
  return QUALITY_CHECK_EDIT_LOCATION[check];
}

export function getQualityIssueEditorTargetIds(
  check: QuestionQualityCheck,
  options: {
    planReviewMode: boolean;
    rubricTargetId?: string | null;
  },
): string[] {
  if (check === 'difficultyCoherence') {
    return options.planReviewMode
      ? ['question-training-targets', 'question-stem-editor']
      : ['question-difficulty-editor', 'question-stem-editor'];
  }

  const primaryField = QUALITY_CHECK_PRIMARY_FIELD[check];
  if (primaryField === 'rubric') {
    return [
      options.rubricTargetId,
      'question-rubric-editor',
    ].filter((value): value is string => Boolean(value));
  }
  return AUTHORING_FIELD_CONTRACTS[primaryField].editorTargetIds;
}

function readTagValue(tags: string[] | undefined, prefix: string): string | null {
  return tags?.find((tag) => tag.startsWith(prefix))?.slice(prefix.length) || null;
}

function planSource(sourcePath: string): AuthoringFieldProvenance {
  return {
    source: 'plan',
    sourcePath,
    needsHumanReview: false,
  };
}

function unavailableSource(): AuthoringFieldProvenance {
  return {
    source: 'unavailable',
    sourcePath: null,
    needsHumanReview: true,
  };
}

function isHighResponsibilityOverlap(value: string, otherValue: string): boolean {
  const normalized = normalizeResponsibilityText(value);
  const normalizedOther = normalizeResponsibilityText(otherValue);
  if (normalized.length < 6 || normalizedOther.length < 6) return false;
  if (normalized === normalizedOther) return true;
  const shorter = normalized.length <= normalizedOther.length ? normalized : normalizedOther;
  const longer = normalized.length > normalizedOther.length ? normalized : normalizedOther;
  if (longer.includes(shorter) && shorter.length / longer.length >= 0.72) return true;
  return ngramJaccard(normalized, normalizedOther, 2) >= 0.78;
}

function normalizeResponsibilityText(value: string): string {
  return value
    .toLowerCase()
    .replace(/[，。！？；：、,.!?;:\s"'“”‘’（）()《》【】[\]]/g, '');
}

function ngramJaccard(value: string, otherValue: string, size: number): number {
  const left = createNgrams(value, size);
  const right = createNgrams(otherValue, size);
  const union = new Set([...left, ...right]);
  if (!union.size) return 0;
  let intersection = 0;
  left.forEach((item) => {
    if (right.has(item)) intersection += 1;
  });
  return intersection / union.size;
}

function createNgrams(value: string, size: number): Set<string> {
  const result = new Set<string>();
  for (let index = 0; index <= value.length - size; index += 1) {
    result.add(value.slice(index, index + size));
  }
  return result;
}

function satisfiesFieldResponsibility(
  field: AuthoringContentFieldKey,
  value: string,
): boolean {
  if (field === 'specificTrainingPoint') {
    return value.length <= 40 && !/^(概括|分析|理解|推理|表达|提取)$/.test(value);
  }
  if (field === 'questionStem') {
    return /[？?]$/.test(value) || /^(请|结合|根据|阅读|从文中|分析|概括|说明|找出|比较)/.test(value);
  }
  if (field === 'studentTask') {
    return /(提取|比较|概括|分析|组织|说明|列出|判断|归纳|解释|表达)/.test(value);
  }
  return /(是否|能否|完整|准确|合理|清晰|覆盖|区分|判断|表现|依据)/.test(value);
}

function buildResponsibilitySuggestion(
  field: AuthoringContentFieldKey,
  otherField: AuthoringContentFieldKey,
): string {
  const suggestions: Record<AuthoringContentFieldKey, string> = {
    specificTrainingPoint: '具体训练点只描述当前题在能力目标下的具体落点。',
    questionStem: '题目只保留学生实际看到的问题，不展开完整评分要求。',
    studentTask: '学生任务说明要执行的动作、对象和输出方式。',
    observationTarget: '观察目标改写为可判断的表现，例如完整性、准确性或材料依据。',
  };
  return `${suggestions[field]}${suggestions[otherField]}`;
}
