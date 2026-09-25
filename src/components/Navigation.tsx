import React from 'react';
import { 
  Camera, 
  LayoutDashboard, 
  ClipboardCheck, 
  UserPlus, 
  Users, 
  Code2, 
  ShieldCheck,
  Cpu
} from 'lucide-react';
import { ActiveTab } from '../types/index.ts';

interface NavigationProps {
  activeTab: ActiveTab;
  setActiveTab: (tab: ActiveTab) => void;
  presentCount: number;
  totalUsersCount: number;
}

export const Navigation: React.FC<NavigationProps> = ({
  activeTab,
  setActiveTab,
  presentCount,
  totalUsersCount,
}) => {
  const navItems = [
    {
      id: 'recognition' as ActiveTab,
      label: 'Live Face Recognition',
      icon: Camera,
      badge: 'Live',
    },
    {
      id: 'dashboard' as ActiveTab,
      label: 'Analytics Dashboard',
      icon: LayoutDashboard,
    },
    {
      id: 'attendance' as ActiveTab,
      label: 'Attendance Records',
      icon: ClipboardCheck,
      count: presentCount,
    },
    {
      id: 'register' as ActiveTab,
      label: 'Register Person',
      icon: UserPlus,
    },
    {
      id: 'users' as ActiveTab,
      label: 'Enrolled Personnel',
      icon: Users,
      count: totalUsersCount,
    },
    {
      id: 'python_project' as ActiveTab,
      label: 'Python Flask Codebase',
      icon: Code2,
      highlight: true,
    },
  ];

  return (
    <aside className="w-64 bg-slate-900 border-r border-slate-800 flex flex-col justify-between shrink-0 select-none">
      <div className="p-5">
        {/* Brand */}
        <div className="flex items-center gap-3 pb-6 border-b border-slate-800/80 mb-6">
          <div className="w-11 h-11 rounded-xl bg-gradient-to-tr from-blue-600 via-indigo-600 to-cyan-400 flex items-center justify-center text-white shadow-lg shadow-blue-500/20">
            <Camera className="w-6 h-6" />
          </div>
          <div>
            <div className="font-bold text-base text-white tracking-tight flex items-center gap-1.5">
              FaceTrack AI
              <span className="text-[10px] uppercase font-bold tracking-wider px-1.5 py-0.5 rounded bg-blue-500/20 text-blue-400 border border-blue-500/30">
                PRO
              </span>
            </div>
            <p className="text-xs text-slate-400 font-medium">Biometric Attendance</p>
          </div>
        </div>

        {/* Navigation list */}
        <nav className="space-y-1.5">
          <div className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider px-3 mb-2">
            Operations
          </div>
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl font-medium text-sm transition-all duration-150 cursor-pointer ${
                  isActive
                    ? 'bg-blue-600/15 text-blue-400 border-l-4 border-blue-500 shadow-sm shadow-blue-900/10'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
                }`}
              >
                <div className="flex items-center gap-3">
                  <Icon className={`w-4.5 h-4.5 ${isActive ? 'text-blue-400' : 'text-slate-400'}`} />
                  <span className={isActive ? 'font-semibold text-white' : ''}>{item.label}</span>
                </div>

                {item.badge && (
                  <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                    {item.badge}
                  </span>
                )}

                {item.count !== undefined && !item.badge && (
                  <span className="text-xs px-2 py-0.5 rounded-md bg-slate-800 text-slate-400 font-mono">
                    {item.count}
                  </span>
                )}

                {item.highlight && (
                  <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-md bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                    ZIP
                  </span>
                )}
              </button>
            );
          })}
        </nav>
      </div>

      {/* Footer System Status */}
      <div className="p-4 border-t border-slate-800/80 bg-slate-950/40 m-3 rounded-2xl">
        <div className="flex items-center gap-2 mb-1.5">
          <div className="w-2 h-2 rounded-full bg-emerald-400 shadow-sm shadow-emerald-400"></div>
          <span className="text-xs font-semibold text-slate-200">Vision & SQLite Online</span>
        </div>
        <div className="flex items-center justify-between text-[11px] text-slate-500">
          <span>Engine: OpenCV 128-d</span>
          <span className="font-mono">Port 3000</span>
        </div>
      </div>
    </aside>
  );
};
