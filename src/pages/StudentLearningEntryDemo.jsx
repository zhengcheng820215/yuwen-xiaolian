import { useMemo, useState } from 'react';
import PageHeader from '../components/PageHeader.jsx';
import {
  clearStudentLearningPersistenceDemo,
  getStudentLearningEntryDemoData,
  restoreStudentLearningPersistenceDemo,
  runStudentLearningFeedbackDemo,
  runStudentLearningEntryDemo,
  runStudentRoundSummaryDemo,
  saveStudentLearningPersistenceDemo,
} from '../api/studentLearningEntry';

const { cases, defaultCaseId } = getStudentLearningEntryDemoData();

export default function StudentLearningEntryDemo() {
  const [selectedCaseId, setSelectedCaseId] = useState(defaultCaseId);
  const [answerDraft, setAnswerDraft] = useState('');
  const [feedbackResult, setFeedbackResult] = useState(null);
  const [roundSummaryResult, setRoundSummaryResult] = useState(null);
  const [persistenceStatus, setPersistenceStatus] = useState(null);
  const [isPersistenceBusy, setIsPersistenceBusy] = useState(false);
  const result = useMemo(
    () => runStudentLearningEntryDemo(selectedCaseId, answerDraft),
    [selectedCaseId, answerDraft],
  );
  const { selectedCase, startResult, entryState } = result;

  function selectCase(caseItem) {
    setSelectedCaseId(caseItem.id);
    setAnswerDraft(caseItem.defaultAnswer);
    setFeedbackResult(null);
    setRoundSummaryResult(null);
    setPersistenceStatus(null);
  }

  function submitAnswer() {
    setFeedbackResult(runStudentLearningFeedbackDemo(selectedCaseId, answerDraft));
    setRoundSummaryResult(null);
  }

  function showRoundSummary() {
    setRoundSummaryResult(runStudentRoundSummaryDemo(selectedCaseId, answerDraft));
  }

  async function saveCurrentLearningState() {
    setIsPersistenceBusy(true);
    try {
      const record = await saveStudentLearningPersistenceDemo({
        caseId: selectedCaseId,
        answerDraft,
        feedbackResult,
        roundSummaryResult,
      });
      setPersistenceStatus({
        type: record.status === 'saved' ? 'success' : 'warning',
        title: record.status === 'saved' ? '已保存当前学习状态' : '保存状态需要检查',
        message: record.status === 'saved'
          ? '刷新页面后，可以从这里恢复本轮任务、草稿或结束页。'
          : record.issues.join('；'),
        debug: record,
      });
    } catch (error) {
      setPersistenceStatus({
        type: 'error',
        title: '保存失败',
        message: error instanceof Error ? error.message : '无法保存当前学习状态。',
      });
    } finally {
      setIsPersistenceBusy(false);
    }
  }

  async function restoreLatestLearningState() {
    setIsPersistenceBusy(true);
    try {
      const restored = await restoreStudentLearningPersistenceDemo();
      if (restored.canResume && restored.restoredRecord) {
        const record = restored.restoredRecord;
        const nextCaseId = inferCaseIdFromLearningRoundId(record.learningRoundId);
        setSelectedCaseId(nextCaseId);
        setAnswerDraft(record.answerDraft || record.studentResponse?.answerText || '');
        setFeedbackResult(record.studentLearningFeedback
          ? {
            feedback: record.studentLearningFeedback,
            executionResult: null,
            learningRoundResult: record.learningRoundResult || null,
          }
          : null);
        setRoundSummaryResult(record.studentRoundSummary
          ? {
            roundSummary: record.studentRoundSummary,
            feedback: record.studentLearningFeedback || null,
            learningRoundResult: record.learningRoundResult || null,
          }
          : null);
      }
      setPersistenceStatus({
        type: restored.canResume ? 'success' : 'warning',
        title: restored.studentVisibleState.title,
        message: restored.studentVisibleState.message,
        debug: restored,
      });
    } catch (error) {
      setPersistenceStatus({
        type: 'error',
        title: '恢复失败',
        message: error instanceof Error ? error.message : '无法恢复上次学习状态。',
      });
    } finally {
      setIsPersistenceBusy(false);
    }
  }

  async function clearSavedLearningState() {
    setIsPersistenceBusy(true);
    try {
      await clearStudentLearningPersistenceDemo();
      setPersistenceStatus({
        type: 'success',
        title: '已清除保存记录',
        message: '再次点击恢复时，将不会恢复旧学习状态。',
      });
    } catch (error) {
      setPersistenceStatus({
        type: 'error',
        title: '清除失败',
        message: error instanceof Error ? error.message : '无法清除保存记录。',
      });
    } finally {
      setIsPersistenceBusy(false);
    }
  }

  return (
    <div className="min-h-screen bg-[#f5f7fb]">
      <PageHeader
        title="开始学习 Alpha"
        subtitle="Phase 11.1 学生学习入口"
        back
      />

      <main className="space-y-4 px-4 pb-8">
        <section className="rounded-md border border-blue-200 bg-blue-50 p-4">
          <p className="text-sm font-semibold text-blue-700">本阶段验收重点</p>
          <h2 className="mt-1 text-xl font-semibold text-slate-950">
            从统一入口开始一轮学习，并验证保存与恢复
          </h2>
          <p className="mt-2 text-sm leading-6 text-slate-700">
            本页轻量接入 Phase 12.1：未完成时保存任务和草稿，完成后保存反馈和结束页，刷新后可以恢复。
          </p>
        </section>

        <section className="rounded-md border border-slate-200 bg-white p-4">
          <h2 className="text-base font-semibold text-slate-950">选择体验 Case</h2>
          <div className="mt-3 grid grid-cols-3 gap-2">
            {cases.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => selectCase(item)}
                className={[
                  'rounded-md border px-3 py-3 text-left text-sm font-semibold',
                  selectedCaseId === item.id
                    ? 'border-blue-500 bg-blue-50 text-blue-700'
                    : 'border-slate-200 bg-white text-slate-700',
                ].join(' ')}
              >
                {item.label}
              </button>
            ))}
          </div>
          <p className="mt-3 rounded-md bg-slate-50 p-3 text-sm leading-6 text-slate-700">
            {selectedCase.description}
          </p>
        </section>

        <section className="rounded-md border border-slate-200 bg-white p-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-slate-500">Phase 12.1</p>
              <h2 className="mt-1 text-xl font-semibold text-slate-950">学习状态保存与恢复</h2>
            </div>
            <span className="rounded-md bg-slate-50 px-3 py-2 text-sm font-semibold text-slate-600">
              IndexedDB
            </span>
          </div>
          <p className="mt-3 text-sm leading-6 text-slate-700">
            可以先输入一段答案后保存，再刷新页面并恢复；也可以提交、查看本轮结束页后保存，再刷新恢复到结束页。
          </p>
          <div className="mt-3 grid grid-cols-3 gap-2">
            <button
              type="button"
              disabled={isPersistenceBusy || !entryState.canAnswer}
              onClick={saveCurrentLearningState}
              className={[
                'rounded-md px-3 py-3 text-sm font-semibold',
                isPersistenceBusy || !entryState.canAnswer
                  ? 'bg-slate-100 text-slate-400'
                  : 'bg-blue-600 text-white',
              ].join(' ')}
            >
              保存当前状态
            </button>
            <button
              type="button"
              disabled={isPersistenceBusy}
              onClick={restoreLatestLearningState}
              className="rounded-md bg-slate-950 px-3 py-3 text-sm font-semibold text-white disabled:bg-slate-200 disabled:text-slate-400"
            >
              恢复上次学习
            </button>
            <button
              type="button"
              disabled={isPersistenceBusy}
              onClick={clearSavedLearningState}
              className="rounded-md border border-slate-200 bg-white px-3 py-3 text-sm font-semibold text-slate-700 disabled:text-slate-400"
            >
              清除保存
            </button>
          </div>
          {persistenceStatus ? (
            <div className={[
              'mt-3 rounded-md border p-3',
              persistenceStatus.type === 'success'
                ? 'border-emerald-200 bg-emerald-50'
                : persistenceStatus.type === 'error'
                  ? 'border-red-200 bg-red-50'
                  : 'border-amber-200 bg-amber-50',
            ].join(' ')}
            >
              <h3 className="text-sm font-semibold text-slate-950">{persistenceStatus.title}</h3>
              <p className="mt-1 text-sm leading-6 text-slate-700">{persistenceStatus.message}</p>
            </div>
          ) : null}
        </section>

        <section className="rounded-md border border-slate-200 bg-white p-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-slate-500">当前状态</p>
              <h2 className="mt-1 text-xl font-semibold text-slate-950">{formatEntryStatus(entryState.status)}</h2>
            </div>
            <span className="rounded-md bg-blue-50 px-3 py-2 text-sm font-semibold text-blue-700">
              {formatViewStatus(entryState.viewStatus)}
            </span>
          </div>
          <p className="mt-3 rounded-md bg-slate-50 p-3 text-sm leading-6 text-slate-700">
            {entryState.message}
          </p>
        </section>

        {entryState.canAnswer ? (
          <>
            <section className="rounded-md border border-slate-200 bg-white p-4">
              <p className="text-sm font-semibold text-slate-500">本轮任务</p>
              <h2 className="mt-1 text-xl font-semibold text-slate-950">{entryState.taskTitle}</h2>
              <div className="mt-3 rounded-md bg-blue-50 p-3">
                <div className="text-sm font-semibold text-blue-700">{entryState.studentRoundFocus.title}</div>
                <div className="mt-1 text-sm leading-6 text-slate-700">{entryState.studentRoundFocus.description}</div>
              </div>
            </section>

            {entryState.readingText ? (
              <section className="rounded-md border border-slate-200 bg-white p-4">
                <h2 className="text-base font-semibold text-slate-950">阅读材料</h2>
                <p className="mt-3 whitespace-pre-wrap text-base leading-8 text-slate-800">
                  {entryState.readingText}
                </p>
              </section>
            ) : null}

            <section className="rounded-md border border-slate-200 bg-white p-4">
              <h2 className="text-base font-semibold text-slate-950">题目</h2>
              <p className="mt-3 text-base leading-8 text-slate-950">{entryState.questionText}</p>
            </section>

            <section className="rounded-md border border-slate-200 bg-white p-4">
              <h2 className="text-base font-semibold text-slate-950">作答要求</h2>
              <ul className="mt-3 space-y-2 text-sm leading-6 text-slate-700">
                {entryState.answerRequirements.map((item) => (
                  <li key={item} className="flex gap-2">
                    <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-blue-500" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </section>

            <section className="rounded-md border border-slate-200 bg-white p-4">
              <h2 className="text-base font-semibold text-slate-950">你的答案</h2>
              <textarea
                value={answerDraft}
                onChange={(event) => {
                  setAnswerDraft(event.target.value);
                  setFeedbackResult(null);
                }}
                rows={6}
                className="mt-3 w-full rounded-md border border-slate-200 bg-white p-3 text-base leading-7 text-slate-950 outline-none focus:border-blue-500"
                placeholder="请在这里写下你的想法"
              />
              <button
                type="button"
                disabled={!entryState.canAnswer}
                onClick={submitAnswer}
                className={[
                  'mt-3 w-full rounded-md px-4 py-3 text-base font-semibold',
                  entryState.canAnswer
                    ? 'bg-blue-600 text-white'
                    : 'bg-slate-200 text-slate-500',
                ].join(' ')}
              >
                {entryState.canSubmit ? '提交并查看反馈' : '检查当前回答'}
              </button>
            </section>

            {feedbackResult?.feedback ? (
              <>
                <StudentFeedbackPanel feedback={feedbackResult.feedback} />
                <section className="rounded-md border border-slate-200 bg-white p-4">
                  <h2 className="text-base font-semibold text-slate-950">本轮结束页验收</h2>
                  <p className="mt-2 text-sm leading-6 text-slate-700">
                    Phase 11.3 会把本轮 Runtime 结果和提交反馈整理成学生能看懂的结束摘要。
                  </p>
                  <button
                    type="button"
                    onClick={showRoundSummary}
                    className="mt-3 w-full rounded-md bg-slate-950 px-4 py-3 text-base font-semibold text-white"
                  >
                    查看本轮结束页
                  </button>
                </section>
                {roundSummaryResult?.roundSummary ? (
                  <StudentRoundSummaryPanel summary={roundSummaryResult.roundSummary} />
                ) : null}
              </>
            ) : null}
          </>
        ) : (
          <section className="rounded-md border border-amber-200 bg-amber-50 p-4">
            <h2 className="text-base font-semibold text-amber-900">任务暂时无法开始</h2>
            <p className="mt-2 text-sm leading-6 text-amber-800">
              系统没有展示残缺任务，也没有允许进入作答。请稍后重试或切换体验 Case。
            </p>
          </section>
        )}

        <details className="rounded-md border border-slate-200 bg-white p-4">
          <summary className="cursor-pointer text-base font-semibold text-slate-950">
            开发者调试信息（与学生主体验区隔离）
          </summary>
          <div className="mt-3 grid gap-3">
            <InfoBlock title="Debug 摘要" value={JSON.stringify(entryState.debugState, null, 2)} />
            {persistenceStatus?.debug ? (
              <JsonBlock title="LearningPersistence Debug" value={persistenceStatus.debug} />
            ) : null}
            <JsonBlock title="StudentLearningEntryState" value={entryState} />
            {feedbackResult?.feedback ? (
              <JsonBlock title="StudentLearningFeedback" value={feedbackResult.feedback} />
            ) : null}
            {feedbackResult?.executionResult ? (
              <JsonBlock title="LearningRoundExecutionResult" value={feedbackResult.executionResult} />
            ) : null}
            {feedbackResult?.learningRoundResult ? (
              <JsonBlock title="LearningRoundResult" value={feedbackResult.learningRoundResult} />
            ) : null}
            {roundSummaryResult?.roundSummary ? (
              <JsonBlock title="StudentRoundSummary" value={roundSummaryResult.roundSummary} />
            ) : null}
            <JsonBlock title="LearningRoundStartResult" value={startResult} />
          </div>
        </details>
      </main>
    </div>
  );
}

function inferCaseIdFromLearningRoundId(learningRoundId) {
  if (learningRoundId.includes('readiness_failed')) return 'readiness_failed';
  if (learningRoundId.includes('blocked')) return 'blocked';
  return 'ready';
}

function StudentRoundSummaryPanel({ summary }) {
  return (
    <section className="rounded-md border border-violet-200 bg-white p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-violet-700">本轮结束页</p>
          <h2 className="mt-1 text-xl font-semibold text-slate-950">{summary.title}</h2>
        </div>
        <span className="rounded-md bg-violet-50 px-3 py-2 text-sm font-semibold text-violet-700">
          {formatSummaryStatus(summary.status)}
        </span>
      </div>

      <div className="mt-4 rounded-md bg-slate-50 p-3">
        <h3 className="text-sm font-semibold text-slate-500">本轮任务</h3>
        <p className="mt-1 text-base font-semibold leading-7 text-slate-950">{summary.completedTaskTitle}</p>
      </div>

      <div className="mt-3 rounded-md bg-blue-50 p-3">
        <h3 className="text-sm font-semibold text-blue-700">{summary.roundFocus.title}</h3>
        <p className="mt-1 text-sm leading-6 text-slate-700">{summary.roundFocus.description}</p>
      </div>

      <div className="mt-3 rounded-md bg-slate-50 p-3">
        <h3 className="text-sm font-semibold text-slate-500">本轮完成情况</h3>
        <p className="mt-1 text-base leading-7 text-slate-800">{summary.completionSummary}</p>
      </div>

      <div className="mt-3 rounded-md bg-slate-50 p-3">
        <h3 className="text-sm font-semibold text-slate-500">本次反馈摘要</h3>
        <p className="mt-1 text-base leading-7 text-slate-800">{summary.studentReadableResult}</p>
      </div>

      {summary.positiveTakeaway.length > 0 ? (
        <div className="mt-4">
          <h3 className="text-sm font-semibold text-slate-500">可以保留的做法</h3>
          <ul className="mt-2 space-y-2 text-sm leading-6 text-slate-700">
            {summary.positiveTakeaway.map((item) => (
              <li key={item} className="flex gap-2">
                <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-500" />
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {summary.continueAttention.length > 0 ? (
        <div className="mt-4">
          <h3 className="text-sm font-semibold text-slate-500">继续注意</h3>
          <ul className="mt-2 space-y-2 text-sm leading-6 text-slate-700">
            {summary.continueAttention.map((item) => (
              <li key={item} className="flex gap-2">
                <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-amber-500" />
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <div className="mt-4 rounded-md bg-violet-50 p-3">
        <h3 className="text-sm font-semibold text-violet-700">下一步入口</h3>
        <p className="mt-1 text-sm leading-6 text-slate-700">{summary.nextActionText}</p>
      </div>
    </section>
  );
}

function StudentFeedbackPanel({ feedback }) {
  return (
    <section className="rounded-md border border-emerald-200 bg-white p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-emerald-700">提交反馈</p>
          <h2 className="mt-1 text-xl font-semibold text-slate-950">{feedback.headline}</h2>
        </div>
        <span className="rounded-md bg-emerald-50 px-3 py-2 text-sm font-semibold text-emerald-700">
          {formatFeedbackStage(feedback.stage)}
        </span>
      </div>

      <p className="mt-3 rounded-md bg-slate-50 p-3 text-base leading-7 text-slate-800">
        {feedback.summary}
      </p>

      {feedback.whatYouDidWell.length > 0 ? (
        <div className="mt-4">
          <h3 className="text-sm font-semibold text-slate-500">你做得可以的地方</h3>
          <ul className="mt-2 space-y-2 text-sm leading-6 text-slate-700">
            {feedback.whatYouDidWell.map((item) => (
              <li key={item} className="flex gap-2">
                <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-500" />
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {feedback.whatNeedsAttention.length > 0 ? (
        <div className="mt-4">
          <h3 className="text-sm font-semibold text-slate-500">需要注意或补充</h3>
          <ul className="mt-2 space-y-2 text-sm leading-6 text-slate-700">
            {feedback.whatNeedsAttention.map((item) => (
              <li key={item} className="flex gap-2">
                <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-amber-500" />
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <div className="mt-4 rounded-md bg-blue-50 p-3">
        <h3 className="text-sm font-semibold text-blue-700">下一步</h3>
        <p className="mt-1 text-sm leading-6 text-slate-700">{feedback.nextActionText}</p>
      </div>
    </section>
  );
}

function formatSummaryStatus(status) {
  const labels = {
    completed: '本轮完成',
    retry_required: '需要补充',
    review_required: '等待确认',
    blocked: '暂时阻断',
    abandoned: '已停止',
  };
  return labels[status] || status;
}

function formatEntryStatus(status) {
  const labels = {
    loading_task: '正在准备任务',
    ready_to_answer: '可以开始作答',
    blocked: '任务已阻断',
    retry_required: '需要重试',
    error: '出现错误',
  };
  return labels[status] || status;
}

function formatViewStatus(status) {
  const labels = {
    loading_task: '加载中',
    ready: '已准备好',
    submitting: '提交中',
    analyzing: '分析中',
    feedback_ready: '反馈已生成',
    error: '不可用',
  };
  return labels[status] || status;
}

function formatFeedbackStage(stage) {
  const labels = {
    submission: '已提交',
    analysis: '分析中',
    result: '已出反馈',
  };
  return labels[stage] || stage;
}

function InfoBlock({ title, value }) {
  return (
    <div className="rounded-md bg-slate-50 p-3">
      <div className="text-sm font-semibold text-slate-500">{title}</div>
      <pre className="mt-2 max-h-60 overflow-auto whitespace-pre-wrap text-xs leading-5 text-slate-700">
        {value || '暂无'}
      </pre>
    </div>
  );
}

function JsonBlock({ title, value }) {
  return (
    <details className="rounded-md bg-slate-50 p-3">
      <summary className="cursor-pointer text-sm font-semibold text-slate-700">{title}</summary>
      <pre className="mt-3 max-h-80 overflow-auto whitespace-pre-wrap text-xs leading-5 text-slate-700">
        {JSON.stringify(value, null, 2)}
      </pre>
    </details>
  );
}
