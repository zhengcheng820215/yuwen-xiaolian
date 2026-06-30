import { useState } from 'react';
import { RotateCcw, Star } from 'lucide-react';
import PageHeader from '../components/PageHeader.jsx';
import Card from '../components/Card.jsx';

const levels = [
  { title: '成语接龙', task: '画龙点睛 -> 精益求精', stars: 2 },
  { title: '诗句配对', task: '把上下句拖进同一组', stars: 1 },
  { title: '错字侦探', task: '找出句子里的错别字', stars: 3 },
  { title: '文学人物猜猜看', task: '根据线索判断人物', stars: 0 },
  { title: '每日挑战', task: '5 题限时混合挑战', stars: 0 },
];

export default function FunPractice() {
  const [active, setActive] = useState(null);
  const [success, setSuccess] = useState(0);
  const [failed, setFailed] = useState(false);

  const finishLevel = (index) => {
    setActive(index);
    setFailed(false);
    setSuccess((value) => value + 1);
  };

  return (
    <>
      <PageHeader title="趣味挑战" subtitle="完成关卡获得星星，连续答对有鼓励" back />
      <div className="space-y-4 px-5">
        {success > 1 && (
          <div className="rounded-lg bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-700">
            连续答对 {success} 次，状态不错，继续保持。
          </div>
        )}
        {levels.map((level, index) => (
          <Card key={level.title}>
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="font-semibold text-slate-900">{level.title}</h2>
                <p className="mt-1 text-sm text-slate-500">{level.task}</p>
              </div>
              <div className="flex gap-1">
                {[0, 1, 2].map((star) => (
                  <Star
                    key={star}
                    size={17}
                    className={star < (active === index ? 3 : level.stars) ? 'fill-amber-400 text-amber-400' : 'text-slate-300'}
                  />
                ))}
              </div>
            </div>
            {active === index && !failed && (
              <p className="mt-3 rounded-md bg-blue-50 px-3 py-2 text-sm text-blue-700">本关完成，获得 3 颗星。</p>
            )}
            {failed && active === index && (
              <p className="mt-3 rounded-md bg-red-50 px-3 py-2 text-sm text-red-600">挑战失败，可以重新开始。</p>
            )}
            <div className="mt-4 grid grid-cols-2 gap-3">
              <button onClick={() => finishLevel(index)} className="min-h-11 rounded-md bg-blue-600 font-medium text-white">
                完成一关
              </button>
              <button
                onClick={() => {
                  setActive(index);
                  setFailed(true);
                  setSuccess(0);
                }}
                className="flex min-h-11 items-center justify-center gap-2 rounded-md bg-slate-100 font-medium text-slate-700"
              >
                <RotateCcw size={16} />
                重来
              </button>
            </div>
          </Card>
        ))}
      </div>
    </>
  );
}
