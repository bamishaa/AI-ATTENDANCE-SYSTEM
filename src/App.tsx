import React, { useState, useEffect } from 'react';
import { Navigation } from './components/Navigation.tsx';
import { LiveRecognitionView } from './components/LiveRecognitionView.tsx';
import { DashboardView } from './components/DashboardView.tsx';
import { AttendanceLogView } from './components/AttendanceLogView.tsx';
import { RegistrationView } from './components/RegistrationView.tsx';
import { UserManagementView } from './components/UserManagementView.tsx';
import { PythonProjectHubView } from './components/PythonProjectHubView.tsx';
import { ActiveTab, DashboardStats } from './types/index.ts';
import { Calendar, ShieldAlert } from 'lucide-react';

export default function App() {
  const [activeTab, setActiveTab] = useState<ActiveTab>('recognition');
  const [stats, setStats] = useState<DashboardStats>({
    totalUsers: 0,
    presentToday: 0,
    attendancePercentage: 0,
    recentRecords: [],
    date: new Date().toISOString().slice(0, 10),
  });

  const fetchStats = async () => {
    try {
      const res = await fetch('/api/stats');
      if (res.ok) {
        const data = await res.json();
        setStats(data);
      }
    } catch (err) {
      console.error('Failed to load stats:', err);
    }
  };

  useEffect(() => {
    fetchStats();
    const interval = setInterval(fetchStats, 5000);
    return () => clearInterval(interval);
  }, []);

  const getPageTitle = () => {
    switch (activeTab) {
      case 'recognition':
        return {
          title: 'Live Optical Face Recognition',
          subtitle: 'Webcam biometric scanning with real-time OpenCV HUD bounding boxes & auto-attendance',
        };
      case 'dashboard':
        return {
          title: 'Biometric Attendance Analytics',
          subtitle: 'Real-time turnout percentages, KPI metrics, and daily verification audits',
        };
      case 'attendance':
        return {
          title: 'Attendance History & Logs',
          subtitle: 'Searchable, filterable database of all confirmed check-in timestamps',
        };
      case 'register':
        return {
          title: 'Personnel Registration & Dataset Capture',
          subtitle: 'Multi-view 128-d face embedding generation and SQLite enrolment',
        };
      case 'users':
        return {
          title: 'Enrolled Personnel Directory',
          subtitle: 'Manage authorized personnel profiles, vector datasets, and permissions',
        };
      case 'python_project':
        return {
          title: 'Python Flask & OpenCV Source Code Hub',
          subtitle: 'Inspect standalone architecture or download complete project package (.ZIP)',
        };
    }
  };

  const { title, subtitle } = getPageTitle();

  return (
    <div className="flex h-screen w-full bg-slate-950 text-slate-100 overflow-hidden font-sans select-text">
      {/* Sidebar Navigation */}
      <Navigation
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        presentCount={stats.presentToday}
        totalUsersCount={stats.totalUsers}
      />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden bg-gradient-to-b from-slate-950 via-[#0a0f1d] to-[#080d19]">
        {/* Top Header */}
        <header className="h-18 px-8 border-b border-slate-800/80 bg-slate-950/60 backdrop-blur-lg flex items-center justify-between shrink-0">
          <div>
            <h1 className="text-lg font-bold text-white tracking-tight">{title}</h1>
            <p className="text-xs text-slate-400 mt-0.5">{subtitle}</p>
          </div>

          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 px-3.5 py-1.5 rounded-xl bg-slate-900 border border-slate-800 text-xs text-slate-300">
              <Calendar className="w-3.5 h-3.5 text-blue-400" />
              <span className="font-medium">
                {new Date().toLocaleDateString('en-US', {
                  weekday: 'short',
                  month: 'short',
                  day: 'numeric',
                  year: 'numeric',
                })}
              </span>
            </div>

            <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-xs font-semibold text-emerald-400">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
              SQLite Connected
            </div>
          </div>
        </header>

        {/* Scrollable Tab Viewport */}
        <main className="flex-1 overflow-y-auto p-8">
          {activeTab === 'recognition' && (
            <LiveRecognitionView
              onAttendanceMarked={fetchStats}
              recentAttendance={stats.recentRecords}
            />
          )}

          {activeTab === 'dashboard' && (
            <DashboardView stats={stats} onNavigate={setActiveTab} />
          )}

          {activeTab === 'attendance' && <AttendanceLogView />}

          {activeTab === 'register' && (
            <RegistrationView
              onRegistrationComplete={fetchStats}
              onNavigateToRecognition={() => setActiveTab('recognition')}
            />
          )}

          {activeTab === 'users' && (
            <UserManagementView
              onNavigateToRegister={() => setActiveTab('register')}
              onUsersChanged={fetchStats}
            />
          )}

          {activeTab === 'python_project' && <PythonProjectHubView />}
        </main>
      </div>
    </div>
  );
}
