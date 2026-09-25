import React from 'react';
import { 
  Users, 
  UserCheck, 
  PieChart, 
  ShieldCheck, 
  ArrowUpRight, 
  Download, 
  Camera, 
  UserPlus, 
  Calendar, 
  Clock 
} from 'lucide-react';
import { DashboardStats, AttendanceRecord } from '../types/index.ts';

interface DashboardViewProps {
  stats: DashboardStats;
  onNavigate: (tab: any) => void;
}

export const DashboardView: React.FC<DashboardViewProps> = ({ stats, onNavigate }) => {
  const exportCsv = () => {
    window.location.href = '/api/attendance?format=csv';
    // Fallback direct CSV export
    const headers = ['Record ID', 'User ID', 'Name', 'Date', 'Time', 'Status', 'Confidence'];
    const rows = stats.recentRecords.map((r) => [
      r.id,
      r.user_id,
      `"${r.name}"`,
      r.date,
      r.time,
      r.status,
      r.confidence,
    ]);
    const csvContent = [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.setAttribute('download', `attendance_report_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="bg-gradient-to-r from-blue-900/40 via-indigo-900/30 to-slate-900 border border-slate-800 p-6 rounded-2xl flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-white tracking-tight">
            Attendance Intelligence Overview
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            Real-time biometric monitoring connected to SQLite persistent database
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => onNavigate('recognition')}
            className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold flex items-center gap-2 transition-all shadow-md shadow-blue-600/20 cursor-pointer"
          >
            <Camera className="w-4 h-4" /> Open Camera Feed
          </button>
          <button
            onClick={exportCsv}
            className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 text-xs font-semibold flex items-center gap-2 transition-all cursor-pointer"
          >
            <Download className="w-4 h-4" /> Export CSV
          </button>
        </div>
      </div>

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Users */}
        <div className="bg-slate-900 border border-slate-800 p-5 rounded-2xl relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
              Enrolled Personnel
            </span>
            <div className="w-10 h-10 rounded-xl bg-blue-500/10 border border-blue-500/20 text-blue-400 flex items-center justify-center">
              <Users className="w-5 h-5" />
            </div>
          </div>
          <div className="text-3xl font-extrabold text-white font-mono mt-3">
            {stats.totalUsers}
          </div>
          <div className="text-xs text-slate-500 mt-1 flex items-center gap-1">
            <span>Stored in SQLite</span>
          </div>
        </div>

        {/* Present Today */}
        <div className="bg-slate-900 border border-slate-800 p-5 rounded-2xl relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
              Present Today
            </span>
            <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center">
              <UserCheck className="w-5 h-5" />
            </div>
          </div>
          <div className="text-3xl font-extrabold text-emerald-400 font-mono mt-3">
            {stats.presentToday}
          </div>
          <div className="text-xs text-emerald-400/80 mt-1 flex items-center gap-1">
            <ArrowUpRight className="w-3.5 h-3.5" />
            <span>Active check-ins today</span>
          </div>
        </div>

        {/* Attendance Rate */}
        <div className="bg-slate-900 border border-slate-800 p-5 rounded-2xl relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
              Turnout Rate
            </span>
            <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400 flex items-center justify-center">
              <PieChart className="w-5 h-5" />
            </div>
          </div>
          <div className="text-3xl font-extrabold text-amber-400 font-mono mt-3">
            {stats.attendancePercentage}%
          </div>
          <div className="w-full bg-slate-800 h-1.5 rounded-full mt-2 overflow-hidden">
            <div
              className="bg-amber-400 h-full rounded-full transition-all duration-500"
              style={{ width: `${Math.min(100, stats.attendancePercentage)}%` }}
            ></div>
          </div>
        </div>

        {/* Biometric Vectors */}
        <div className="bg-slate-900 border border-slate-800 p-5 rounded-2xl relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
              Vector Embeddings
            </span>
            <div className="w-10 h-10 rounded-xl bg-purple-500/10 border border-purple-500/20 text-purple-400 flex items-center justify-center">
              <ShieldCheck className="w-5 h-5" />
            </div>
          </div>
          <div className="text-3xl font-extrabold text-purple-400 font-mono mt-3">
            128-d
          </div>
          <div className="text-xs text-slate-500 mt-1">
            Euclidean tolerance: 0.52
          </div>
        </div>
      </div>

      {/* Main Content Grid: Recent Activity Table + Quick Action Cards */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Table (2 cols) */}
        <div className="lg:col-span-2 bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-lg">
          <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between">
            <div>
              <h3 className="font-semibold text-white text-base">Recent Check-in Records</h3>
              <p className="text-xs text-slate-400">Latest biometric recognitions across all dates</p>
            </div>
            <button
              onClick={() => onNavigate('attendance')}
              className="text-xs font-semibold text-blue-400 hover:text-blue-300 flex items-center gap-1 cursor-pointer"
            >
              View Full History <ArrowUpRight className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-950/50 text-slate-400 text-xs uppercase font-semibold border-b border-slate-800">
                <tr>
                  <th className="px-5 py-3.5">ID</th>
                  <th className="px-5 py-3.5">Name</th>
                  <th className="px-5 py-3.5">Date</th>
                  <th className="px-5 py-3.5">Time</th>
                  <th className="px-5 py-3.5">Status</th>
                  <th className="px-5 py-3.5">AI Confidence</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 text-slate-300">
                {stats.recentRecords.length > 0 ? (
                  stats.recentRecords.map((r) => (
                    <tr key={r.id} className="hover:bg-slate-800/30 transition-colors">
                      <td className="px-5 py-3 font-mono text-xs text-cyan-400">
                        {r.user_id}
                      </td>
                      <td className="px-5 py-3 font-medium text-white">
                        {r.name}
                      </td>
                      <td className="px-5 py-3 text-xs text-slate-400">
                        {r.date}
                      </td>
                      <td className="px-5 py-3 text-xs font-mono text-slate-300">
                        {r.time}
                      </td>
                      <td className="px-5 py-3">
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                          {r.status}
                        </span>
                      </td>
                      <td className="px-5 py-3 text-xs font-mono text-emerald-400">
                        {Math.round((r.confidence || 0.95) * 100)}%
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={6} className="px-5 py-8 text-center text-slate-500 text-xs">
                      No attendance records found. Start optical webcam to register check-ins.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Right Info Card & Actions */}
        <div className="space-y-6">
          {/* Quick Enrol Card */}
          <div className="bg-gradient-to-br from-slate-900 to-slate-950 border border-slate-800 p-5 rounded-2xl space-y-4">
            <div className="w-10 h-10 rounded-xl bg-blue-600/20 border border-blue-500/30 text-blue-400 flex items-center justify-center">
              <UserPlus className="w-5 h-5" />
            </div>
            <div>
              <h4 className="text-white font-semibold text-sm">Register New Person</h4>
              <p className="text-xs text-slate-400 mt-1">
                Enrol employee or student identity with multi-angle facial dataset capture.
              </p>
            </div>
            <button
              onClick={() => onNavigate('register')}
              className="w-full py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-semibold text-xs transition-colors flex items-center justify-center gap-2 cursor-pointer shadow-md shadow-blue-600/20"
            >
              Start Enrolment Flow
            </button>
          </div>

          {/* Biometric Verification Spec */}
          <div className="bg-slate-900 border border-slate-800 p-5 rounded-2xl space-y-3">
            <h4 className="text-white font-semibold text-sm flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
              Anti-Duplicate Enforcement
            </h4>
            <div className="text-xs text-slate-400 space-y-2">
              <div className="flex items-start gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 mt-1.5 shrink-0"></span>
                <span>Each personnel profile can check in once per calendar date.</span>
              </div>
              <div className="flex items-start gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-blue-400 mt-1.5 shrink-0"></span>
                <span>The first successful verification timestamp is sealed as arrival time.</span>
              </div>
              <div className="flex items-start gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-purple-400 mt-1.5 shrink-0"></span>
                <span>Euclidean distance matching against 128-d normalized embeddings.</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
