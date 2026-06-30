import { Link } from 'react-router-dom';
import { Home, RotateCcw, XCircle } from 'lucide-react';
import Card from '../components/Card.jsx';
import { useStudy } from '../context/StudyContext.jsx';

export default function Result() {
  const { lastResult } = useStudy();

  return (
    <div className="min-h-screen px-5 py-8">
      <header className="text-center">
        <p className="text-sm font-medium text-blue-600">{lastResult.category}</p>
        <h1 className="mt-2 text-3xl font-semibold text-slate-950">本次得分 {lastResult.score}</h1>
        <p className="mt-2 text-sm text-slate-500">完成一组练习后，看看下一步该补哪里。</p>
      </header>

      <Card className="mt-6">
        <div className="grid grid-cols-2 gap-4 text-center">
          <div>
            <p className="text-2xl font-semibold text-slate-900">{lastResult.correct}/{lastResult.total}</p>
            <p className="mt-1 text-xs text-slate-500">正确题数</p>
          </div>
          <div>
            <p className="text-2xl font-semibold text-slate-900">{lastResult.accuracy}%</p>
            <p className="mt-1 text-xs text-slate-500">正确率</p>
          </div>
          <div>
            <p className="text-2xl font-semibold text-slate-900">{lastResult.duration}</p>
            <p className="mt-1 text-xs text-slate-500">用时</p>
          </div>
          <div>
            <p className="text-2xl font-semibold text-red-500">{lastResult.mistakeCount}</p>
            <p className="mt-1 text-xs text-slate-500">错题数量</p>
          </div>
        </div>
      </Card>

      <Card className="mt-4">
        <h2 className="font-semibold text-slate-900">推荐下一步练习</h2>
        <p className="mt-2 text-sm leading-6 text-slate-600">
          {lastResult.mistakeCount > 0 ? '先查看错题本，把相关知识点重新练一遍。' : '正确率很稳，可以进入阅读理解或作文片段训练。'}
        </p>
      </Card>

      <div className="mt-6 grid gap-3">
        <Link to="/quiz/all" className="flex min-h-12 items-center justify-center gap-2 rounded-lg bg-blue-600 font-semibold text-white">
          <RotateCcw size={18} />
          再练一次
        </Link>
        <Link to="/mistakes" className="flex min-h-12 items-center justify-center gap-2 rounded-lg bg-red-50 font-semibold text-red-600">
          <XCircle size={18} />
          查看错题
        </Link>
        <Link to="/" className="flex min-h-12 items-center justify-center gap-2 rounded-lg bg-white font-semibold text-slate-700 shadow-sm">
          <Home size={18} />
          返回首页
        </Link>
      </div>
    </div>
  );
}
