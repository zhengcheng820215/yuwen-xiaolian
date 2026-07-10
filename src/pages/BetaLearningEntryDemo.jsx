import { useState } from 'react';
import { Link } from 'react-router-dom';
import PageHeader from '../components/PageHeader.jsx';
import {
  learningEntryMockDiagnosisCaller,
  runLearningEntryAgent,
} from '../ai/agents/learningEntryAgent.ts';

const studentId = 'beta-demo-student';
const question = '阅读片段：父亲反复整理旧书，翻到“我”小时候夹在书里的树叶时，停了很久。由此可以推断出父亲怎样的心理？请结合文本线索说明理由。';
const referenceAnswer = '可以推断父亲看到旧书和树叶后想起与孩子共同读书的回忆，内心有不舍、珍惜和牵挂。理由应结合“反复整理旧书”“停了很久”等文本线索说明。';
const defaultStudentAnswer = '父亲看到旧书和树叶时停了很久，说明他想起以前和孩子一起读书的时光，所以内心有不舍、怀念和牵挂。';
const answerSamples = [
  {
    label: '完整答案',
    value: defaultStudentAnswer,
  },
  {
    label: '部分答案',
    value: '父亲很怀念以前和孩子在一起的时光，也很牵挂孩子。',
  },
  {
    label: '薄弱答案',
    value: '父亲很喜欢整理东西。',
  },
  {
    label: '空答案',
    value: '',
  },
];

export default function BetaLearningEntryDemo() {
  const [studentAnswer, setStudentAnswer] = useState(defaultStudentAnswer);
  const [result, setResult] = useState(null);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit() {
    setRunning(true);
    setError('');

    try {
      const learningEntryResult = await runLearningEntryAgent({
        studentId,
        question,
        referenceAnswer,
        studentAnswer,
        diagnosisCaller: learningEntryMockDiagnosisCaller,
        createdAt: new Date().toISOString(),
      });

      setResult(learningEntryResult);
    } catch (runError) {
      setError(runError instanceof Error ? runError.message : '学习入口运行失败。');
    } finally {
      setRunning(false);
    }
  }

  return (
    <div className="min-h-screen bg-[#f5f7fb]">
      <PageHeader
        title="开始学习 Beta"
        subtitle="Phase 7.1：第一题作答 → 诊断反馈 → 初始能力状态"
        back
      />

      <main className="space-y-4 px-4 pb-8">
        <section className="rounded-md border border-blue-200 bg-blue-50 p-4">
          <p className="text-sm font-semibold text-blue-700">本次学习目标</p>
          <h2 className="mt-1 text-xl font-semibold text-slate-950">
            完成第一道题，看看系统如何识别当前能力起点
          </h2>
          <p className="mt-2 text-sm leading-6 text-slate-700">
            这是 Beta 学习入口的最小验证页。你只需要阅读题目、写下答案并提交，系统会给出学生可读反馈。
          </p>
        </section>

        <section className="rounded-md border border-slate-200 bg-white p-4">
          <h2 className="text-base font-semibold text-slate-950">题目</h2>
          <div className="mt-3 rounded-md bg-slate-50 p-3 text-sm leading-7 text-slate-800">
            {question}
          </div>
        </section>

        <section className="rounded-md border border-slate-200 bg-white p-4">
          <h2 className="text-base font-semibold text-slate-950">你的答案</h2>
          <textarea
            value={studentAnswer}
            rows={6}
            onChange={(event) => setStudentAnswer(event.target.value)}
            className="mt-3 w-full resize-y rounded-md border border-slate-200 bg-slate-50 p-3 text-base leading-7 text-slate-950 outline-none focus:border-blue-500"
            placeholder="请写下你的理解和理由"
          />
          <div className="mt-3 flex flex-wrap gap-2">
            {answerSamples.map((sample) => (
              <button
                key={sample.label}
                type="button"
                onClick={() => setStudentAnswer(sample.value)}
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
            {running ? '诊断中...' : '提交答案'}
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
              <h2 className="text-base font-semibold text-slate-950">诊断反馈</h2>
              <div className="mt-3 grid gap-3">
                <StudentFeedbackBlock title="本题主要考察能力" value={result.student_feedback.title} />
                <StudentFeedbackBlock title="你的当前表现" value={result.student_feedback.summary} />
                <StudentFeedbackBlock title="下一步建议" value={result.student_feedback.next_step} />
              </div>
            </section>

            <section className="rounded-md border border-slate-200 bg-white p-4">
              <h2 className="text-base font-semibold text-slate-950">初始能力状态</h2>
              <div className="mt-3 grid gap-3 text-sm">
                <InfoLine label="本次 Session" value={result.session_id} />
                <InfoLine label="初始关注能力" value={result.initial_target_ability} />
                <InfoBlock title="当前能力画像" value={result.student_ability_profile.current_weakness.primary} />
                <InfoBlock title="下一步提示" value={result.next_step_hint} />
              </div>
              <Link
                to="/beta-personalized-training-demo"
                state={{ learningEntryResult: result }}
                className="mt-4 block rounded-md bg-blue-600 px-4 py-3 text-center text-base font-semibold text-white"
              >
                继续个性化训练
              </Link>
            </section>

            <details className="rounded-md border border-slate-200 bg-white p-4">
              <summary className="cursor-pointer text-base font-semibold text-slate-950">
                开发者调试信息
              </summary>
              <div className="mt-3 grid gap-3 text-sm">
                <JsonBlock title="diagnosisResult" value={result.diagnosis_result} />
                <JsonBlock title="abilityEvidence" value={result.new_ability_evidence} />
                <JsonBlock title="studentAbilityProfile" value={result.student_ability_profile} />
                <JsonBlock title="LearningEntryResult" value={result} />
              </div>
            </details>
          </>
        ) : null}
      </main>
    </div>
  );
}

function StudentFeedbackBlock({ title, value }) {
  return (
    <article className="rounded-md bg-slate-50 p-3">
      <p className="text-sm font-semibold text-slate-500">{title}</p>
      <p className="mt-2 text-base leading-7 text-slate-950">{value}</p>
    </article>
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
      <div className="mt-2 whitespace-pre-wrap leading-6 text-slate-950">{value}</div>
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
