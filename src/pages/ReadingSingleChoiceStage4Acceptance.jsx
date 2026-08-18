import { useState } from 'react';
import { ArrowLeft, ArrowRight, RefreshCw, Save, ShieldCheck } from 'lucide-react';
import { Link } from 'react-router-dom';
import SingleChoiceResponseInput from '../components/continuous-learning/SingleChoiceResponseInput.jsx';

const options = [
  { optionId: 'wolf-correct', content: '为了借助柴草堆形成依托，避免腹背受敌。' },
  { optionId: 'wolf-surface', content: '因为他只是想在麦场里休息片刻。' },
  { optionId: 'wolf-cause', content: '因为狼已经停止追赶，他可以放心放下担子。' },
  { optionId: 'wolf-over', content: '因为他计划点燃柴草堆把两只狼烧死。' },
];

export default function ReadingSingleChoiceStage4Acceptance() {
  const [selectedOptionId, setSelectedOptionId] = useState('');
  const [savedOptionId, setSavedOptionId] = useState('');
  const [operation, setOperation] = useState('idle');
  const [feedback, setFeedback] = useState('');

  function save() {
    if (!selectedOptionId || operation !== 'idle') return;
    setSavedOptionId(selectedOptionId);
  }

  function submit() {
    if (!selectedOptionId || operation !== 'idle') return;
    setOperation('submitting');
    setFeedback('');
    window.setTimeout(() => {
      setOperation('idle');
      setFeedback(selectedOptionId === 'wolf-correct'
        ? '这次基础判断成立。下一步请进入文本解释，继续观察你能否说明处境与动作之间的关系。'
        : selectedOptionId === 'wolf-surface'
          ? '当前选择只看到“麦场”和“奔倚”的表面动作。请回到第三段，核对奔倚积薪前屠户面对的处境。'
          : '当前选择与材料中的事件顺序或证据范围不一致。请回到第三段核对“并驱如故”之后发生的动作。');
    }, 500);
  }

  return (
    <div className="min-h-screen bg-[#f7f9fc] text-slate-950">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex min-h-16 max-w-[1208px] items-center gap-4 px-5 md:px-8">
          <Link to="/internal/acceptance" aria-label="返回验收入口" className="flex h-10 w-10 items-center justify-center rounded-md border border-slate-200 text-slate-700 hover:bg-slate-50">
            <ArrowLeft size={18} />
          </Link>
          <div>
            <h1 className="text-lg font-semibold">单项选择学习端验收</h1>
            <p className="text-sm text-slate-500">复用正式 Learning 单选输入组件，不写入正式学生数据</p>
          </div>
        </div>
      </header>

      <main className="mx-auto grid w-full max-w-[1208px] gap-6 px-5 py-8 md:px-8 lg:grid-cols-[minmax(0,1fr)_minmax(420px,0.9fr)] lg:py-12">
        <section className="rounded-lg border border-slate-200 bg-white p-6 md:p-8">
          <div className="flex items-center gap-2 text-sm font-semibold text-amber-700"><ShieldCheck size={16} />内部产品验收</div>
          <h2 className="mt-5 text-lg font-semibold">阅读材料</h2>
          <div className="mt-4 space-y-4 text-base leading-8 text-slate-700">
            <p>屠惧，投以骨。一狼得骨止，一狼仍从。复投之，后狼止而前狼又至。骨已尽矣，而两狼之并驱如故。</p>
            <p>屠大窘，恐前后受其敌。顾野有麦场，场主积薪其中，苫蔽成丘。屠乃奔倚其下，弛担持刀。</p>
          </div>
        </section>

        <section className="rounded-lg border border-slate-200 bg-white p-6 md:p-8" data-testid="single-choice-stage4-acceptance">
          <p className="text-sm font-semibold text-slate-500">基础理解 · 局部因果</p>
          <h2 className="mt-3 text-lg font-semibold">屠户为什么“奔倚”积薪堆下？</h2>
          <SingleChoiceResponseInput
            options={options}
            selectedOptionId={selectedOptionId}
            onSelect={(optionId) => {
              setSelectedOptionId(optionId);
              setFeedback('');
            }}
            disabled={operation !== 'idle' || Boolean(feedback)}
            groupId="stage4-product-acceptance"
          />

          {operation === 'submitting' ? (
            <div className="mt-5 flex min-h-11 items-center justify-center gap-2 rounded-md bg-emerald-50 px-4 text-sm font-medium text-emerald-800" role="status" aria-live="polite" data-testid="choice-submit-running">
              <RefreshCw size={16} className="animate-spin" />
              正在提交并分析本次回答…
            </div>
          ) : feedback ? (
            <div className="mt-5 rounded-md border-l-2 border-emerald-600 bg-emerald-50 px-4 py-4" role="status" data-testid="choice-feedback">
              <p className="text-sm font-semibold text-emerald-900">本次反馈</p>
              <p className="mt-2 text-sm leading-6 text-emerald-900">{feedback}</p>
            </div>
          ) : (
            <div className="mt-5 grid grid-cols-2 gap-3">
              <button type="button" onClick={save} disabled={!selectedOptionId} className="flex min-h-11 items-center justify-center gap-2 rounded-md border border-emerald-600 bg-white px-4 text-sm text-emerald-700 disabled:cursor-not-allowed disabled:opacity-40">
                <Save size={16} />保存选择
              </button>
              <button type="button" onClick={submit} disabled={!selectedOptionId} className="flex min-h-11 items-center justify-center gap-2 rounded-md bg-emerald-600 px-4 text-sm text-white disabled:cursor-not-allowed disabled:opacity-40">
                <ArrowRight size={16} />提交选择
              </button>
            </div>
          )}
          {savedOptionId && !feedback && operation === 'idle' ? <p className="mt-3 text-sm text-emerald-700" role="status">当前选择已保存。</p> : null}
        </section>
      </main>
    </div>
  );
}
