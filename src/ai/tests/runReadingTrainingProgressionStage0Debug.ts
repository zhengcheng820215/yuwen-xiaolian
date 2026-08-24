import assert from 'node:assert/strict';
import { SharedFormalResourceStore } from '../../server/sharedFormalResourceStore.ts';
import {
  auditReadingTaskGroupProgression,
  projectLegacyTaskLoadSemantics,
} from '../agents/readingTrainingProgressiveLoadAuditAgent.ts';
import {
  isTaskLoadSemanticsProjection,
  READING_TRAINING_PROGRESSIVE_LOAD_POLICY_VERSION,
  type TaskLoadSemanticsProjection,
} from '../schemas/readingTrainingProgressionAudit.schema.ts';
import {
  READING_OPEN_RESPONSE_INPUT_LOAD_AUDIT_VERSION,
  READING_OPEN_RESPONSE_INPUT_LOAD_POLICY_VERSION,
  type TextResponseLoadAuditResult,
  type TextResponseLoadLevel,
} from '../schemas/readingOpenResponseInputLoad.schema.ts';
import type {
  FrozenQuestionResourceVersion,
  PrimaryAbilityId,
  QuestionResponseFormat,
} from '../schemas/questionResourceAdmission.schema.ts';
import {
  buildReadingTrainingProgressionStage0Audit,
  renderReadingTrainingProgressionStage0Markdown,
} from '../services/readingTrainingProgressionStage0AuditService.ts';

type DebugCase = { id: string; name: string; run: () => void | Promise<void> };

const cases: DebugCase[] = [
  {
    id: 'S0-01',
    name: 'complete text task projects to the expected sequence role',
    run: () => assert.equal(projectText('developing').sequenceRole, 'development'),
  },
  {
    id: 'S0-02',
    name: 'single choice projects to foundation without a fake text level',
    run: () => {
      const result = projectChoice();
      assert.equal(result.sequenceRole, 'foundation_entry');
      assert.equal(result.textLoadLevel, undefined);
    },
  },
  {
    id: 'S0-03',
    name: 'retest and transfer project to independent validation',
    run: () => {
      assert.equal(projectText('focused_short', 'retest').sequenceRole, 'independent_validation');
      assert.equal(projectChoice('transfer').sequenceRole, 'independent_validation');
    },
  },
  {
    id: 'S0-04',
    name: 'missing text profile degrades conservatively',
    run: () => {
      const result = projectLegacyTaskLoadSemantics({ version: version('short_text') });
      assert.equal(result.completeness, 'insufficient');
      assert.equal(result.confidence, 'low');
    },
  },
  {
    id: 'S0-05',
    name: 'projection and group audit are deterministic',
    run: () => {
      const input = [projectChoice(), projectText('focused_short'), projectText('developing')];
      assert.deepEqual(group(structuredClone(input)), group(input));
    },
  },
  {
    id: 'S0-06',
    name: 'full progressive sequence has no unexplained jump',
    run: () => assert.equal(group([
      projectChoice(),
      projectText('focused_short'),
      projectText('developing'),
      projectText('integrated'),
    ]).findings.some((item) => item.code === 'unexplained_responsibility_jump'), false),
  },
  {
    id: 'S0-07',
    name: 'foundation to integration without rationale is identified',
    run: () => assert(group([
      projectChoice(),
      projectText('integrated'),
    ]).findings.some((item) => item.code === 'unexplained_responsibility_jump')),
  },
  {
    id: 'S0-08',
    name: 'holistic first is a legal sequence exception',
    run: () => assert.equal(group([
      projectText('integrated'),
      projectChoice(),
    ], { strategy: 'holistic_first', reason: 'holistic_judgment_required' })
      .findings.some((item) => item.code === 'missing_accessible_entry'
        || item.code === 'unexplained_responsibility_jump'), false),
  },
  {
    id: 'S0-09',
    name: 'audit does not require every load level',
    run: () => {
      const result = group([projectChoice(), projectText('focused_short')]);
      assert.equal(result.findings.some((item) => item.explanation.includes('每个')), false);
      assert.equal(result.transitions[0].status, 'progressive');
    },
  },
  {
    id: 'S0-10',
    name: 'same action ability and evidence scope is identified',
    run: () => {
      const left = projectText('focused_short', 'training', 'q-left', ['anchor-same']);
      const right = projectText('focused_short', 'training', 'q-right', ['anchor-same']);
      assert(group([left, right]).findings.some((item) => (
        item.code === 'duplicate_observation_scope'
      )));
    },
  },
  {
    id: 'S0-11',
    name: 'cross thread group does not claim a traceable breakpoint',
    run: () => {
      const result = group([
        projectChoice('training', 'q-extraction', ['anchor-1'], 'extraction'),
        projectText('focused_short', 'training', 'q-comprehension', ['anchor-2'], 'comprehension'),
        projectText('developing', 'training', 'q-analysis', ['anchor-3'], 'analysis'),
      ]);
      assert.notEqual(result.breakPointObservability, 'traceable');
      assert(result.findings.some((item) => item.code === 'cross_thread_comparison_invalid'));
    },
  },
  {
    id: 'S0-12',
    name: 'high load first task creates attribution risk only',
    run: () => {
      const student = { ability: 'stable' };
      const before = structuredClone(student);
      const result = group([projectText('integrated')]);
      assert(result.findings.some((item) => item.code === 'task_overload_attribution_risk'));
      assert.deepEqual(student, before);
    },
  },
  {
    id: 'S0-13',
    name: 'targeted excerpt uses single task audit scope',
    run: () => {
      const result = group([projectText('focused_short')], { usageType: 'targeted_excerpt' });
      assert.equal(result.auditScope, 'targeted_excerpt_single_task');
      assert.equal(result.findings.some((item) => item.code === 'missing_accessible_entry'), false);
    },
  },
  {
    id: 'S0-14',
    name: 'real report records the effective Learning order',
    run: async () => {
      const report = buildReadingTrainingProgressionStage0Audit(
        await new SharedFormalResourceStore().read(),
      );
      report.groups.forEach((item) => assert.deepEqual(
        item.orderedQuestionVersionIds,
        item.projections.map((projection) => projection.questionVersionId),
      ));
    },
  },
  {
    id: 'S0-15',
    name: 'real active formal question coverage is complete',
    run: async () => {
      const report = buildReadingTrainingProgressionStage0Audit(
        await new SharedFormalResourceStore().read(),
      );
      assert.equal(report.counts.projectedQuestions, report.counts.activeFormalQuestions);
    },
  },
  {
    id: 'S0-16',
    name: 'every real core material receives a group audit',
    run: async () => {
      const report = buildReadingTrainingProgressionStage0Audit(
        await new SharedFormalResourceStore().read(),
      );
      assert.equal(report.counts.coreTaskGroups, report.counts.activeCoreMaterials);
    },
  },
  {
    id: 'S0-17',
    name: 'formal versions registry and links remain unchanged',
    run: async () => {
      const store = new SharedFormalResourceStore();
      const before = await store.read();
      const protectedCollections = snapshotProtectedCollections(before);
      buildReadingTrainingProgressionStage0Audit(before);
      const after = await store.read();
      assert.deepEqual(snapshotProtectedCollections(after), protectedCollections);
    },
  },
  {
    id: 'S0-18',
    name: 'store revision remains unchanged',
    run: async () => {
      const store = new SharedFormalResourceStore();
      const before = await store.read();
      buildReadingTrainingProgressionStage0Audit(before);
      assert.equal((await store.read()).revision, before.revision);
    },
  },
  {
    id: 'S0-19',
    name: 'Learning session and attempts remain untouched',
    run: () => {
      const state = { sessions: [{ id: 's1' }], attempts: [{ id: 'a1' }] };
      const before = structuredClone(state);
      group([projectChoice(), projectText('focused_short')]);
      assert.deepEqual(state, before);
    },
  },
  {
    id: 'S0-20',
    name: 'student profile and Evidence remain untouched',
    run: () => {
      const state = { profile: { level: 'stable' }, evidence: [{ id: 'e1' }] };
      const before = structuredClone(state);
      group([projectText('integrated')]);
      assert.deepEqual(state, before);
    },
  },
  {
    id: 'S0-21',
    name: 'finding breakdown equals group findings',
    run: async () => {
      const report = buildReadingTrainingProgressionStage0Audit(
        await new SharedFormalResourceStore().read(),
      );
      assert.equal(
        Object.values(report.findingBreakdown).reduce((sum, count) => sum + count, 0),
        report.groups.reduce((sum, item) => sum + item.findings.length, 0),
      );
    },
  },
  {
    id: 'S0-22',
    name: 'schema guard rejects unknown version and enum',
    run: () => {
      const valid = projectChoice();
      assert.equal(isTaskLoadSemanticsProjection(valid), true);
      assert.equal(isTaskLoadSemanticsProjection({ ...valid, policyVersion: 'unknown' }), false);
      assert.equal(isTaskLoadSemanticsProjection({ ...valid, sequenceRole: 'easy' }), false);
    },
  },
  {
    id: 'S0-23',
    name: 'real report renders with migration limits',
    run: async () => {
      const markdown = renderReadingTrainingProgressionStage0Markdown(
        buildReadingTrainingProgressionStage0Audit(
          await new SharedFormalResourceStore().read(),
        ),
      );
      assert(markdown.includes('迁移限制'));
      assert(markdown.includes('不形成学生能力结论'));
    },
  },
  {
    id: 'S0-24',
    name: 'stage 0 emits no commands or publication receipts',
    run: async () => {
      const store = new SharedFormalResourceStore();
      const before = await store.read();
      const receiptCount = before.commandReceipts?.length || 0;
      buildReadingTrainingProgressionStage0Audit(structuredClone(before));
      const after = await store.read();
      assert.equal(after.commandReceipts?.length || 0, receiptCount);
      assert.equal(after.revision, before.revision);
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
const report = buildReadingTrainingProgressionStage0Audit(snapshot);
console.log(JSON.stringify({
  summary: `${passed}/${cases.length}`,
  counts: report.counts,
  findingBreakdown: report.findingBreakdown,
  sourceDigest: report.sourceDigest,
  auditDigest: report.auditDigest,
}, null, 2));
if (process.argv.includes('--report')) {
  console.log('REPORT_MARKDOWN_START');
  console.log(renderReadingTrainingProgressionStage0Markdown(report));
  console.log('REPORT_MARKDOWN_END');
}
assert.equal(passed, 24);
assert.equal(cases.length, 24);
console.log('Reading Training Progressive Load Stage 0 Debug passed (24/24, read-only).');

function projectText(
  level: TextResponseLoadLevel,
  taskRole: FrozenQuestionResourceVersion['abilityMetadata']['taskRole'] = 'training',
  id = `q-${level}-${taskRole}`,
  sourceAnchorIds = [`anchor-${id}`],
  abilityId: PrimaryAbilityId = 'comprehension',
): TaskLoadSemanticsProjection {
  return projectLegacyTaskLoadSemantics({
    version: version(level === 'integrated' ? 'long_text' : 'short_text', {
      id,
      taskRole,
      abilityId,
    }),
    observationTaskPlanId: `task-${id}`,
    sourceAnchorIds,
    textLoadAudit: textAudit(id, level),
  });
}

function projectChoice(
  taskRole: FrozenQuestionResourceVersion['abilityMetadata']['taskRole'] = 'training',
  id = `q-choice-${taskRole}`,
  sourceAnchorIds = [`anchor-${id}`],
  abilityId: PrimaryAbilityId = 'comprehension',
): TaskLoadSemanticsProjection {
  return projectLegacyTaskLoadSemantics({
    version: version('single_choice', { id, taskRole, abilityId }),
    observationTaskPlanId: `task-${id}`,
    sourceAnchorIds,
  });
}

function group(
  projections: TaskLoadSemanticsProjection[],
  overrides: {
    strategy?: 'entry_first' | 'holistic_first' | 'role_driven';
    reason?: 'default_foundation_entry' | 'holistic_judgment_required';
    usageType?: 'core_reading' | 'targeted_excerpt';
  } = {},
) {
  return auditReadingTaskGroupProgression({
    materialId: 'material-1',
    materialVersionId: 'material-version-1',
    materialTitle: '测试材料',
    usageType: overrides.usageType || 'core_reading',
    strategy: overrides.strategy || 'entry_first',
    sequenceReason: overrides.reason,
    projections,
  });
}

function version(
  responseFormat: QuestionResponseFormat,
  overrides: {
    id?: string;
    taskRole?: FrozenQuestionResourceVersion['abilityMetadata']['taskRole'];
    abilityId?: PrimaryAbilityId;
  } = {},
): FrozenQuestionResourceVersion {
  const id = overrides.id || `version-${responseFormat}`;
  const isChoice = responseFormat === 'single_choice';
  return {
    resourceId: `resource-${id}`,
    resourceVersionId: id,
    versionNumber: 1,
    sourceDraftId: `draft-${id}`,
    materialId: 'material-1',
    materialVersionId: 'material-version-1',
    taskId: `task-${id}`,
    title: '测试题',
    questionStem: isChoice ? '下列理解正确的一项是？' : '结合材料说明含义。',
    questionType: isChoice ? 'multiple_choice' : 'reading_comprehension',
    responseFormat,
    choiceInteraction: isChoice ? {
      schemaVersion: 'single-choice-interaction-v1',
      selectionMode: 'single',
      options: [
        { optionId: 'a', content: '正确理解' },
        { optionId: 'b', content: '表面理解' },
        { optionId: 'c', content: '过度推断' },
      ],
      correctOptionIds: ['a'],
      distractorRationales: [
        { optionId: 'b', misconceptionCode: 'surface_reading', diagnosisMeaning: '只看表面' },
        { optionId: 'c', misconceptionCode: 'over_inference', diagnosisMeaning: '超出证据' },
      ],
      optionSetVersion: 1,
    } : undefined,
    assessmentMode: isChoice ? 'exact_match' : 'key_points',
    rubric: [{
      itemId: 'rubric-1',
      name: '理解',
      abilityId: overrides.abilityId || 'comprehension',
      importance: 'critical',
      required: true,
      acceptedSignals: ['完成动作'],
    }],
    minimumAnswerRequirement: isChoice ? {
      responseFormat: 'single_choice',
      minLength: 0,
      requireTextEvidence: false,
      requireExplanation: false,
      minSelections: 1,
      maxSelections: 1,
    } : {
      responseFormat: responseFormat as 'short_text' | 'long_text',
      minLength: 12,
      requireTextEvidence: true,
      requireExplanation: true,
    },
    abilityMetadata: {
      abilityId: overrides.abilityId || 'comprehension',
      supportingAbilityIds: [],
      prerequisiteAbilityIds: [],
      taskRole: overrides.taskRole || 'training',
      difficulty: 'basic',
    },
    source: { sourceType: 'ai_assisted', description: 'test' },
    tags: isChoice ? ['sequence-prelude:true'] : [],
    validationId: `validation-${id}`,
    reviewId: `review-${id}`,
    status: 'frozen',
    frozenAt: '2026-08-21T00:00:00.000Z',
    updatedAt: '2026-08-21T00:00:00.000Z',
    version: 'phase16_1a_v1',
    schemaVersion: 'question_resource_admission_v1',
  };
}

function textAudit(id: string, level: TextResponseLoadLevel): TextResponseLoadAuditResult {
  return {
    questionVersionId: id,
    materialVersionId: 'material-version-1',
    responseFormat: level === 'integrated' ? 'long_text' : 'short_text',
    analysisCompleteness: 'complete',
    profile: {
      policyVersion: READING_OPEN_RESPONSE_INPUT_LOAD_POLICY_VERSION,
      loadLevel: level,
      primaryAction: 'explain_local_meaning',
      requiredEvidenceUnitCount: level === 'integrated' ? '3_or_more' : 1,
      requiredRelationCount: level === 'entry_short' ? 0 : level === 'integrated' ? '2_or_more' : 1,
      requiredObjectCount: 1,
      expectedAnswerLengthBand: { recommendedMin: 12, recommendedMax: 60 },
      compositeLoadReasons: [],
    },
    findings: [],
    disposition: 'retain',
    analyzerVersion: READING_OPEN_RESPONSE_INPUT_LOAD_AUDIT_VERSION,
  };
}

function snapshotProtectedCollections(snapshot: Awaited<ReturnType<SharedFormalResourceStore['read']>>) {
  return structuredClone({
    versions: snapshot.data.questionResources.versions,
    registryEntries: snapshot.data.questionResources.registryEntries,
    links: snapshot.data.materialObservations.links,
    commandReceipts: snapshot.commandReceipts,
  });
}

assert.equal(READING_TRAINING_PROGRESSIVE_LOAD_POLICY_VERSION,
  'reading_training_progressive_load_policy_v2');
