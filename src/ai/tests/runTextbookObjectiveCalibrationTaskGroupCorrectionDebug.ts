import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import {
  assessReadingTaskGroupProgression,
  planReadingTaskGroupProgressionSeeds,
} from '../agents/readingTaskGroupProgressionPlanner.ts';
import { buildMaterialObservationDraftPlanningPrompt } from
  '../prompts/materialObservationDraftPrompt.ts';
import {
  calculateTaskGroupProgressionPlanHash,
  isTaskGroupProgressionPlan,
  type ReadingTaskPlanningSeed,
} from '../schemas/readingTaskGroupProgression.schema.ts';
import {
  TEXTBOOK_OBJECTIVE_CALIBRATION_POLICY_VERSION,
  isReadingCurriculumCalibrationContext,
  isReadingCurriculumCalibrationRole,
  type ReadingCurriculumCalibrationContext,
  type ReadingCurriculumCalibrationRole,
} from '../schemas/readingCurriculumCalibration.schema.ts';

const ROOT = '/Users/chengzheng/Desktop/web/yuwen-xiaolian/System';
const STORE = `${ROOT}/.local-data/formal-resource-store.json`;
const tests: Array<{ id: string; name: string; run: () => void }> = [];

function test(id: string, name: string, run: () => void) {
  tests.push({ id, name, run });
}

const preference = {
  strategy: 'entry_first',
  reason: 'default_foundation_entry',
  preferredPreludeChoiceCount: 1,
} as const;

const enforcedContext: ReadingCurriculumCalibrationContext = {
  policyVersion: TEXTBOOK_OBJECTIVE_CALIBRATION_POLICY_VERSION,
  requiresWholeTextOrientation: true,
  enforcementMode: 'enforced',
  basisCodes: ['multi_scene_structure'],
  deferredActivityCodes: ['oral_reading', 'recitation', 'vocabulary_accumulation'],
};

function seed(
  key: string,
  role: ReadingCurriculumCalibrationRole,
  anchorType: 'paragraph' | 'full_text' = 'paragraph',
): ReadingTaskPlanningSeed {
  return {
    planningTaskKey: key,
    observationDimension: role === 'whole_text_orientation' ? 'structure' : 'language',
    observationObject: key,
    materialAnchor: anchorType === 'full_text'
      ? { anchorType: 'full_text' }
      : { anchorType: 'paragraph', startParagraph: 2 },
    primaryAbilityId: 'comprehension',
    taskRole: 'training',
    responseFormat: 'single_choice',
    curriculumCalibrationRole: role,
    loadIntent: {
      primaryAction: 'locate_information',
      responsibilities: ['basic_understanding'],
    },
  };
}

function plan(
  roles: ReadingCurriculumCalibrationRole[],
  context: ReadingCurriculumCalibrationContext | null = enforcedContext,
) {
  return planReadingTaskGroupProgressionSeeds({
    materialVersionId: 'spring:v3',
    observationPlanRevisionId: 'observation-plan:successor-1',
    seeds: roles.map((role, index) => seed(
      `task-${index + 1}`,
      role,
      role === 'whole_text_orientation' ? 'full_text' : 'paragraph',
    )),
    preference,
    curriculumCalibration: context || undefined,
  });
}

function subjects(result: ReturnType<typeof plan>) {
  const semantics = new Map(result.planningResult.plannedTasks.map((item) => [
    item.planningTaskKey,
    item,
  ]));
  return result.planningResult.progressionPlan.orderedTasks.map((item, index) => {
    const planned = semantics.get(item.planningTaskKey)!;
    return {
      planningTaskKey: item.planningTaskKey,
      subjectId: `subject-${index + 1}`,
      taskLoadSemantics: planned.taskLoadSemantics,
      taskLoadSemanticsHash: planned.taskLoadSemanticsHash,
      taskGroupProgressionPlanHash: result.planningResult.progressionPlan.planHash,
      observationObject: `object-${index + 1}`,
      sourceAnchorIdentity: `anchor-${index + 1}`,
      scoringTargetIds: [`target-${index + 1}`],
      curriculumCalibrationRole: item.curriculumCalibrationRole,
    };
  });
}

function assess(result: ReturnType<typeof plan>) {
  return assessReadingTaskGroupProgression({
    plan: result.planningResult.progressionPlan,
    materialVersionId: 'spring:v3',
    observationPlanRevisionId: 'observation-plan:successor-1',
    subjects: subjects(result),
    assessedAt: '2026-09-03T00:00:00.000Z',
  });
}

function storeHash() {
  return createHash('sha256').update(readFileSync(STORE)).digest('hex');
}

function springFrozenQuestions() {
  const store = JSON.parse(readFileSync(STORE, 'utf8'));
  return store.data.questionResources.versions.filter((item: any) => (
    item.status === 'frozen'
    && item.materialVersionId === 'material-109b70ff-106:v3'
  ));
}

test('TC-01', '合法校准上下文通过 Guard', () => {
  assert(isReadingCurriculumCalibrationContext(enforcedContext));
});
test('TC-02', '非法角色与 basis code 被拒绝', () => {
  assert(!isReadingCurriculumCalibrationRole('reading_aloud'));
  assert(!isReadingCurriculumCalibrationContext({
    ...enforcedContext,
    basisCodes: ['paragraph_count_only'],
  }));
});
test('TC-03', '无校准上下文保持历史兼容', () => {
  const legacy = plan(['local_close_reading', 'integrated_understanding'], null);
  assert.equal(legacy.planningResult.progressionPlan.curriculumCalibration, undefined);
  assert(isTaskGroupProgressionPlan(legacy.planningResult.progressionPlan));
});
test('TC-04', 'enforced 且有全文入口时不产生教材校准 blocker', () => {
  assert(!assess(plan(['local_close_reading', 'whole_text_orientation']))
    .blockerCodes.some((code) => code.includes('whole_text_orientation')));
});
test('TC-05', 'enforced 缺全文入口时阻断', () => {
  assert(assess(plan(['local_close_reading', 'relation_explanation']))
    .blockerCodes.includes('required_whole_text_orientation_missing'));
});
test('TC-06', 'advisory 缺全文入口时只提醒', () => {
  const result = plan(['local_close_reading'], { ...enforcedContext, enforcementMode: 'advisory' });
  const gate = assess(result);
  assert.equal(gate.blockerCodes.includes('required_whole_text_orientation_missing'), false);
  assert(gate.advisoryCodes.includes('whole_text_orientation_missing'));
});
test('TC-07', '局部题排在全文入口前时强门禁阻断', () => {
  const result = plan(['whole_text_orientation', 'local_close_reading']);
  const projection = structuredClone(result.planningResult.progressionPlan);
  projection.orderedTasks[0]!.curriculumCalibrationRole = 'local_close_reading';
  projection.orderedTasks[1]!.curriculumCalibrationRole = 'whole_text_orientation';
  projection.planHash = calculateTaskGroupProgressionPlanHash(projection);
  result.planningResult.progressionPlan = projection;
  const projectedSubjects = subjects(result).map((item) => ({
    ...item,
    taskGroupProgressionPlanHash: projection.planHash,
  }));
  const gate = assessReadingTaskGroupProgression({
    plan: projection,
    materialVersionId: 'spring:v3',
    observationPlanRevisionId: 'observation-plan:successor-1',
    subjects: projectedSubjects,
  });
  assert(gate.blockerCodes.includes('local_close_reading_before_whole_text_orientation'));
});
test('TC-08', '整体入口排序优先于局部与综合角色', () => {
  assert.deepEqual(
    plan(['integrated_understanding', 'local_close_reading', 'whole_text_orientation'])
      .orderedSeeds.map((item) => item.curriculumCalibrationRole),
    ['whole_text_orientation', 'local_close_reading', 'integrated_understanding'],
  );
});
test('TC-09', '角色集合保留 optional transfer', () => {
  assert(isReadingCurriculumCalibrationRole('optional_transfer'));
});
test('TC-10', '不要求机械补齐全部角色', () => {
  assert.equal(plan(['whole_text_orientation', 'integrated_understanding']).orderedSeeds.length, 2);
});
test('TC-11', '专项片段可不建立校准上下文', () => {
  const source = readFileSync(`${ROOT}/src/pages/MaterialResourceProductionWorkbench.jsx`, 'utf8');
  assert(source.includes("material.usageType === 'targeted_excerpt'"));
});
test('TC-12', '校准上下文进入新 Plan Hash', () => {
  assert.notEqual(
    plan(['whole_text_orientation'], null).planningResult.progressionPlan.planHash,
    plan(['whole_text_orientation']).planningResult.progressionPlan.planHash,
  );
});
test('TC-13', '历史 Plan 缺新字段仍通过 Guard', () => {
  assert(isTaskGroupProgressionPlan(plan(['local_close_reading'], null)
    .planningResult.progressionPlan));
});
test('TC-14', 'Pass A Prompt 冻结教材校准角色与边界', () => {
  const prompt = buildMaterialObservationDraftPlanningPrompt({
    requestId: 'spring-calibration',
    material: {
      materialVersionId: 'spring:v3',
      title: '《春》',
      content: '第一段。\n\n第二段。\n\n第三段。\n\n第四段。',
    },
    preferences: { curriculumCalibration: enforcedContext },
  });
  assert(prompt.includes('whole_text_orientation'));
  assert(prompt.includes('不得直接照搬题目'));
  assert(prompt.includes('oral_reading、recitation、vocabulary_accumulation'));
});
test('TC-15', '《春》现有正式题组只读审计识别整体入口缺口', () => {
  const questions = springFrozenQuestions();
  assert.equal(questions.length, 6);
  assert(!questions.some((item: any) => item.curriculumCalibrationRole === 'whole_text_orientation'));
});
test('TC-16', '《春》successor 模拟题组按整体到局部到综合排序', () => {
  const result = plan([
    'integrated_understanding',
    'relation_explanation',
    'whole_text_orientation',
    'local_close_reading',
  ]);
  assert.deepEqual(result.orderedSeeds.map((item) => item.curriculumCalibrationRole), [
    'whole_text_orientation',
    'local_close_reading',
    'relation_explanation',
    'integrated_understanding',
  ]);
});
test('TC-17', '只读审计不修改 Formal Store', () => {
  const before = storeHash();
  springFrozenQuestions();
  assert.equal(storeHash(), before);
});
test('TC-18', '自动结构推断只启用 advisory', () => {
  const source = readFileSync(`${ROOT}/src/pages/MaterialResourceProductionWorkbench.jsx`, 'utf8');
  assert.match(source, /Paragraph structure is only an inference signal[\s\S]*enforcementMode: 'advisory'/);
});
test('TC-19', '新校准语义不写入学生能力画像', () => {
  const source = readFileSync(`${ROOT}/src/ai/schemas/readingCurriculumCalibration.schema.ts`, 'utf8');
  assert(!source.includes('studentAbilityProfile'));
});
test('TC-20', '内部校准角色未投射到 Learning 页面', () => {
  const source = readFileSync(`${ROOT}/src/pages/UnifiedLearningEntry.jsx`, 'utf8');
  assert(!source.includes('curriculumCalibrationRole'));
});

let passed = 0;
console.log('\nTextbook Objective Calibration & Task Group Correction Debug');
console.log('='.repeat(78));
for (const item of tests) {
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
console.log(`Result: ${passed} / ${tests.length} PASS`);
if (passed !== tests.length) process.exitCode = 1;
