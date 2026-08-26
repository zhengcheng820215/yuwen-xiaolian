import { useEffect, useRef, useState } from 'react';
import { ArrowLeft, ArrowRight, BookOpen, Lightbulb, Pencil, RefreshCw, Save, ThumbsUp } from 'lucide-react';
import {
  advancePhase163LiveRound,
  loadPhase163LiveWorkspace,
  recordPhase163FeedbackPresented,
  recordPhase163FirstInputObserved,
  recordPhase163PreAnswerHintOpened,
  recordPhase163QuestionPresented,
  resumePhase163CoreAfterTargetedMicroTraining,
  resumePhase163FeedbackRevisionEvaluation,
  savePhase163LiveDraft,
  savePhase163FeedbackRevisionDraft,
  skipPhase163FeedbackRevision,
  skipPhase163FeedbackRevisionByAttemptId,
  skipPhase163TargetedMicroTraining,
  startPhase163TargetedMicroTraining,
  startPhase163FeedbackRevision,
  submitPhase163FeedbackRevision,
  submitPhase163LiveAnswer,
} from '../api/phase163LiveLearning.ts';
import {
  getPhase163DiagnosisBoundaryStatus,
  isPhase163DiagnosisBoundaryUnavailable,
} from '../api/phase163DiagnosisBoundary.ts';
import { requestStudentWritingCorrections } from '../api/studentWritingCorrections.ts';
import WorkspaceToast from '../components/continuous-learning/WorkspaceToast.jsx';
import ReadingMaterialText from '../components/continuous-learning/ReadingMaterialText.jsx';
import { formatLearningMaterialHeading } from '../ui/learningMaterialHeading.ts';
import { buildPreAnswerLearningGuidance } from '../ai/content/preAnswerLearningGuidance.ts';
import AnswerLengthIndicator from '../components/continuous-learning/AnswerLengthIndicator.jsx';
import SingleChoiceResponseInput from '../components/continuous-learning/SingleChoiceResponseInput.jsx';
import {
  FeedbackRevisionGoal,
  FeedbackRevisionEvaluated,
  FeedbackRevisionSubmitted,
  FeedbackRevisionWorkspace,
} from '../components/continuous-learning/FeedbackGuidedRevision.jsx';
import {
  resolveCompletedFeedbackFallback,
  shouldRenderThinkingReview,
  shouldStageFeedbackPresentation,
  synchronizeFeedbackPresentationStep,
} from '../ui/feedbackPresentationPolicy.ts';
import {
  formatNextTaskContinuation,
  shouldSettleTerminalLearningSessionOnExit,
} from '../ui/learningSessionProgressCopy.ts';
import {
  formatStudentNextQuestionAction,
  studentConditionalTaskTitle,
} from '../ui/productComplexityConvergencePresentation.ts';
import {
  removeDuplicateRevisionNextAction,
  resolveConvergenceStage3PresentationFlag,
  toConvergenceFeedbackStudentView,
} from '../ui/productComplexityConvergenceStage3Presentation.ts';
import { readProductRuntimeHealth } from '../api/productRuntimeHealthClient.ts';

const RUNTIME_UNAVAILABLE_MESSAGE = '分析服务尚未就绪。你可以继续编辑或保存回答，服务准备好后再提交。';
const FEEDBACK_PRESENTATION_KEY_PREFIX = 'qingzhou:feedback-presentation:';

export default function Phase163LiveLearningWorkspace({
  onReturnToEntry,
  onCompleteSession,
  autoRetryResource = false,
}) {
  const [state, setState] = useState(null);
  const [answer, setAnswer] = useState('');
  const [selectedOptionId, setSelectedOptionId] = useState('');
  const [revisionAnswer, setRevisionAnswer] = useState('');
  const [busy, setBusy] = useState(true);
  const [activeOperation, setActiveOperation] = useState(null);
  const [toast, setToast] = useState(null);
  const [analysisRetry, setAnalysisRetry] = useState(false);
  const [runtimeAvailability, setRuntimeAvailability] = useState('checking');
  const [writingCorrections, setWritingCorrections] = useState([]);
  const [writingCorrectionStatus, setWritingCorrectionStatus] = useState('idle');
  const answerInputRef = useRef(null);
  const revisionInputRef = useRef(null);
  const saveRequest = useRef(0);
  const toastSequence = useRef(0);
  const autoResourceRetryStarted = useRef(false);
  const revisionEvaluationRetryStarted = useRef(null);
  const preAnswerGuidance = state?.task
    ? buildPreAnswerLearningGuidance({
        abilityId: state.task.abilityId,
        abilityName: state.task.focus,
        responseFormat: state.task.responseFormat,
        questionText: state.task.questionText,
      })
    : null;

  useEffect(() => {
    let active = true;
    Promise.all([
      loadPhase163LiveWorkspace(),
      getPhase163DiagnosisBoundaryStatus(),
      readProductRuntimeHealth(),
    ])
      .then(([next, diagnosisRuntime, healthResult]) => {
        if (!active) return;
        applyState(next);
        const runtimeStatus = diagnosisRuntime.status === 'ready'
          && healthResult.state === 'available'
          && healthResult.health.learning.canSubmitForDiagnosis ? 'ready' : 'unavailable';
        setRuntimeAvailability(runtimeStatus);
        if (runtimeStatus === 'unavailable' && next.task.responseFormat !== 'single_choice' && (next.status === 'ready' || next.status === 'retry_required')) {
          showMessage(RUNTIME_UNAVAILABLE_MESSAGE, 'error');
        }
      })
      .catch((error) => active && showMessage(toMessage(error), 'error'))
      .finally(() => active && setBusy(false));
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (!state?.roundId) return undefined;
    const presentsQuestion = !state.feedback && ['ready', 'retry_required'].includes(state.status);
    if (!presentsQuestion) return undefined;
    const frame = window.requestAnimationFrame(() => {
      void recordPhase163QuestionPresented(state.roundId).catch(() => {});
    });
    return () => window.cancelAnimationFrame(frame);
  }, [state?.roundId, state?.status, Boolean(state?.feedback)]);

  useEffect(() => {
    if (!autoRetryResource || autoResourceRetryStarted.current || busy || state?.primaryAction !== 'retry_resource') return;
    autoResourceRetryStarted.current = true;
    void resumeProcessing();
  }, [autoRetryResource, busy, state?.primaryAction]);

  useEffect(() => {
    const revision = state?.revision;
    if (
      busy
      || runtimeAvailability !== 'ready'
      || !revision
      || !['submitted', 'evaluating', 'evaluation_pending_retry'].includes(revision.status)
      || revisionEvaluationRetryStarted.current === revision.learningTaskAttemptId
    ) return;
    revisionEvaluationRetryStarted.current = revision.learningTaskAttemptId;
    setBusy(true);
    void resumePhase163FeedbackRevisionEvaluation()
      .then((next) => applyState(next))
      .catch(() => {})
      .finally(() => setBusy(false));
  }, [busy, runtimeAvailability, state?.revision?.learningTaskAttemptId, state?.revision?.status]);

  useEffect(() => {
    if (state?.task?.responseFormat === 'single_choice' || !state?.feedback || !answer.trim()) {
      setWritingCorrections([]);
      setWritingCorrectionStatus('idle');
      return undefined;
    }
    let active = true;
    setWritingCorrections([]);
    setWritingCorrectionStatus('loading');
    requestStudentWritingCorrections({
      requestId: `writing-correction-${state.roundId}-${answerFingerprint(answer)}`,
      answerText: answer,
      readingText: state.task.readingText,
      questionText: state.task.questionText,
    })
      .then((suggestions) => {
        if (!active) return;
        setWritingCorrections(suggestions);
        setWritingCorrectionStatus('resolved');
      })
      .catch(() => {
        if (!active) return;
        setWritingCorrections([]);
        setWritingCorrectionStatus('resolved');
      });
    return () => { active = false; };
  }, [state?.feedback, state?.roundId, answer, state?.task.readingText, state?.task.questionText]);

  useEffect(() => {
    const input = answerInputRef.current;
    if (!input) return;
    input.style.height = 'auto';
    const nextHeight = Math.min(Math.max(input.scrollHeight, 240), 400);
    input.style.height = `${nextHeight}px`;
    input.style.overflowY = input.scrollHeight > 400 ? 'auto' : 'hidden';
  }, [answer, state?.roundId]);

  function applyState(next) {
    setState(next);
    setAnswer(next.answerDraft || '');
    setSelectedOptionId(next.singleChoiceDraft?.selectedOptionIds?.[0] || '');
    setRevisionAnswer(next.revision?.draftAnswer || next.revision?.initialAnswer || '');
    setToast(null);
    setAnalysisRetry(false);
  }

  useEffect(() => {
    const input = revisionInputRef.current;
    if (!input) return;
    input.style.height = 'auto';
    const nextHeight = Math.min(Math.max(input.scrollHeight, 220), 400);
    input.style.height = `${nextHeight}px`;
    input.style.overflowY = input.scrollHeight > 400 ? 'auto' : 'hidden';
  }, [revisionAnswer, state?.revision?.status]);

  function showMessage(value, tone = 'operation') {
    if (!value) {
      setToast(null);
      return;
    }
    const duration = tone === 'error' ? 6000 : tone === 'success' ? 2000 : 3000;
    setToast({ id: ++toastSequence.current, message: value, tone, duration });
  }

  async function saveDraft() {
    const choiceAnswer = buildChoiceAnswer(state, selectedOptionId);
    if ((state?.task?.responseFormat === 'single_choice' ? !choiceAnswer : !answer.trim()) || busy) {
      showMessage('当前没有可保存的内容。');
      return;
    }
    const requestId = ++saveRequest.current;
    setActiveOperation('save_draft');
    setBusy(true);
    try {
      await savePhase163LiveDraft(answer, choiceAnswer);
      if (requestId === saveRequest.current) showMessage('草稿已保存。', 'success');
    } catch (error) {
      if (requestId === saveRequest.current) showMessage(toMessage(error), 'error');
    } finally {
      if (requestId === saveRequest.current) setBusy(false);
      if (requestId === saveRequest.current) setActiveOperation(null);
    }
  }

  async function submitAnswer() {
    if (busy) return;
    const choiceAnswer = buildChoiceAnswer(state, selectedOptionId);
    if (state.task.responseFormat === 'single_choice' ? !choiceAnswer : !answer.trim()) {
      showMessage(state.task.responseFormat === 'single_choice' ? '请先选择一个答案。' : '请先输入回答再提交。');
      return;
    }
    if (state.task.responseFormat !== 'single_choice' && runtimeAvailability !== 'ready') {
      showMessage(RUNTIME_UNAVAILABLE_MESSAGE, 'error');
      return;
    }
    saveRequest.current += 1;
    setActiveOperation('submit_answer');
    setBusy(true);
    setAnalysisRetry(false);
    try {
      const nextState = await submitPhase163LiveAnswer(choiceAnswer || answer);
      applyState(nextState);
      if (
        nextState.status === 'retry_required' &&
        nextState.primaryAction === 'submit_answer' &&
        nextState.studentMessage
      ) {
        showMessage(nextState.studentMessage);
      }
    } catch (error) {
      if (isPhase163DiagnosisBoundaryUnavailable(error)) {
        setRuntimeAvailability('unavailable');
        setAnalysisRetry(false);
        showMessage(RUNTIME_UNAVAILABLE_MESSAGE, 'error');
      } else {
        setAnalysisRetry(isRetryableAnalysisFailure(error));
        showMessage(toMessage(error), 'error');
      }
    } finally {
      setBusy(false);
      setActiveOperation(null);
    }
  }

  async function resumeProcessing() {
    const choiceAnswer = buildChoiceAnswer(state, selectedOptionId) || state?.singleChoiceDraft;
    if (busy || (state?.task?.responseFormat === 'single_choice' ? !choiceAnswer : !answer.trim())) return;
    const resourceOnlyRetry = state?.primaryAction === 'retry_resource';
    if (!resourceOnlyRetry && state?.task?.responseFormat !== 'single_choice' && runtimeAvailability !== 'ready') {
      showMessage(RUNTIME_UNAVAILABLE_MESSAGE, 'error');
      return;
    }
    setBusy(true);
    showMessage(resourceOnlyRetry ? '正在检查符合要求的下一任务。' : '正在恢复已经提交的结果，请稍候。');
    try {
      applyState(await submitPhase163LiveAnswer(choiceAnswer || answer));
    } catch (error) {
      if (isPhase163DiagnosisBoundaryUnavailable(error)) {
        setRuntimeAvailability('unavailable');
        showMessage(RUNTIME_UNAVAILABLE_MESSAGE, 'error');
      } else {
        showMessage(toMessage(error), 'error');
      }
    } finally {
      setBusy(false);
    }
  }

  async function startRevision() {
    if (busy) return;
    setBusy(true);
    try {
      applyState(await startPhase163FeedbackRevision());
    } catch (error) {
      showMessage(toMessage(error), 'error');
    } finally {
      setBusy(false);
    }
  }

  async function saveRevisionDraft() {
    if (busy || !revisionAnswer.trim()) return;
    setBusy(true);
    try {
      applyState(await savePhase163FeedbackRevisionDraft(revisionAnswer));
      showMessage('修订草稿已保存。', 'success');
    } catch (error) {
      showMessage(toMessage(error), 'error');
    } finally {
      setBusy(false);
    }
  }

  async function submitRevision() {
    if (busy || !revisionAnswer.trim()) return;
    setBusy(true);
    try {
      applyState(await submitPhase163FeedbackRevision(revisionAnswer));
      showMessage('修订已提交。', 'success');
    } catch (error) {
      showMessage(toMessage(error), 'error');
    } finally {
      setBusy(false);
    }
  }

  async function continueAfterFeedback() {
    if (busy) return;
    const hasChangedDraft = state?.revision?.status === 'draft'
      && revisionAnswer.trim() !== state.revision.initialAnswer.trim();
    if (hasChangedDraft && !window.confirm('本次修订尚未提交。继续后草稿仍会保留，是否继续？')) return;
    setBusy(true);
    try {
      const skippableRevisionAttemptId = state?.revision
        && (state.revision.status === 'offered' || state.revision.status === 'draft')
        ? state.revision.learningTaskAttemptId
        : undefined;
      if (state?.isTargetedMicroTraining) {
        applyState(await resumePhase163CoreAfterTargetedMicroTraining());
      } else if (state?.canAdvance) {
        const nextState = await advancePhase163LiveRound();
        if (skippableRevisionAttemptId) {
          await skipPhase163FeedbackRevisionByAttemptId(skippableRevisionAttemptId);
        }
        applyState(nextState);
      } else if (state?.sessionComplete) {
        if (skippableRevisionAttemptId) await skipPhase163FeedbackRevision();
        if (onCompleteSession) await onCompleteSession();
        else await onReturnToEntry();
      } else {
        if (skippableRevisionAttemptId) await skipPhase163FeedbackRevision();
        if (shouldSettleTerminalLearningSessionOnExit(state) && onCompleteSession) {
          await onCompleteSession();
        } else {
          await onReturnToEntry();
        }
      }
    } catch (error) {
      showMessage(toMessage(error), 'error');
    } finally {
      setBusy(false);
    }
  }

  async function returnFromWorkspace() {
    if (busy) return;
    setBusy(true);
    try {
      if (shouldSettleTerminalLearningSessionOnExit(state) && onCompleteSession) {
        await onCompleteSession();
      } else {
        await onReturnToEntry();
      }
    } catch (error) {
      showMessage(toMessage(error), 'error');
    } finally {
      setBusy(false);
    }
  }

  async function startTargetedMicroTraining() {
    if (busy || !state?.targetedMicroTraining?.assignmentId) return;
    setBusy(true);
    try {
      applyState(await startPhase163TargetedMicroTraining(state.targetedMicroTraining.assignmentId));
    } catch (error) {
      showMessage(toMessage(error), 'error');
    } finally {
      setBusy(false);
    }
  }

  async function skipTargetedMicroTraining() {
    if (busy || !state?.targetedMicroTraining?.assignmentId) return;
    setBusy(true);
    try {
      applyState(await skipPhase163TargetedMicroTraining(state.targetedMicroTraining.assignmentId));
    } catch (error) {
      showMessage(toMessage(error), 'error');
    } finally {
      setBusy(false);
    }
  }

  if (!state && busy) return <LoadingWorkspace />;
  if (!state) return <WorkspaceFailure message={toast?.message} onBack={onReturnToEntry} />;

  const completed = state.status === 'completed';
  const paused = state.status === 'blocked' || state.status === 'review_required';
  const recovering = state.status === 'retry_required' && state.primaryAction === 'resume_processing';
  const revising = state.revision?.status === 'draft';
  const revisionSubmitted = ['submitted', 'evaluating', 'evaluation_pending_retry'].includes(state.revision?.status);
  const revisionEvaluated = state.revision?.status === 'evaluated';
  const continueActionLabel = state.isTargetedMicroTraining
    ? state.canAdvance
      ? formatStudentNextQuestionAction(state.roundNumber, state.sessionTaskCount)
      : '完成本轮学习'
    : state.canAdvance
    ? formatStudentNextQuestionAction(state.roundNumber, state.sessionTaskCount)
    : state.sessionComplete
      ? '完成本轮学习'
      : '返回学习入口';
  return (
    <div className={`min-h-screen text-slate-950 ${completed || paused || recovering || revising || revisionSubmitted || revisionEvaluated ? 'bg-[#f7f9fc]' : 'learning-workspace-split-background bg-[#f7f9fc] min-[1060px]:h-screen min-[1060px]:overflow-hidden'}`}>
      <header className="sticky top-0 z-20 border-b border-slate-200 bg-white">
        <div className="mx-auto flex min-h-16 w-full max-w-[1680px] items-center justify-between gap-4 px-5 md:px-8">
          <button
            type="button"
            disabled={busy}
            onClick={returnFromWorkspace}
            className="flex h-10 w-10 items-center justify-center rounded-md border border-slate-200 text-slate-700 hover:bg-slate-50"
            aria-label="返回学习入口"
          >
            <ArrowLeft size={19} />
          </button>
          <div className="flex items-center gap-3 text-sm text-slate-500">
            {studentConditionalTaskTitle(state) ? <span className="font-medium text-emerald-700">{studentConditionalTaskTitle(state)}</span> : null}
            <span>第 {state.roundNumber} / {state.sessionTaskCount} 题</span>
          </div>
        </div>
      </header>

      {revising ? (
        <FeedbackRevisionWorkspace
          task={state.task}
          revision={state.revision}
          draftAnswer={revisionAnswer}
          busy={busy}
          onDraftChange={(value) => {
            setRevisionAnswer(value);
            if (toast) showMessage('');
          }}
          onSave={saveRevisionDraft}
          onSubmit={submitRevision}
          onContinue={continueAfterFeedback}
          continueLabel={continueActionLabel}
          inputRef={revisionInputRef}
        />
      ) : revisionEvaluated ? (
        <FeedbackRevisionEvaluated
          revision={state.revision}
          busy={busy}
          canAdvance={state.canAdvance}
          continueLabel={continueActionLabel}
          onContinue={continueAfterFeedback}
        />
      ) : revisionSubmitted ? (
        <FeedbackRevisionSubmitted
          revision={state.revision}
          busy={busy}
          canAdvance={state.canAdvance}
          continueLabel={continueActionLabel}
          onContinue={continueAfterFeedback}
        />
      ) : completed ? (
        <CompletedFeedback state={state} writingCorrections={writingCorrections} writingCorrectionStatus={writingCorrectionStatus} busy={busy} onContinue={continueAfterFeedback} onReturn={continueAfterFeedback} onStartRevision={startRevision} onStartTargeted={startTargetedMicroTraining} onSkipTargeted={skipTargetedMicroTraining} continueActionLabel={continueActionLabel} />
      ) : paused ? (
        <PausedWorkspace state={state} writingCorrections={writingCorrections} busy={busy} onReturn={continueAfterFeedback} onStartRevision={startRevision} />
      ) : recovering ? (
        <RecoveringWorkspace
          state={state}
          busy={busy}
          runtimeAvailability={runtimeAvailability}
          onResume={resumeProcessing}
          onReturn={onReturnToEntry}
        />
      ) : (
        <main className="mx-auto grid min-h-[calc(100vh-65px)] w-full max-w-[1680px] min-[1060px]:h-[calc(100vh-65px)] min-[1060px]:min-h-0 min-[1060px]:grid-cols-[clamp(460px,55%,760px)_minmax(480px,1fr)] min-[1060px]:overflow-hidden">
          <section className="border-b border-slate-200 bg-[#f7f9fc] px-6 py-8 lg:px-10 lg:py-10 min-[1060px]:min-h-0 min-[1060px]:overflow-y-auto min-[1060px]:overscroll-contain min-[1060px]:border-b-0 min-[1060px]:border-r">
            <div className="mx-auto w-full max-w-[760px]">
              <h1 className="flex items-center gap-3 text-lg font-semibold">
                <BookOpen size={20} className="text-slate-500" />
                {formatLearningMaterialHeading(state.task.materialTitle, state.task.materialAuthor)}
              </h1>
              <ReadingMaterialText className="mt-6 border-t border-slate-200 pt-7 text-base leading-8 text-slate-800">
                {state.task.readingText || '本题不需要额外阅读材料。'}
              </ReadingMaterialText>
            </div>
          </section>

          <section className="bg-white px-6 py-8 lg:px-10 lg:py-10 xl:px-14 min-[1060px]:min-h-0 min-[1060px]:overflow-y-auto min-[1060px]:overscroll-contain">
            <div className="mx-auto max-w-[640px]">
              <h1 className="text-lg font-semibold">题目</h1>
              <p className="mt-3 text-base leading-8 text-slate-800">{state.task.questionText}</p>

              {preAnswerGuidance ? (
                <details
                  className="mt-5 py-2 text-sm"
                  onToggle={(event) => {
                    if (event.currentTarget.open) recordPhase163PreAnswerHintOpened(state.roundId);
                  }}
                >
                  <summary className="cursor-pointer select-none font-medium text-emerald-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2">
                    需要提示时查看
                  </summary>
                  <p className="mt-3 leading-6 text-slate-600">{preAnswerGuidance.hint}</p>
                </details>
              ) : null}

              {state.task.responseFormat === 'single_choice' ? (
                <SingleChoiceResponseInput
                  options={state.task.singleChoice?.options || []}
                  selectedOptionId={selectedOptionId}
                  onSelect={(optionId) => {
                    recordPhase163FirstInputObserved(state.roundId);
                    setSelectedOptionId(optionId);
                    if (toast) showMessage('');
                  }}
                  disabled={busy || analysisRetry}
                  groupId={state.roundId}
                />
              ) : (
              <textarea
                ref={answerInputRef}
                value={answer}
                onChange={(event) => {
                  if (event.target.value.trim()) recordPhase163FirstInputObserved(state.roundId);
                  setAnswer(event.target.value);
                  if (toast) showMessage('');
                }}
                disabled={busy || analysisRetry}
                aria-label="输入你的回答"
                placeholder="请在这里输入你的回答。"
                className="mt-7 min-h-[240px] max-h-[400px] w-full resize-none rounded-md border border-slate-300 bg-[#f8fafc] px-4 py-4 text-base leading-7 text-slate-900 outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100 disabled:cursor-wait disabled:opacity-70"
              />
              )}
              {state.task.responseFormat !== 'single_choice' ? (
              <AnswerLengthIndicator
                answer={answer}
                minimumLength={state.task.minimumAnswerLength}
              />
              ) : null}

              {activeOperation === 'submit_answer' ? (
                <div className="mt-5 flex min-h-11 items-center justify-center gap-2 rounded-md bg-emerald-50 px-4 text-sm font-medium text-emerald-800" role="status" aria-live="polite">
                  <RefreshCw size={16} className="animate-spin" />
                  正在提交并分析本次回答…
                </div>
              ) : (
              <div className="mt-5 grid grid-cols-2 gap-3">
                <button
                  type="button"
                  disabled={busy || (state.task.responseFormat === 'single_choice' && !selectedOptionId)}
                  onClick={analysisRetry ? () => {
                    setAnalysisRetry(false);
                    showMessage('可以修改回答，完成后重新提交。');
                  } : saveDraft}
                  className={`flex min-h-11 items-center justify-center gap-2 rounded-md border border-emerald-600 bg-white px-4 text-sm text-emerald-700 transition hover:bg-emerald-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-40 ${activeOperation === 'save_draft' ? 'col-span-2' : ''}`}
                >
                  {activeOperation === 'save_draft' ? <RefreshCw size={16} className="animate-spin" /> : analysisRetry ? <Pencil size={16} /> : <Save size={16} />}
                  {activeOperation === 'save_draft' ? '正在保存…' : analysisRetry ? '返回修改' : state.task.responseFormat === 'single_choice' ? '保存选择' : '保存草稿'}
                </button>
                {activeOperation !== 'save_draft' ? (
                <button
                  type="button"
                  disabled={busy || (state.task.responseFormat === 'single_choice' && !selectedOptionId)}
                  onClick={submitAnswer}
                  className="flex min-h-11 items-center justify-center gap-2 rounded-md bg-emerald-600 px-4 text-sm text-white transition hover:bg-emerald-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  {analysisRetry || (state.task.responseFormat !== 'single_choice' && runtimeAvailability === 'checking') ? <RefreshCw size={16} className={runtimeAvailability === 'checking' ? 'animate-spin' : ''} /> : <ArrowRight size={16} />}
                  {analysisRetry ? '重新分析' : state.task.responseFormat === 'single_choice' ? '提交选择' : '提交本轮回答'}
                </button>
                ) : null}
              </div>
              )}
            </div>
          </section>
        </main>
      )}
      {toast ? (
        <WorkspaceToast
          key={toast.id}
          message={toast.message}
          tone={toast.tone}
          duration={toast.duration}
          onDismiss={() => setToast((current) => current?.id === toast.id ? null : current)}
        />
      ) : null}
    </div>
  );
}

function CompletedFeedback({
  state,
  writingCorrections,
  writingCorrectionStatus,
  busy,
  onContinue,
  onReturn,
  onStartRevision,
  onStartTargeted,
  onSkipTargeted,
  continueActionLabel,
}) {
  const positive = state.feedback?.whatYouDidWell?.slice(0, 1) || [];
  const thinkingReview = state.feedback?.thinkingReview;
  const guidance = state.feedback?.guidance;
  const attention = guidance ? [] : state.feedback?.whatNeedsAttention?.slice(0, 1) || [];
  const hasLearningNarrative = hasOutcomeNarrative(state.learningPresentation);
  const rawConvergenceView = resolveConvergenceStage3PresentationFlag() === 'convergence_v1'
    ? toConvergenceFeedbackStudentView(state.convergenceFeedbackPresentation)
    : undefined;
  const convergenceView = removeDuplicateRevisionNextAction(
    rawConvergenceView,
    state.revision?.status === 'offered' ? state.revision.revisionGoal?.instruction : undefined,
  );
  const fallbackFeedback = resolveCompletedFeedbackFallback({
    hasOutcomeNarrative: hasLearningNarrative,
    hasThinkingReview: Boolean(thinkingReview),
    positiveCount: positive.length,
    hasGuidance: Boolean(guidance),
    attentionCount: attention.length,
    responseFormat: state.task?.responseFormat,
    feedback: state.feedback,
  });
  const presentedFallbackFeedback = fallbackFeedback ? {
    ...fallbackFeedback,
    nextAction: state.canAdvance
      ? formatNextTaskContinuation(state.roundNumber + 1, state.sessionTaskCount)
      : state.sessionComplete
        ? '本题结果已经保存，当前题组已经全部完成。'
        : fallbackFeedback.nextAction,
  } : undefined;
  const hasReview = Boolean(thinkingReview || positive.length);
  const shouldStageFeedback = shouldStageFeedbackPresentation({
    correctionStatus: writingCorrectionStatus,
    correctionCount: writingCorrections.length,
    hasReview,
    hasGuidance: Boolean(guidance),
    prefersReducedMotion: prefersReducedMotion(),
    hasPresented: hasPresentedFeedback(state.roundId),
  });
  const [presentationStep, setPresentationStep] = useState(() => shouldStageFeedback ? 0 : 3);

  const revealAll = () => {
    setPresentationStep(3);
    markFeedbackPresented(state.roundId);
  };

  useEffect(() => {
    if (!shouldStageFeedback) {
      setPresentationStep((step) => synchronizeFeedbackPresentationStep(step, false));
      void recordPhase163FeedbackPresented(state.roundId).catch(() => {});
      return undefined;
    }
    const reviewTimer = window.setTimeout(() => {
      setPresentationStep((step) => Math.max(step, 1));
      void recordPhase163FeedbackPresented(state.roundId).catch(() => {});
    }, 180);
    const guidanceTimer = window.setTimeout(() => setPresentationStep((step) => Math.max(step, 2)), 520);
    const actionTimer = window.setTimeout(() => {
      setPresentationStep(3);
      markFeedbackPresented(state.roundId);
    }, 1050);
    const revealFromKeyboard = (event) => {
      if (event.key !== 'Enter' && event.key !== ' ') return;
      event.preventDefault();
      revealAll();
    };
    window.addEventListener('keydown', revealFromKeyboard);
    return () => {
      window.clearTimeout(reviewTimer);
      window.clearTimeout(guidanceTimer);
      window.clearTimeout(actionTimer);
      window.removeEventListener('keydown', revealFromKeyboard);
    };
  }, [shouldStageFeedback, state.roundId]);

  const handleRevealClick = () => {
    if (presentationStep >= 3 || window.getSelection()?.toString()) return;
    revealAll();
  };

  return (
    <main className="flex min-h-[calc(100vh-65px)] items-center px-6 py-12" onClick={handleRevealClick}>
      <div className="mx-auto w-full max-w-[720px]">
        <section className="rounded-md bg-white px-7 py-[60px] shadow-[0_10px_36px_rgba(15,23,42,0.08)] [&>section:first-child]:mt-0 md:px-10">
          {writingCorrections.length ? <WritingCorrections items={writingCorrections} /> : null}
          {convergenceView ? (
            <ConvergenceFeedbackOutcome
              view={convergenceView}
              reviewVisible={presentationStep >= 1}
              actionVisible={presentationStep >= 2}
            />
          ) : hasLearningNarrative ? (
            <StudentLearningNarrativeOutcome
              presentation={state.learningPresentation}
              responseFormat={state.task?.responseFormat}
              reviewVisible={presentationStep >= 1}
              actionVisible={presentationStep >= 2}
            />
          ) : (
            <>
              {thinkingReview ? <ThinkingReview review={thinkingReview} contentVisible={presentationStep >= 1} /> : positive.length ? <FeedbackList title="已经完成的思考" items={positive} tone="positive" contentVisible={presentationStep >= 1} /> : null}
              <div className={feedbackRevealClass(presentationStep >= 2)}>
                {guidance ? <StudentFeedbackGuidance guidance={guidance} compact={Boolean(thinkingReview)} /> : null}
              </div>
              {attention.length ? <FeedbackList title="需要留意" items={attention} tone="attention" /> : null}
            </>
          )}
          {!convergenceView && state.learningPresentation?.outcome?.progressMeaning ? (
            <NarrativeNote title="这次学习说明了什么" text={state.learningPresentation.outcome.progressMeaning} />
          ) : null}
          {state.revision?.status === 'offered' ? (
            <FeedbackRevisionGoal revision={state.revision} />
          ) : null}
          {presentedFallbackFeedback ? <CompletedFeedbackNotice feedback={presentedFallbackFeedback} /> : null}
          {state.targetedMicroTraining ? (
            <section className="mt-8 rounded-md bg-emerald-50 px-5 py-4">
              <h2 className="text-sm font-semibold text-emerald-900">{state.targetedMicroTraining.title}</h2>
              <p className="mt-2 text-sm leading-6 text-emerald-900">{state.targetedMicroTraining.message}</p>
            </section>
          ) : null}
        </section>
        <div className={`mt-8 grid min-h-11 gap-3 sm:grid-cols-2 ${feedbackRevealClass(presentationStep >= 3)}`}>
          {state.targetedMicroTraining ? (
            <>
              <button
                type="button"
                disabled={busy}
                onClick={onSkipTargeted}
                className="flex min-h-11 items-center justify-center rounded-md border border-slate-300 bg-white px-5 text-sm text-slate-700 transition hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2 disabled:opacity-40"
              >
                {state.targetedMicroTraining.secondaryActionText}
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={onStartTargeted}
                className="flex min-h-11 items-center justify-center gap-2 rounded-md bg-emerald-600 px-5 text-sm text-white transition hover:bg-emerald-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2 disabled:opacity-40"
              >
                {busy ? <RefreshCw size={16} className="animate-spin" /> : <ArrowRight size={16} />}
                {state.targetedMicroTraining.primaryActionText}
              </button>
            </>
          ) : state.revision?.status === 'offered' ? (
            <>
              <button
                type="button"
                disabled={busy}
                onClick={onContinue}
                className="flex min-h-11 items-center justify-center rounded-md border border-slate-300 bg-white px-5 text-sm text-slate-700 transition hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-40"
              >
                {continueActionLabel}
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={onStartRevision}
                className="flex min-h-11 items-center justify-center gap-2 rounded-md bg-emerald-600 px-5 text-sm text-white transition hover:bg-emerald-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-40"
              >
                {busy ? <RefreshCw size={16} className="animate-spin" /> : <Pencil size={16} />}
                {state.revision.actionLabel}
              </button>
            </>
          ) : state.canAdvance || state.sessionComplete ? (
            <button
              type="button"
              disabled={busy}
              onClick={onContinue}
              className="flex min-h-11 items-center justify-center gap-2 rounded-md bg-emerald-600 px-5 text-sm text-white transition hover:bg-emerald-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-40 sm:col-span-2 sm:mx-auto sm:min-w-52"
            >
              {busy ? <RefreshCw size={16} className="animate-spin" /> : <ArrowRight size={16} />}
              {continueActionLabel}
            </button>
          ) : (
            <button type="button" onClick={onReturn} className="min-h-11 rounded-md bg-emerald-600 px-5 text-sm text-white transition hover:bg-emerald-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2 sm:col-span-2 sm:mx-auto">
              返回学习入口
            </button>
          )}
        </div>
      </div>
    </main>
  );
}

function CompletedFeedbackNotice({ feedback }) {
  return (
    <section aria-live="polite">
      <h1 className="text-lg font-semibold text-slate-900">{feedback.title}</h1>
      <p className="mt-3 text-sm leading-7 text-slate-600">{feedback.summary}</p>
      {feedback.nextAction ? (
        <p className="mt-3 text-sm leading-7 text-slate-600">{feedback.nextAction}</p>
      ) : null}
    </section>
  );
}

function PausedWorkspace({ state, writingCorrections, busy, onReturn, onStartRevision }) {
  const positive = state.feedback?.whatYouDidWell?.slice(0, 1) || [];
  const thinkingReview = state.feedback?.thinkingReview;
  const guidance = state.feedback?.guidance;
  const attention = guidance ? [] : state.feedback?.whatNeedsAttention?.slice(0, 1) || [];
  const hasLearningNarrative = hasOutcomeNarrative(state.learningPresentation);
  const rawConvergenceView = resolveConvergenceStage3PresentationFlag() === 'convergence_v1'
    ? toConvergenceFeedbackStudentView(state.convergenceFeedbackPresentation)
    : undefined;
  const convergenceView = removeDuplicateRevisionNextAction(
    rawConvergenceView,
    state.revision?.status === 'offered' ? state.revision.revisionGoal?.instruction : undefined,
  );
  const showPauseMessage = !state.feedback || !['resource_unavailable', 'next_task_review'].includes(state.pauseReason);
  useEffect(() => {
    if (!state.feedback) return;
    void recordPhase163FeedbackPresented(state.roundId).catch(() => {});
  }, [state.feedback, state.roundId]);
  return (
    <main className="flex min-h-[calc(100vh-65px)] items-center px-6 py-12">
      <div className="mx-auto w-full max-w-[720px]">
        <section className="rounded-md bg-white px-7 py-7 shadow-[0_10px_36px_rgba(15,23,42,0.08)] [&>section:first-child]:mt-0 md:px-10">
          {state.feedback ? (
            <>
              {writingCorrections.length ? <WritingCorrections items={writingCorrections} /> : null}
              {convergenceView ? (
                <ConvergenceFeedbackOutcome view={convergenceView} />
              ) : hasLearningNarrative ? (
                <StudentLearningNarrativeOutcome
                  presentation={state.learningPresentation}
                  responseFormat={state.task?.responseFormat}
                />
              ) : (
                <>
                  {thinkingReview ? <ThinkingReview review={thinkingReview} /> : positive.length ? <FeedbackList title="已经完成的思考" items={positive} tone="positive" /> : null}
                  {guidance ? <StudentFeedbackGuidance guidance={guidance} compact={Boolean(thinkingReview)} /> : null}
                  {attention.length ? <FeedbackList title="需要留意" items={attention} tone="attention" /> : null}
                </>
              )}
            </>
          ) : null}
          {showPauseMessage ? (
            <div className={state.feedback ? 'mt-9 border-t border-slate-200 pt-7' : ''} aria-live="polite">
              <h2 className="text-base font-semibold">{state.studentTitle || '暂时无法继续'}</h2>
              <p className="mt-2 text-base leading-7 text-slate-600">{state.studentMessage}</p>
            </div>
          ) : null}
          {state.revision?.status === 'offered' ? (
            <FeedbackRevisionGoal revision={state.revision} />
          ) : null}
        </section>
        <div className="mt-8 grid gap-3 sm:grid-cols-2">
          <button type="button" disabled={busy} onClick={onReturn} className={`min-h-11 rounded-md px-5 text-sm transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2 disabled:opacity-40 ${state.revision?.status === 'offered' ? 'border border-slate-300 bg-white text-slate-700 hover:bg-slate-50' : 'bg-emerald-600 text-white hover:bg-emerald-700 sm:col-span-2 sm:mx-auto'}`}>返回学习入口</button>
          {state.revision?.status === 'offered' ? (
            <button type="button" disabled={busy} onClick={onStartRevision} className="flex min-h-11 items-center justify-center gap-2 rounded-md bg-emerald-600 px-5 text-sm text-white transition hover:bg-emerald-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2 disabled:opacity-40">
              {busy ? <RefreshCw size={16} className="animate-spin" /> : <Pencil size={16} />}
              {state.revision.actionLabel}
            </button>
          ) : null}
        </div>
      </div>
    </main>
  );
}

function RecoveringWorkspace({ state, busy, runtimeAvailability, onResume, onReturn }) {
  const unavailable = runtimeAvailability === 'unavailable' && state.task.responseFormat !== 'single_choice';
  return (
    <main className="mx-auto flex min-h-[calc(100vh-65px)] max-w-[720px] flex-col justify-center px-6 py-12">
      <RefreshCw size={24} className={busy ? 'animate-spin text-emerald-600' : 'text-slate-500'} />
      <h1 className="mt-4 text-lg font-semibold">{unavailable ? '分析服务尚未就绪' : '恢复本次提交'}</h1>
      <p className="mt-3 text-base leading-7 text-slate-600">{unavailable ? RUNTIME_UNAVAILABLE_MESSAGE : state.studentMessage}</p>
      <div className="mt-8 flex flex-wrap gap-3">
        <button type="button" disabled={busy || (state.task.responseFormat !== 'single_choice' && runtimeAvailability !== 'ready')} onClick={onResume} className="flex min-h-11 items-center justify-center gap-2 rounded-md bg-emerald-600 px-5 text-sm text-white transition hover:bg-emerald-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2 disabled:opacity-40">
          {busy ? <RefreshCw size={16} className="animate-spin" /> : <ArrowRight size={16} />}
          {unavailable ? '分析服务尚未就绪' : '继续处理'}
        </button>
        <button type="button" disabled={busy} onClick={onReturn} className="min-h-11 rounded-md border border-emerald-600 bg-white px-5 text-sm text-emerald-700 transition hover:bg-emerald-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2 disabled:opacity-40">稍后继续</button>
      </div>
    </main>
  );
}

function FeedbackList({ title, items, tone, contentVisible = true }) {
  return (
    <section className="mt-7">
      {tone === 'positive' ? (
        <FeedbackSectionTitle icon="positive">{title}</FeedbackSectionTitle>
      ) : (
        <h2 className="text-sm font-semibold text-slate-800">{title}</h2>
      )}
      <ol className={`mt-3 space-y-3 text-base leading-7 text-slate-700 ${tone === 'positive' ? 'pl-[26px]' : ''} ${feedbackRevealClass(contentVisible)}`}>
        {items.map((item, index) => (
          <li key={`${index}-${item}`} className={tone === 'attention' ? 'flex items-start gap-3' : ''}>
            {tone === 'attention' ? (
              <span className="w-5 shrink-0 text-right font-medium text-slate-500">{index + 1}.</span>
            ) : null}
            <span className="min-w-0">{item}</span>
          </li>
        ))}
      </ol>
    </section>
  );
}

function FeedbackSectionTitle({ icon, children }) {
  const Icon = icon === 'positive' ? ThumbsUp : icon === 'gap' ? Lightbulb : Pencil;
  const colorClass = icon === 'positive'
    ? 'text-emerald-600'
    : icon === 'gap'
      ? 'text-amber-500'
      : 'text-slate-900';
  return (
    <h2 className="flex items-center gap-2 text-sm font-semibold text-slate-800">
      <Icon size={18} aria-hidden="true" className={`shrink-0 ${colorClass}`} />
      <span>{children}</span>
    </h2>
  );
}

function ConvergenceFeedbackOutcome({ view, reviewVisible = true, actionVisible = true }) {
  return (
    <section aria-label={view.eyebrow}>
      {view.blocks.map((block) => {
        const visible = block.kind === 'next_action' ? actionVisible : reviewVisible;
        const icon = block.kind === 'acknowledgement'
          ? 'positive'
          : block.kind === 'primary_gap'
            ? 'gap'
            : 'action';
        return (
          <div
            key={block.kind}
            className={`mt-7 ${feedbackRevealClass(visible)}`}
            data-feedback-block={block.kind}
          >
            <FeedbackSectionTitle icon={icon}>{block.title}</FeedbackSectionTitle>
            <p className="mt-2 pl-[26px] text-base leading-7 text-slate-700">{block.text}</p>
          </div>
        );
      })}
    </section>
  );
}

function NarrativeNote({ title, text }) {
  return (
    <section className="mt-7 border-t border-slate-200 pt-6">
      <h2 className="text-sm font-semibold text-slate-800">{title}</h2>
      <p className="mt-2 text-base leading-7 text-slate-700">{text}</p>
    </section>
  );
}

function StudentLearningNarrativeOutcome({ presentation, responseFormat = 'text', reviewVisible = true, actionVisible = true }) {
  const outcome = presentation?.outcome || {};
  const hasReview = Boolean(outcome.achieved || outcome.primaryGap);
  const actions = splitNarrativeActions(presentation?.nextAction);
  const isSingleChoice = responseFormat === 'single_choice';
  return (
    <>
      {hasReview ? (
        <section className="mt-7">
          <div className={feedbackRevealClass(reviewVisible)}>
            {outcome.achieved ? (
              <div>
                <FeedbackSectionTitle icon="positive">{isSingleChoice ? '本次选择' : '已经完成的思考'}</FeedbackSectionTitle>
                <p className="mt-2 pl-[26px] text-base leading-7 text-slate-700">{outcome.achieved}</p>
              </div>
            ) : null}
            {outcome.primaryGap ? (
              <div className={outcome.achieved ? 'mt-5' : ''}>
                <FeedbackSectionTitle icon="gap">
                  {isSingleChoice ? '需要核对' : narrativeGapTitle(outcome.primaryGapMode, outcome.primaryGapReasonCode)}
                </FeedbackSectionTitle>
                <p className="mt-2 pl-[26px] text-base leading-7 text-slate-700">{outcome.primaryGap}</p>
              </div>
            ) : null}
          </div>
        </section>
      ) : null}
      {actions.length > 0 ? (
        <section className={`mt-7 ${feedbackRevealClass(actionVisible)}`}>
          <FeedbackSectionTitle icon="action">{isSingleChoice ? '回到材料看看' : '下一步训练'}</FeedbackSectionTitle>
          <ol className="mt-3 space-y-2 pl-[26px] text-base leading-7 text-slate-700">
            {actions.map((item, index) => (
              <li key={`${index}-${item}`}>{item}</li>
            ))}
          </ol>
        </section>
      ) : null}
    </>
  );
}

function hasOutcomeNarrative(presentation) {
  return Boolean(
    presentation?.outcome?.responseAnchor ||
    presentation?.outcome?.achieved ||
    presentation?.outcome?.primaryGap ||
    presentation?.nextAction,
  );
}

function splitNarrativeActions(value) {
  if (!value) return [];
  return value
    .split(/\r?\n/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function buildChoiceAnswer(state, selectedOptionId) {
  if (state?.task?.responseFormat !== 'single_choice' || !selectedOptionId || !state.task.singleChoice) return undefined;
  return {
    responseFormat: 'single_choice',
    selectedOptionIds: [selectedOptionId],
    optionSetVersion: state.task.singleChoice.optionSetVersion,
    displayedOptionOrder: state.task.singleChoice.options.map((option) => option.optionId),
  };
}

function narrativeGapTitle() {
  return '思考缺口';
}

function ThinkingReview({ review, contentVisible = true }) {
  const missingPoints = review.primaryGap ? [review.primaryGap] : review.missingPoints.slice(0, 1);
  const primaryGapCoverage = review.requirementCoverage?.find((item) =>
    item.requirementId === review.primaryGapRequirementId);
  if (!shouldRenderThinkingReview(review)) return null;
  const gapTitle = narrativeGapTitle();
  return (
    <section className="mt-7">
      <div className={feedbackRevealClass(contentVisible)}>
        {review.coveredPoints.length > 0 ? (
          <div>
            <FeedbackSectionTitle icon="positive">已经完成的思考</FeedbackSectionTitle>
            <ol className="mt-2 space-y-2 pl-[26px] text-base leading-7 text-slate-700">
              {review.coveredPoints.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ol>
          </div>
        ) : null}
        {missingPoints.length > 0 ? (
          <div className={review.coveredPoints.length > 0 ? 'mt-5' : ''}>
            <FeedbackSectionTitle icon="gap">{gapTitle}</FeedbackSectionTitle>
            <ol className="mt-2 space-y-2 pl-[26px] text-base leading-7 text-slate-700">
              {missingPoints.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ol>
          </div>
        ) : null}
      </div>
    </section>
  );
}

function feedbackRevealClass(visible) {
  return visible
    ? 'visible translate-y-0 opacity-100 transition-[opacity,transform] duration-200 motion-reduce:transition-none'
    : 'invisible translate-y-1 opacity-0 transition-[opacity,transform] duration-200 motion-reduce:transition-none';
}

function feedbackPresentationKey(roundId) {
  return `${FEEDBACK_PRESENTATION_KEY_PREFIX}${roundId}`;
}

function hasPresentedFeedback(roundId) {
  try {
    return window.localStorage.getItem(feedbackPresentationKey(roundId)) === 'presented';
  } catch {
    return false;
  }
}

function markFeedbackPresented(roundId) {
  try {
    window.localStorage.setItem(feedbackPresentationKey(roundId), 'presented');
  } catch {
    // Presentation persistence must never block the learning flow.
  }
}

function prefersReducedMotion() {
  return typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

function StudentFeedbackGuidance({ guidance, compact = false }) {
  const hasContent = compact
    ? guidance.revisionActions.length > 0
    : guidance.understandingNotice ||
      guidance.detailsToReview.length > 0 ||
      guidance.revisionActions.length > 0;
  if (!hasContent) return null;
  if (compact) {
    return (
      <section className="mt-7">
        <FeedbackSectionTitle icon="action">下一步训练</FeedbackSectionTitle>
        <ol className="mt-3 space-y-2 pl-[26px] text-base leading-7 text-slate-700">
          {guidance.revisionActions.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ol>
      </section>
    );
  }
  return (
    <section className="mt-7">
      <h2 className="text-base font-semibold">需要留意</h2>
      {guidance.understandingNotice ? (
        <p className="mt-3 text-base leading-7 text-slate-700">{guidance.understandingNotice}</p>
      ) : null}
      {guidance.detailsToReview.length > 0 ? (
        <div className="mt-5">
          <h3 className="text-sm font-semibold text-slate-800">重新看看</h3>
          <ul className="mt-2 space-y-2 text-base leading-7 text-slate-700">
            {guidance.detailsToReview.map((item) => <li key={item}>{item}</li>)}
          </ul>
        </div>
      ) : null}
      {guidance.revisionActions.length > 0 ? (
        <div className="mt-5">
          <FeedbackSectionTitle icon="action">下一步训练</FeedbackSectionTitle>
          <ol className="mt-2 space-y-2 pl-[26px] text-base leading-7 text-slate-700">
            {guidance.revisionActions.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ol>
        </div>
      ) : null}
    </section>
  );
}

function WritingCorrections({ items }) {
  return (
    <section className="mt-7">
      <h2 className="text-sm font-semibold text-slate-800">发现错别字</h2>
      <ol className="mt-3 space-y-3 text-base leading-7 text-slate-700">
        {items.map((item, index) => (
          <li key={item.correctionId} className="flex items-start gap-3">
            <span className="w-5 shrink-0 text-right font-medium text-slate-500">{index + 1}.</span>
            <span className="min-w-0">“{item.originalText}”可能是“{item.suggestedText}”，请检查。</span>
          </li>
        ))}
      </ol>
    </section>
  );
}

function answerFingerprint(value) {
  let hash = 0;
  for (const character of value) hash = ((hash * 31) + character.codePointAt(0)) >>> 0;
  return `${value.length}-${hash.toString(36)}`;
}

function LoadingWorkspace() {
  return <div className="flex min-h-screen items-center justify-center gap-2 text-sm text-slate-600"><RefreshCw size={17} className="animate-spin" />正在恢复学习任务</div>;
}

function WorkspaceFailure({ message, onBack }) {
  const presentation = resolveWorkspaceFailurePresentation(message);
  return (
    <main className="mx-auto max-w-[680px] px-6 py-16">
      <h1 className="text-xl font-semibold">{presentation.title}</h1>
      <p className="mt-3 text-base leading-7 text-slate-600">{presentation.message}</p>
      <button type="button" onClick={onBack} className="mt-7 min-h-11 rounded-md bg-emerald-600 px-5 text-sm text-white hover:bg-emerald-700">返回学习入口</button>
    </main>
  );
}

function resolveWorkspaceFailurePresentation(message) {
  if (/暂无符合复测要求的正式任务/.test(message || '')) {
    return {
      title: '下一项练习还需要准备',
      message: '本次学习要求已经保留，目前还没有适合继续的练习。已完成的学习记录不会丢失。',
    };
  }
  if (/暂无符合当前能力和任务要求的正式任务/.test(message || '')) {
    return {
      title: '当前没有新的正式任务',
      message: '上一轮结果已经保存。目前还没有适合继续的练习，系统不会安排不匹配的题目。',
    };
  }
  if (/当前正式任务尚未准备完成/.test(message || '')) {
    return {
      title: '当前任务需要检查',
      message: '任务来源已经找到，但正式执行条件尚未全部满足。已有学习记录不会丢失。',
    };
  }
  return {
    title: '暂时无法打开当前任务',
    message: message || '请稍后重新尝试。',
  };
}

function toMessage(error) {
  const value = error instanceof Error ? error.message : String(error);
  if (/learning_task_attempt|feedback.*revision/i.test(value)) {
    return '本次回答已经保留，结果显示暂未完成。请点击“重新分析”继续，无需重新作答。';
  }
  if (/api|provider|diagnosis|prompt|schema/i.test(value)) {
    return '本次分析尚未完成，回答已经保留。请点击“重新分析”继续，无需刷新或重新作答。';
  }
  return value;
}

function isRetryableAnalysisFailure(error) {
  const value = error instanceof Error ? error.message : String(error);
  if (/暂无符合|当前没有.*任务|任务尚未准备|resource|match|正式任务/i.test(value)) return false;
  return /api|provider|diagnosis|prompt|schema|learning_task_attempt|feedback.*revision|分析.*失败|分析.*超时/i.test(value);
}
