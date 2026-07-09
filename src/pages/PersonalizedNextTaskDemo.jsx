import { useMemo, useState } from 'react';
import PageHeader from '../components/PageHeader.jsx';
import { runRealAIDiagnosisLoop } from '../ai/agents/realAIDiagnosisAgent.ts';
import { generatePersonalizedNextTask } from '../ai/agents/personalizedNextTaskAgent.ts';
import { generateStudentAbilityProfile } from '../ai/agents/studentAbilityProfileAgent.ts';
import {
  rankWeaknessSummaries,
  summarizeAbilityEvidence,
} from '../ai/agents/weaknessRankingAgent.ts';
import { normalizeAbilityEvidence } from '../ai/schemas/abilityEvidence.schema.ts';

const studentId = 'phase51-demo-student';
const generatedAt = '2026-07-09T16:00:00.000Z';
const initialEvidence = [
  normalizeAbilityEvidence({
    id: 'phase51-demo-inference-001',
    studentId,
    ability: '推理',
    evidenceType: 'weakness',
    source: 'diagnosis',
    observation: '学生答案停留在表面行为，没有从文本线索推断人物心理。',
    rootCause: '学生尚未建立“文本行为线索 -> 人物心理 -> 结论表达”的推理链。',
    confidence: 0.82,
    createdAt: '2026-07-09T15:20:00.000Z',
  }),
  normalizeAbilityEvidence({
    id: 'phase51-demo-expression-001',
    studentId,
    ability: '表达',
    evidenceType: 'weakness',
    source: 'diagnosis',
    observation: '学生能够给出结论，但解释时缺少“观点 + 文本依据 + 说明”的完整结构。',
    rootCause: '表达链条不完整，容易只写结论。',
    confidence: 0.68,
    createdAt: '2026-07-09T15:25:00.000Z',
  }),
  normalizeAbilityEvidence({
    id: 'phase51-demo-summary-001',
    studentId,
    ability: '概括',
    evidenceType: 'positive',
    source: 'diagnosis',
    observation: '学生能够抓住人物和主要事件，完成简短概括。',
    confidence: 0.76,
    createdAt: '2026-07-09T15:30:00.000Z',
  }),
];

const defaultStudentAnswer = '父亲很喜欢整理东西。';

export default function PersonalizedNextTaskDemo() {
  const [studentAnswer, setStudentAnswer] = useState(defaultStudentAnswer);
  const [runMode, setRunMode] = useState('dry_run');
  const [deepSeekApiKey, setDeepSeekApiKey] = useState('');
  const [deepSeekModel, setDeepSeekModel] = useState('deepseek-v4-flash');
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');
  const [running, setRunning] = useState(false);

  const runtimeState = useMemo(() => {
    const evidenceSummary = summarizeAbilityEvidence(initialEvidence);
    const topWeakness = rankWeaknessSummaries(evidenceSummary, 3);
    const studentAbilityProfile = generateStudentAbilityProfile({
      studentId,
      evidenceSummary,
      topWeakness,
      evidence: initialEvidence,
      generatedAt,
    });
    const personalizedNextTask = generatePersonalizedNextTask({
      studentAbilityProfile,
      topWeakness,
      evidenceSummary,
      updatedEvidence: initialEvidence,
      generatedAt,
    });

    return {
      evidenceSummary,
      topWeakness,
      studentAbilityProfile,
      personalizedNextTask,
    };
  }, []);

  async function handleRun() {
    setRunning(true);
    setError('');

    try {
      if (runMode === 'deepseek' && !deepSeekApiKey.trim()) {
        throw new Error('请先输入 DeepSeek API Key，或切换为 Dry Run。');
      }

      const loopInput = {
        studentId,
        question: runtimeState.personalizedNextTask.question,
        referenceAnswer: buildReferenceAnswer(runtimeState.personalizedNextTask),
        studentAnswer,
        previousEvidence: initialEvidence,
        taskId: runtimeState.personalizedNextTask.task_id,
        diagnosisId: `phase51-demo-diagnosis-${Date.now()}`,
        createdAt: new Date().toISOString(),
      };
      const loopResult = runMode === 'deepseek'
        ? await runRealAIDiagnosisLoop(loopInput, buildDeepSeekDemoCaller({
          apiKey: deepSeekApiKey.trim(),
          model: deepSeekModel.trim() || 'deepseek-v4-flash',
        }))
        : await runRealAIDiagnosisLoop(loopInput, buildPhase51DryRunCaller(runtimeState.personalizedNextTask));

      setResult(loopResult);
    } catch (runError) {
      setError(runError instanceof Error ? runError.message : 'Phase 5.1 Demo 运行失败。');
    } finally {
      setRunning(false);
    }
  }

  const task = runtimeState.personalizedNextTask;
  const diagnosis = result?.diagnosisResult;
  const updatedProfile = result?.studentAbilityProfile;

  return (
    <div className="min-h-screen bg-[#f5f7fb]">
      <PageHeader
        title="个性化下一步任务 Demo"
        subtitle="Phase 5.1：学生画像 → 下一步任务 → 作答 → 回流诊断 → 画像更新"
        back
      />

      <main className="space-y-4 px-4 pb-8">
        <section className="rounded-md border border-blue-200 bg-blue-50 p-4">
          <p className="text-sm font-semibold text-blue-700">当前优先薄弱能力</p>
          <h2 className="mt-1 text-2xl font-semibold text-slate-950">
            {runtimeState.studentAbilityProfile.current_weakness.primary}
          </h2>
          <p className="mt-2 text-sm leading-6 text-slate-700">
            次级观察：{runtimeState.studentAbilityProfile.current_weakness.secondary.join('、') || '暂无'}
          </p>
        </section>

        <section className="rounded-md border border-slate-200 bg-white p-4">
          <h2 className="text-base font-semibold text-slate-950">当前 Runtime 状态</h2>
          <div className="mt-3 grid gap-3">
            <SummaryBlock title="Evidence Summary" summaries={runtimeState.evidenceSummary} />
            <TopWeaknessBlock items={runtimeState.topWeakness} />
          </div>
        </section>

        <section className="rounded-md border border-slate-200 bg-white p-4">
          <h2 className="text-base font-semibold text-slate-950">个性化下一步任务</h2>
          <div className="mt-3 grid gap-3 text-sm">
            <InfoLine label="target_ability" value={task.target_ability} />
            <InfoBlock title="task_goal" value={task.task_goal} />
            <InfoBlock title="why_this_task" value={task.why_this_task} />
            <InfoBlock title="question" value={task.question} />
            <ListBlock title="answer_requirements" items={task.answer_requirements} />
            <ListBlock title="success_criteria" items={task.success_criteria} />
            <LinkedEvidenceBlock items={task.linked_evidence} />
          </div>
        </section>

        <section className="rounded-md border border-slate-200 bg-white p-4">
          <h2 className="text-base font-semibold text-slate-950">学生作答</h2>
          <div className="mt-3 grid gap-3">
            <RunModeSwitch value={runMode} onChange={setRunMode} />
            {runMode === 'deepseek' ? (
              <div className="grid gap-3 rounded-md border border-blue-100 bg-blue-50 p-3">
                <TextInput
                  label="DeepSeek API Key（仅当前页面内存使用，不写入代码）"
                  value={deepSeekApiKey}
                  onChange={setDeepSeekApiKey}
                  type="password"
                  placeholder="sk-..."
                />
                <TextInput
                  label="DeepSeek 模型"
                  value={deepSeekModel}
                  onChange={setDeepSeekModel}
                  placeholder="deepseek-v4-flash"
                />
              </div>
            ) : (
              <div className="rounded-md border border-slate-200 bg-slate-50 p-3 text-sm leading-6 text-slate-600">
                Dry Run 会根据答案是否包含文本线索、心理判断和理由说明，生成不同的诊断结果。
              </div>
            )}
          </div>
          <label className="mt-3 block text-sm">
            <span className="font-semibold text-slate-700">模拟学生答案</span>
            <textarea
              value={studentAnswer}
              rows={4}
              onChange={(event) => setStudentAnswer(event.target.value)}
              className="mt-2 w-full resize-y rounded-md border border-slate-200 bg-slate-50 p-3 leading-6 text-slate-950 outline-none focus:border-blue-500"
            />
          </label>
          <button
            type="button"
            onClick={handleRun}
            disabled={running}
            className="mt-4 w-full rounded-md bg-blue-600 px-4 py-3 text-base font-semibold text-white disabled:bg-slate-400"
          >
            {running ? '回流诊断中...' : runMode === 'deepseek' ? '提交并用真实 AI 回流诊断' : '提交并用 Dry Run 回流诊断'}
          </button>
          {error ? (
            <div className="mt-3 rounded-md border border-red-200 bg-red-50 p-3 text-sm leading-6 text-red-700">
              {error}
            </div>
          ) : null}
        </section>

        {result ? (
          <>
            <section className="rounded-md border border-slate-200 bg-white p-4">
              <h2 className="text-base font-semibold text-slate-950">回流诊断结果</h2>
              <div className="mt-3 grid gap-3 text-sm">
                <InfoLine label="mainAbility" value={diagnosis.mainAbility} />
                <InfoLine label="answerStatus" value={formatAnswerStatus(diagnosis.answerStatus)} />
                <InfoLine label="confidence" value={formatPercent(diagnosis.confidence)} />
                <InfoBlock title="rootCause" value={diagnosis.rootCause} />
                <InfoBlock title="abilityEvidence" value={diagnosis.abilityEvidence.join('\n')} />
                <InfoBlock title="nextTraining" value={diagnosis.nextTraining} />
              </div>
            </section>

            <section className="rounded-md border border-slate-200 bg-white p-4">
              <h2 className="text-base font-semibold text-slate-950">Evidence 回流</h2>
              <div className="mt-3 grid gap-3 text-sm">
                <InfoLine label="updatedEvidence" value={`${initialEvidence.length} -> ${result.updatedEvidence.length}`} />
                <InfoBlock title="newAbilityEvidence" value={`${result.newAbilityEvidence.id}\n${result.newAbilityEvidence.ability} / ${formatEvidenceType(result.newAbilityEvidence.evidenceType)} / ${formatPercent(result.newAbilityEvidence.confidence)}\n${result.newAbilityEvidence.observation}`} />
              </div>
            </section>

            <section className="rounded-md border border-slate-200 bg-white p-4">
              <h2 className="text-base font-semibold text-slate-950">更新后的学生能力画像</h2>
              <div className="mt-3 grid gap-3 text-sm">
                <InfoLine
                  label="current_weakness"
                  value={`${updatedProfile.current_weakness.primary} / 次级观察：${updatedProfile.current_weakness.secondary.join('、') || '暂无'}`}
                />
                <InfoBlock title="continue_training_focus" value={updatedProfile.continue_training_focus} />
                <InfoBlock title="next_step_recommendation" value={updatedProfile.next_step_recommendation} />
                <AbilityStatusList items={updatedProfile.ability_status} />
              </div>
            </section>

            <section className="rounded-md border border-slate-200 bg-white p-4">
              <h2 className="text-base font-semibold text-slate-950">Stable JSON</h2>
              <pre className="mt-3 max-h-[420px] overflow-auto rounded-md bg-slate-950 p-3 text-xs leading-5 text-slate-50">
                {JSON.stringify({
                  personalizedNextTask: task,
                  studentAnswer,
                  diagnosisResult: diagnosis,
                  newAbilityEvidence: result.newAbilityEvidence,
                  updatedEvidenceCount: result.updatedEvidence.length,
                  updatedStudentAbilityProfile: updatedProfile,
                }, null, 2)}
              </pre>
            </section>
          </>
        ) : null}
      </main>
    </div>
  );
}

function SummaryBlock({ title, summaries }) {
  return (
    <div className="rounded-md bg-slate-50 p-3 text-sm">
      <p className="font-semibold text-slate-900">{title}</p>
      <div className="mt-2 space-y-1 leading-6 text-slate-600">
        {summaries.map((summary) => (
          <div key={summary.ability}>
            {summary.ability}: weakness {summary.weaknessCount}, positive {summary.positiveCount}, growth {summary.growthCount}, avg {formatPercent(summary.averageConfidence)}
          </div>
        ))}
      </div>
    </div>
  );
}

function TopWeaknessBlock({ items }) {
  return (
    <div className="rounded-md bg-slate-50 p-3 text-sm">
      <p className="font-semibold text-slate-900">Top Weakness</p>
      <div className="mt-2 space-y-2 leading-6 text-slate-600">
        {items.map((item, index) => (
          <div key={item.ability}>
            {index + 1}. {item.ability} / priority {item.priority} / {item.suggestedTrainingFocus}
          </div>
        ))}
      </div>
    </div>
  );
}

function LinkedEvidenceBlock({ items }) {
  return (
    <div className="rounded-md bg-slate-50 p-3">
      <div className="font-semibold text-slate-500">linked_evidence</div>
      <div className="mt-2 space-y-2 leading-6 text-slate-800">
        {items.map((item) => (
          <div key={item.evidence_id}>
            {item.evidence_id} / {item.ability} / {formatEvidenceType(item.evidence_type)}
            <div className="text-slate-600">{item.reason}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

function AbilityStatusList({ items }) {
  return (
    <div className="rounded-md bg-slate-50 p-3">
      <div className="font-semibold text-slate-500">ability_status</div>
      <div className="mt-2 space-y-2">
        {items.map((item) => (
          <div key={item.ability} className="rounded-md bg-white p-3 leading-6">
            <div className="font-semibold text-slate-950">
              {item.ability} / {formatAbilityStatus(item.status)}
            </div>
            <p className="text-slate-600">{item.summary}</p>
            <p className="text-slate-500">
              weakness {item.weakness_count} / positive {item.positive_count} / growth {item.growth_count}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}

function InfoLine({ label, value }) {
  return (
    <div className="rounded-md bg-slate-50 p-3">
      <span className="font-semibold text-slate-500">{label}</span>
      <span className="ml-2 text-slate-950">{value}</span>
    </div>
  );
}

function InfoBlock({ title, value }) {
  return (
    <div className="rounded-md bg-slate-50 p-3">
      <div className="font-semibold text-slate-500">{title}</div>
      <p className="mt-1 whitespace-pre-line leading-6 text-slate-800">{value || '暂无'}</p>
    </div>
  );
}

function ListBlock({ title, items }) {
  return (
    <div className="rounded-md bg-slate-50 p-3">
      <div className="font-semibold text-slate-500">{title}</div>
      <ul className="mt-2 list-disc space-y-2 pl-5 leading-6 text-slate-800">
        {items.map((item, index) => (
          <li key={`${item}-${index}`}>{item}</li>
        ))}
      </ul>
    </div>
  );
}

function TextInput({ label, value, onChange, type = 'text', placeholder = '' }) {
  return (
    <label className="block text-sm">
      <span className="font-semibold text-slate-700">{label}</span>
      <input
        type={type}
        value={value}
        placeholder={placeholder}
        onChange={(event) => onChange(event.target.value)}
        className="mt-2 w-full rounded-md border border-slate-200 bg-slate-50 p-3 text-slate-950 outline-none focus:border-blue-500"
      />
    </label>
  );
}

function RunModeSwitch({ value, onChange }) {
  const options = [
    { value: 'dry_run', label: 'Dry Run', description: '本地最小判断，适合快速体验答案变化。' },
    { value: 'deepseek', label: '真实 AI', description: '调用 DeepSeek，适合验证真实诊断质量。' },
  ];

  return (
    <div className="grid grid-cols-2 gap-2 rounded-md bg-slate-100 p-1">
      {options.map((option) => {
        const selected = value === option.value;

        return (
          <button
            key={option.value}
            type="button"
            onClick={() => onChange(option.value)}
            className={`rounded-md px-3 py-2 text-left text-sm transition ${
              selected
                ? 'bg-white font-semibold text-blue-700 shadow-sm'
                : 'text-slate-600'
            }`}
          >
            <span className="block">{option.label}</span>
            <span className="mt-1 block text-xs font-normal leading-5 text-slate-500">
              {option.description}
            </span>
          </button>
        );
      })}
    </div>
  );
}

function buildReferenceAnswer(task) {
  return [
    task.reference_answer,
    `评分要点：${task.scoring_points.join('；')}`,
    `成功标准：${task.success_criteria.join('；')}`,
  ].join('\n');
}

function formatPercent(value) {
  return `${Math.round((Number(value) || 0) * 100)}%`;
}

function formatAnswerStatus(value) {
  const labels = {
    fully_meets: '完整满足',
    partially_meets: '部分满足',
    does_not_meet: '未满足',
    insufficient_evidence: '证据不足',
  };
  return labels[value] || value || '暂无';
}

function formatEvidenceType(value) {
  const labels = {
    weakness: '薄弱证据',
    positive: '正向证据',
    growth: '成长证据',
    insufficient: '证据不足',
  };
  return labels[value] || value || '未知';
}

function buildPhase51DryRunCaller(task) {
  return async (_prompt, input) => {
    const answer = input.studentAnswer || '';
    const hasTextClue = /旧书|树叶|反复整理|停了很久|文本|线索/.test(answer);
    const hasPsychology = /不舍|怀念|牵挂|珍惜|回忆|想起|心理|舍不得/.test(answer);
    const hasReasoning = /所以|因为|说明|由此|可以推断|能看出/.test(answer);
    const score = [hasTextClue, hasPsychology, hasReasoning].filter(Boolean).length;

    if (score >= 3) {
      return JSON.stringify({
        taskType: 'open_response',
        correct: true,
        strategyUsed: 'phase5_1_demo_dry_run_answer_sensitive',
        answerStatus: 'fully_meets',
        scoreBand: 'high',
        mainAbility: task.target_ability,
        relatedAbilities: ['信息提取', '理解', '推理', '表达'],
        surfaceError: '本次作答没有明显表面错误。',
        rootCause: '本次作答已经能够从文本线索推断人物心理，并说明理由；暂不生成补弱型 rootCause。',
        errorType: '待验证',
        abilityEvidence: [
          '学生答案提取了“旧书、树叶、停了很久”等文本线索。',
          '学生答案能够把文本线索与“不舍、怀念、牵挂”等人物心理建立联系。',
          '学生答案包含理由说明，基本形成“线索 -> 心理 -> 说明”的推理链。',
        ],
        diagnosisSummary: '本次 Dry Run 诊断表明，学生能够完成推理任务的关键步骤，可形成正向能力证据。',
        nextTraining: '进入同能力变式推理任务，验证学生是否能稳定迁移“文本线索 -> 心理判断 -> 理由说明”。',
        confidence: 0.78,
      });
    }

    if (score >= 2) {
      return JSON.stringify({
        taskType: 'open_response',
        correct: false,
        strategyUsed: 'phase5_1_demo_dry_run_answer_sensitive',
        answerStatus: 'partially_meets',
        scoreBand: 'medium',
        mainAbility: task.target_ability,
        relatedAbilities: ['信息提取', '理解', '推理', '表达'],
        surfaceError: '学生答案包含部分线索或心理判断，但推理说明不够完整。',
        rootCause: '学生已触及文本线索或人物心理，但尚未稳定完成“线索 -> 心理 -> 说明”的完整推理链。',
        errorType: '推理错误',
        abilityEvidence: [
          '学生答案已经出现部分文本线索或心理判断。',
          '学生答案仍缺少充分说明，未完整解释线索如何支持心理结论。',
        ],
        diagnosisSummary: '本次 Dry Run 诊断表明，学生在推理任务上部分满足要求，但推理链表达仍需巩固。',
        nextTraining: '继续练习“引用文本线索 + 说明线索如何支持心理判断”的推理链表达。',
        confidence: 0.68,
      });
    }

    return JSON.stringify({
      taskType: 'open_response',
      correct: false,
      strategyUsed: 'phase5_1_demo_dry_run_answer_sensitive',
      answerStatus: 'does_not_meet',
      scoreBand: 'low',
      mainAbility: task.target_ability,
      relatedAbilities: ['信息提取', '理解', '推理', '表达'],
      surfaceError: '学生答案停留在表面行为描述，没有从文本线索推断人物心理。',
      rootCause: '学生尚未建立“文本行为线索 -> 人物心理 -> 结论表达”的推理链。',
      errorType: '推理错误',
      abilityEvidence: [
        '学生答案没有提取“旧书、树叶、停了很久”等关键文本线索。',
        '学生答案没有说明父亲的不舍、怀念或牵挂等心理。',
        '学生答案未形成从文本线索到心理结论的推理链。',
      ],
      diagnosisSummary: '本次 Dry Run 诊断表明，学生能够注意到人物行为，但未能把行为转化为心理推断。',
      nextTraining: '进入基于文本依据的推理链训练，重点练习“行为线索 -> 心理判断 -> 文本依据说明”。',
      confidence: 0.7,
    });
  };
}

function buildDeepSeekDemoCaller({ apiKey, model }) {
  return async (prompt) => {
    const response = await fetch('/__demo/deepseek-chat', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        apiKey,
        model,
        prompt,
      }),
    });

    const payload = await response.json().catch(() => ({}));

    if (!response.ok) {
      throw new Error(payload.error || `DeepSeek Demo 调用失败：${response.status}`);
    }

    if (!payload.content) {
      throw new Error('DeepSeek 返回内容为空。');
    }

    return payload.content;
  };
}

function formatAbilityStatus(value) {
  const labels = {
    weak: '薄弱',
    improving: '改善中',
    stable_positive: '相对稳定',
    insufficient_evidence: '证据不足',
  };
  return labels[value] || value || '未知';
}
