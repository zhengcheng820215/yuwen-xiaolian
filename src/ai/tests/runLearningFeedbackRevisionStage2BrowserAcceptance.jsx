import React, { useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { Pencil } from 'lucide-react';
import { decideLearningFeedbackRevisionOffer } from '../agents/learningFeedbackRevisionOfferPolicy.ts';
import { IndexedDBLearningTaskAttemptRepository } from '../repositories/indexedDBLearningCollectionRepositories.ts';
import { LearningFeedbackRevisionPersistenceService } from '../services/learningFeedbackRevisionPersistenceService.ts';
import {
  FeedbackRevisionGoal,
  FeedbackRevisionSubmitted,
  FeedbackRevisionWorkspace,
} from '../../components/continuous-learning/FeedbackGuidedRevision.jsx';
import '../../styles.css';

const parameters = new URLSearchParams(window.location.search);
const databaseName = parameters.get('db') || 'learning_feedback_revision_stage2_browser_acceptance';
const repository = new IndexedDBLearningTaskAttemptRepository(databaseName);
const service = new LearningFeedbackRevisionPersistenceService(repository);
const goal = decideLearningFeedbackRevisionOffer({
  taskRole: 'training',
  answerStatus: 'partially_meets',
  formalDiagnosisId: 'diagnosis-stage2-browser',
  formalFeedbackId: 'feedback-stage2-browser',
  formalFeedbackReady: true,
  requirementCoverage: [{
    requirementId: 'text-evidence',
    requirementType: 'text_evidence',
    requirementText: '结合材料中的具体行为说明判断依据',
    required: true,
    status: 'missing',
    studentEvidence: [],
    taskEvidence: ['父亲在原地停留很久'],
    source: 'formal_diagnosis',
    gapMessage: '还缺少能支持判断的具体行为依据。',
    gapReasonCode: 'missing_text_evidence',
  }],
  guidance: {
    detailsToReview: ['回看父亲离开前的具体行为。'],
    revisionActions: ['补充父亲离开前的具体行为，并说明这一行为如何支持你的判断。'],
  },
}).revisionGoal;

const task = {
  readingText: '父亲走到门口，又回头望了很久，才慢慢离开。',
  questionText: '父亲为什么舍不得离开？请结合材料说明理由。',
  minimumAnswerLength: 20,
};

function Stage2Acceptance() {
  const [record, setRecord] = useState(null);
  const [draftAnswer, setDraftAnswer] = useState('');
  const [busy, setBusy] = useState(true);
  const [notice, setNotice] = useState('正在恢复阶段 2 验收状态…');
  const inputRef = useRef(null);

  useEffect(() => {
    let active = true;
    void initialize().then((next) => {
      if (!active) return;
      applyRecord(next, '阶段 2 验收状态已恢复。');
    }).catch((error) => {
      if (active) setNotice(error instanceof Error ? error.message : String(error));
    }).finally(() => active && setBusy(false));
    return () => { active = false; };
  }, []);

  function applyRecord(next, message) {
    setRecord(next);
    setDraftAnswer(next.revision?.draftAnswer || next.initialResponse.answerText);
    setNotice(message);
  }

  async function startRevision() {
    if (!record || !goal) return;
    setBusy(true);
    try {
      applyRecord(await service.startRevision(record.learningTaskAttemptId, goal), '已进入一次反馈后修订。');
    } finally {
      setBusy(false);
    }
  }

  async function saveDraft() {
    if (!record) return;
    setBusy(true);
    try {
      applyRecord(await service.saveRevisionDraft(record.learningTaskAttemptId, draftAnswer), '修订草稿已保存，可刷新页面验证恢复。');
    } finally {
      setBusy(false);
    }
  }

  async function submitRevision() {
    if (!record) return;
    setBusy(true);
    try {
      applyRecord(await service.submitRevision(record.learningTaskAttemptId, draftAnswer), '修订已独立提交，首次回答未被覆盖。');
    } finally {
      setBusy(false);
    }
  }

  if (!record) return <p className="p-8 text-slate-700">{notice}</p>;
  const revision = presentation(record);
  return (
    <div>
      <div className="fixed right-4 top-4 z-50 rounded-md bg-slate-900 px-4 py-2 text-sm text-white" role="status">{notice}</div>
      {record.status === 'feedback_presented' ? (
        <main className="flex min-h-screen items-center bg-[#f7f9fc] px-6 py-12">
          <div className="mx-auto w-full max-w-[720px]">
            <section className="rounded-md bg-white px-8 py-10 shadow-[0_10px_36px_rgba(15,23,42,0.08)]">
              <p className="text-sm font-medium text-emerald-700">诊断反馈</p>
              <h1 className="mt-3 text-xl font-semibold">已经找到主要思路，还需要补充依据</h1>
              <p className="mt-3 text-base leading-7 text-slate-700">你判断父亲舍不得离开是合理的，但还没有引用父亲离开前的具体行为。</p>
              <FeedbackRevisionGoal revision={revision} />
            </section>
            <div className="mt-8 grid gap-3 sm:grid-cols-2">
              <button type="button" className="min-h-11 rounded-md border border-slate-300 bg-white px-5 text-sm text-slate-700">继续下一项</button>
              <button type="button" disabled={busy} onClick={startRevision} className="flex min-h-11 items-center justify-center gap-2 rounded-md bg-emerald-600 px-5 text-sm text-white disabled:opacity-40">
                <Pencil size={16} />根据反馈修订
              </button>
            </div>
          </div>
        </main>
      ) : record.status === 'revision_draft' ? (
        <FeedbackRevisionWorkspace
          task={task}
          revision={revision}
          draftAnswer={draftAnswer}
          busy={busy}
          onDraftChange={setDraftAnswer}
          onSave={saveDraft}
          onSubmit={submitRevision}
          onContinue={() => setNotice('草稿仍保留，本次验收不切换任务。')}
          inputRef={inputRef}
        />
      ) : (
        <FeedbackRevisionSubmitted
          revision={revision}
          busy={busy}
          canAdvance
          onContinue={() => setNotice('第二阶段只验证提交与恢复，不执行第三阶段评估。')}
        />
      )}
      <output id="debug-result" className="sr-only" data-status={record.status}>
        {JSON.stringify({
          status: record.status,
          initialAnswer: record.initialResponse.answerText,
          draftAnswer: record.revision?.draftAnswer,
          revisedAnswer: record.revision?.revisedResponse?.answerText,
          revisionCount: record.revision ? 1 : 0,
        })}
      </output>
    </div>
  );
}

async function initialize() {
  const recovered = await service.recover('student-stage2-browser', 'round-stage2-browser');
  if (recovered.record) return recovered.record;
  return service.createInitialAttempt({
    initialAttemptId: 'attempt-stage2-browser-initial',
    studentId: 'student-stage2-browser',
    learningSessionId: 'session-stage2-browser',
    learningRoundId: 'round-stage2-browser',
    operationId: 'operation-stage2-browser',
    materialVersionId: 'material-stage2-browser-v1',
    resourceId: 'resource-stage2-browser',
    resourceVersionId: 'resource-stage2-browser-v1',
    taskRole: 'training',
    rubricVersion: 'rubric-stage2-browser-v1',
    initialResponse: {
      responseId: 'response-stage2-browser-initial',
      executionSessionId: 'execution-stage2-browser',
      studentId: 'student-stage2-browser',
      taskId: 'task-stage2-browser',
      answerText: '父亲舍不得离开，因为他很珍惜这段经历。',
      submittedAt: '2026-08-14T03:00:00.000Z',
      usedHint: false,
      hintCount: 0,
    },
    initialDiagnosisId: 'diagnosis-stage2-browser',
    initialDiagnosisSchemaVersion: 'formal_diagnosis_commit_v1',
    initialFeedbackId: 'feedback-stage2-browser',
    initialFeedbackSchemaVersion: 'controlled_feedback_expression_v1',
    createdAt: '2026-08-14T03:00:00.000Z',
  });
}

function presentation(record) {
  return {
    learningTaskAttemptId: record.learningTaskAttemptId,
    status: record.revision?.status || 'offered',
    offerLevel: 'recommended',
    actionLabel: '根据反馈修订',
    revisionGoal: record.revision?.revisionGoal || goal,
    initialAnswer: record.initialResponse.answerText,
    draftAnswer: record.revision?.draftAnswer,
  };
}

createRoot(document.getElementById('root')).render(<Stage2Acceptance />);
