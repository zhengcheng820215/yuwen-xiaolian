import { useNavigate } from 'react-router-dom';

export default function PageHeader({ title, subtitle, back = false, backTo }) {
  const navigate = useNavigate();
  return (
    <header className="sticky top-0 z-20 bg-[#f5f7fb]/95 px-5 pb-3 pt-4 backdrop-blur">
      <div className="flex items-start gap-3">
        {back && (
          <button
            aria-label="返回"
            onClick={() => backTo ? navigate(backTo) : navigate(-1)}
            className="min-h-10 shrink-0 rounded-md bg-white px-3 text-sm font-semibold text-slate-700 shadow-sm"
          >
            返回
          </button>
        )}
        <div>
          <h1 className="text-xl font-semibold text-slate-900">{title}</h1>
          {subtitle && <p className="mt-1 text-sm text-slate-500">{subtitle}</p>}
        </div>
      </div>
    </header>
  );
}
