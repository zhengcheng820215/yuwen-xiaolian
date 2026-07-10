import { useMemo, useState } from 'react';
import PageHeader from '../components/PageHeader.jsx';
import { generatePersonalizedNextTask } from '../ai/agents/personalizedNextTaskAgent.ts';
import { runPersonalizedTaskExecutionAgent } from '../ai/agents/personalizedTaskExecutionAgent.ts';
import { generateStudentAbilityProfile } from '../ai/agents/studentAbilityProfileAgent.ts';
import {
  rankWeaknessSummaries,
  summarizeAbilityEvidence,
} from '../ai/agents/weaknessRankingAgent.ts';
import { normalizeAbilityEvidence } from '../ai/schemas/abilityEvidence.schema.ts';

const studentId = 'phase52-demo-student';
const generatedAt = '2026-07-10T09:00:00.000Z';

const initialEvidence = [
  normalizeAbilityEvidence({
    id: 'phase52-demo-inference-001',
    studentId,
    ability: '推理',
    evidenceType: 'weakness',
    source: 'diagnosis',
    observation: '学生答案停留在表面行为，没有从文本线索推断人物心理。',
    rootCause: '学生尚未建立“文本行为线索 -> 人物心理 -> 结论表达”的推理链。',
    confidence: 0.82,
    createdAt: '2026-07-10T08:20:00.000Z',
  }),
  normalizeAbilityEvidence({
    id: 'phase52-demo-expression-001',
    studentId,
    ability: '表达',
    evidenceType: 'weakness',
    source: 'diagnosis',
    observation: '学生能够给出结论，但解释时缺少“观点 + 文本依据 + 说明”的完整结构。',
    rootCause: '表达链条不完整，容易只写结论。',
    confidence: 0.68,
    createdAt: '2026-07-10T08:25:00.000Z',
  }),
  normalizeAbilityEvidence({
    id: 'phase52-demo-summary-001',
    studentId,
    ability: '概括',
    evidenceType: 'positive',
    source: 'diagnosis',
    observation: '学生能够抓住人物和主要事件，完成简短概括。',
    confidence: 0.76,
    createdAt: '2026-07-10T08:30:00.000Z',
  }),
];

const defaultStudentAnswer = '父亲看到旧书和树叶时停了很久，说明他想起以前和孩子一起读书的时光，所以内心有不舍、怀念和牵挂。';

export default function PersonalizedTaskExecutionDemo() {
  const [studentAnswer, setStudentAnswer] = useState(defaultStudentAnswer);
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
      const executionResult = await runPersonalizedTaskExecutionAgent({
        studentId,
        studentAbilityProfile: runtimeState.studentAbilityProfile,
        evidenceSummary: runtimeState.evidenceSummary,
        updatedEvidence: initialEvidence,
        personalizedNextTask: runtimeState.personalizedNextTask,
        studentAnswer,
        createdAt: new Date().toISOString(),
      });

      setResult(executionResult);
    } catch (runError) {
      setError(runError instanceof Error ? runError.message : 'Phase 5.2 Demo 运行失败。');
    } finally {
      setRunning(false);
    }
  }

  const task = runtimeState.personalizedNextTask;
  const diagnosis = result?.diagnosisResult;
  const summary = result?.taskExecutionSummary;

  return (
    <div className="min-h-screen bg-[#f5f7fb]">
      <PageHeader
        title="个性化任务执行回流 Demo"
        subtitle="Phase 5.2：任务作答 → 回流诊断 → 能力证据更新 → 下一步决策"
        back
      />

      <main className="space-y-4 px-4 pb-8">
        <section className="rounded-md border border-blue-200 bg-blue-50 p-4">
          <p className="text-sm font-semibold text-blue-700">训练前优先薄弱能力</p>
          <h2 className="mt-1 text-2xl font-semibold text-slate-950">
            {runtimeState.studentAbilityProfile.current_weakness.primary}
          </h2>
          <p className="mt-2 text-sm leading-6 text-slate-700">
            当前 Demo 固定带入 {initialEvidence.length} 条历史 evidence，用于验证 Phase 5.2 的任务执行回流链路。
          </p>
        </section>

        <section className="rounded-md border border-slate-200 bg-white p-4">
          <h2 className="text-base font-semibold text-slate-950">训练前状态</h2>
          <div className="mt-3 grid gap-3 text-sm">
            <InfoLine label="current_weakness" value={`${runtimeState.studentAbilityProfile.current_weakness.primary} / 次级观察：${runtimeState.studentAbilityProfile.current_weakness.secondary.join('、') || '暂无'}`} />
            <EvidenceList title="历史能力证据" items={initialEvidence} />
            <TopWeaknessList items={runtimeState.topWeakness} />
          </div>
        </section>

        <section className="rounded-md border border-slate-200 bg-white p-4">
          <h2 className="text-base font-semibold text-slate-950">个性化任务</h2>
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
          <div className="mt-3 rounded-md border border-slate-200 bg-slate-50 p-3 text-sm leading-6 text-slate-600">
            当前页面默认使用 Dry Run 回流诊断，重点验收 Phase 5.2 的 Runtime 数据链路。
          </div>
          <label className="mt-3 block text-sm">
            <span className="font-semibold text-slate-700">模拟学生答案</span>
            <textarea
              value={studentAnswer}
              rows={5}
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
            {running ? '回流诊断中...' : '提交并回流诊断'}
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
              <h2 className="text-base font-semibold text-slate-950">能力证据更新</h2>
              <div className="mt-3 grid gap-3 text-sm">
                <InfoLine label="updatedEvidence" value={`${initialEvidence.length} -> ${result.updatedEvidence.length}`} />
                <InfoLine label="diagnosisFocusMatch" value={result.diagnosisFocusMatch ? '是' : '否，进入 REVIEW'} />
                <InfoBlock
                  title="newAbilityEvidence"
                  value={`${result.newAbilityEvidence.id}\n${result.newAbilityEvidence.ability} / ${formatEvidenceType(result.newAbilityEvidence.evidenceType)} / ${formatPercent(result.newAbilityEvidence.confidence)}\n${result.newAbilityEvidence.observation}`}
                />
              </div>
            </section>

            <section className="rounded-md border border-slate-200 bg-white p-4">
              <h2 className="text-base font-semibold text-slate-950">任务执行摘要</h2>
              <div className="mt-3 grid gap-3 text-sm">
                <InfoBlock title="before" value={`target_ability: ${summary.before.target_ability}\nstatus: ${summary.before.status}\nweakness: ${summary.before.weakness_evidence_count}\ngrowth: ${summary.before.growth_evidence_count}\nreason: ${summary.before.reason}`} />
                <InfoBlock title="execution" value={`task_id: ${summary.execution.task_id}\ndiagnosis_main_ability: ${summary.execution.diagnosis_main_ability}\ndiagnosis_focus_match: ${summary.execution.diagnosis_focus_match ? 'true' : 'false'}\nnew_evidence_type: ${summary.execution.new_evidence_type}`} />
                <InfoBlock title="after" value={`target_ability: ${summary.after.target_ability}\nevidence_updated: ${summary.after.evidence_updated ? 'true' : 'false'}\nstatus: ${summary.after.status}\nweakness: ${summary.after.weakness_evidence_count}\ngrowth: ${summary.after.growth_evidence_count}`} />
                <InfoLine label="review_status" value={summary.review_status} />
                <InfoBlock title="review_reason" value={summary.review_reason} />
                <InfoLine label="next_decision" value={formatNextDecision(summary.next_decision)} />
                <InfoBlock title="decision_reason" value={summary.decision_reason} />
              </div>
            </section>

            <section className="rounded-md border border-slate-200 bg-white p-4">
              <h2 className="text-base font-semibold text-slate-950">更新后学生能力画像</h2>
              <div className="mt-3 grid gap-3 text-sm">
                <InfoLine
                  label="current_weakness"
                  value={`${result.updatedStudentAbilityProfile.current_weakness.primary} / 次级观察：${result.updatedStudentAbilityProfile.current_weakness.secondary.join('、') || '暂无'}`}
                />
                <InfoBlock title="continue_training_focus" value={result.updatedStudentAbilityProfile.continue_training_focus} />
                <InfoBlock title="next_step_recommendation" value={result.updatedStudentAbilityProfile.next_step_recommendation} />
                <AbilityStatusList items={result.updatedStudentAbilityProfile.ability_status} />
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
                  updatedStudentAbilityProfile: result.updatedStudentAbilityProfile,
                  taskExecutionSummary: result.taskExecutionSummary,
                  next_decision: result.next_decision,
                }, null, 2)}
              </pre>
            </section>
          </>
        ) : null}
      </main>
    </div>
  );
}

function InfoLine({ label, value }) {
  return (
    <div className="rounded-md bg-slate-50 p-3">
      <span className="font-semibold text-slate-500">{label}</span>
      <span className="ml-2 whitespace-pre-wrap text-slate-950">{value}</span>
    </div>
  );
}

function InfoBlock({ title, value }) {
  return (
    <div className="rounded-md bg-slate-50 p-3">
      <div className="font-semibold text-slate-500">{title}</div>
      <p className="mt-2 whitespace-pre-wrap leading-6 text-slate-950">{value}</p>
    </div>
  );
}

function ListBlock({ title, items }) {
  return (
    <div className="rounded-md bg-slate-50 p-3">
      <div className="font-semibold text-slate-500">{title}</div>
      <ul className="mt-2 list-disc space-y-1 pl-5 leading-6 text-slate-950">
        {items.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
    </div>
  );
}

function EvidenceList({ title, items }) {
  return (
    <div className="rounded-md bg-slate-50 p-3">
      <div className="font-semibold text-slate-950">{title}（{items.length}）</div>
      <div className="mt-2 grid gap-2">
        {items.map((item) => (
          <article key={item.id} className="rounded-md bg-white p-3 leading-6">
            <div className="font-semibold text-slate-950">
              {item.ability} / {formatEvidenceType(item.evidenceType)} / {formatPercent(item.confidence)}
            </div>
            <p className="text-slate-600">{item.observation}</p>
            {item.rootCause ? <p className="text-slate-500">根本原因：{item.rootCause}</p> : null}
          </article>
        ))}
      </div>
    </div>
  );
}

function TopWeaknessList({ items }) {
  return (
    <div className="rounded-md bg-slate-50 p-3">
      <div className="font-semibold text-slate-950">Top Weakness</div>
      <div className="mt-2 grid gap-2">
        {items.map((item, index) => (
          <article key={item.ability} className="rounded-md bg-white p-3 leading-6">
            <div className="font-semibold text-slate-950">
              {index + 1}. {item.ability} / 优先级 {item.priority}
            </div>
            <p className="text-slate-600">{item.suggestedTrainingFocus}</p>
          </article>
        ))}
      </div>
    </div>
  );
}

function LinkedEvidenceBlock({ items }) {
  return (
    <div className="rounded-md bg-slate-50 p-3">
      <div className="font-semibold text-slate-500">linked_evidence</div>
      <div className="mt-2 grid gap-2">
        {items.map((item) => (
          <article key={item.evidence_id} className="rounded-md bg-white p-3 leading-6">
            <div className="font-semibold text-slate-950">
              {item.evidence_id} / {item.ability} / {formatEvidenceType(item.evidence_type)}
            </div>
            <p className="text-slate-600">{item.reason}</p>
          </article>
        ))}
      </div>
    </div>
  );
}

function AbilityStatusList({ items }) {
  return (
    <div className="rounded-md bg-slate-50 p-3">
      <div className="font-semibold text-slate-500">ability_status</div>
      <div className="mt-2 grid gap-2">
        {items.map((item) => (
          <article key={item.ability} className="rounded-md bg-white p-3 leading-6">
            <div className="font-semibold text-slate-950">
              {item.ability} / {formatAbilityStatus(item.status)}
            </div>
            <p className="text-slate-600">{item.summary}</p>
            <p className="text-slate-500">
              weakness {item.weakness_count} / positive {item.positive_count} / growth {item.growth_count} / insufficient {item.insufficient_count}
            </p>
          </article>
        ))}
      </div>
    </div>
  );
}

function formatPercent(value) {
  return `${Math.round((Number(value) || 0) * 100)}%`;
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

function formatAbilityStatus(value) {
  const labels = {
    weak: '薄弱',
    improving: '改善中',
    stable_positive: '相对稳定',
    insufficient_evidence: '证据不足',
  };
  return labels[value] || value || '未知';
}

function formatAnswerStatus(value) {
  const labels = {
    fully_meets: '完整满足',
    partially_meets: '部分满足',
    does_not_meet: '未满足',
    insufficient_evidence: '证据不足',
  };
  return labels[value] || value || '未知';
}

function formatNextDecision(value) {
  const labels = {
    continue_reinforcement: '继续强化',
    increase_difficulty: '提高难度',
    switch_ability: '切换能力',
    retest: '复测验证',
  };
  return labels[value] || value || '未知';
}
