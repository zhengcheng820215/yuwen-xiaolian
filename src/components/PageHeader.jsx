import { ChevronLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export default function PageHeader({ title, subtitle, back = false }) {
  const navigate = useNavigate();
  return (
    <header className="sticky top-0 z-20 bg-[#f5f7fb]/95 px-5 pb-3 pt-4 backdrop-blur">
      <div className="flex items-center gap-3">
        {back && (
          <button
            aria-label="返回"
            onClick={() => navigate(-1)}
            className="flex h-10 w-10 items-center justify-center rounded-md bg-white text-slate-700 shadow-sm"
          >
            <ChevronLeft size={22} />
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
