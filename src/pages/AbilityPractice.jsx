import { useState } from 'react';
import { BookOpen, PenLine } from 'lucide-react';
import PageHeader from '../components/PageHeader.jsx';
import Card from '../components/Card.jsx';
import readings from '../data/readings.json';

const abilityTypes = ['现代文阅读', '文言文阅读', '句子赏析', '段落概括', '作文审题', '作文片段训练'];

export default function AbilityPractice() {
  const [answer, setAnswer] = useState('');
  const [composition, setComposition] = useState('');
  const reading = readings[0];

  return (
    <>
      <PageHeader title="能力训练" subtitle="面向中考阅读与表达能力" back />
      <div className="space-y-4 px-5">
        <div className="flex gap-2 overflow-x-auto pb-1">
          {abilityTypes.map((item, index) => (
            <span key={item} className={`shrink-0 rounded-md px-3 py-2 text-sm ${index === 0 ? 'bg-blue-600 text-white' : 'bg-white text-slate-600'}`}>
              {item}
            </span>
          ))}
        </div>

        <Card>
          <div className="mb-3 flex items-center gap-2">
            <BookOpen size={20} className="text-blue-600" />
            <h2 className="font-semibold text-slate-900">{reading.title}</h2>
          </div>
          <p className="text-[15px] leading-7 text-slate-700">{reading.passage}</p>
        </Card>

        <Card>
          <h2 className="font-semibold text-slate-900">问题区</h2>
          <ol className="mt-3 list-inside list-decimal space-y-2 text-sm text-slate-700">
            {reading.questions.map((question) => (
              <li key={question}>{question}</li>
            ))}
          </ol>
          <textarea
            value={answer}
            onChange={(event) => setAnswer(event.target.value)}
            placeholder="写下你的答案要点"
            className="mt-4 min-h-28 w-full resize-none rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm outline-none focus:border-blue-400"
          />
          <div className="mt-4 rounded-lg bg-emerald-50 p-3">
            <p className="text-sm font-semibold text-emerald-800">参考答案</p>
            <p className="mt-2 text-sm leading-6 text-emerald-700">{reading.referenceAnswer}</p>
          </div>
          <div className="mt-3 rounded-lg bg-blue-50 p-3">
            <p className="text-sm font-semibold text-blue-800">答题思路</p>
            <p className="mt-2 text-sm leading-6 text-blue-700">{reading.thinkingPath}</p>
          </div>
          <p className="mt-3 text-sm text-slate-500">优化建议：答案要先概括内容，再点明情感或道理，避免只摘抄原文。</p>
        </Card>

        <Card>
          <div className="mb-3 flex items-center gap-2">
            <PenLine size={20} className="text-violet-600" />
            <h2 className="font-semibold text-slate-900">作文片段训练</h2>
          </div>
          <p className="text-sm leading-6 text-slate-600">材料：一次普通的坚持，可能悄悄改变你。请写 100-200 字片段。</p>
          <textarea
            value={composition}
            onChange={(event) => setComposition(event.target.value)}
            placeholder="从一个具体场景写起"
            className="mt-4 min-h-32 w-full resize-none rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm outline-none focus:border-blue-400"
          />
          <div className="mt-3 grid gap-3">
            <div className="rounded-lg bg-violet-50 p-3 text-sm leading-6 text-violet-700">
              示例点评：片段应有动作细节和心理变化，让“坚持”落在具体画面中。
            </div>
            <div className="rounded-lg bg-amber-50 p-3 text-sm leading-6 text-amber-700">
              修改建议：加入时间推移、困难感受和结果变化，结尾用一句简洁感悟收束。
            </div>
            <div className="rounded-lg bg-slate-50 p-3 text-sm leading-6 text-slate-700">
              优化范文：晚自习的灯亮着，我把错了三遍的几何题又抄到草稿纸上。笔尖停了又动，心里那点烦躁慢慢沉下去。等最后一步终于算对时，我忽然明白，坚持不是热血的一瞬，而是不肯放下的下一分钟。
            </div>
          </div>
        </Card>
      </div>
    </>
  );
}
