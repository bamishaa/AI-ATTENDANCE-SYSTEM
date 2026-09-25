import React, { useState, useEffect } from 'react';
import { 
  ClipboardCheck, 
  Search, 
  Calendar, 
  Download, 
  X, 
  RefreshCw,
  FileSpreadsheet
} from 'lucide-react';
import { AttendanceRecord } from '../types/index.ts';

export const AttendanceLogView: React.FC = () => {
  const [records, setRecords] = useState<AttendanceRecord[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [search, setSearch] = useState<string>('');
  const [selectedDate, setSelectedDate] = useState<string>('');

  const fetchRecords = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (search) params.set('search', search);
      if (selectedDate) params.set('date', selectedDate);

      const res = await fetch(`/api/attendance?${params.toString()}`);
      const data = await res.json();
      setRecords(data);
    } catch (err) {
      console.error('Failed fetching attendance:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRecords();
  }, [selectedDate]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    fetchRecords();
  };

  const handleClearFilters = () => {
    setSearch('');
    setSelectedDate('');
    setTimeout(fetchRecords, 50);
  };

  const exportCsv = () => {
    const headers = ['Record ID', 'User ID', 'Name', 'Date', 'Time', 'Status', 'Confidence'];
    const rows = records.map((r) => [
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
    link.setAttribute('download', `attendance_export_${selectedDate || 'all'}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
        {/* Header */}
        <div className="p-6 border-b border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-slate-900/60">
          <div>
            <h2 className="text-lg font-bold text-white flex items-center gap-2">
              <ClipboardCheck className="w-5 h-5 text-blue-400" />
              Attendance Master Records
            </h2>
            <p className="text-xs text-slate-400 mt-1">
              Historical audit log of verified webcam attendance entries stored in SQLite
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={exportCsv}
              disabled={records.length === 0}
              className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 disabled:opacity-50 border border-slate-700 text-slate-200 text-xs font-semibold flex items-center gap-2 transition-all cursor-pointer"
            >
              <Download className="w-4 h-4 text-emerald-400" /> Export CSV
            </button>
            <button
              onClick={fetchRecords}
              className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 transition-all cursor-pointer"
              title="Refresh Records"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>

        {/* Search & Filter Toolbar */}
        <div className="p-4 bg-slate-950/40 border-b border-slate-800 flex flex-wrap items-center justify-between gap-3">
          <form onSubmit={handleSearchSubmit} className="flex items-center gap-2 flex-1 max-w-md">
            <div className="relative flex-1">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search by personnel name or ID..."
                className="w-full bg-slate-900 border border-slate-800 rounded-xl pl-9 pr-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 transition-colors"
              />
            </div>
            <button
              type="submit"
              className="px-3.5 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-semibold text-xs transition-colors cursor-pointer"
            >
              Search
            </button>
          </form>

          <div className="flex items-center gap-2">
            <div className="relative">
              <Calendar className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="bg-slate-900 border border-slate-800 rounded-xl pl-9 pr-3 py-2 text-xs text-white focus:outline-none focus:border-blue-500 transition-colors cursor-pointer"
              />
            </div>

            {(search || selectedDate) && (
              <button
                onClick={handleClearFilters}
                className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                <X className="w-3.5 h-3.5" /> Clear
              </button>
            )}

            <div className="text-xs text-slate-400 font-mono pl-2">
              Showing <span className="text-white font-bold">{records.length}</span> entries
            </div>
          </div>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-950/60 text-slate-400 text-xs uppercase font-semibold border-b border-slate-800">
              <tr>
                <th className="px-5 py-3.5">Record ID</th>
                <th className="px-5 py-3.5">Personnel ID</th>
                <th className="px-5 py-3.5">Full Name</th>
                <th className="px-5 py-3.5">Date</th>
                <th className="px-5 py-3.5">Recorded Time</th>
                <th className="px-5 py-3.5">Attendance Status</th>
                <th className="px-5 py-3.5">AI Confidence</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 text-slate-300">
              {loading ? (
                <tr>
                  <td colSpan={7} className="px-5 py-12 text-center text-slate-500 text-xs">
                    Loading records from SQLite...
                  </td>
                </tr>
              ) : records.length > 0 ? (
                records.map((r) => (
                  <tr key={r.id} className="hover:bg-slate-800/30 transition-colors">
                    <td className="px-5 py-3.5 font-mono text-xs text-slate-500">
                      #{r.id}
                    </td>
                    <td className="px-5 py-3.5 font-mono text-xs text-cyan-400">
                      {r.user_id}
                    </td>
                    <td className="px-5 py-3.5 font-medium text-white">
                      {r.name}
                    </td>
                    <td className="px-5 py-3.5 text-xs text-slate-400 font-mono">
                      {r.date}
                    </td>
                    <td className="px-5 py-3.5 text-xs font-mono text-slate-200">
                      {r.time}
                    </td>
                    <td className="px-5 py-3.5">
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
                        {r.status}
                      </span>
                    </td>
                    <td className="px-5 py-3.5 text-xs font-mono text-emerald-400">
                      {Math.round((r.confidence || 0.95) * 100)}%
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={7} className="px-5 py-12 text-center text-slate-500 text-xs">
                    No attendance records match your search or date criteria.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
