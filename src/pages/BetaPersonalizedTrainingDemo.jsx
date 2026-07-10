import { useEffect, useMemo, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import PageHeader from '../components/PageHeader.jsx';
import {
  learningEntryMockDiagnosisCaller,
  runLearningEntryAgent,
} from '../ai/agents/learningEntryAgent.ts';
import { generatePersonalizedNextTask } from '../ai/agents/personalizedNextTaskAgent.ts';
import {
  personalizedTrainingFlowMockDiagnosisCaller,
  runPersonalizedTrainingFlowAgent,
} from '../ai/agents/personalizedTrainingFlowAgent.ts';
import {
  rankWeaknessSummaries,
  summarizeAbilityEvidence,
} from '../ai/agents/weaknessRankingAgent.ts';

const studentId = 'beta-demo-student';
const entryQuestion = '阅读片段：父亲反复整理旧书，翻到“我”小时候夹在书里的树叶时，停了很久。由此可以推断出父亲怎样的心理？请结合文本线索说明理由。';
const entryReferenceAnswer = '可以推断父亲看到旧书和树叶后想起与孩子共同读书的回忆，内心有不舍、珍惜和牵挂。理由应结合“反复整理旧书”“停了很久”等文本线索说明。';
const entryWeakAnswer = '父亲很喜欢整理东西。';
const defaultTaskAnswer = '父亲反复整理旧书，翻到我小时候夹在书里的树叶时停了很久，说明他想起以前和孩子一起读书的时光，所以内心有不舍、怀念和牵挂。';
const answerSamples = [
  {
    label: '训练完成较好',
    value: defaultTaskAnswer,
  },
  {
    label: '训练部分完成',
    value: '父亲看到旧书和树叶，心里很怀念以前，也很牵挂孩子。',
  },
  {
    label: '训练仍薄弱',
    value: '父亲很喜欢整理东西。',
  },
];

export default function BetaPersonalizedTrainingDemo() {
  const location = useLocation();
  const routedEntryResult = location.state?.learningEntryResult || null;
  const [learningEntryResult, setLearningEntryResult] = useState(routedEntryResult);
  const [loadingEntry, setLoadingEntry] = useState(!routedEntryResult);
  const [studentTaskAnswer, setStudentTaskAnswer] = useState(defaultTaskAnswer);
  const [result, setResult] = useState(null);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (routedEntryResult) return;

    let cancelled = false;

    async function prepareDemoEntry() {
      setLoadingEntry(true);
      try {
        const entry = await runLearningEntryAgent({
          studentId,
          question: entryQuestion,
          referenceAnswer: entryReferenceAnswer,
          studentAnswer: entryWeakAnswer,
          diagnosisCaller: learningEntryMockDiagnosisCaller,
          createdAt: new Date().toISOString(),
        });

        if (!cancelled) setLearningEntryResult(entry);
      } catch (entryError) {
        if (!cancelled) {
          setError(entryError instanceof Error ? entryError.message : '生成 7.1 演示入口失败。');
        }
      } finally {
        if (!cancelled) setLoadingEntry(false);
      }
    }

    prepareDemoEntry();

    return () => {
      cancelled = true;
    };
  }, [routedEntryResult]);

  const personalizedTask = useMemo(() => {
    if (!learningEntryResult) return null;

    const evidenceSummary = summarizeAbilityEvidence(learningEntryResult.updated_evidence);
    const topWeakness = rankWeaknessSummaries(evidenceSummary, 3);

    return generatePersonalizedNextTask({
      studentAbilityProfile: learningEntryResult.student_ability_profile,
      topWeakness,
      evidenceSummary,
      updatedEvidence: learningEntryResult.updated_evidence,
      generatedAt: '2026-07-10T14:10:00.000Z',
    });
  }, [learningEntryResult]);

  async function handleSubmit() {
    if (!learningEntryResult || !personalizedTask) return;

    setRunning(true);
    setError('');

    try {
      const trainingFlowResult = await runPersonalizedTrainingFlowAgent({
        learningEntryResult,
        personalizedTask,
        studentTaskAnswer,
        diagnosisCaller: personalizedTrainingFlowMockDiagnosisCaller,
        createdAt: new Date().toISOString(),
      });

      setResult(trainingFlowResult);
    } catch (runError) {
      setError(runError instanceof Error ? runError.message : '个性化训练流程运行失败。');
    } finally {
      setRunning(false);
    }
  }

  return (
    <div className="min-h-screen bg-[#f5f7fb]">
      <PageHeader
        title="个性化训练 Beta"
        subtitle="Phase 7.2：诊断结果 → 个性化任务 → 训练回流"
        back
      />

      <main className="space-y-4 px-4 pb-8">
        {loadingEntry ? (
          <section className="rounded-md border border-slate-200 bg-white p-4 text-sm text-slate-600">
            正在准备 7.1 学习入口结果...
          </section>
        ) : null}

        {learningEntryResult && personalizedTask ? (
          <>
            <section className="rounded-md border border-blue-200 bg-blue-50 p-4">
              <p className="text-sm font-semibold text-blue-700">上一步诊断摘要</p>
              <h2 className="mt-1 text-xl font-semibold text-slate-950">
                当前重点能力：{learningEntryResult.initial_target_ability}
              </h2>
              <p className="mt-2 text-sm leading-6 text-slate-700">
                {learningEntryResult.student_feedback.summary}
              </p>
            </section>

            <section className="rounded-md border border-slate-200 bg-white p-4">
              <h2 className="text-base font-semibold text-slate-950">个性化任务说明</h2>
              <div className="mt-3 grid gap-3">
                <InfoBlock title="训练目标" value={personalizedTask.task_goal} />
                <InfoBlock title="为什么做这道任务" value={personalizedTask.why_this_task} />
                <InfoList title="作答要求" values={personalizedTask.answer_requirements} />
                <InfoList title="成功标准" values={personalizedTask.success_criteria} />
              </div>
            </section>

            <section className="rounded-md border border-slate-200 bg-white p-4">
              <h2 className="text-base font-semibold text-slate-950">任务题目</h2>
              <div className="mt-3 rounded-md bg-slate-50 p-3 text-sm leading-7 text-slate-800">
                {personalizedTask.question}
              </div>
              <textarea
                value={studentTaskAnswer}
                rows={6}
                onChange={(event) => setStudentTaskAnswer(event.target.value)}
                className="mt-3 w-full resize-y rounded-md border border-slate-200 bg-slate-50 p-3 text-base leading-7 text-slate-950 outline-none focus:border-blue-500"
                placeholder="请完成这次训练任务"
              />
              <div className="mt-3 flex flex-wrap gap-2">
                {answerSamples.map((sample) => (
                  <button
                    key={sample.label}
                    type="button"
                    onClick={() => setStudentTaskAnswer(sample.value)}
                    className="rounded-md border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700"
                  >
                    {sample.label}
                  </button>
                ))}
              </div>
              <button
                type="button"
                onClick={handleSubmit}
                disabled={running}
                className="mt-4 w-full rounded-md bg-blue-600 px-4 py-3 text-base font-semibold text-white disabled:bg-slate-400"
              >
                {running ? '训练诊断中...' : '提交训练答案'}
              </button>
              {error ? (
                <div className="mt-3 rounded-md border border-red-200 bg-red-50 p-3 text-sm leading-6 text-red-700">
                  {error}
                </div>
              ) : null}
            </section>
          </>
        ) : null}

        {result ? (
          <>
            <section className="rounded-md border border-slate-200 bg-white p-4">
              <h2 className="text-base font-semibold text-slate-950">训练反馈</h2>
              <div className="mt-3 grid gap-3">
                <InfoBlock title="本次训练目标" value={result.student_readable_feedback.task_goal} />
                <InfoBlock title="本次表现" value={result.student_readable_feedback.performance_summary} />
                <InfoBlock title="下一步建议" value={result.student_readable_feedback.what_to_improve_next} />
                <InfoBlock title="流程状态" value={formatFlowStatus(result.flow_status)} />
              </div>
            </section>

            <section className="rounded-md border border-slate-200 bg-white p-4">
              <h2 className="text-base font-semibold text-slate-950">训练后能力状态</h2>
              <div className="mt-3 grid gap-3 text-sm">
                <InfoLine label="当前关注能力" value={result.updated_student_ability_profile.current_weakness.primary} />
                <InfoBlock title="下一步提示" value={result.next_step_hint} />
              </div>
              <Link
                to="/beta-session-result-demo"
                state={{ personalizedTrainingFlowResult: result }}
                className="mt-4 block rounded-md bg-blue-600 px-4 py-3 text-center text-base font-semibold text-white"
              >
                进入复测
              </Link>
            </section>

            <details className="rounded-md border border-slate-200 bg-white p-4">
              <summary className="cursor-pointer text-base font-semibold text-slate-950">
                开发者调试信息
              </summary>
              <div className="mt-3 grid gap-3 text-sm">
                <JsonBlock title="personalizedTask" value={result.personalized_task} />
                <JsonBlock title="taskDiagnosisResult" value={result.task_diagnosis_result} />
                <JsonBlock title="newAbilityEvidence" value={result.new_ability_evidence} />
                <JsonBlock title="updatedStudentAbilityProfile" value={result.updated_student_ability_profile} />
                <JsonBlock title="PersonalizedTrainingFlowResult" value={result} />
              </div>
            </details>
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
      <span className="ml-2 text-slate-950">{value}</span>
    </div>
  );
}

function InfoBlock({ title, value }) {
  return (
    <div className="rounded-md bg-slate-50 p-3">
      <div className="text-sm font-semibold text-slate-500">{title}</div>
      <div className="mt-2 whitespace-pre-wrap text-base leading-7 text-slate-950">{value}</div>
    </div>
  );
}

function InfoList({ title, values }) {
  return (
    <div className="rounded-md bg-slate-50 p-3">
      <div className="text-sm font-semibold text-slate-500">{title}</div>
      <ul className="mt-2 space-y-2 text-sm leading-6 text-slate-800">
        {values.map((value) => (
          <li key={value} className="flex gap-2">
            <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-blue-500" />
            <span>{value}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function JsonBlock({ title, value }) {
  return (
    <details className="rounded-md bg-slate-50 p-3">
      <summary className="cursor-pointer font-semibold text-slate-700">{title}</summary>
      <pre className="mt-3 max-h-80 overflow-auto whitespace-pre-wrap text-xs leading-5 text-slate-700">
        {JSON.stringify(value, null, 2)}
      </pre>
    </details>
  );
}

function formatFlowStatus(status) {
  const labels = {
    task_generated: '任务已生成',
    task_completed: '任务已完成',
    diagnosis_completed: '训练诊断已完成',
    ready_for_retest: '可以进入复测',
    validation_failed: '校验未通过',
  };

  return labels[status] || status;
}
