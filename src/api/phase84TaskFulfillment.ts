import { branchTaskFulfillment } from '../ai/agents/taskFulfillmentBranchingAgent.ts';
import { createTaskFulfillmentRequest } from '../ai/agents/taskFulfillmentRequestAgent.ts';
import { matchTaskResources } from '../ai/agents/taskResourceMatchingAgent.ts';
import {
  buildFulfillmentRequestFixture,
  buildMockTaskResources,
  buildTaskRequestFixture,
  phase84RunAt,
} from '../ai/tests/taskFulfillmentDebugFixtures.ts';

export function getPhase84TaskFulfillmentDemoData() {
  const cases = getPhase84TaskFulfillmentDemoCases();

  return {
    cases,
    defaultCaseId: 'matched',
  };
}

export function getPhase84TaskFulfillmentDemoCases() {
  const resources = buildMockTaskResources();

  return [
    buildMatchedCase(resources),
    buildPartialCase(resources),
    buildNoMatchCase(resources),
    buildInvalidTaskRequestCase(resources),
  ];
}

function buildMatchedCase(resources) {
  const taskRequest = buildTaskRequestFixture();
  const fulfillmentResult = createTaskFulfillmentRequest({
    taskRequest,
    createdAt: phase84RunAt,
  });
  const matchResult = matchTaskResources({
    fulfillmentRequest: fulfillmentResult.request,
    availableTaskResources: resources,
  });
  const branchResult = branchTaskFulfillment({
    fulfillmentRequest: fulfillmentResult.request,
    matchResult,
    availableTaskResources: resources,
    createdAt: phase84RunAt,
  });

  return {
    id: 'matched',
    label: '完全匹配',
    description: '合法 TaskRequest 可以被标准化，并在 mock 资源中找到满足硬约束与软偏好的任务。',
    expected: 'matched 分支生成 ExecutableLearningTask。',
    acceptancePoints: [
      'TaskFulfillmentRequest 成功生成。',
      'TaskResourceMatchResult status 为 matched。',
      'ExecutableLearningTask 被创建。',
      '不生成 TaskGenerationRequest。',
    ],
    taskRequest,
    fulfillmentResult,
    matchResult,
    branchResult,
    resources,
  };
}

function buildPartialCase(resources) {
  const taskRequest = buildTaskRequestFixture();
  const fulfillmentRequest = buildFulfillmentRequestFixture({
    sourceTaskRequestId: taskRequest.taskRequestId,
    sourceStrategyId: taskRequest.strategyId,
    recentTaskIds: ['task_matched_retest_reasoning'],
  });
  const matchResult = matchTaskResources({
    fulfillmentRequest,
    availableTaskResources: resources,
  });
  const branchResult = branchTaskFulfillment({
    fulfillmentRequest,
    matchResult,
    availableTaskResources: resources,
    createdAt: phase84RunAt,
  });

  return {
    id: 'partial_match',
    label: '部分匹配',
    description: '资源满足硬约束，但未满足部分软偏好，例如近期已使用或难度不完全合适。',
    expected: 'partial_match 不生成 ExecutableLearningTask，而是进入 TaskGenerationRequest / review 分支。',
    acceptancePoints: [
      'TaskResourceMatchResult status 为 partial_match。',
      '不会生成 ExecutableLearningTask。',
      '会生成 TaskGenerationRequest。',
      '保留 blockedReason 和 unmetPreferences。',
    ],
    taskRequest,
    fulfillmentResult: {
      request: fulfillmentRequest,
      blockedReason: undefined,
    },
    matchResult,
    branchResult,
    resources,
  };
}

function buildNoMatchCase(resources) {
  const taskRequest = buildTaskRequestFixture();
  const fulfillmentRequest = buildFulfillmentRequestFixture({
    sourceTaskRequestId: taskRequest.taskRequestId,
    sourceStrategyId: taskRequest.strategyId,
    targetAbilityId: '概括',
    requiredCapabilities: ['open_response', 'ability_observation', 'summary_extraction'],
  });
  const matchResult = matchTaskResources({
    fulfillmentRequest,
    availableTaskResources: resources,
  });
  const branchResult = branchTaskFulfillment({
    fulfillmentRequest,
    matchResult,
    availableTaskResources: resources,
    createdAt: phase84RunAt,
  });

  return {
    id: 'no_match',
    label: '没有匹配',
    description: '当前 mock 资源无法满足目标能力或核心能力要求。',
    expected: 'no_match 分支不生成 ExecutableLearningTask，而是生成 TaskGenerationRequest。',
    acceptancePoints: [
      'TaskResourceMatchResult status 为 no_match。',
      '不会生成 selectedTaskId。',
      '不会生成 ExecutableLearningTask。',
      '会生成 TaskGenerationRequest。',
    ],
    taskRequest,
    fulfillmentResult: {
      request: fulfillmentRequest,
      blockedReason: undefined,
    },
    matchResult,
    branchResult,
    resources,
  };
}

function buildInvalidTaskRequestCase(resources) {
  const fulfillmentResult = createTaskFulfillmentRequest({
    taskRequest: { taskRequestId: '' },
    createdAt: phase84RunAt,
  });

  return {
    id: 'invalid_task_request',
    label: '无效请求阻断',
    description: '无效 TaskRequest 不能进入资源匹配。',
    expected: 'fulfillment blocked，不生成 TaskFulfillmentRequest，不进入匹配与分流。',
    acceptancePoints: [
      'TaskFulfillmentRequest 为 null。',
      'blockedReason 明确说明输入无效。',
      '不进入 TaskResourceMatchResult。',
      '不生成 ExecutableLearningTask 或 TaskGenerationRequest。',
    ],
    taskRequest: { taskRequestId: '' },
    fulfillmentResult,
    matchResult: null,
    branchResult: {
      fulfillmentRequestId: 'blocked',
      executableTask: null,
      generationRequest: null,
      blockedReason: fulfillmentResult.blockedReason,
    },
    resources,
  };
}
