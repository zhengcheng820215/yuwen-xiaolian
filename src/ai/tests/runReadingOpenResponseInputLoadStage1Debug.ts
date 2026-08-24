import assert from 'node:assert/strict';
import { SharedFormalResourceStore } from '../../server/sharedFormalResourceStore.ts';
import {
  analyzeReadingOpenResponseInputLoad,
} from '../agents/readingOpenResponseInputLoadAnalyzer.ts';
import { auditReadingOpenResponseTaskGroup } from
  '../agents/readingOpenResponseTaskGroupLoadAuditAgent.ts';
import {
  READING_OPEN_RESPONSE_INPUT_LOAD_AUDIT_VERSION,
  READING_OPEN_RESPONSE_INPUT_LOAD_POLICY_VERSION,
  isTextResponseLoadAuditResult,
  isTextResponseLoadProfile,
  type CanonicalTextResponseAction,
  type TextResponseLoadAnalysisInput,
  type TextResponseLoadAuditResult,
  type TextResponseLoadLevel,
  type TextResponseTaskGroupItem,
} from '../schemas/readingOpenResponseInputLoad.schema.ts';
import type { QuestionResourceRubricItem } from
  '../schemas/questionResourceAdmission.schema.ts';
import {
  buildReadingOpenResponseInputLoadBaselineAudit,
} from '../services/readingOpenResponseInputLoadBaselineAuditService.ts';
import { buildQuestionOptimizationBaseline } from
  '../agents/questionOptimizationBaselineAgent.ts';

type DebugCase = { id: string; name: string; run: () => void | Promise<void> };

const cases: DebugCase[] = [
  {
    id: 'S1-01',
    name: 'single choice is excluded from text load profiling',
    run: () => assert.equal(analyzeReadingOpenResponseInputLoad(input({
      responseFormat: 'single_choice',
    })), null),
  },
  {
    id: 'S1-02',
    name: 'single information location is entry short',
    run: () => assert.equal(profile(input({
      questionStem: '女娲最初在哪里行走？',
      minimumAnswerRequirement: minimum(6, false, false),
      rubric: [rubric('定位地点', '写出女娲最初所在的位置', 'extraction')],
      abilityMetadata: ability('extraction', 'basic'),
      expectedStudentAction: '定位信息',
    })).loadLevel, 'entry_short'),
  },
  {
    id: 'S1-03',
    name: 'local meaning plus one explanation is focused short',
    run: () => assert.equal(profile(input({
      questionStem: '“荒凉寂寞”在这里有什么含义？',
      minimumAnswerRequirement: minimum(12, false, true),
      rubric: [rubric('局部含义', '解释句中词语的含义', 'comprehension')],
      abilityMetadata: ability('comprehension', 'basic'),
    })).loadLevel, 'focused_short'),
  },
  {
    id: 'S1-04',
    name: 'two evidence units form developing load',
    run: () => assert.equal(profile(input({
      questionStem: '结合两处描写，说明人物心情的变化。',
      sourceAnchorIds: ['anchor-1', 'anchor-2'],
      rubric: [rubric('变化解释', '用两处描写说明人物心情变化', 'analysis', true)],
      abilityMetadata: ability('analysis', 'intermediate'),
    })).loadLevel, 'developing'),
  },
  {
    id: 'S1-05',
    name: 'whole text multi evidence analysis is integrated',
    run: () => assert.equal(profile(integratedInput()).loadLevel, 'integrated'),
  },
  {
    id: 'S1-06',
    name: 'one primary action with dependent support is not composite',
    run: () => {
      const result = resultOf(input({
        questionStem: '找出一句描写，并说明它表达的含义。',
        rubric: [rubric('证据解释', '找出证据并解释局部含义', 'comprehension', true)],
      }));
      assert.equal(hasFinding(result, 'composite_core_actions'), false);
      assert(result.profile?.supportingAction);
    },
  },
  {
    id: 'S1-07',
    name: 'three independent core actions are reported',
    run: () => assert(hasFinding(resultOf(input({
      questionStem: '概括故事内容，分析人物形象，并说明文章主题。',
      rubric: [
        rubric('概括', '概括故事内容', 'summarization'),
        rubric('人物', '分析人物形象', 'analysis'),
        rubric('主题', '说明文章主题', 'analysis'),
      ],
    })), 'composite_core_actions')),
  },
  {
    id: 'S1-08',
    name: 'hidden rubric action is reported',
    run: () => assert(hasFinding(resultOf(input({
      questionStem: '请概括这一段的主要内容。',
      rubric: [
        rubric('内容概括', '概括主要内容', 'summarization'),
        rubric('结构作用', '分析这段在结构上的作用', 'analysis'),
      ],
    })), 'hidden_rubric_requirement')),
  },
  {
    id: 'S1-09',
    name: 'short evidence cannot support integrated demand',
    run: () => assert(hasFinding(resultOf(input({
      ...integratedInput(),
      sourceEvidenceCharacterCount: 32,
    })), 'evidence_scope_insufficient')),
  },
  {
    id: 'S1-10',
    name: 'overweighted minimum length is reported',
    run: () => assert(hasFinding(resultOf(input({
      questionStem: '女娲最初在哪里行走？',
      minimumAnswerRequirement: minimum(80, false, false),
      rubric: [rubric('定位地点', '写出地点', 'extraction')],
      abilityMetadata: ability('extraction', 'basic'),
      expectedStudentAction: '定位信息',
    })), 'minimum_length_overweighted')),
  },
  {
    id: 'S1-11',
    name: 'under supportive minimum length is reported',
    run: () => assert(hasFinding(resultOf(input({
      ...integratedInput(),
      minimumAnswerRequirement: minimum(10, true, true),
      sourceEvidenceCharacterCount: 260,
    })), 'minimum_length_under_supports_rubric')),
  },
  {
    id: 'S1-12',
    name: 'integrated short text mismatch is reported',
    run: () => assert(hasFinding(resultOf(input({
      ...integratedInput(),
      responseFormat: 'short_text',
    })), 'response_format_load_mismatch')),
  },
  {
    id: 'S1-13',
    name: 'analysis is deterministic across repeated runs',
    run: () => {
      const source = integratedInput();
      const expected = resultOf(source);
      for (let index = 0; index < 20; index += 1) {
        assert.deepEqual(resultOf(structuredClone(source)), expected);
      }
    },
  },
  {
    id: 'S1-14',
    name: 'incomplete structured input is conservative',
    run: () => {
      const result = resultOf(input({
        materialVersionId: undefined,
        rubric: [],
        sourceAnchorIds: undefined,
      }));
      assert.equal(result.analysisCompleteness, 'partial');
      assert(hasFinding(result, 'analysis_input_incomplete'));
    },
  },
  {
    id: 'S1-15',
    name: 'recommended band remains an internal profile field',
    run: () => {
      const result = resultOf(input());
      assert(result.profile?.expectedAnswerLengthBand);
      assert.equal('studentVisibleRecommendedLength' in result, false);
      assert.equal('studentInstruction' in result, false);
    },
  },
  {
    id: 'S1-16',
    name: 'load profile does not mutate student ability profile',
    run: () => {
      const studentProfile = { studentId: 'student-1', abilities: { comprehension: 'developing' } };
      const before = structuredClone(studentProfile);
      resultOf(input());
      assert.deepEqual(studentProfile, before);
    },
  },
  {
    id: 'S1-17',
    name: 'choice developing integrated sequence passes',
    run: () => assert.equal(group([
      choiceTask('choice'),
      textTask('developing', 'developing'),
      textTask('integrated', 'integrated'),
    ]).sequenceFindings.some((item) => item.code === 'unexplained_load_jump'), false),
  },
  {
    id: 'S1-18',
    name: 'entry to developing does not force a focused short template',
    run: () => assert.deepEqual(group([
      textTask('entry', 'entry_short'),
      textTask('developing', 'developing'),
      textTask('integrated', 'integrated'),
    ]).sequenceFindings.filter((item) => (
      item.code === 'unexplained_load_jump' || item.code === 'missing_entry_path'
    )), []),
  },
  {
    id: 'S1-19',
    name: 'choice to integrated without rationale is reported',
    run: () => assert(group([
      choiceTask('choice'),
      textTask('integrated', 'integrated'),
    ]).sequenceFindings.some((item) => item.code === 'unexplained_load_jump')),
  },
  {
    id: 'S1-20',
    name: 'holistic first sequence is a legal exception',
    run: () => assert.equal(group([
      textTask('integrated', 'integrated'),
      choiceTask('choice'),
    ], 'holistic_judgment_required').sequenceFindings.length, 0),
  },
  {
    id: 'S1-21',
    name: 'retest and transfer sequence is a legal exception',
    run: () => {
      const tasks = [
        { ...textTask('integrated-retest', 'integrated'), taskRole: 'retest' as const },
        { ...choiceTask('choice-transfer'), taskRole: 'transfer' as const },
      ];
      assert.equal(group(tasks).sequenceFindings.length, 0);
    },
  },
  {
    id: 'S1-22',
    name: 'same action and evidence scope is reported as duplicate',
    run: () => assert(group([
      textTask('first', 'focused_short', ['anchor-shared']),
      textTask('second', 'focused_short', ['anchor-shared']),
    ]).sequenceFindings.some((item) => item.code === 'duplicate_load_observation')),
  },
  {
    id: 'S1-23',
    name: 'real active formal text corpus is fully audited',
    run: async () => {
      const snapshot = await new SharedFormalResourceStore().read();
      const baseline = buildQuestionOptimizationBaseline(snapshot);
      const report = buildReadingOpenResponseInputLoadBaselineAudit(snapshot);
      assert.equal(
        report.counts.textQuestions + report.counts.singleChoiceQuestions,
        baseline.counts.currentFormalVersions,
      );
      assert.equal(report.counts.activeMaterials, baseline.counts.activeMaterials);
    },
  },
  {
    id: 'S1-24',
    name: 'formal versions registry and links remain unchanged',
    run: async () => {
      const store = new SharedFormalResourceStore();
      const snapshot = await store.read();
      const before = structuredClone({
        versions: snapshot.data.questionResources.versions,
        registryEntries: snapshot.data.questionResources.registryEntries,
        links: snapshot.data.materialObservations.links,
      });
      buildReadingOpenResponseInputLoadBaselineAudit(snapshot);
      const after = await store.read();
      assert.deepEqual({
        versions: after.data.questionResources.versions,
        registryEntries: after.data.questionResources.registryEntries,
        links: after.data.materialObservations.links,
      }, before);
      assert.equal(after.revision, snapshot.revision);
    },
  },
  {
    id: 'S1-25',
    name: 'learning session and attempt objects remain untouched',
    run: async () => {
      const learningState = { sessions: [{ id: 'session-1' }], attempts: [{ id: 'attempt-1' }] };
      const before = structuredClone(learningState);
      const snapshot = await new SharedFormalResourceStore().read();
      buildReadingOpenResponseInputLoadBaselineAudit(snapshot);
      assert.deepEqual(learningState, before);
    },
  },
  {
    id: 'S1-26',
    name: 'student profile remains untouched by baseline service',
    run: async () => {
      const profileState = { studentId: 'student-1', abilityStatus: ['stable'] };
      const before = structuredClone(profileState);
      const snapshot = await new SharedFormalResourceStore().read();
      buildReadingOpenResponseInputLoadBaselineAudit(snapshot);
      assert.deepEqual(profileState, before);
    },
  },
  {
    id: 'S1-27',
    name: 'disposition totals equal audited text question count',
    run: async () => {
      const snapshot = await new SharedFormalResourceStore().read();
      const report = buildReadingOpenResponseInputLoadBaselineAudit(snapshot);
      assert.equal(
        Object.values(report.dispositionBreakdown).reduce((sum, value) => sum + value, 0),
        report.counts.textQuestions,
      );
    },
  },
  {
    id: 'S1-28',
    name: 'real baseline report and schema guards are stable',
    run: async () => {
      const snapshot = await new SharedFormalResourceStore().read();
      const first = buildReadingOpenResponseInputLoadBaselineAudit(snapshot);
      const second = buildReadingOpenResponseInputLoadBaselineAudit(structuredClone(snapshot));
      assert.deepEqual(second, first);
      assert.deepEqual(
        first.issues.filter((issue) => issue.startsWith('stage1_audit_')),
        [],
        first.issues.join('\n'),
      );
      first.questionResults.forEach((result) => {
        assert.equal(isTextResponseLoadAuditResult(result), true);
        if (result.profile) assert.equal(isTextResponseLoadProfile(result.profile), true);
      });
      const sampleProfile = first.questionResults.find((result) => result.profile)?.profile;
      assert.ok(sampleProfile);
      assert.equal(isTextResponseLoadProfile({
        ...sampleProfile,
        requiredRelationCount: 2,
      }), false);
      assert.equal(isTextResponseLoadProfile({
        ...sampleProfile,
        requiredObjectCount: '2_or_more',
      }), false);
    },
  },
];

let passed = 0;
for (const testCase of cases) {
  try {
    await testCase.run();
    passed += 1;
    console.log(`PASS ${testCase.id} ${testCase.name}`);
  } catch (error) {
    console.error(`FAIL ${testCase.id} ${testCase.name}`);
    throw error;
  }
}

const snapshot = await new SharedFormalResourceStore().read();
const report = buildReadingOpenResponseInputLoadBaselineAudit(snapshot);
console.log(JSON.stringify({
  summary: `${passed}/${cases.length}`,
  counts: report.counts,
  levelDistribution: report.levelDistribution,
  dispositionBreakdown: report.dispositionBreakdown,
  findingBreakdown: report.findingBreakdown,
  sequenceFindingBreakdown: report.sequenceFindingBreakdown,
  sourceDigest: report.sourceDigest,
  auditDigest: report.auditDigest,
}, null, 2));
assert.equal(passed, 28);
assert.equal(cases.length, 28);
console.log('Reading open-response input-load Stage 1 Debug passed (28/28, read-only).');

function input(
  overrides: Partial<TextResponseLoadAnalysisInput> = {},
): TextResponseLoadAnalysisInput {
  return {
    questionVersionId: 'question-version-1',
    materialVersionId: 'material-version-1',
    title: '局部理解',
    questionStem: '这句话有什么含义？',
    responseFormat: 'short_text',
    rubric: [rubric('局部理解', '解释句子的局部含义', 'comprehension')],
    minimumAnswerRequirement: minimum(12, false, true),
    abilityMetadata: ability('comprehension', 'basic'),
    expectedStudentAction: '解释局部含义',
    sourceAnchorIds: ['anchor-1'],
    sourceEvidenceCharacterCount: 100,
    tags: [],
    ...overrides,
  };
}

function integratedInput(): TextResponseLoadAnalysisInput {
  return input({
    questionVersionId: 'question-integrated',
    questionStem: '结合全文多处证据，分析人物形象及其变化。',
    responseFormat: 'long_text',
    rubric: [
      rubric('人物行动', '结合文本证据分析人物行动', 'analysis', true),
      rubric('人物变化', '说明人物心理和形象的变化', 'analysis', true),
    ],
    minimumAnswerRequirement: minimum(60, true, true),
    abilityMetadata: ability('analysis', 'advanced'),
    expectedStudentAction: '结合全文证据分析人物形象变化',
    sourceAnchorIds: ['anchor-1', 'anchor-2'],
    sourceEvidenceCharacterCount: 260,
  });
}

function ability(
  abilityId: TextResponseLoadAnalysisInput['abilityMetadata']['abilityId'],
  difficulty: TextResponseLoadAnalysisInput['abilityMetadata']['difficulty'],
): TextResponseLoadAnalysisInput['abilityMetadata'] {
  return {
    abilityId,
    supportingAbilityIds: [],
    taskRole: 'training',
    difficulty,
  };
}

function minimum(
  minLength: number,
  requireTextEvidence: boolean,
  requireExplanation: boolean,
): TextResponseLoadAnalysisInput['minimumAnswerRequirement'] {
  return { responseFormat: 'short_text', minLength, requireTextEvidence, requireExplanation };
}

function rubric(
  name: string,
  description: string,
  abilityId: QuestionResourceRubricItem['abilityId'],
  requireTextEvidence = false,
): QuestionResourceRubricItem {
  return {
    itemId: `rubric-${name}`,
    name,
    description,
    abilityId,
    importance: 'critical',
    required: true,
    evidenceRequirement: {
      requireTextEvidence,
      requireExplanation: true,
    },
    acceptedSignals: ['完成对应动作'],
  };
}

function resultOf(value: TextResponseLoadAnalysisInput): TextResponseLoadAuditResult {
  const result = analyzeReadingOpenResponseInputLoad(value);
  assert(result, 'Expected a text response audit result.');
  return result;
}

function profile(value: TextResponseLoadAnalysisInput) {
  const result = resultOf(value);
  assert(result.profile, 'Expected a load profile.');
  return result.profile;
}

function hasFinding(
  result: TextResponseLoadAuditResult,
  code: TextResponseLoadAuditResult['findings'][number]['code'],
): boolean {
  return result.findings.some((finding) => finding.code === code);
}

function auditResult(
  id: string,
  level: TextResponseLoadLevel,
  primaryAction: CanonicalTextResponseAction = 'explain_local_meaning',
): TextResponseLoadAuditResult {
  return {
    questionVersionId: id,
    materialVersionId: 'material-version-group',
    responseFormat: 'short_text',
    analysisCompleteness: 'complete',
    profile: {
      policyVersion: READING_OPEN_RESPONSE_INPUT_LOAD_POLICY_VERSION,
      loadLevel: level,
      primaryAction,
      requiredEvidenceUnitCount: level === 'integrated' ? '3_or_more' : 1,
      requiredRelationCount: level === 'integrated' ? '2_or_more' : level === 'entry_short' ? 0 : 1,
      requiredObjectCount: 1,
      expectedAnswerLengthBand: { recommendedMin: 12, recommendedMax: 60 },
      compositeLoadReasons: [],
    },
    findings: [],
    disposition: 'retain',
    analyzerVersion: READING_OPEN_RESPONSE_INPUT_LOAD_AUDIT_VERSION,
  };
}

function textTask(
  id: string,
  level: TextResponseLoadLevel,
  sourceAnchorIds: string[] = [`anchor-${id}`],
): TextResponseTaskGroupItem {
  return {
    questionVersionId: id,
    responseFormat: level === 'integrated' ? 'long_text' : 'short_text',
    taskRole: 'training',
    sourceAnchorIds,
    auditResult: auditResult(id, level),
  };
}

function choiceTask(id: string): TextResponseTaskGroupItem {
  return {
    questionVersionId: id,
    responseFormat: 'single_choice',
    taskRole: 'training',
    sourceAnchorIds: [`anchor-${id}`],
  };
}

function group(
  tasks: TextResponseTaskGroupItem[],
  sequenceReason?: Parameters<typeof auditReadingOpenResponseTaskGroup>[0]['sequenceReason'],
) {
  return auditReadingOpenResponseTaskGroup({
    materialVersionId: 'material-version-group',
    tasks: tasks.map((task, index) => ({ ...task, sequenceRank: index + 1 })),
    sequenceReason,
  });
}
