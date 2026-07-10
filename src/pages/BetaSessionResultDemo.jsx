import { useEffect, useMemo, useState } from 'react';
import { useLocation } from 'react-router-dom';
import PageHeader from '../components/PageHeader.jsx';
import {
  learningEntryMockDiagnosisCaller,
  runLearningEntryAgent,
} from '../ai/agents/learningEntryAgent.ts';
import {
  personalizedTrainingFlowMockDiagnosisCaller,
  runPersonalizedTrainingFlowAgent,
} from '../ai/agents/personalizedTrainingFlowAgent.ts';
import {
  generateRetestTaskFromTrainingFlow,
  runBetaLearningSessionResultAgent,
} from '../ai/agents/betaLearningSessionResultAgent.ts';

const studentId = 'beta-demo-student';
const entryQuestion = '阅读片段：父亲反复整理旧书，翻到“我”小时候夹在书里的树叶时，停了很久。由此可以推断出父亲怎样的心理？请结合文本线索说明理由。';
const entryReferenceAnswer = '可以推断父亲看到旧书和树叶后想起与孩子共同读书的回忆，内心有不舍、珍惜和牵挂。理由应结合“反复整理旧书”“停了很久”等文本线索说明。';
const entryWeakAnswer = '父亲很喜欢整理东西。';
const trainingAnswer = '父亲反复整理旧书，翻到我小时候夹在书里的树叶时停了很久，说明他想起以前和孩子一起读书的时光，所以内心有不舍、怀念和牵挂。';
const defaultRetestAnswer = '母亲雨停后没有立刻回屋，而是把菜苗一株株扶正，袖口还沾满泥水，第二天又用小竹竿固定菜苗。由此可以看出她很心疼这些菜苗，也很珍惜自己照料的生活成果，希望菜苗继续生长。';
const retestAnswerSamples = [
  {
    label: '复测表现较好',
    value: defaultRetestAnswer,
  },
  {
    label: '复测部分迁移',
    value: '母亲把菜苗扶正，又用小竹竿固定，说明她很珍惜这些菜苗。',
  },
  {
    label: '复测仍薄弱',
    value: '母亲很喜欢种菜。',
  },
];

export default function BetaSessionResultDemo() {
  const location = useLocation();
  const routedTrainingResult = location.state?.personalizedTrainingFlowResult || null;
  const [trainingResult, setTrainingResult] = useState(routedTrainingResult);
  const [loadingTraining, setLoadingTraining] = useState(!routedTrainingResult);
  const [studentRetestAnswer, setStudentRetestAnswer] = useState(defaultRetestAnswer);
  const [result, setResult] = useState(null);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (routedTrainingResult) return;

    let cancelled = false;

    async function prepareDemoTrainingResult() {
      setLoadingTraining(true);
      try {
        const entry = await runLearningEntryAgent({
          studentId,
          question: entryQuestion,
          referenceAnswer: entryReferenceAnswer,
          studentAnswer: entryWeakAnswer,
          diagnosisCaller: learningEntryMockDiagnosisCaller,
          createdAt: new Date().toISOString(),
        });
        const training = await runPersonalizedTrainingFlowAgent({
          learningEntryResult: entry,
          studentTaskAnswer: trainingAnswer,
          diagnosisCaller: personalizedTrainingFlowMockDiagnosisCaller,
          createdAt: new Date().toISOString(),
        });

        if (!cancelled) setTrainingResult(training);
      } catch (prepareError) {
        if (!cancelled) {
          setError(prepareError instanceof Error ? prepareError.message : '生成 7.2 演示结果失败。');
        }
      } finally {
        if (!cancelled) setLoadingTraining(false);
      }
    }

    prepareDemoTrainingResult();

    return () => {
      cancelled = true;
    };
  }, [routedTrainingResult]);

  const retestTask = useMemo(() => {
    if (!trainingResult) return null;

    const generation = generateRetestTaskFromTrainingFlow(trainingResult);
    return generation.retest_task || null;
  }, [trainingResult]);

  async function handleSubmit() {
    if (!trainingResult || !retestTask) return;

    setRunning(true);
    setError('');

    try {
      const sessionResult = await runBetaLearningSessionResultAgent({
        personalizedTrainingFlowResult: trainingResult,
        retestTask,
        studentRetestAnswer,
        createdAt: new Date().toISOString(),
      });

      setResult(sessionResult);
    } catch (runError) {
      setError(runError instanceof Error ? runError.message : '复测与本轮结果生成失败。');
    } finally {
      setRunning(false);
    }
  }

  return (
    <div className="min-h-screen bg-[#f5f7fb]">
      <PageHeader
        title="复测与本轮结果 Beta"
        subtitle="Phase 7.3：训练结果 → 复测 → 能力变化判断 → 本轮反馈"
        back
      />

      <main className="space-y-4 px-4 pb-8">
        {loadingTraining ? (
          <section className="rounded-md border border-slate-200 bg-white p-4 text-sm text-slate-600">
            正在准备 7.2 个性化训练结果...
          </section>
        ) : null}

        {trainingResult && retestTask ? (
          <>
            <section className="rounded-md border border-blue-200 bg-blue-50 p-4">
              <p className="text-sm font-semibold text-blue-700">上一步训练摘要</p>
              <h2 className="mt-1 text-xl font-semibold text-slate-950">
                当前训练能力：{trainingResult.target_ability}
              </h2>
              <p className="mt-2 text-sm leading-6 text-slate-700">
                {trainingResult.student_readable_feedback.performance_summary}
              </p>
              <p className="mt-2 text-sm font-semibold text-blue-700">
                当前状态：{trainingResult.flow_status === 'ready_for_retest' ? '可以进入复测' : '暂不能复测'}
              </p>
            </section>

            <section className="rounded-md border border-slate-200 bg-white p-4">
              <h2 className="text-base font-semibold text-slate-950">复测任务</h2>
              <div className="mt-3 grid gap-3">
                <InfoBlock title="复测目标" value={retestTask.retest_goal} />
                <InfoBlock title="为什么现在复测" value={retestTask.why_retest_now} />
                <InfoList title="成功标准" values={retestTask.success_criteria} />
                <InfoBlock title="复测题目" value={retestTask.question} />
              </div>
              <textarea
                value={studentRetestAnswer}
                rows={6}
                onChange={(event) => setStudentRetestAnswer(event.target.value)}
                className="mt-3 w-full resize-y rounded-md border border-slate-200 bg-slate-50 p-3 text-base leading-7 text-slate-950 outline-none focus:border-blue-500"
                placeholder="请完成复测题"
              />
              <div className="mt-3 flex flex-wrap gap-2">
                {retestAnswerSamples.map((sample) => (
                  <button
                    key={sample.label}
                    type="button"
                    onClick={() => setStudentRetestAnswer(sample.value)}
                    className="rounded-md border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700"
                  >
                    {sample.label}
                  </button>
                ))}
              </div>
              <button
                type="button"
                onClick={handleSubmit}
                disabled={running || trainingResult.flow_status !== 'ready_for_retest'}
                className="mt-4 w-full rounded-md bg-blue-600 px-4 py-3 text-base font-semibold text-white disabled:bg-slate-400"
              >
                {running ? '复测诊断中...' : '提交复测答案'}
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
              <h2 className="text-base font-semibold text-slate-950">复测反馈</h2>
              <div className="mt-3 grid gap-3">
                <InfoBlock title="本轮结果" value={result.student_readable_feedback.title} />
                <InfoBlock title="复测表现" value={result.student_readable_feedback.summary} />
                <InfoBlock title="下一步建议" value={result.student_readable_feedback.next_step} />
              </div>
            </section>

            <section className="rounded-md border border-slate-200 bg-white p-4">
              <h2 className="text-base font-semibold text-slate-950">本轮 Session 结果</h2>
              <div className="mt-3 grid gap-3">
                <InfoLine label="本轮训练能力" value={result.target_ability} />
                <InfoLine label="Session 状态" value={formatSessionStatus(result.session_status)} />
                <InfoBlock title="初始问题" value={result.session_summary.initial_problem} />
                <InfoBlock title="训练过程" value={result.session_summary.training_focus} />
                <InfoBlock title="复测结果" value={result.session_summary.retest_result} />
                <InfoBlock title="本轮结论" value={result.session_summary.ability_change_summary} />
                <InfoBlock title="下一步学习建议" value={result.session_summary.next_learning_decision} />
              </div>
            </section>

            <details className="rounded-md border border-slate-200 bg-white p-4">
              <summary className="cursor-pointer text-base font-semibold text-slate-950">
                开发者调试信息
              </summary>
              <div className="mt-3 grid gap-3 text-sm">
                <JsonBlock title="RetestTask" value={result.retest_task} />
                <JsonBlock title="RetestExecutionResult" value={result.retest_execution_result} />
                <JsonBlock title="RetestEvidence" value={result.retest_execution_result?.new_retest_evidence} />
                <JsonBlock title="AbilityChangeEvaluation" value={result.ability_change_evaluation} />
                <JsonBlock title="BetaLearningSessionResult" value={result} />
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

function formatSessionStatus(status) {
  const labels = {
    completed: '本轮学习已完成',
    needs_more_training: '需要继续训练',
    needs_more_evidence: '需要更多证据',
    ready_for_next_ability: '可以切换能力',
    validation_failed: '校验未通过',
    not_ready_for_retest: '暂不能复测',
  };

  return labels[status] || status;
}
