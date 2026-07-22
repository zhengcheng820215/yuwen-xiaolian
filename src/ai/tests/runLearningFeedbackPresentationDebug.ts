import {
  shouldRenderThinkingReview,
  shouldStageFeedbackPresentation,
  synchronizeFeedbackPresentationStep,
} from '../../ui/feedbackPresentationPolicy.ts';

type DebugCase = {
  id: string;
  description: string;
  passed: boolean;
  details: string;
};

const cases: DebugCase[] = [];

function record(id: string, description: string, passed: boolean, details: string): void {
  cases.push({ id, description, passed, details });
}

const stagedInitially = shouldStageFeedbackPresentation({
  correctionStatus: 'loading',
  correctionCount: 0,
  hasReview: true,
  hasGuidance: true,
  prefersReducedMotion: false,
  hasPresented: false,
});
record('P1', '纠错请求期间可以开始短时反馈引导', stagedInitially, `staged=${stagedInitially}`);

const stageAfterCorrections = shouldStageFeedbackPresentation({
  correctionStatus: 'resolved',
  correctionCount: 1,
  hasReview: true,
  hasGuidance: true,
  prefersReducedMotion: false,
  hasPresented: false,
});
const revealedAfterCorrections = synchronizeFeedbackPresentationStep(0, stageAfterCorrections);
record(
  'P2',
  '纠错结果中途返回后立即完整显示反馈和流程操作',
  !stageAfterCorrections && revealedAfterCorrections === 3,
  `staged=${stageAfterCorrections}, step=${revealedAfterCorrections}`,
);

const reducedMotionStage = shouldStageFeedbackPresentation({
  correctionStatus: 'resolved',
  correctionCount: 0,
  hasReview: true,
  hasGuidance: true,
  prefersReducedMotion: true,
  hasPresented: false,
});
record(
  'P3',
  '减少动态效果时直接完整显示',
  synchronizeFeedbackPresentationStep(0, reducedMotionStage) === 3,
  `staged=${reducedMotionStage}`,
);

const presentedStage = shouldStageFeedbackPresentation({
  correctionStatus: 'resolved',
  correctionCount: 0,
  hasReview: true,
  hasGuidance: true,
  prefersReducedMotion: false,
  hasPresented: true,
});
record(
  'P4',
  '已查看反馈恢复后不重复播放',
  synchronizeFeedbackPresentationStep(0, presentedStage) === 3,
  `staged=${presentedStage}`,
);

const insufficientReviewVisible = shouldRenderThinkingReview({
  coveredPoints: [],
  primaryGap: '这次回答还没有明确写出人物的心理。',
  missingPoints: ['这次回答还没有明确写出人物的心理。'],
});
record(
  'P5',
  '信息不足但存在具体缺口时显示思路点评',
  insufficientReviewVisible,
  `visible=${insufficientReviewVisible}`,
);

const emptyReviewHidden = shouldRenderThinkingReview({
  coveredPoints: [],
  missingPoints: [],
});
record('P6', '没有可靠点评内容时隐藏空区块', !emptyReviewHidden, `visible=${emptyReviewHidden}`);

console.log('Learning Feedback Presentation Debug');
console.log('='.repeat(72));
for (const item of cases) {
  console.log(`${item.passed ? 'PASS' : 'FAIL'} | ${item.id} ${item.description}`);
  console.log(`       ${item.details}`);
}
console.log('-'.repeat(72));
const passed = cases.filter((item) => item.passed).length;
console.log(`Result: ${passed} / ${cases.length} PASS`);

if (passed !== cases.length) process.exitCode = 1;
