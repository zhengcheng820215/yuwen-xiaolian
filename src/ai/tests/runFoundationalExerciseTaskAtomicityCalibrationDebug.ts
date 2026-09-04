import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import {
  assessReadingOpenResponseLoadGate,
} from '../agents/readingOpenResponseLoadQualityGate.ts';
import {
  buildMaterialObservationDraftPlanningPrompt,
  buildMaterialObservationDraftPrompt,
} from '../prompts/materialObservationDraftPrompt.ts';
import {
  READING_OPEN_RESPONSE_CANDIDATE_PROMPT_VERSION,
  READING_OPEN_RESPONSE_LOAD_PLANNER_VERSION,
  type TextResponseCandidateGenerationTrace,
} from '../schemas/readingOpenResponseGenerationPlanning.schema.ts';
import type { QuestionEditableFields } from
  '../schemas/workingTaskContent.schema.ts';

type DebugCase = { id: string; name: string; run: () => void };

const ROOT = '/Users/chengzheng/Desktop/web/yuwen-xiaolian/System';
const STORE = `${ROOT}/.local-data/formal-resource-store.json`;
const CONTRACT = `${ROOT}/docs/product/FOUNDATIONAL_EXERCISE_TASK_ATOMICITY_CALIBRATION_CONTRACT.md`;
const storeHashBefore = fileHash(STORE);

const cases: DebugCase[] = [
  test('FA-01', '基础题只包含一个主要动作时通过', () => {
    const result = gate(fixture(), 'fa-01');
    assert.notEqual(result.decision, 'blocked');
  }),
  test('FA-02', '同一证据上的找出与直接说明可作为依赖支撑动作通过', () => {
    const content = fixture({
      questionStem: '找出第2段表现春风特点的句子，并说明它表现了什么。',
      rubric: [rubric('证据与含义', '找出句子并直接说明其表现的特点')],
      minimumAnswerRequirement: {
        minLength: 10,
        requireTextEvidence: true,
        requireExplanation: true,
      },
    });
    const result = gate(content, 'fa-02');
    assert.notEqual(result.decision, 'blocked');
    assert.equal(result.recomputedLoadProfile.loadLevel, 'focused_short');
    assert.equal(result.recomputedLoadProfile.requiredEvidenceUnitCount, 1);
    assert.equal(result.recomputedLoadProfile.requiredRelationCount, 1);
  }),
  test('FA-03', '低负担计划被实现为两个独立责任时以专用原因阻断', () => {
    const content = compoundFixture();
    const trace = traceFor(content, 'fa-03');
    trace.planningIntent.targetLoadLevel = 'focused_short';
    const result = gate(content, 'fa-03', trace, true);
    assert(result.blockerCodes.includes('low_load_atomicity_violation'));
    assert.equal(result.blockerCodes.includes('load_identity_mismatch'), false);
  }),
  test('FA-04', '合法 developing 任务不被低负担原子性规则误伤', () => {
    const content = compoundFixture();
    const result = gate(content, 'fa-04', traceFor(content, 'fa-04'), true);
    assert.equal(result.blockerCodes.includes('low_load_atomicity_violation'), false);
  }),
  test('FA-05', '题干未要求的 Required Rubric 继续由隐藏要求门禁阻断', () => {
    const content = fixture({
      questionStem: '第2段中哪一句写出了春风的特点？',
      rubric: [
        rubric('信息定位', '找出原句'),
        rubric('表达效果', '分析修辞表达效果'),
      ],
    });
    assert(gate(content, 'fa-05').blockerCodes.includes('required_rubric_not_in_stem'));
  }),
  test('FA-06', 'Pass A 与 Pass B Prompt 均冻结低负担原子性边界', () => {
    const input = generatorInput();
    const planningPrompt = buildMaterialObservationDraftPlanningPrompt(input);
    const realizationPrompt = buildMaterialObservationDraftPrompt(input);
    for (const prompt of [planningPrompt, realizationPrompt]) {
      assert(prompt.includes('一个主要'));
      assert(/共享(?:同一)?对象(?:和|与)证据/u.test(prompt));
      assert(prompt.includes('连续动作链') || prompt.includes('串联多个可独立评分'));
    }
    assert(planningPrompt.includes('不得伪装成入口题'));
  }),
  test('FA-07', '契约明确排除字词默写等外部练习范围', () => {
    const contract = readFileSync(CONTRACT, 'utf8');
    assert(contract.includes('拼音、字形、词语听写'));
    assert(contract.includes('背诵、默写'));
    assert(contract.includes('文学常识填空'));
    assert(contract.includes('不直接复制外部样本措辞'));
  }),
  test('FA-08', '专项验收对 Formal Store 零写入', () => {
    assert.equal(fileHash(STORE), storeHashBefore);
  }),
];

let passed = 0;
console.log('\nFoundational Exercise Task Atomicity Calibration Debug');
console.log('='.repeat(78));
for (const item of cases) {
  try {
    item.run();
    passed += 1;
    console.log(`PASS | ${item.id} ${item.name}`);
  } catch (error) {
    console.log(`FAIL | ${item.id} ${item.name}`);
    console.error(error);
  }
}
console.log('-'.repeat(78));
console.log(`Result: ${passed} / ${cases.length} PASS`);
console.log(`Formal Store SHA-256: ${storeHashBefore}`);
if (passed !== cases.length) process.exitCode = 1;

function test(id: string, name: string, run: () => void): DebugCase {
  return { id, name, run };
}

function gate(
  content: QuestionEditableFields,
  taskId: string,
  generationTrace?: TextResponseCandidateGenerationTrace,
  requireGenerationTrace = false,
) {
  const result = assessReadingOpenResponseLoadGate({
    subject: { kind: 'candidate', subjectId: `${taskId}:candidate` },
    trainingTaskId: taskId,
    content,
    generationTrace,
    requireGenerationTrace,
    assessedAt: '2026-09-04T00:00:00.000Z',
  });
  assert(result);
  return result;
}

function traceFor(
  content: QuestionEditableFields,
  taskId: string,
): TextResponseCandidateGenerationTrace {
  const profile = gate(content, taskId).recomputedLoadProfile;
  return {
    planningIntent: {
      policyVersion: profile.policyVersion,
      plannerVersion: READING_OPEN_RESPONSE_LOAD_PLANNER_VERSION,
      sourceIdentity: {
        materialVersionId: content.materialVersionId,
        trainingTaskId: taskId,
        taskRole: 'training',
      },
      primaryAction: profile.primaryAction,
      ...(profile.supportingAction
        ? { supportingAction: profile.supportingAction }
        : {}),
      responseObject: '第2段中的景物变化',
      evidenceScope: {
        sourceAnchorIds: ['paragraph:2-2'],
        requiredEvidenceUnitCount: profile.requiredEvidenceUnitCount,
      },
      requiredRelationCount: profile.requiredRelationCount,
      requiredObjectCount: profile.requiredObjectCount,
      targetLoadLevel: profile.loadLevel,
      preferredResponseFormat: content.responseFormat as 'short_text' | 'long_text',
      expectedAnswerLengthBand: profile.expectedAnswerLengthBand,
      sequenceContext: {
        position: 1,
        singleChoiceFoundationSatisfied: true,
        sequencePreference: 'foundation_first',
      },
      preserveHigherOrderTextObservation: profile.loadLevel === 'integrated',
      rationaleCodes: ['single_primary_action', 'bounded_evidence_scope'],
    },
    promptVersion: READING_OPEN_RESPONSE_CANDIDATE_PROMPT_VERSION,
    promptInputFingerprint: 'fa-debug-prompt-fingerprint',
    initialProfile: profile,
    initialFindingCodes: [],
    repairAttemptCount: 0,
    repairReasonCodes: [],
    finalProfile: profile,
    outcome: 'candidate_created',
  };
}

function fixture(
  overrides: Partial<QuestionEditableFields> = {},
): QuestionEditableFields {
  return {
    materialVersionId: 'material-fa:v1',
    title: '春风特点定位',
    questionStem: '第2段中，哪一句写出了春风的特点？',
    questionType: 'open_short_answer',
    responseFormat: 'short_text',
    options: [],
    assessmentMode: 'key_points',
    answerAcceptance: {
      acceptedKeywords: ['春风'],
      semanticEquivalentAllowed: true,
      normalizationRules: ['trim'],
    },
    rubric: [rubric('信息定位', '定位写出春风特点的句子')],
    minimumAnswerRequirement: {
      minLength: 10,
      requireTextEvidence: false,
      requireExplanation: false,
    },
    abilityMetadata: {
      abilityId: 'extraction',
      supportingAbilityIds: [],
      prerequisiteAbilityIds: [],
      taskRole: 'training',
      difficulty: 'basic',
    },
    source: { sourceType: 'ai_assisted', description: 'FA debug fixture' },
    tags: ['paragraph:2-2', 'observation_task:fa'],
    ...overrides,
  };
}

function compoundFixture(): QuestionEditableFields {
  return fixture({
    questionStem: '概括第2段的景物变化，并分析这些变化如何表现春天的特点。',
    rubric: [
      rubric('内容概括', '概括第2段的景物变化'),
      rubric('特点分析', '分析变化如何表现春天的特点'),
    ],
  });
}

function rubric(name: string, description: string) {
  return {
    itemId: `rubric:${name}`,
    name,
    description,
    abilityId: 'extraction' as const,
    importance: 'critical' as const,
    required: true,
    acceptedSignals: [name],
  };
}

function generatorInput() {
  return {
    requestId: 'fa-prompt-debug',
    material: {
      materialVersionId: 'material-fa:v1',
      title: '《春》',
      content: '盼望着，东风来了。\n\n山朗润起来了，水涨起来了。',
    },
    preferences: {
      candidateCount: 2,
      planningIntent: 'initial' as const,
      preferredAbilityIds: ['extraction', 'comprehension'] as const,
    },
  };
}

function fileHash(path: string): string {
  return createHash('sha256').update(readFileSync(path)).digest('hex');
}
