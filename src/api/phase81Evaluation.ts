import {
  normalizeAbilityEvidence,
  type AbilityEvidence,
} from '../ai/schemas/abilityEvidence.schema.ts';
import { evaluateAbilityEvidence } from '../ai/agents/evaluationAgent.ts';
import { decideProfileUpdate } from '../ai/agents/profileUpdateDecisionAgent.ts';
import { applyProfileUpdateDecision } from '../ai/agents/profileUpdateExecutor.ts';
import type { StudentAbilityProfile } from '../ai/schemas/studentAbilityProfile.schema.ts';

const studentId = 'demo-student';
const ability = '推理';
const runAt = '2026-07-11T08:40:00.000Z';

export function getPhase81EvaluationDemoData() {
  const cases = getPhase81EvaluationDemoCases();

  return {
    cases,
    defaultCaseId: 'improving',
  };
}

export function getPhase81EvaluationDemoCases() {
  return [
    buildDemoCase({
      id: 'insufficient',
      label: '证据不足',
      description: '全部证据都是 insufficient，只能追加证据或继续收集，不应更新长期状态。',
      expected: 'Profile 不改变长期状态，下一步继续收集有效证据。',
      acceptancePoints: [
        'EvaluationResult 应为 evidenceSufficiency = insufficient。',
        'ProfileUpdateDecision 应为 append_evidence_only。',
        'StudentAbilityProfile 的长期状态不应改变。',
      ],
      evidence: makeInsufficientEvidence(),
    }),
    buildDemoCase({
      id: 'early_signal',
      label: '早期改善',
      description: '存在历史 weakness 和训练 growth，但缺少独立复测，只能视为早期改善迹象。',
      expected: '只出现改善迹象，画像状态暂不改变；下一步需要独立复测。',
      acceptancePoints: [
        'EvaluationResult 应为 growthLevel = early_signal。',
        'ProfileUpdateDecision 应为 update_confidence。',
        'StudentAbilityProfile 不应更新为 improving。',
        '下一步应要求独立复测，而不是宣布能力提升。',
      ],
      evidence: makeEarlySignalEvidence(),
    }),
    buildDemoCase({
      id: 'improving',
      label: '改善较明确',
      description: '存在历史 weakness、训练 growth 和独立复测 growth，可以受控更新为 improving。',
      expected: '改善证据较充分，画像可受控更新为 improving；下一步需要迁移验证，不能直接判定稳定提升。',
      acceptancePoints: [
        'EvaluationResult 应为 growthLevel = improving。',
        'ProfileUpdateDecision 应为 update_status。',
        'StudentAbilityProfile 可以更新为 improving。',
        '下一步应保留迁移验证要求，不能输出 stable。',
      ],
      evidence: makeImprovingEvidence(),
    }),
    buildDemoCase({
      id: 'conflict',
      label: '证据冲突',
      description: '同一能力同时存在多条 weakness 和 positive，进入人工复核或复测。',
      expected: 'Profile 不应自动升级，下一步进入人工复核或独立复测。',
      acceptancePoints: [
        'EvaluationResult 应识别 significant conflict 或 fluctuating。',
        'ProfileUpdateDecision 应为 human_review 或 request_retest。',
        'StudentAbilityProfile 不应自动升级。',
      ],
      evidence: makeConflictEvidence(),
    }),
  ];
}

function buildDemoCase(input: {
  id: string;
  label: string;
  description: string;
  expected: string;
  acceptancePoints: string[];
  evidence: AbilityEvidence[];
}) {
  const evidence = input.evidence;
  const currentProfile = makeProfile();
  const evaluationResult = evaluateAbilityEvidence({
    studentId,
    targetAbility: ability,
    evidence,
    evaluatedAt: runAt,
  });
  const profileUpdateDecision = decideProfileUpdate({
    evaluationResult,
    currentProfile,
    decidedAt: runAt,
  });
  const executionResult = applyProfileUpdateDecision({
    currentProfile,
    decision: profileUpdateDecision,
    appliedAt: runAt,
  });

  return {
    id: input.id,
    label: input.label,
    description: input.description,
    expected: input.expected,
    acceptancePoints: input.acceptancePoints,
    evidence,
    currentProfile,
    evaluationResult,
    profileUpdateDecision,
    executionResult,
    updatedProfile: executionResult.afterProfile,
  };
}

function makeInsufficientEvidence(): AbilityEvidence[] {
  return [
    makeEvidenceItem('phase81-insufficient-1', 'insufficient', 'diagnosis', '学生答案没有提供可分析内容。', 0.35, 0),
    makeEvidenceItem('phase81-insufficient-2', 'insufficient', 'retest', '复测答案仍不足以形成能力判断。', 0.38, 1),
  ];
}

function makeEarlySignalEvidence(): AbilityEvidence[] {
  return [
    makeEvidenceItem('phase81-early-weak-1', 'weakness', 'diagnosis', '诊断中学生只写出结论，没有写出文本线索。', 0.74, 0),
    makeEvidenceItem('phase81-early-weak-2', 'weakness', 'training', '训练中学生需要提示后，才能找到一处相关线索。', 0.72, 1),
    makeEvidenceItem('phase81-early-growth-1', 'growth', 'training', '训练后学生开始尝试补充依据，但尚未经过独立复测验证。', 0.78, 2),
  ];
}

function makeImprovingEvidence(): AbilityEvidence[] {
  return [
    normalizeAbilityEvidence({
      id: 'phase81-weak-1',
      studentId,
      ability,
      evidenceType: 'weakness',
      source: 'diagnosis',
      detail: '答案缺少文本依据。',
      observation: '训练前学生给出心理判断，但没有呈现文本依据。',
      confidence: 0.76,
      createdAt: '2026-07-10T08:00:00.000Z',
    }),
    normalizeAbilityEvidence({
      id: 'phase81-weak-2',
      studentId,
      ability,
      evidenceType: 'weakness',
      source: 'training',
      detail: '训练中仍需要提示才能补充推理过程。',
      observation: '训练初期学生能定位线索，但还不能独立说明线索与结论的关系。',
      confidence: 0.72,
      createdAt: '2026-07-10T08:20:00.000Z',
    }),
    normalizeAbilityEvidence({
      id: 'phase81-growth-1',
      studentId,
      ability,
      evidenceType: 'growth',
      source: 'training',
      detail: '训练后能够补充依据和解释关系。',
      observation: '训练后学生能把文本线索和心理判断连接起来，形成较完整解释。',
      confidence: 0.78,
      createdAt: '2026-07-10T08:40:00.000Z',
    }),
    normalizeAbilityEvidence({
      id: 'phase81-retest-growth-1',
      studentId,
      ability,
      evidenceType: 'growth',
      source: 'retest',
      detail: '独立复测中能够解释文本依据与结论关系。',
      observation: '独立复测的新题中，学生无需提示也能写出依据、解释关系和结论。',
      confidence: 0.82,
      createdAt: '2026-07-10T09:00:00.000Z',
    }),
  ];
}

function makeConflictEvidence(): AbilityEvidence[] {
  return [
    makeEvidenceItem('phase81-conflict-weak-1', 'weakness', 'diagnosis', '学生在诊断中缺少文本依据。', 0.76, 0),
    makeEvidenceItem('phase81-conflict-weak-2', 'weakness', 'retest', '学生在复测中仍未说明依据与结论关系。', 0.74, 1),
    makeEvidenceItem('phase81-conflict-positive-1', 'positive', 'training', '训练中能够完整引用线索并说明关系。', 0.8, 2),
    makeEvidenceItem('phase81-conflict-positive-2', 'positive', 'retest', '另一次复测中能够独立完成推理说明。', 0.82, 3),
    makeEvidenceItem('phase81-conflict-growth-1', 'growth', 'training', '训练后相比起点出现改善迹象。', 0.78, 4),
  ];
}

function makeEvidenceItem(
  id: string,
  evidenceType: AbilityEvidence['evidenceType'],
  source: AbilityEvidence['source'],
  observation: string,
  confidence: number,
  index: number,
): AbilityEvidence {
  return normalizeAbilityEvidence({
    id,
    studentId,
    ability,
    evidenceType,
    source,
    detail: observation,
    observation,
    confidence,
    createdAt: `2026-07-10T08:${String(index).padStart(2, '0')}:00.000Z`,
  });
}

function makeProfile(): StudentAbilityProfile {
  return {
    studentId,
    generatedAt: '2026-07-10T07:50:00.000Z',
    current_weakness: {
      primary: ability,
      secondary: ['表达'],
    },
    ability_status: [{
      ability,
      status: 'weak',
      summary: '推理当前仍以薄弱证据为主。',
      weakness_count: 2,
      positive_count: 0,
      growth_count: 0,
      insufficient_count: 0,
      evidence_links: [{
        evidenceId: 'phase81-weak-1',
        ability,
        evidenceType: 'weakness',
        source: 'diagnosis',
        observation: '学生给出结论，但没有说明依据来自哪里。',
        confidence: 0.76,
      }],
    }],
    improvement_signals: [],
    continue_training_focus: '继续围绕推理进行文本依据与推理链训练。',
    evidence_links: [{
      evidenceId: 'phase81-weak-1',
      ability,
      evidenceType: 'weakness',
      source: 'diagnosis',
      observation: '学生给出结论，但没有说明依据来自哪里。',
      confidence: 0.76,
    }],
    next_step_recommendation: '继续围绕推理进行训练。',
  };
}
