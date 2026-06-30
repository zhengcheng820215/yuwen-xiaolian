import { useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ChevronLeft } from 'lucide-react';
import questions from '../data/questions.json';
import Card from '../components/Card.jsx';
import { useStudy } from '../context/StudyContext.jsx';

export default function Quiz() {
  const { category } = useParams();
  const navigate = useNavigate();
  const { addMistake, setLastResult } = useStudy();
  const decoded = decodeURIComponent(category || 'all');
  const quizQuestions = useMemo(
    () => (decoded === 'all' ? questions : questions.filter((item) => item.category === decoded)),
    [decoded],
  );
  const [index, setIndex] = useState(0);
  const [selected, setSelected] = useState('');
  const [input, setInput] = useState('');
  const [answered, setAnswered] = useState(false);
  const [records, setRecords] = useState([]);
  const current = quizQuestions[index] || questions[0];
  const userAnswer = current.type === '填空题' ? input.trim() : selected;
  const isCorrect = userAnswer === current.answer;

  const submitAnswer = (answerValue = userAnswer) => {
    if (!answerValue) return;
    const correct = answerValue === current.answer;
    setAnswered(true);
    if (!correct) addMistake(current, answerValue);
    setRecords((items) => {
      if (items.some((item) => item.id === current.id)) return items;
      return [...items, { id: current.id, correct, answer: answerValue }];
    });
  };

  const next = () => {
    if (index < quizQuestions.length - 1) {
      setIndex(index + 1);
      setSelected('');
      setInput('');
      setAnswered(false);
      return;
    }
    const finalRecords = records.length === quizQuestions.length ? records : [...records, { id: current.id, correct: isCorrect, answer: userAnswer }];
    const correct = finalRecords.filter((item) => item.correct).length;
    const total = quizQuestions.length;
    const accuracy = Math.round((correct / total) * 100);
    setLastResult({
      score: correct * 10,
      correct,
      total,
      accuracy,
      duration: `${Math.max(3, total * 2)} 分钟`,
      mistakeCount: total - correct,
      category: decoded === 'all' ? '综合小练' : decoded,
    });
    navigate('/result');
  };

  return (
    <div className="flex min-h-screen flex-col bg-[#f5f7fb]">
      <header className="sticky top-0 z-20 flex items-center gap-3 bg-[#f5f7fb]/95 px-5 py-4 backdrop-blur">
        <button onClick={() => navigate(-1)} aria-label="返回" className="flex h-10 w-10 items-center justify-center rounded-md bg-white shadow-sm">
          <ChevronLeft size={22} />
        </button>
        <div className="flex-1">
          <p className="text-sm text-slate-500">第 {index + 1} / {quizQuestions.length} 题</p>
          <h1 className="text-lg font-semibold text-slate-900">{current.type}</h1>
        </div>
      </header>

      <main className="flex-1 px-5 pb-5">
        <Card>
          <div className="mb-3 inline-flex rounded-md bg-blue-50 px-3 py-1 text-xs font-medium text-blue-700">
            {current.category} · {current.difficulty}
          </div>
          <h2 className="text-lg font-semibold leading-8 text-slate-950">{current.question}</h2>
        </Card>

        <div className="mt-4 space-y-3">
          {current.type === '填空题' ? (
            <input
              value={input}
              onChange={(event) => setInput(event.target.value)}
              disabled={answered}
              placeholder="请输入答案"
              className="h-13 w-full rounded-lg border border-slate-200 bg-white px-4 outline-none focus:border-blue-400"
            />
          ) : (
            current.options.map((option) => {
              const key = option[0];
              const chosen = selected === key;
              const correct = answered && key === current.answer;
              const wrong = answered && chosen && key !== current.answer;
              return (
                <button
                  key={option}
                  disabled={answered}
                  onClick={() => {
                    setSelected(key);
                    submitAnswer(key);
                  }}
                  className={`min-h-14 w-full rounded-lg border px-4 text-left text-sm font-medium transition ${
                    correct
                      ? 'border-emerald-400 bg-emerald-50 text-emerald-800'
                      : wrong
                        ? 'border-red-400 bg-red-50 text-red-700'
                        : chosen
                          ? 'border-blue-400 bg-blue-50 text-blue-700'
                          : 'border-slate-200 bg-white text-slate-700'
                  }`}
                >
                  {option}
                </button>
              );
            })
          )}
        </div>

        {answered && (
          <Card className="mt-4">
            <p className={`text-base font-semibold ${isCorrect ? 'text-emerald-700' : 'text-red-600'}`}>
              {isCorrect ? '回答正确' : '回答错误'}
            </p>
            <div className="mt-3 space-y-2 text-sm leading-6 text-slate-600">
              <p><span className="font-medium text-slate-900">正确答案：</span>{current.answer}</p>
              <p><span className="font-medium text-slate-900">知识点：</span>{current.knowledgePoint}</p>
              <p><span className="font-medium text-slate-900">解析说明：</span>{current.explanation}</p>
              <p><span className="font-medium text-slate-900">错题本状态：</span>{isCorrect ? '无需加入' : '已自动加入错题本'}</p>
            </div>
          </Card>
        )}
      </main>

      <footer className="sticky bottom-0 bg-white px-5 py-4 shadow-[0_-8px_24px_rgba(15,23,42,0.06)]">
        {current.type === '填空题' && !answered ? (
          <button onClick={() => submitAnswer()} className="min-h-12 w-full rounded-lg bg-blue-600 font-semibold text-white disabled:bg-slate-300" disabled={!input.trim()}>
            提交答案
          </button>
        ) : (
          <button onClick={next} className="min-h-12 w-full rounded-lg bg-blue-600 font-semibold text-white" disabled={!answered}>
            {index === quizQuestions.length - 1 ? '查看结果' : '下一题'}
          </button>
        )}
      </footer>
    </div>
  );
}
