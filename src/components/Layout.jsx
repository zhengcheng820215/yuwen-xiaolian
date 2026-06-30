import { NavLink, useLocation } from 'react-router-dom';
import { BookOpen, Home, User, XCircle } from 'lucide-react';

const tabs = [
  { to: '/', label: '首页', icon: Home },
  { to: '/practice', label: '练习', icon: BookOpen },
  { to: '/mistakes', label: '错题本', icon: XCircle },
  { to: '/profile', label: '我的', icon: User },
];

const noTabPaths = ['/quiz', '/result'];

export default function Layout({ children }) {
  const location = useLocation();
  const hideTabs = noTabPaths.some((path) => location.pathname.startsWith(path));

  return (
    <div className="mx-auto min-h-screen max-w-[430px] bg-[#f5f7fb] shadow-2xl shadow-slate-200/70">
      <main className={hideTabs ? 'min-h-screen' : 'safe-bottom min-h-screen'}>{children}</main>
      {!hideTabs && (
        <nav className="fixed inset-x-0 bottom-0 z-30 mx-auto max-w-[430px] border-t border-slate-200 bg-white/95 px-3 pb-[env(safe-area-inset-bottom)] pt-2 backdrop-blur">
          <div className="grid grid-cols-4 gap-1">
            {tabs.map(({ to, label, icon: Icon }) => (
              <NavLink
                key={to}
                to={to}
                end={to === '/'}
                className={({ isActive }) =>
                  `flex min-h-14 flex-col items-center justify-center gap-1 rounded-md text-xs transition ${
                    isActive ? 'bg-blue-50 text-blue-600' : 'text-slate-500'
                  }`
                }
              >
                <Icon size={20} />
                <span>{label}</span>
              </NavLink>
            ))}
          </div>
        </nav>
      )}
    </div>
  );
}
