import { NavLink, useLocation } from 'react-router-dom';

const tabs = [
  { to: '/', label: '首页' },
  { to: '/practice', label: '练习', frozen: true },
  { to: '/mistakes', label: '错题本', frozen: true },
  { to: '/profile', label: '我的', frozen: true },
];

const noTabPaths = ['/quiz', '/result'];
const workspacePaths = [
  '/continuous-learning-demo',
  '/phase15-integration-demo',
  '/question-resource-workbench',
  '/resource-matching-quality-demo',
];

export default function Layout({ children }) {
  const location = useLocation();
  const isWorkspace = workspacePaths.some((path) => location.pathname.startsWith(path));
  const hideTabs = isWorkspace || noTabPaths.some((path) => location.pathname.startsWith(path));
  const containerClassName = isWorkspace
    ? 'min-h-screen w-full bg-white'
    : 'mx-auto min-h-screen max-w-[430px] bg-[#f5f7fb] shadow-2xl shadow-slate-200/70';

  return (
    <div className={isWorkspace ? 'workspace-viewport min-h-screen w-full' : ''}>
      <div className={containerClassName}>
        <main className={hideTabs ? 'min-h-screen' : 'safe-bottom min-h-screen'}>{children}</main>
        {!hideTabs && (
          <nav className="fixed inset-x-0 bottom-0 z-30 mx-auto max-w-[430px] border-t border-slate-200 bg-white/95 px-3 pb-[env(safe-area-inset-bottom)] pt-2 backdrop-blur">
            <div className="grid grid-cols-4 gap-1">
              {tabs.map(({ to, label, frozen }) => (
                <NavLink
                  key={to}
                  to={to}
                  end={to === '/'}
                  className={({ isActive }) =>
                    `flex min-h-14 flex-col items-center justify-center gap-1 rounded-md text-xs transition ${
                      isActive
                        ? frozen ? 'bg-slate-50 text-slate-400' : 'bg-blue-50 text-blue-600'
                        : frozen ? 'text-slate-300' : 'text-slate-500'
                    }`
                  }
                >
                  <span className="font-semibold">{label}</span>
                </NavLink>
              ))}
            </div>
          </nav>
        )}
      </div>
    </div>
  );
}
