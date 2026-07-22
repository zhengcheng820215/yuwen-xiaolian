import { useMemo, useState } from 'react';
import {
  AlertTriangle,
  ArrowLeft,
  BookOpen,
  CheckCircle2,
  CircleDashed,
  FileSearch,
  Layers3,
  ShieldAlert,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { loadResourceCoverageDashboardDemo } from '../api/resourceCoverageDashboardDemo.ts';

const abilityLabels = {
  extraction: '信息提取',
  comprehension: '理解',
  summarization: '概括',
  analysis: '分析',
  inference: '推理',
  expression: '表达',
};

const roleLabels = {
  training: '训练',
  retest: '复测',
  transfer: '迁移',
  diagnosis: '诊断',
  observation: '观察',
};

const statusMeta = {
  covered: { label: '已覆盖', tone: 'border-emerald-200 bg-emerald-50 text-emerald-800', dot: 'bg-emerald-500', icon: CheckCircle2 },
  thin: { label: '覆盖偏薄', tone: 'border-amber-200 bg-amber-50 text-amber-800', dot: 'bg-amber-500', icon: AlertTriangle },
  gap: { label: '存在缺口', tone: 'border-rose-200 bg-rose-50 text-rose-800', dot: 'bg-rose-500', icon: CircleDashed },
  blocked: { label: '资源被阻断', tone: 'border-red-300 bg-red-50 text-red-800', dot: 'bg-red-600', icon: ShieldAlert },
  not_planned: { label: '暂未规划', tone: 'border-slate-200 bg-slate-50 text-slate-500', dot: 'bg-slate-300', icon: CircleDashed },
};

const difficultyLabels = { basic: '基础', intermediate: '进阶', advanced: '提高' };
const questionTypeLabels = {
  multiple_choice: '选择题',
  true_false: '判断题',
  fill_blank: '填空题',
  open_short_answer: '开放简答',
  reading_comprehension: '阅读理解',
};

const actionLabels = {
  add_resource: '补充正式资源',
  add_material_cluster: '增加独立材料',
  repair_resource_metadata: '修复资源元数据',
  complete_review_or_freeze: '完成审核与冻结',
  enable_product_capability: '补齐产品执行能力',
  repair_registry: '修复 Registry',
  review_policy: '复核覆盖策略',
};

const gapLabels = {
  no_current_frozen_resource: '没有当前 Frozen Resource',
  insufficient_executable_resources: '可执行资源数量不足',
  insufficient_material_clusters: '独立材料数量不足',
  insufficient_independent_contexts: '独立观察情境不足',
  missing_required_difficulty: '缺少要求的难度层级',
  question_type_not_product_executable: '当前产品尚不能执行该题型',
  response_format_not_product_executable: '当前产品尚不能执行该作答形式',
  question_type_not_allowed_by_policy: '题型不符合当前覆盖策略',
};

const abilities = Object.keys(abilityLabels);
const roles = Object.keys(roleLabels);

export default function ResourceCoverageDashboardDemo() {
  const data = useMemo(() => loadResourceCoverageDashboardDemo(), []);
  const [view, setView] = useState('matrix');
  const [selectedKey, setSelectedKey] = useState('inference:training');

  const selectedCell = data.report.cells.find((cell) => `${cell.key.abilityId}:${cell.key.taskRole}` === selectedKey);
  const selectedGaps = data.report.gaps.filter((gap) => `${gap.cellKey.abilityId}:${gap.cellKey.taskRole}` === selectedKey);
  const selectedResources = data.resources.filter((resource) => (
    resource.abilityMetadata.abilityId === selectedCell?.key.abilityId
      && resource.abilityMetadata.taskRole === selectedCell?.key.taskRole
  ));
  const selectedMaterials = data.materials.filter((material) => (
    selectedResources.some((resource) => resource.materialId === material.materialId)
  ));

  return (
    <div className="min-h-screen bg-[#f6f8fb] text-slate-950">
      <header className="sticky top-0 z-20 border-b border-slate-200 bg-white/95 backdrop-blur">
        <div className="mx-auto flex min-h-16 max-w-[1440px] items-center justify-between gap-4 px-5 md:px-8">
          <div className="flex min-w-0 items-center gap-3">
            <Link to="/internal" aria-label="返回内部入口" title="返回内部入口" className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md border border-slate-200 text-slate-700 hover:bg-slate-50"><ArrowLeft size={18} /></Link>
            <div className="min-w-0">
              <h1 className="truncate text-lg font-semibold">资源覆盖仪表盘</h1>
              <p className="truncate text-sm text-slate-500">Phase 17.1 · 受控验收快照</p>
            </div>
          </div>
          <div className="hidden items-center gap-2 text-sm text-slate-600 md:flex"><FileSearch size={16} />只读，不修改正式资源</div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-[1440px] px-5 py-7 md:px-8 md:py-9">
        <section className="flex flex-col gap-5 border-b border-slate-200 pb-7 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-[820px]">
            <p className="text-sm font-semibold text-blue-700">Material Cluster × Ability × TaskRole</p>
            <h2 className="mt-2 text-xl font-semibold leading-8">检查现有正式资源能否支撑 Runtime</h2>
            <p className="mt-2 text-base leading-7 text-slate-600">覆盖状态、数量和缺口均来自同一份 ResourceCoverageReport。点击矩阵单元可查看对应材料、资源和阻断原因。</p>
          </div>
          <div className="inline-flex w-fit rounded-md border border-slate-200 bg-white p-1" aria-label="仪表盘视图">
            <button type="button" onClick={() => setView('matrix')} className={`whitespace-nowrap rounded px-4 py-2 text-sm font-semibold ${view === 'matrix' ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-slate-50'}`}>覆盖矩阵</button>
            <button type="button" onClick={() => setView('materials')} className={`whitespace-nowrap rounded px-4 py-2 text-sm font-semibold ${view === 'materials' ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-slate-50'}`}>材料追溯</button>
          </div>
        </section>

        <Summary summary={data.dashboard.summary} rejectedRecordCount={data.dashboard.rejectedRecordCount} />

        {view === 'matrix' ? (
          <div className="mt-7 grid gap-6 xl:grid-cols-[minmax(0,1fr)_390px]">
            <CoverageMatrix selectedKey={selectedKey} onSelect={setSelectedKey} cells={data.dashboard.cells} />
            <CellDetail cell={selectedCell} gaps={selectedGaps} resources={selectedResources} materials={selectedMaterials} />
          </div>
        ) : (
          <MaterialTraceability data={data} />
        )}

        <section className="mt-8 border-t border-slate-200 pt-6">
          <h2 className="text-base font-semibold">本 Demo 验证边界</h2>
          <div className="mt-3 grid gap-3 text-sm leading-6 text-slate-600 md:grid-cols-3">
            <p>矩阵展示正式 Report 的五种状态，不按题目总数自行推断。</p>
            <p>被阻断资源保留原因与身份，但不计入可执行覆盖。</p>
            <p>Observation Diversity 属于后续规划，不混入 17.1 覆盖结论。</p>
          </div>
        </section>
      </main>
    </div>
  );
}

function Summary({ summary, rejectedRecordCount }) {
  const items = [
    ['可执行资源', summary.executableResourceCount],
    ['材料集', summary.materialClusterCount],
    ['独立情境', summary.independentContextCount],
    ['已覆盖单元', summary.coveredCellCount],
    ['待补单元', summary.thinCellCount + summary.gapCellCount],
    ['阻断记录', rejectedRecordCount],
  ];
  return (
    <section className="mt-6 grid grid-cols-2 overflow-hidden rounded-md border border-slate-200 bg-white md:grid-cols-3 xl:grid-cols-6" aria-label="覆盖摘要">
      {items.map(([label, value]) => (
        <div key={label} className="border-b border-r border-slate-200 p-4 last:border-r-0 md:p-5">
          <p className="text-sm text-slate-500">{label}</p>
          <p className="mt-2 text-xl font-semibold tabular-nums">{value}</p>
        </div>
      ))}
    </section>
  );
}

function CoverageMatrix({ selectedKey, onSelect, cells }) {
  const byKey = new Map(cells.map((cell) => [`${cell.abilityId}:${cell.taskRole}`, cell]));
  return (
    <section className="min-w-0">
      <div className="mb-3 flex items-center justify-between gap-4">
        <h2 className="text-base font-semibold">能力与任务角色覆盖</h2>
        <p className="text-sm text-slate-500">数字：资源 / 材料 / 情境</p>
      </div>
      <div className="overflow-x-auto rounded-md border border-slate-200 bg-white">
        <div className="grid min-w-[860px] grid-cols-[132px_repeat(5,minmax(138px,1fr))]">
          <div className="border-b border-r border-slate-200 bg-slate-50 p-4 text-sm font-semibold text-slate-600">目标能力</div>
          {roles.map((role) => <div key={role} className="border-b border-r border-slate-200 bg-slate-50 p-4 text-center text-sm font-semibold text-slate-600 last:border-r-0">{roleLabels[role]}</div>)}
          {abilities.flatMap((ability) => {
            const row = [<div key={`${ability}-label`} className="flex items-center border-b border-r border-slate-200 px-4 py-3 text-sm font-semibold">{abilityLabels[ability]}</div>];
            roles.forEach((role) => {
              const key = `${ability}:${role}`;
              const cell = byKey.get(key);
              const meta = statusMeta[cell.status];
              row.push(
                <button key={key} type="button" data-cell-key={key} onClick={() => onSelect(key)} className={`min-h-[92px] border-b border-r border-slate-200 p-3 text-left transition last:border-r-0 ${selectedKey === key ? 'relative z-10 ring-2 ring-inset ring-blue-500' : 'hover:bg-slate-50'}`}>
                  <span className={`inline-flex rounded border px-2 py-1 text-xs font-semibold ${meta.tone}`}>{meta.label}</span>
                  <span className="mt-3 block text-sm tabular-nums text-slate-600">{cell.executableResourceCount} / {cell.materialClusterCount} / {cell.independentContextCount}</span>
                </button>,
              );
            });
            return row;
          })}
        </div>
      </div>
    </section>
  );
}

function CellDetail({ cell, gaps, resources, materials }) {
  if (!cell) return null;
  const meta = statusMeta[cell.status];
  const Icon = meta.icon;
  return (
    <aside className="self-start rounded-md border border-slate-200 bg-white p-5 xl:sticky xl:top-24">
      <div className="flex items-start justify-between gap-3">
        <div><p className="text-sm text-slate-500">当前单元</p><h2 className="mt-1 text-lg font-semibold">{abilityLabels[cell.key.abilityId]} · {roleLabels[cell.key.taskRole]}</h2></div>
        <span className={`inline-flex items-center gap-1.5 rounded border px-2 py-1 text-xs font-semibold ${meta.tone}`}><Icon size={14} />{meta.label}</span>
      </div>

      <div className="mt-5 grid grid-cols-3 gap-2 border-y border-slate-200 py-4 text-center">
        <Count label="资源" value={cell.executableResourceCount} />
        <Count label="材料" value={cell.materialClusterCount} />
        <Count label="情境" value={cell.independentContextCount} />
      </div>

      {gaps.length > 0 && (
        <section className="mt-5">
          <h3 className="text-sm font-semibold">缺口与动作</h3>
          <div className="mt-3 space-y-3">
            {gaps.map((gap) => (
              <div key={gap.gapId} className="border-l-2 border-amber-400 pl-3">
                <p className="text-sm font-semibold text-slate-800">{gapLabels[gap.code] || gap.reason}</p>
                <p className="mt-1 text-sm leading-6 text-slate-600">{actionLabels[gap.recommendedActionCode]}</p>
              </div>
            ))}
          </div>
        </section>
      )}

      <section className="mt-5">
        <h3 className="text-sm font-semibold">当前正式资源</h3>
        {resources.length > 0 ? <div className="mt-3 space-y-3">{resources.map((resource) => (
          <div key={resource.resourceVersionId} className="rounded border border-slate-200 p-3">
            <div className="flex items-start justify-between gap-3">
              <p className="text-sm font-semibold leading-6">{resource.title}</p>
              {!cell.resourceVersionIds.includes(resource.resourceVersionId) && <span className="shrink-0 text-xs font-semibold text-red-700">未计入</span>}
            </div>
            <p className="mt-1 text-xs leading-5 text-slate-500">{difficultyLabels[resource.abilityMetadata.difficulty]} · {questionTypeLabels[resource.questionType]} · {resource.materialSnapshot?.title}</p>
          </div>
        ))}</div> : <p className="mt-2 text-sm leading-6 text-slate-500">当前没有进入可执行覆盖的正式资源。</p>}
      </section>

      {materials.length > 0 && <p className="mt-4 text-xs leading-5 text-slate-500">来源材料：{materials.map((item) => item.title).join('、')}</p>}
    </aside>
  );
}

function Count({ label, value }) {
  return <div><p className="text-lg font-semibold tabular-nums">{value}</p><p className="mt-1 text-xs text-slate-500">{label}</p></div>;
}

function MaterialTraceability({ data }) {
  return (
    <section className="mt-7">
      <div className="mb-3 flex items-center gap-2"><Layers3 size={18} className="text-blue-600" /><h2 className="text-base font-semibold">材料集与能力观察入口</h2></div>
      <div className="divide-y divide-slate-200 overflow-hidden rounded-md border border-slate-200 bg-white">
        {data.dashboard.materialClusters.map((cluster) => {
          const material = data.materials.find((item) => item.materialId === cluster.materialId);
          const resources = data.resources.filter((item) => cluster.currentExecutableResourceIds.includes(item.resourceId));
          return (
            <article key={cluster.materialClusterId} className="grid gap-4 p-5 lg:grid-cols-[280px_minmax(0,1fr)]">
              <div>
                <div className="flex items-center gap-2"><BookOpen size={17} className="text-slate-500" /><h3 className="text-base font-semibold">{material?.title || cluster.materialId}</h3></div>
                <p className="mt-2 text-sm text-slate-500">{cluster.currentExecutableResourceIds.length} 个可执行任务 · v{material?.versionNumber || 1}</p>
              </div>
              <div className="grid gap-2 sm:grid-cols-2">
                {resources.map((resource) => (
                  <div key={resource.resourceId} className="rounded border border-slate-200 px-3 py-3">
                    <p className="text-sm font-semibold leading-6">{resource.title}</p>
                    <p className="mt-1 text-xs text-slate-500">{abilityLabels[resource.abilityMetadata.abilityId]} · {roleLabels[resource.abilityMetadata.taskRole]} · {difficultyLabels[resource.abilityMetadata.difficulty]}</p>
                  </div>
                ))}
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}
