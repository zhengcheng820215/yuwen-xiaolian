import { useState } from 'react';
import PageHeader from '../components/PageHeader.jsx';
import { runRealAIDiagnosisLoop } from '../ai/agents/realAIDiagnosisAgent.ts';
import { normalizeAbilityEvidence } from '../ai/schemas/abilityEvidence.schema.ts';

const initialQuestion = '结合上下文，说说你对“那盏灯不仅照亮了回家的路，也照亮了父亲对我的牵挂”这句话的理解。';
const initialReferenceAnswer = '“照亮”不是指灯光真正照亮，而是指作者通过这盏灯感受到父亲一直以来的关爱和牵挂，表达了作者对父亲爱的理解和感动。';
const initialStudentAnswer = '这句话表现了作者感受到父亲对自己的爱，也表达了作者的感动。';

const previousEvidence = [
  normalizeAbilityEvidence({
    id: 'phase42-demo-prev-expression-001',
    studentId: 'demo-student',
    ability: '表达',
    evidenceType: 'weakness',
    source: 'diagnosis',
    observation: '学生能够给出结论，但解释时缺少“观点 + 文本依据 + 说明”的完整结构。',
    rootCause: '表达链条不完整，容易只写结论。',
    confidence: 0.68,
    createdAt: '2026-07-01T08:00:00.000Z',
  }),
  normalizeAbilityEvidence({
    id: 'phase42-demo-prev-summary-001',
    studentId: 'demo-student',
    ability: '概括',
    evidenceType: 'positive',
    source: 'training',
    observation: '学生能够抓住人物和主要事件，完成简短概括。',
    confidence: 0.74,
    createdAt: '2026-07-02T08:00:00.000Z',
  }),
];

export default function RealAIDiagnosisDemo() {
  const [question, setQuestion] = useState(initialQuestion);
  const [referenceAnswer, setReferenceAnswer] = useState(initialReferenceAnswer);
  const [studentAnswer, setStudentAnswer] = useState(initialStudentAnswer);
  const [targetAbility, setTargetAbility] = useState('理解');
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');
  const [running, setRunning] = useState(false);

  async function handleRun() {
    setRunning(true);
    setError('');

    try {
      const loopResult = await runRealAIDiagnosisLoop({
        studentId: 'demo-student',
        question,
        referenceAnswer,
        studentAnswer,
        previousEvidence,
        taskId: 'phase42-demo-task',
        diagnosisId: `phase42-demo-${Date.now()}`,
        createdAt: new Date().toISOString(),
      });
      setResult(loopResult);
    } catch (diagnosisError) {
      setError(diagnosisError instanceof Error ? diagnosisError.message : 'Phase 4.2 Demo 运行失败。');
    } finally {
      setRunning(false);
    }
  }

  const diagnosis = result?.diagnosisResult;
  const profile = result?.studentAbilityProfile;
  const promptSummary = result ? buildPromptSummary(result.prompt, result.questionMetadata) : null;

  return (
    <div className="min-h-screen bg-[#f5f7fb]">
      <PageHeader
        title="真实 AI 诊断 Demo"
        subtitle="Phase 4.2：提示词构建 → 诊断结果 → 能力证据 → 学生能力画像"
        back
      />

      <main className="space-y-4 px-4 pb-8">
        <section className="rounded-md border border-slate-200 bg-white p-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="text-base font-semibold text-slate-950">输入区</h2>
              <p className="mt-1 text-sm leading-6 text-slate-600">
                当前页面用于验收 Phase 4.2 运行链路，默认使用干运行模拟 AI。
              </p>
            </div>
            <span className="rounded-md bg-blue-50 px-3 py-2 text-sm font-semibold text-blue-700">
              {result?.usedLiveAI ? '真实 AI' : '干运行'}
            </span>
          </div>

          <div className="mt-4 grid gap-3">
            <TextArea label="题目" value={question} onChange={setQuestion} rows={4} />
            <TextArea label="参考答案 / 评分要点" value={referenceAnswer} onChange={setReferenceAnswer} rows={4} />
            <TextArea label="学生答案" value={studentAnswer} onChange={setStudentAnswer} rows={4} />
            <TextInput label="目标能力" value={targetAbility} onChange={setTargetAbility} />
          </div>

          <div className="mt-4 rounded-md border border-slate-200 bg-slate-50 p-3 text-sm leading-6 text-slate-600">
            <div className="font-semibold text-slate-800">历史能力证据</div>
            <p>当前 Demo 固定带入 {previousEvidence.length} 条历史证据，用于验证长期运行层合并能力。</p>
          </div>

          <button
            type="button"
            onClick={handleRun}
            disabled={running}
            className="mt-4 w-full rounded-md bg-blue-600 px-4 py-3 text-base font-semibold text-white disabled:bg-slate-400"
          >
            {running ? '运行中...' : '运行阶段 4.2 链路'}
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
              <h2 className="text-base font-semibold text-slate-950">提示词构建结果</h2>
              <div className="mt-3 grid gap-3 text-sm">
                <InfoLine label="提示词长度" value={`${promptSummary.promptLength} 字符`} />
                <InfoLine label="题目类型" value={promptSummary.questionType} />
                <InfoLine label="评价方式" value={formatAssessmentMode(promptSummary.assessmentMode)} />
                <InfoLine label="主要能力" value={promptSummary.mainAbility} />
                <InfoBlock title="提示词摘要" value={promptSummary.preview} />
              </div>
            </section>

            <section className="rounded-md border border-slate-200 bg-white p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h2 className="text-base font-semibold text-slate-950">诊断结果</h2>
                <span className="rounded-md bg-blue-50 px-2 py-1 text-sm font-semibold text-blue-700">
                  置信度 {formatPercent(diagnosis.confidence)}
                </span>
              </div>
              <div className="mt-3 grid gap-3 text-sm">
                <InfoBlock title="答案理解" value={diagnosis.diagnosisSummary} />
                <InfoLine label="正确性判断" value={`是否正确：${diagnosis.correct ? '是' : '否'} / 答案状态：${formatAnswerStatus(diagnosis.answerStatus)} / 分档：${formatScoreBand(diagnosis.scoreBand)}`} />
                <InfoLine label="能力" value={diagnosis.mainAbility} />
                <InfoLine label="证据类型" value={formatEvidenceType(result.newAbilityEvidence.evidenceType)} />
                <InfoBlock title="根本原因" value={diagnosis.rootCause} />
                <InfoBlock title="判断依据" value={diagnosis.abilityEvidence.join('\n')} />
                <InfoBlock title="建议训练重点" value={result.topWeakness[0]?.suggestedTrainingFocus || diagnosis.nextTraining} />
              </div>
            </section>

            <section className="rounded-md border border-slate-200 bg-white p-4">
              <h2 className="text-base font-semibold text-slate-950">Evidence 更新</h2>
              <div className="mt-3 grid gap-3">
                <EvidenceList title="历史能力证据" items={previousEvidence} />
                <EvidenceList title="本次新增能力证据" items={[result.newAbilityEvidence]} />
                <UpdatedEvidenceSummary
                  previousCount={previousEvidence.length}
                  newCount={1}
                  items={result.updatedEvidence}
                />
              </div>
            </section>

            <section className="rounded-md border border-slate-200 bg-white p-4">
              <h2 className="text-base font-semibold text-slate-950">能力证据汇总</h2>
              <div className="mt-3 grid gap-3">
                {result.evidenceSummary.map((summary) => (
                  <article key={summary.ability} className="rounded-md bg-slate-50 p-3 text-sm">
                    <div className="font-semibold text-slate-950">{summary.ability}</div>
                    <p className="mt-2 leading-6 text-slate-600">
                      薄弱 {summary.weaknessCount} / 正向 {summary.positiveCount} / 成长 {summary.growthCount} / 证据不足 {summary.insufficientCount}
                    </p>
                    <p className="mt-1 leading-6 text-slate-500">
                      平均置信度 {formatPercent(summary.averageConfidence)}
                    </p>
                  </article>
                ))}
              </div>
            </section>

            <section className="rounded-md border border-slate-200 bg-white p-4">
              <h2 className="text-base font-semibold text-slate-950">优先薄弱能力</h2>
              <div className="mt-3 grid gap-3">
                {result.topWeakness.map((item, index) => (
                  <article key={item.ability} className="rounded-md bg-slate-50 p-3 text-sm">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <h3 className="font-semibold text-slate-950">
                        {index + 1}. {item.ability}
                      </h3>
                      <span className="rounded-md bg-white px-2 py-1 text-xs font-semibold text-blue-700">
                        优先级 {item.priority}
                      </span>
                    </div>
                    <InfoBlock title="证据依据" value={item.reasons.join('\n')} />
                    <InfoBlock title="训练方向" value={item.suggestedTrainingFocus} />
                  </article>
                ))}
              </div>
            </section>

            <section className="rounded-md border border-slate-200 bg-white p-4">
              <h2 className="text-base font-semibold text-slate-950">学生能力画像</h2>
              <div className="mt-3 grid gap-3 text-sm">
                <InfoLine label="当前薄弱能力" value={`${profile.current_weakness.primary} / 次级观察：${profile.current_weakness.secondary.join('、') || '暂无'}`} />
                <AbilityStatusList items={profile.ability_status} />
                <InfoBlock title="改善信号" value={profile.improvement_signals.map((signal) => `${signal.ability}: ${signal.signal}`).join('\n') || '暂无'} />
                <InfoBlock title="继续训练重点" value={profile.continue_training_focus} />
                <InfoBlock title="下一步建议" value={profile.next_step_recommendation} />
                <InfoBlock title="证据链接" value={profile.evidence_links.map((link) => `${link.evidenceId} / ${link.ability} / ${formatEvidenceType(link.evidenceType)}`).join('\n')} />
              </div>
            </section>
          </>
        ) : null}
      </main>
    </div>
  );
}

function TextArea({ label, value, onChange, rows }) {
  return (
    <label className="block text-sm">
      <span className="font-semibold text-slate-700">{label}</span>
      <textarea
        value={value}
        rows={rows}
        onChange={(event) => onChange(event.target.value)}
        className="mt-2 w-full resize-y rounded-md border border-slate-200 bg-slate-50 p-3 leading-6 text-slate-950 outline-none focus:border-blue-500"
      />
    </label>
  );
}

function TextInput({ label, value, onChange }) {
  return (
    <label className="block text-sm">
      <span className="font-semibold text-slate-700">{label}</span>
      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="mt-2 w-full rounded-md border border-slate-200 bg-slate-50 p-3 text-slate-950 outline-none focus:border-blue-500"
      />
    </label>
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

function EvidenceList({ title, items }) {
  return (
    <div className="rounded-md bg-slate-50 p-3 text-sm">
      <div className="font-semibold text-slate-950">
        {title} ({items.length})
      </div>
      <div className="mt-2 space-y-2">
        {items.map((item) => (
          <div key={item.id} className="rounded-md bg-white p-3 leading-6 text-slate-600">
            <div className="font-semibold text-slate-900">
              {item.ability} / {formatEvidenceType(item.evidenceType)} / {formatEvidenceSource(item.source)} / {formatPercent(item.confidence)}
            </div>
            <p>{item.observation}</p>
            {item.rootCause ? <p className="text-slate-500">根本原因：{item.rootCause}</p> : null}
          </div>
        ))}
      </div>
    </div>
  );
}

function UpdatedEvidenceSummary({ previousCount, newCount, items }) {
  return (
    <div className="rounded-md bg-slate-50 p-3 text-sm">
      <div className="font-semibold text-slate-950">
        合并后能力证据 ({items.length})
      </div>
      <p className="mt-2 leading-6 text-slate-600">
        历史能力证据 {previousCount} 条 + 本次新增能力证据 {newCount} 条，按 evidence.id 去重后共 {items.length} 条。
      </p>
      <div className="mt-2 space-y-1 leading-6 text-slate-600">
        {items.map((item) => (
          <div key={item.id}>
            {item.id} / {item.ability} / {formatEvidenceType(item.evidenceType)} / {formatPercent(item.confidence)}
          </div>
        ))}
      </div>
    </div>
  );
}

function AbilityStatusList({ items }) {
  return (
    <div className="rounded-md bg-slate-50 p-3">
      <div className="font-semibold text-slate-500">能力状态</div>
      <div className="mt-2 space-y-2">
        {items.map((item) => (
          <div key={item.ability} className="rounded-md bg-white p-3 leading-6">
            <div className="font-semibold text-slate-950">
              {item.ability} / {formatAbilityStatus(item.status)}
            </div>
            <p className="text-slate-600">{item.summary}</p>
            <p className="text-slate-500">
              薄弱 {item.weakness_count} / 正向 {item.positive_count} / 成长 {item.growth_count} / 证据不足 {item.insufficient_count}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}

function buildPromptSummary(prompt, metadata) {
  return {
    promptLength: prompt.length,
    preview: prompt.slice(0, 280),
    questionType: metadata?.questionType || '未知',
    assessmentMode: metadata?.assessmentMode || '未知',
    mainAbility: metadata?.mainAbility || '未知',
  };
}

function formatPercent(value) {
  return `${Math.round((Number(value) || 0) * 100)}%`;
}

function formatAssessmentMode(value) {
  const labels = {
    exact_match: '标准答案匹配',
    key_points: '要点覆盖',
    reasoning_chain: '推理链判断',
    expression_quality: '表达质量判断',
    process_operation: '过程行为判断',
  };
  return labels[value] || value || '未知';
}

function formatAnswerStatus(value) {
  const labels = {
    fully_meets: '完整满足',
    partially_meets: '部分满足',
    does_not_meet: '未满足',
  };
  return labels[value] || value || '暂无';
}

function formatScoreBand(value) {
  const labels = {
    high: '高',
    medium: '中',
    low: '低',
    invalid: '无效',
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

function formatEvidenceSource(value) {
  const labels = {
    diagnosis: '诊断',
    training: '训练',
    retest: '复测',
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
