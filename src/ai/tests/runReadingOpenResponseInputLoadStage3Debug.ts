import assert from 'node:assert/strict';
import {
  assessReadingOpenResponseLoadGate,
  stableHash,
} from '../agents/readingOpenResponseLoadQualityGate.ts';
import { assessReadingTaskGroupLoadGate } from
  '../agents/readingTaskGroupLoadQualityGate.ts';
import {
  isCandidateLoadGateAdoptable,
  resolveReadingOpenResponsePublicationReadiness,
} from '../agents/readingOpenResponsePublicationReadiness.ts';
import {
  createQuestionCandidate,
  resolveTaskCandidateState,
  type QuestionCandidate,
} from '../schemas/questionCandidate.schema.ts';
import {
  READING_OPEN_RESPONSE_LOAD_GATED_CANDIDATE_RULE_VERSION,
  isReadingOpenResponseLoadGateAssessment,
  isReadingTaskGroupLoadGateAssessment,
  type ReadingOpenResponseLoadGateAssessment,
} from '../schemas/readingOpenResponseLoadGate.schema.ts';
import {
  READING_OPEN_RESPONSE_CANDIDATE_PROMPT_VERSION,
  READING_OPEN_RESPONSE_LOAD_PLANNER_VERSION,
  type TextResponseCandidateGenerationTrace,
} from '../schemas/readingOpenResponseGenerationPlanning.schema.ts';
import type { TextResponseLoadLevel } from
  '../schemas/readingOpenResponseInputLoad.schema.ts';
import type { QuestionEditableFields } from
  '../schemas/workingTaskContent.schema.ts';

type DebugCase = { id: string; name: string; run: () => void };

const passContent = fixture();
const passTrace = traceFor(passContent, 'task-1');
const passAssessment = gate(passContent, 'task-1', passTrace, true);
const groupPass = group([
  choiceItem('choice-1', 0),
  textItem('task-1', 1, passAssessment),
]);
const gatedCandidate = candidate(passContent, passTrace, passAssessment);

const cases: DebugCase[] = [
  test('P3-01', '完整单题 Assessment 通过 guard', () => {
    assert.equal(isReadingOpenResponseLoadGateAssessment(passAssessment), true);
  }),
  test('P3-02', '缺少内容指纹的 Assessment 被 guard 拒绝', () => {
    assert.equal(isReadingOpenResponseLoadGateAssessment({
      ...passAssessment,
      subject: { ...passAssessment.subject, contentHash: '' },
    }), false);
  }),
  test('P3-03', '新 Candidate 缺少阶段 2 追踪时阻断', () => {
    assert(gate(passContent, 'task-1', undefined, true).blockerCodes.includes(
      'planning_trace_missing_or_stale',
    ));
  }),
  test('P3-04', '非追溯对象缺少追踪仍可审计', () => {
    assert.notEqual(gate(passContent, 'task-1', undefined, false).decision, 'blocked');
  }),
  test('P3-05', '三个核心动作阻断', () => {
    assert(gate(fixture({
      questionStem: '概括故事内容，分析人物形象，并说明文章主题。',
      responseFormat: 'long_text',
      rubric: [rubric('内容概括', '概括故事内容'), rubric('人物形象', '分析人物形象'), rubric('文章主题', '说明文章主题')],
    }), 'task-5', undefined, false).blockerCodes.includes('composite_core_actions'));
  }),
  test('P3-06', '题干未要求的 Required Rubric 阻断', () => {
    assert(gate(fixture({
      questionStem: '第2段中哪一句写出了春风的特点？',
      rubric: [rubric('信息定位', '找出原句'), rubric('表达效果', '分析修辞表达效果')],
    }), 'task-6', undefined, false).blockerCodes.includes('required_rubric_not_in_stem'));
  }),
  test('P3-07', '证据范围不足阻断', () => {
    const result = gate(fixture({
      questionStem: '请结合全文，找出三处证据并分析主题。',
      responseFormat: 'long_text',
    }), 'task-7', undefined, false, 30);
    assert(result.blockerCodes.includes('material_evidence_insufficient'));
  }),
  test('P3-08', '短文本承载综合负担阻断', () => {
    assert(gate(fixture({
      questionStem: '请结合全文比较两个人物并说明两组因果关系。',
    }), 'task-8', undefined, false).blockerCodes.includes('response_format_load_mismatch'));
  }),
  test('P3-09', '最低要求过重阻断', () => {
    assert(gate(fixture({
      minimumAnswerRequirement: { minLength: 180, requireTextEvidence: false, requireExplanation: false },
    }), 'task-9', undefined, false).blockerCodes.includes('minimum_requirement_overweighted'));
  }),
  test('P3-10', '提示新增隐藏任务阻断', () => {
    assert(gate(fixture({ tags: [
      'paragraph:2-2', 'observation_task:task-10', 'pre_answer_hint:先比较两处描写',
    ] }), 'task-10', undefined, false).blockerCodes.includes('hint_creates_hidden_task'));
  }),
  test('P3-11', '长度边界形成 advisory', () => {
    const base = gate(passContent, 'task-11', undefined, false);
    const content = fixture({ minimumAnswerRequirement: {
      minLength: base.recomputedLoadProfile.expectedAnswerLengthBand.recommendedMin,
      requireTextEvidence: false,
      requireExplanation: false,
    } });
    assert(gate(content, 'task-11', undefined, false).advisoryCodes.includes('length_band_boundary'));
  }),
  test('P3-12', '负担画像不写入学生题面字段', () => {
    assert.equal(JSON.stringify(passContent).includes('recommendedMin'), false);
    assert.equal(JSON.stringify(passContent).includes('loadLevel'), false);
  }),
  test('P3-13', '单选到 focused 文本通过', () => assert.notEqual(groupPass.decision, 'blocked')),
  test('P3-14', 'entry 到 developing 可跨过 focused', () => {
    assert.notEqual(groupFromLevels(['entry_short', 'developing']).decision, 'blocked');
  }),
  test('P3-15', '题组无需覆盖全部四级', () => {
    assert.notEqual(groupFromLevels(['focused_short', 'developing']).decision, 'blocked');
  }),
  test('P3-16', '无入口且首题 integrated 阻断', () => {
    assert(groupFromLevels(['integrated']).blockerCodes.includes('missing_accessible_entry'));
  }),
  test('P3-17', '单选到 integrated 无例外阻断', () => {
    assert(groupFromLevels(['single_choice', 'integrated']).blockerCodes.includes(
      'unexplained_entry_to_integrated_jump',
    ));
  }),
  test('P3-18', 'focused 到 integrated 仅 advisory', () => {
    const result = groupFromLevels(['focused_short', 'integrated']);
    assert.equal(result.decision, 'pass_with_advisory');
  }),
  test('P3-19', 'developing 到 integrated 通过', () => {
    assert.notEqual(groupFromLevels(['developing', 'integrated']).decision, 'blocked');
  }),
  test('P3-20', '整体判断例外放行高阶起始', () => {
    assert.notEqual(groupFromLevels(['integrated'], {
      sequenceStrategy: 'holistic_first', reason: 'holistic_judgment_required',
    }).decision, 'blocked');
  }),
  test('P3-21', '独立表达例外放行高阶起始', () => {
    assert.notEqual(groupFromLevels(['integrated'], {
      sequenceStrategy: 'holistic_first', reason: 'independent_expression_baseline',
    }).decision, 'blocked');
  }),
  test('P3-22', 'Retest role-driven 顺序通过', () => {
    assert.notEqual(groupFromLevels(['integrated'], {
      sequenceStrategy: 'role_driven', reason: 'retest_after_training', taskRole: 'retest',
    }).decision, 'blocked');
  }),
  test('P3-23', '无单选但 focused 文本入口通过', () => {
    assert.notEqual(groupFromLevels(['focused_short']).decision, 'blocked');
  }),
  test('P3-24', '跨题型重复观察价值阻断', () => {
    const result = group([
      { ...choiceItem('c', 0), observationObject: '人物心理', sourceAnchorIds: ['p2'], scoringTargetIds: ['reason'] },
      { ...textItem('t', 1, fakeAssessment('focused_short', 't')), observationObject: '人物心理', sourceAnchorIds: ['p2'], scoringTargetIds: ['reason'] },
    ]);
    assert(result.blockerCodes.includes('duplicate_observation_value'));
  }),
  test('P3-25', '缺失高阶观察阻断', () => {
    assert(group([textItem('t', 0, fakeAssessment('focused_short', 't'))], {
      requiredHigherOrderObservationIds: ['higher-1'],
    }).blockerCodes.includes('required_higher_order_observation_missing'));
  }),
  test('P3-26', 'targeted excerpt 单题不因梯度阻断', () => {
    assert.notEqual(group([textItem('t', 0, fakeAssessment('integrated', 't'))], {
      targetedExcerpt: true,
    }).decision, 'blocked');
  }),
  test('P3-27', '相同输入 group fingerprint 稳定', () => {
    assert.equal(groupPass.groupSnapshotHash, group([
      choiceItem('choice-1', 0), textItem('task-1', 1, passAssessment),
    ]).groupSnapshotHash);
  }),
  test('P3-28', '题组顺序变化使预期快照失配', () => {
    const result = group([textItem('t2', 0, passAssessment), choiceItem('c2', 1)], {
      expectedOrderedTrainingTaskIds: ['c2', 't2'],
    });
    assert(result.blockerCodes.includes('sequence_identity_mismatch'));
  }),
  test('P3-29', '内容变化后 Candidate Assessment 不再可采用', () => {
    const changed = { ...gatedCandidate, content: fixture({ questionStem: '换了题干。' }) };
    assert.equal(isCandidateLoadGateAdoptable(changed), false);
  }),
  test('P3-30', 'Candidate 与未变 Draft 结论一致', () => {
    const draft = gate(passContent, 'task-1', passTrace, true, undefined, 'draft_revision');
    assert.equal(draft.decision, passAssessment.decision);
    assert.deepEqual(draft.blockerCodes, passAssessment.blockerCodes);
  }),
  test('P3-31', '同指纹发布就绪不二次阻断', () => {
    assert.equal(resolveReadingOpenResponsePublicationReadiness({
      candidate: gatedCandidate, groupAssessment: groupPass,
    }).canPublish, true);
  }),
  test('P3-32', 'blocker 使 canPublish=false', () => {
    const blockedGroup = groupFromLevels(['integrated']);
    assert.equal(resolveReadingOpenResponsePublicationReadiness({
      candidate: gatedCandidate, groupAssessment: blockedGroup,
    }).canPublish, false);
  }),
  test('P3-33', '只有 advisory 仍可发布', () => {
    const advisoryGroup = groupFromLevels(['focused_short', 'integrated']);
    assert.equal(resolveReadingOpenResponsePublicationReadiness({
      candidate: gatedCandidate, groupAssessment: advisoryGroup,
    }).canPublish, true);
  }),
  test('P3-34', 'readiness 不含人工确认字段', () => {
    const readiness = resolveReadingOpenResponsePublicationReadiness({ candidate: gatedCandidate, groupAssessment: groupPass });
    assert.equal('acceptedWarningCodes' in readiness, false);
    assert.equal('manualOverride' in readiness, false);
  }),
  test('P3-35', '重复发布检查保持相同派生结果', () => {
    assert.deepEqual(
      resolveReadingOpenResponsePublicationReadiness({ candidate: gatedCandidate, groupAssessment: groupPass }),
      resolveReadingOpenResponsePublicationReadiness({ candidate: gatedCandidate, groupAssessment: groupPass }),
    );
  }),
  test('P3-36', '专项审计不修改题目内容', () => {
    const before = structuredClone(passContent);
    gate(passContent, 'task-1', passTrace, true);
    assert.deepEqual(passContent, before);
  }),
  test('P3-37', 'advisory 不产生需要确认字段', () => {
    assert.equal(JSON.stringify(groupFromLevels(['focused_short', 'integrated'])).includes('confirm'), false);
  }),
  test('P3-38', 'blocked Candidate 不进入 ready 列表', () => {
    const blocked = { ...gatedCandidate, loadGateAssessment: {
      ...passAssessment, decision: 'blocked' as const, blockerCodes: ['load_identity_mismatch' as const],
    } };
    assert.equal(resolveTaskCandidateState({ candidates: [blocked], context: runtimeContext() }).readyCandidateIds.length, 0);
  }),
  test('P3-39', '阻断原因随 Candidate 保留供卡片附近投影', () => {
    const blocked = gate(passContent, 'task-1', undefined, true);
    assert(blocked.evidencePaths.includes('generationTrace'));
  }),
  test('P3-40', '发布就绪是布尔主操作投影', () => {
    const readiness = resolveReadingOpenResponsePublicationReadiness({ candidate: gatedCandidate, groupAssessment: groupPass });
    assert.equal(typeof readiness.canPublish, 'boolean');
  }),
  test('P3-41', '已采用 Candidate 不再投射为 ready', () => {
    assert.equal(resolveTaskCandidateState({
      candidates: [{ ...gatedCandidate, status: 'adopted' }], context: runtimeContext(),
    }).readyCandidateIds.length, 0);
  }),
  test('P3-42', '单选不伪造文本负担 Assessment', () => {
    assert.equal(assessReadingOpenResponseLoadGate({
      subject: { kind: 'candidate', subjectId: 'choice' }, trainingTaskId: 'choice', content: choiceContent(),
    }), null);
    assert.equal(isCandidateLoadGateAdoptable({
      ...gatedCandidate,
      content: choiceContent(),
      loadGateAssessment: undefined,
      groupLoadGateAssessment: groupFromLevels(['integrated']),
    }), false);
  }),
  test('P3-43', 'Question Candidate 保存负担轨迹与 Assessment', () => {
    assert.equal(gatedCandidate.textResponseLoadPlanning?.trace.promptVersion, READING_OPEN_RESPONSE_CANDIDATE_PROMPT_VERSION);
    assert.equal(gatedCandidate.loadGateAssessment?.assessmentId, passAssessment.assessmentId);
  }),
  test('P3-44', 'targeted micro-training 保持单题例外', () => {
    assert.notEqual(group([textItem('micro', 0, fakeAssessment('integrated', 'micro'))], { targetedExcerpt: true }).decision, 'blocked');
  }),
  test('P3-45', '最终展示顺序由 sequenceRank 决定', () => {
    const result = group([textItem('later', 2, passAssessment), choiceItem('first', 1)]);
    assert.equal(result.orderedSubjectIdentities[0]?.trainingTaskId, 'first');
  }),
  test('P3-46', '阶段 1/2 版本身份保留', () => {
    assert.equal(passAssessment.generationPlanningVersion, READING_OPEN_RESPONSE_LOAD_PLANNER_VERSION);
    assert(passAssessment.inputLoadRuleVersion.includes('reading_open_response_input_load'));
  }),
  test('P3-47', '题组 Assessment 通过 guard', () => {
    assert.equal(isReadingTaskGroupLoadGateAssessment(groupPass), true);
  }),
  test('P3-48', '规则、内容和题组指纹可审计', () => {
    assert(passAssessment.gateRuleVersion);
    assert(groupPass.groupSnapshotHash.startsWith('fnv1a-'));
    assert.equal(stableHash({ b: 2, a: 1 }), stableHash({ a: 1, b: 2 }));
  }),
];

let passed = 0;
for (const item of cases) {
  try {
    item.run();
    passed += 1;
    console.log(`PASS ${item.id} ${item.name}`);
  } catch (error) {
    console.error(`FAIL ${item.id} ${item.name}`);
    throw error;
  }
}
console.log(`\nReading open-response load Stage 3: ${passed}/${cases.length} passed.`);

function test(id: string, name: string, run: () => void): DebugCase {
  return { id, name, run };
}

function gate(
  content: QuestionEditableFields,
  taskId: string,
  trace?: TextResponseCandidateGenerationTrace,
  requireTrace = false,
  evidenceChars?: number,
  kind: 'candidate' | 'draft_revision' = 'candidate',
): ReadingOpenResponseLoadGateAssessment {
  const result = assessReadingOpenResponseLoadGate({
    subject: { kind, subjectId: kind === 'candidate' ? `${taskId}:candidate` : `${taskId}:draft`, revision: kind === 'draft_revision' ? 1 : undefined },
    trainingTaskId: taskId,
    content,
    generationTrace: trace,
    requireGenerationTrace: requireTrace,
    sourceEvidenceCharacterCount: evidenceChars,
    assessedAt: '2026-08-21T00:00:00.000Z',
  });
  assert(result);
  return result;
}

function traceFor(content: QuestionEditableFields, taskId: string): TextResponseCandidateGenerationTrace {
  const assessment = gate(content, taskId, undefined, false);
  const profile = assessment.recomputedLoadProfile;
  return {
    planningIntent: {
      policyVersion: profile.policyVersion,
      plannerVersion: READING_OPEN_RESPONSE_LOAD_PLANNER_VERSION,
      sourceIdentity: { materialVersionId: content.materialVersionId, trainingTaskId: taskId, taskRole: 'training' },
      primaryAction: profile.primaryAction,
      ...(profile.supportingAction ? { supportingAction: profile.supportingAction } : {}),
      responseObject: '第2段中的春风特点',
      evidenceScope: { sourceAnchorIds: ['paragraph:2-2'], requiredEvidenceUnitCount: profile.requiredEvidenceUnitCount },
      requiredRelationCount: profile.requiredRelationCount,
      requiredObjectCount: profile.requiredObjectCount,
      targetLoadLevel: profile.loadLevel,
      preferredResponseFormat: content.responseFormat as 'short_text' | 'long_text',
      expectedAnswerLengthBand: profile.expectedAnswerLengthBand,
      sequenceContext: { position: 1, singleChoiceFoundationSatisfied: true, sequencePreference: 'foundation_first' },
      preserveHigherOrderTextObservation: profile.loadLevel === 'integrated',
      rationaleCodes: ['single_primary_action', 'bounded_evidence_scope'],
    },
    promptVersion: READING_OPEN_RESPONSE_CANDIDATE_PROMPT_VERSION,
    promptInputFingerprint: 'prompt-fingerprint',
    initialProfile: profile,
    initialFindingCodes: [],
    repairAttemptCount: 0,
    repairReasonCodes: [],
    finalProfile: profile,
    outcome: 'candidate_created',
  };
}

function fixture(overrides: Partial<QuestionEditableFields> = {}): QuestionEditableFields {
  return {
    materialVersionId: 'material:v1',
    title: '春风特点定位',
    questionStem: '第2段中，哪一句写出了春风的特点？',
    questionType: 'open_short_answer',
    responseFormat: 'short_text',
    options: [],
    assessmentMode: 'key_points',
    answerAcceptance: { acceptedKeywords: ['春风'], semanticEquivalentAllowed: true, normalizationRules: ['trim'] },
    rubric: [rubric('信息定位', '定位写出春风特点的句子')],
    minimumAnswerRequirement: { minLength: 10, requireTextEvidence: false, requireExplanation: false },
    abilityMetadata: { abilityId: 'extraction', supportingAbilityIds: [], prerequisiteAbilityIds: [], taskRole: 'training', difficulty: 'basic' },
    source: { sourceType: 'ai_assisted', description: 'stage3 fixture' },
    tags: ['paragraph:2-2', 'observation_task:task-1'],
    ...overrides,
  };
}

function rubric(name: string, description: string) {
  return { itemId: `rubric:${name}`, name, description, abilityId: 'extraction' as const, importance: 'critical' as const, required: true, acceptedSignals: [name] };
}

function choiceContent(): QuestionEditableFields {
  return {
    ...fixture(),
    questionType: 'multiple_choice', responseFormat: 'single_choice', assessmentMode: 'exact_match',
    choiceInteraction: { schemaVersion: 'single-choice-interaction-v1', selectionMode: 'single', options: [
      { optionId: 'o1', label: 'A', text: '春风吹来' }, { optionId: 'o2', label: 'B', text: '大雨落下' },
    ], correctOptionIds: ['o1'], distractorRationales: [{ optionId: 'o2', rationale: '混淆天气' }] },
    answerAcceptance: { acceptedOptionIds: ['o1'], semanticEquivalentAllowed: false, normalizationRules: [] },
    minimumAnswerRequirement: { responseFormat: 'single_choice', minSelections: 1, maxSelections: 1 },
    rubric: [{ ...rubric('正确选择', '选出符合材料的选项'), evidenceRequirement: {} }],
  };
}

function candidate(
  content: QuestionEditableFields,
  trace: TextResponseCandidateGenerationTrace,
  assessment: ReadingOpenResponseLoadGateAssessment,
): QuestionCandidate {
  return createQuestionCandidate({
    candidateId: 'task-1:candidate', generationCommandId: 'command-1', generationCommandFingerprint: 'fp-1',
    trainingTaskId: 'task-1', candidateType: 'initial', content,
    generationReason: 'stage3', changedFields: [], allowedFields: [], lockedFields: [],
    generationContext: { modelId: 'fixture', promptVersion: trace.promptVersion, promptHash: 'prompt-hash', ruleVersion: READING_OPEN_RESPONSE_LOAD_GATED_CANDIDATE_RULE_VERSION, materialVersionId: content.materialVersionId, observationPlanVersion: 1, trainingTaskVersion: 1, generatedAt: '2026-08-21T00:00:00.000Z' },
    textResponseLoadPlanning: { intent: trace.planningIntent, trace }, loadGateAssessment: assessment,
    groupLoadGateAssessment: groupPass,
    status: 'ready', createdAt: '2026-08-21T00:00:00.000Z',
  });
}

function fakeAssessment(level: TextResponseLoadLevel, subjectId: string): ReadingOpenResponseLoadGateAssessment {
  return {
    ...passAssessment,
    assessmentId: `assessment:${subjectId}`,
    subject: { ...passAssessment.subject, subjectId, contentHash: `hash:${subjectId}` },
    trainingTaskId: subjectId,
    recomputedLoadProfile: { ...passAssessment.recomputedLoadProfile, loadLevel: level },
  };
}

function choiceItem(id: string, sequenceRank: number) {
  return { trainingTaskId: id, subjectId: id, responseFormat: 'single_choice' as const, taskRole: 'training' as const, sequenceRank, sourceAnchorIds: ['p1'] };
}

function textItem(id: string, sequenceRank: number, assessment: ReadingOpenResponseLoadGateAssessment) {
  return { trainingTaskId: id, subjectId: id, responseFormat: 'short_text' as const, taskRole: 'training' as const, sequenceRank, sourceAnchorIds: ['p2'], singleGateAssessment: { ...assessment, subject: { ...assessment.subject, subjectId: id }, trainingTaskId: id } };
}

function group(items: ReturnType<typeof choiceItem | typeof textItem>[], overrides: Record<string, unknown> = {}) {
  return assessReadingTaskGroupLoadGate({
    materialVersionId: 'material:v1', observationPlanRevisionId: 'plan:1', items,
    sequenceStrategy: 'entry_first', sequenceReasonCode: 'default_foundation_entry',
    assessedAt: '2026-08-21T00:00:00.000Z', ...overrides,
  } as Parameters<typeof assessReadingTaskGroupLoadGate>[0]);
}

function groupFromLevels(levels: Array<TextResponseLoadLevel | 'single_choice'>, options: { sequenceStrategy?: 'entry_first' | 'holistic_first' | 'role_driven'; reason?: 'default_foundation_entry' | 'holistic_judgment_required' | 'independent_expression_baseline' | 'retest_after_training' | 'transfer_in_new_context'; taskRole?: 'training' | 'retest' | 'transfer' } = {}) {
  const items = levels.map((level, index) => level === 'single_choice'
    ? choiceItem(`task-${index}`, index)
    : { ...textItem(`task-${index}`, index, fakeAssessment(level, `task-${index}`)), taskRole: options.taskRole || 'training' });
  return group(items, { sequenceStrategy: options.sequenceStrategy || 'entry_first', sequenceReasonCode: options.reason || 'default_foundation_entry' });
}

function runtimeContext() {
  return { materialVersionId: 'material:v1', observationPlanVersion: 1, trainingTaskVersion: 1 };
}
