import assert from 'node:assert/strict';
import { projectFeedbackObservationTarget } from
  '../agents/feedbackObservationTargetAdapter.ts';
import { isFeedbackObservationTargetProjection } from
  '../schemas/feedbackObservationTargetProjection.schema.ts';

type TestCase = {
  id: string;
  question: string;
  expected: ReturnType<typeof projectFeedbackObservationTarget>['targetCode'];
  questionType?: string;
  rubric?: Array<{ name: string; description?: string; required?: boolean }>;
};

const cases: TestCase[] = [
  {
    id: 'FT-01',
    question: '母亲挡在窗前时有怎样的心理？',
    expected: 'character_psychology',
  },
  {
    id: 'FT-02',
    question: '结合具体表现，分析屠户是一个怎样的人物。',
    expected: 'character_trait',
    questionType: '人物形象分析',
  },
  {
    id: 'FT-03',
    question: '这些描写共同表现了春天万物刚睡醒时怎样的状态？',
    expected: 'scene_or_object_state',
  },
  {
    id: 'FT-04',
    question: '从哪些信息可以判断公交车暂时无法按时到站？',
    expected: 'fact_or_evidence',
  },
  {
    id: 'FT-05',
    question: '请按先后说明小芽发生了怎样的变化过程。',
    expected: 'event_process_or_change',
  },
  {
    id: 'FT-06',
    question: '女娲最初为什么感到孤独？',
    expected: 'character_psychology',
  },
  {
    id: 'FT-07',
    question: '枯藤挥洒泥浆与手捏泥人有什么不同？',
    expected: 'relationship_or_comparison',
  },
  {
    id: 'FT-08',
    question: '请概括这一段的主要内容。',
    expected: 'main_content',
  },
  {
    id: 'FT-09',
    question: '指出句中的修辞手法，并分析其表达效果。',
    expected: 'expression_effect',
  },
  {
    id: 'FT-10',
    question: '这句话与上文形成怎样的照应？',
    expected: 'structure_relation',
  },
  {
    id: 'FT-11',
    question: '这个故事表达了怎样的主旨？',
    expected: 'theme_or_meaning',
  },
  {
    id: 'FT-12',
    question: '请概括故事经过，并说明结尾在结构上的作用。',
    expected: 'requirement_completion',
  },
  {
    id: 'FT-13',
    question: '结合材料谈谈你的理解。',
    expected: 'generic_content',
  },
  {
    id: 'FT-14',
    question: '作者为什么使用这个比喻？请分析它的表达效果。',
    expected: 'expression_effect',
  },
  {
    id: 'FT-15',
    question: '这些景物描写表现了春天万物怎样的状态？',
    expected: 'generic_content',
    rubric: [{
      name: '人物心理',
      description: '说明人物此时的心理。',
      required: true,
    }],
  },
  {
    id: 'FT-16',
    question: '父亲反复提醒“走一步”表现了怎样的心理？',
    expected: 'character_psychology',
  },
];

for (const testCase of cases) {
  const projection = projectFeedbackObservationTarget({
    question: testCase.question,
    questionType: testCase.questionType,
    rubric: testCase.rubric,
    taskRole: testCase.id === 'FT-16' ? 'retest' : 'training',
  });
  assert.equal(projection.targetCode, testCase.expected, testCase.id);
  assert.equal(isFeedbackObservationTargetProjection(projection), true, testCase.id);
  if (testCase.id === 'FT-03') assert.notEqual(projection.targetCode, 'character_trait');
  if (testCase.id === 'FT-13') {
    assert.equal(projection.confidence, 'low');
    assert.equal(projection.fallbackReason, 'unsupported_target_pattern');
  }
  if (testCase.id === 'FT-15') {
    assert.equal(projection.fallbackReason, 'question_rubric_mismatch');
  }
}

const training = projectFeedbackObservationTarget({
  question: cases[15].question,
  taskRole: 'training',
});
const retest = projectFeedbackObservationTarget({
  question: cases[15].question,
  taskRole: 'retest',
});
const transfer = projectFeedbackObservationTarget({
  question: cases[15].question,
  taskRole: 'transfer',
});
assert.equal(training.targetCode, retest.targetCode);
assert.equal(training.targetCode, transfer.targetCode);
assert.equal(training.displayLabel, retest.displayLabel);
assert.equal(training.displayLabel, transfer.displayLabel);

console.log(`Feedback observation target projection: ${cases.length}/${cases.length} PASS`);
console.log('FINAL: PASS');
