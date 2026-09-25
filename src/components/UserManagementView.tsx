import React, { useState, useEffect } from 'react';
import { 
  Users, 
  UserPlus, 
  Trash2, 
  Search, 
  ShieldCheck, 
  Brain, 
  RefreshCw,
  AlertTriangle
} from 'lucide-react';
import { User } from '../types/index.ts';

interface UserManagementViewProps {
  onNavigateToRegister: () => void;
  onUsersChanged: () => void;
}

export const UserManagementView: React.FC<UserManagementViewProps> = ({
  onNavigateToRegister,
  onUsersChanged,
}) => {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [search, setSearch] = useState<string>('');
  const [deleteConfirmUser, setDeleteConfirmUser] = useState<User | null>(null);
  const [isDeleting, setIsDeleting] = useState<boolean>(false);

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/users');
      const data = await res.json();
      setUsers(data);
    } catch (err) {
      console.error('Error fetching users:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  const handleDeleteUser = async () => {
    if (!deleteConfirmUser) return;
    setIsDeleting(true);
    try {
      const res = await fetch(`/api/users/${deleteConfirmUser.user_id}`, {
        method: 'DELETE',
      });
      if (res.ok) {
        setDeleteConfirmUser(null);
        await fetchUsers();
        onUsersChanged();
      }
    } catch (err) {
      console.error('Error deleting user:', err);
    } finally {
      setIsDeleting(false);
    }
  };

  const filteredUsers = users.filter((u) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return u.name.toLowerCase().includes(q) || u.user_id.toLowerCase().includes(q) || u.email.toLowerCase().includes(q);
  });

  return (
    <div className="space-y-6">
      {/* Delete Confirmation Modal */}
      {deleteConfirmUser && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 p-6 rounded-2xl max-w-md w-full shadow-2xl space-y-4 animate-in fade-in zoom-in-95">
            <div className="w-12 h-12 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-400 flex items-center justify-center">
              <AlertTriangle className="w-6 h-6" />
            </div>

            <div>
              <h3 className="text-base font-bold text-white">Delete Personnel Record?</h3>
              <p className="text-xs text-slate-400 mt-1">
                Are you sure you want to permanently delete <strong className="text-white">{deleteConfirmUser.name}</strong> ({deleteConfirmUser.user_id})? All facial vector encodings and attendance records will be removed from SQLite.
              </p>
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                onClick={() => setDeleteConfirmUser(null)}
                disabled={isDeleting}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteUser}
                disabled={isDeleting}
                className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-semibold flex items-center gap-1.5 cursor-pointer shadow-md shadow-rose-600/20"
              >
                {isDeleting ? 'Deleting...' : 'Confirm Delete'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Main Directory Card */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
        <div className="p-6 border-b border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-slate-900/60">
          <div>
            <h2 className="text-lg font-bold text-white flex items-center gap-2">
              <Users className="w-5 h-5 text-blue-400" />
              Enrolled Personnel Directory
            </h2>
            <p className="text-xs text-slate-400 mt-1">
              Manage identities and registered 128-dimensional facial biometric vectors in SQLite
            </p>
          </div>

          <button
            onClick={onNavigateToRegister}
            className="px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold flex items-center gap-2 transition-all shadow-md shadow-blue-600/20 cursor-pointer self-start sm:self-auto"
          >
            <UserPlus className="w-4 h-4" /> Enrol New Person
          </button>
        </div>

        {/* Search Toolbar */}
        <div className="p-4 bg-slate-950/40 border-b border-slate-800 flex items-center justify-between gap-4">
          <div className="relative max-w-sm flex-1">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search enrolled personnel..."
              className="w-full bg-slate-900 border border-slate-800 rounded-xl pl-9 pr-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 transition-colors"
            />
          </div>

          <button
            onClick={fetchUsers}
            className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 transition-all cursor-pointer"
            title="Refresh"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>

        {/* Directory Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-950/60 text-slate-400 text-xs uppercase font-semibold border-b border-slate-800">
              <tr>
                <th className="px-5 py-3.5">Personnel ID</th>
                <th className="px-5 py-3.5">Full Name</th>
                <th className="px-5 py-3.5">Email</th>
                <th className="px-5 py-3.5">Biometric Vectors</th>
                <th className="px-5 py-3.5">Enrolled Date</th>
                <th className="px-5 py-3.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 text-slate-300">
              {loading ? (
                <tr>
                  <td colSpan={6} className="px-5 py-12 text-center text-slate-500 text-xs">
                    Loading personnel records...
                  </td>
                </tr>
              ) : filteredUsers.length > 0 ? (
                filteredUsers.map((u) => (
                  <tr key={u.id} className="hover:bg-slate-800/30 transition-colors">
                    <td className="px-5 py-3.5 font-mono text-xs text-cyan-400">
                      {u.user_id}
                    </td>
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-3">
                        {u.photo_preview ? (
                          <img
                            src={u.photo_preview}
                            alt={u.name}
                            className="w-8 h-8 rounded-lg object-cover border border-slate-700"
                          />
                        ) : (
                          <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-blue-600 to-indigo-600 text-white font-bold text-xs flex items-center justify-center">
                            {u.name.charAt(0)}
                          </div>
                        )}
                        <span className="font-medium text-white">{u.name}</span>
                      </div>
                    </td>
                    <td className="px-5 py-3.5 text-xs text-slate-400">
                      {u.email}
                    </td>
                    <td className="px-5 py-3.5">
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-mono font-medium bg-indigo-500/10 text-indigo-300 border border-indigo-500/20">
                        <Brain className="w-3.5 h-3.5 text-indigo-400" />
                        {u.sample_count || 1} samples (128-d)
                      </span>
                    </td>
                    <td className="px-5 py-3.5 text-xs text-slate-400 font-mono">
                      {u.created_at?.slice(0, 10) || '-'}
                    </td>
                    <td className="px-5 py-3.5 text-right">
                      <button
                        onClick={() => setDeleteConfirmUser(u)}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 transition-colors cursor-pointer"
                        title={`Delete ${u.name}`}
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={6} className="px-5 py-12 text-center text-slate-500 text-xs">
                    No enrolled personnel found. Click "Enrol New Person" to register.
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
