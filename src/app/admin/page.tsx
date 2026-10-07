'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import {
  Shield,
  Users,
  UserPlus,
  Key,
  Trash2,
  Settings as SettingsIcon,
  Check,
  AlertCircle,
  X,
  Sparkles,
  Lock,
  UserCheck,
  Clock,
  Radio,
  Globe
} from 'lucide-react';
import { User, AppSettings } from '@/types';

export default function AdminPage() {
  const router = useRouter();
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [guildUsers, setGuildUsers] = useState<User[]>([]);
  const [settings, setSettings] = useState<AppSettings>({
    guild_name: 'The Pillar Men',
    server_name: 'Tilustra (NA East 2)',
    hours_of_operation: 'Daily 6:00 PM - 2:00 AM EST (or whenever runners are on duty)',
    default_payout_percent: 75,
    motd: '',
    service_status_mode: 'auto'
  });
  const [loading, setLoading] = useState(true);

  // New Guildmate Form
  const [showAddUserModal, setShowAddUserModal] = useState(false);
  const [newUsername, setNewUsername] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newDisplayName, setNewDisplayName] = useState('');
  const [newRole, setNewRole] = useState<'runner' | 'admin'>('runner');
  const [addUserError, setAddUserError] = useState('');

  // Password Reset Modal
  const [resetTargetUser, setResetTargetUser] = useState<User | null>(null);
  const [resetPasswordVal, setResetPasswordVal] = useState('');
  const [resetSuccess, setResetSuccess] = useState(false);

  // Settings Save State
  const [settingsSuccess, setSettingsSuccess] = useState(false);
  const [settingsError, setSettingsError] = useState('');

  const loadData = useCallback(async () => {
    try {
      const authRes = await fetch('/api/auth/me');
      const authData = await authRes.json();
      if (!authData.user || authData.user.role !== 'admin') {
        router.push('/dashboard');
        return;
      }
      setCurrentUser(authData.user);

      const [usersRes, settingsRes] = await Promise.all([
        fetch('/api/admin/users'),
        fetch('/api/settings')
      ]);

      const usersData = await usersRes.json();
      const settingsData = await settingsRes.json();

      if (usersData.users) setGuildUsers(usersData.users);
      if (settingsData.settings) setSettings(settingsData.settings);

      setLoading(false);
    } catch {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setAddUserError('');

    if (!newUsername.trim() || !newPassword || !newDisplayName.trim()) {
      setAddUserError('All fields are required');
      return;
    }

    try {
      const res = await fetch('/api/admin/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: newUsername.trim(),
          password: newPassword,
          display_name: newDisplayName.trim(),
          role: newRole
        })
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to create user');
      }

      setShowAddUserModal(false);
      setNewUsername('');
      setNewPassword('');
      setNewDisplayName('');
      loadData();
    } catch (err: unknown) {
      setAddUserError(err instanceof Error ? err.message : 'Error creating user');
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resetTargetUser || !resetPasswordVal) return;

    try {
      const res = await fetch('/api/admin/users', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: resetTargetUser.id,
          password: resetPasswordVal
        })
      });

      if (res.ok) {
        setResetSuccess(true);
        setTimeout(() => {
          setResetTargetUser(null);
          setResetPasswordVal('');
          setResetSuccess(false);
        }, 1500);
      }
    } catch {}
  };

  const handleDeleteUser = async (userId: string, username: string) => {
    if (!confirm(`Are you sure you want to remove ${username} from the guild roster?`)) return;

    try {
      const res = await fetch(`/api/admin/users?id=${userId}`, { method: 'DELETE' });
      if (res.ok) {
        loadData();
      }
    } catch {}
  };

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setSettingsSuccess(false);
    setSettingsError('');

    try {
      const res = await fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings)
      });

      if (!res.ok) {
        const d = await res.json();
        throw new Error(d.error || 'Failed to save settings');
      }

      setSettingsSuccess(true);
      setTimeout(() => setSettingsSuccess(false), 3000);
    } catch (err: unknown) {
      setSettingsError(err instanceof Error ? err.message : 'Error saving settings');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-zinc-950 text-zinc-100 flex items-center justify-center">
        <p className="text-sm text-zinc-400">Loading Guild Admin Panel...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 pb-20">
      {/* Top Banner */}
      <div className="border-b border-zinc-800 bg-zinc-900/60 backdrop-blur-md px-4 sm:px-6 lg:px-8 py-6">
        <div className="max-w-7xl mx-auto">
          <h1 className="text-2xl font-black text-white tracking-tight flex items-center gap-2.5">
            <Shield className="w-6 h-6 text-purple-400" />
            The Pillar Men — Administration & Credentials
          </h1>
          <p className="text-xs text-zinc-400 mt-1">
            Manage guildmate credentials, server configuration, operating hours, runner duty status, and payout policies.
          </p>
        </div>
      </div>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-6 space-y-8">
        {/* Section 1: Guildmates Roster & Credentials */}
        <div className="bg-zinc-900/90 border border-zinc-800 rounded-2xl p-6 shadow-xl space-y-6">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-zinc-800 pb-4">
            <div>
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                <Users className="w-5 h-5 text-amber-400" />
                Guild Roster & Credentials
              </h2>
              <p className="text-xs text-zinc-400 mt-0.5">
                Issue credentials to guild members so they can log in, declare online duty, and run orders.
              </p>
            </div>

            <button
              onClick={() => {
                setAddUserError('');
                setShowAddUserModal(true);
              }}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-zinc-950 text-xs font-bold shadow-md transition-colors"
            >
              <UserPlus className="w-4 h-4" />
              <span>Add Guildmate</span>
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-zinc-950/80 border-b border-zinc-800 text-zinc-400 uppercase text-[10px] tracking-wider">
                <tr>
                  <th className="py-3 px-4 font-semibold">Login Username</th>
                  <th className="py-3 px-4 font-semibold">Runner In-Game Name</th>
                  <th className="py-3 px-4 font-semibold">Duty Status</th>
                  <th className="py-3 px-4 font-semibold">Role</th>
                  <th className="py-3 px-4 font-semibold text-right">Credentials & Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800/60">
                {guildUsers.map((u) => (
                  <tr key={u.id} className="hover:bg-zinc-800/30 transition-colors">
                    <td className="py-3 px-4 font-mono font-bold text-zinc-200">
                      {u.username}
                      {u.id === currentUser?.id && (
                        <span className="ml-2 px-1.5 py-0.5 rounded text-[10px] bg-zinc-800 text-amber-300">
                          (You)
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-4 font-medium text-amber-300">
                      {u.display_name}
                    </td>
                    <td className="py-3 px-4">
                      <span
                        className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          u.is_online
                            ? 'bg-emerald-950/80 border border-emerald-500/50 text-emerald-300'
                            : 'bg-zinc-900 border border-zinc-800 text-zinc-500'
                        }`}
                      >
                        <span className={`w-1.5 h-1.5 rounded-full ${u.is_online ? 'bg-emerald-400' : 'bg-zinc-600'}`} />
                        <span>{u.is_online ? 'ON DUTY' : 'OFFLINE'}</span>
                      </span>
                    </td>
                    <td className="py-3 px-4 capitalize text-zinc-400">
                      {u.role}
                    </td>
                    <td className="py-3 px-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => {
                            setResetTargetUser(u);
                            setResetPasswordVal('');
                            setResetSuccess(false);
                          }}
                          className="px-2.5 py-1 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-[11px] font-medium transition-colors flex items-center gap-1"
                          title="Reset Password"
                        >
                          <Key className="w-3 h-3 text-amber-400" />
                          <span>Reset Password</span>
                        </button>

                        {u.id !== currentUser?.id && (
                          <button
                            onClick={() => handleDeleteUser(u.id, u.username)}
                            className="p-1.5 rounded bg-rose-950/40 hover:bg-rose-950 text-rose-400 border border-rose-900/50 transition-colors"
                            title="Remove User"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Section 2: Global Service Settings, Server & Hours of Operation */}
        <div className="bg-zinc-900/90 border border-zinc-800 rounded-2xl p-6 shadow-xl space-y-6">
          <div className="border-b border-zinc-800 pb-4">
            <h2 className="text-base font-bold text-white flex items-center gap-2">
              <SettingsIcon className="w-5 h-5 text-amber-400" />
              Server & Service Configuration
            </h2>
            <p className="text-xs text-zinc-400 mt-0.5">
              Configure game realm server, operating hours, service status mode, and base payout rates.
            </p>
          </div>

          {settingsSuccess && (
            <div className="bg-emerald-950/60 border border-emerald-800/80 text-emerald-200 rounded-xl p-3 text-xs flex items-center gap-2">
              <Check className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>Settings updated successfully!</span>
            </div>
          )}

          {settingsError && (
            <div className="bg-rose-950/60 border border-rose-800/80 text-rose-200 rounded-xl p-3 text-xs">
              {settingsError}
            </div>
          )}

          <form onSubmit={handleSaveSettings} className="space-y-5 text-xs max-w-2xl">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-zinc-300 mb-1.5">
                  Guild Name
                </label>
                <input
                  type="text"
                  required
                  value={settings.guild_name}
                  onChange={(e) => setSettings({ ...settings, guild_name: e.target.value })}
                  className="w-full bg-zinc-950 border border-zinc-700 rounded-lg px-3.5 py-2 text-xs text-white focus:outline-none focus:ring-1 focus:ring-amber-500 font-bold"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-zinc-300 mb-1.5 flex items-center gap-1.5">
                  <Globe className="w-3.5 h-3.5 text-blue-400" />
                  Game Server
                </label>
                <input
                  type="text"
                  required
                  value={settings.server_name || 'Tilustra (NA East 2)'}
                  onChange={(e) => setSettings({ ...settings, server_name: e.target.value })}
                  placeholder="e.g. Tilustra (NA East 2)"
                  className="w-full bg-zinc-950 border border-zinc-700 rounded-lg px-3.5 py-2 text-xs text-white focus:outline-none focus:ring-1 focus:ring-blue-500 font-bold"
                />
                <span className="text-[11px] text-zinc-500 mt-1 block">
                  Displayed prominently across customer order pages and runner boards.
                </span>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-zinc-300 mb-1.5">
                  Service Status Mode
                </label>
                <select
                  value={settings.service_status_mode || 'auto'}
                  onChange={(e) => setSettings({ ...settings, service_status_mode: e.target.value })}
                  className="w-full bg-zinc-950 border border-zinc-700 rounded-lg px-3.5 py-2 text-xs text-white focus:outline-none focus:ring-1 focus:ring-amber-500"
                >
                  <option value="auto">Automatic (Open when runners are on duty)</option>
                  <option value="open">Forced Open (Always accept runs)</option>
                  <option value="closed">Forced Closed (Maintenance / Off)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-zinc-300 mb-1.5 flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5 text-amber-400" />
                  Hours of Operation
                </label>
                <input
                  type="text"
                  required
                  value={settings.hours_of_operation}
                  onChange={(e) => setSettings({ ...settings, hours_of_operation: e.target.value })}
                  placeholder="e.g. Daily 6:00 PM - 2:00 AM EST (or whenever runners are on duty)"
                  className="w-full bg-zinc-950 border border-zinc-700 rounded-lg px-3.5 py-2 text-xs text-white focus:outline-none focus:ring-1 focus:ring-amber-500"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-zinc-300 mb-1.5 flex items-center justify-between">
                <span>Default Customer Payout Percentage</span>
                <span className="font-mono text-amber-400 font-bold">{settings.default_payout_percent}%</span>
              </label>
              <div className="flex items-center gap-4">
                <input
                  type="range"
                  min="50"
                  max="95"
                  step="5"
                  value={settings.default_payout_percent}
                  onChange={(e) => setSettings({ ...settings, default_payout_percent: parseInt(e.target.value, 10) })}
                  className="w-full accent-amber-500 cursor-pointer"
                />
                <span className="font-mono text-xs text-zinc-400 w-12 text-right">
                  {settings.default_payout_percent}%
                </span>
              </div>
              <span className="text-[11px] text-zinc-500 mt-1 block">
                The standard coin cut given to customers for regular items (runners keep remainder as profit).
              </span>
            </div>

            <div>
              <label className="block text-xs font-semibold text-zinc-300 mb-1.5">
                Public Announcement Banner (MOTD)
              </label>
              <input
                type="text"
                value={settings.motd || ''}
                onChange={(e) => setSettings({ ...settings, motd: e.target.value })}
                placeholder="e.g. Now serving Blackburrow lower depths! Fast delivery guaranteed."
                className="w-full bg-zinc-950 border border-zinc-700 rounded-lg px-3.5 py-2 text-xs text-white focus:outline-none focus:ring-1 focus:ring-amber-500"
              />
            </div>

            <button
              type="submit"
              className="px-5 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-zinc-950 text-xs font-bold shadow-md transition-colors"
            >
              Save Settings
            </button>
          </form>
        </div>
      </main>

      {/* Add Guildmate Modal */}
      {showAddUserModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4">
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <UserPlus className="w-4 h-4 text-amber-400" />
                Issue Guildmate Credentials
              </h3>
              <button
                onClick={() => setShowAddUserModal(false)}
                className="text-zinc-500 hover:text-zinc-300 text-sm"
              >
                ✕
              </button>
            </div>

            {addUserError && (
              <div className="bg-rose-950/60 border border-rose-800 text-rose-200 text-xs p-3 rounded-lg">
                {addUserError}
              </div>
            )}

            <form onSubmit={handleCreateUser} className="space-y-4 text-xs">
              <div>
                <label className="block text-zinc-300 font-semibold mb-1">
                  Login Username
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. kars"
                  value={newUsername}
                  onChange={(e) => setNewUsername(e.target.value)}
                  className="w-full bg-zinc-950 border border-zinc-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:ring-1 focus:ring-amber-500 font-mono"
                />
              </div>

              <div>
                <label className="block text-zinc-300 font-semibold mb-1">
                  Temporary Password
                </label>
                <input
                  type="password"
                  required
                  placeholder="Choose strong password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="w-full bg-zinc-950 border border-zinc-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:ring-1 focus:ring-amber-500"
                />
              </div>

              <div>
                <label className="block text-zinc-300 font-semibold mb-1">
                  Runner In-Game Character Name
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Kars (The Swift)"
                  value={newDisplayName}
                  onChange={(e) => setNewDisplayName(e.target.value)}
                  className="w-full bg-zinc-950 border border-zinc-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:ring-1 focus:ring-amber-500"
                />
              </div>

              <div>
                <label className="block text-zinc-300 font-semibold mb-1">
                  Guild Role
                </label>
                <select
                  value={newRole}
                  onChange={(e) => setNewRole(e.target.value as 'runner' | 'admin')}
                  className="w-full bg-zinc-950 border border-zinc-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:ring-1 focus:ring-amber-500"
                >
                  <option value="runner">Runner (Can accept & run orders, toggle duty)</option>
                  <option value="admin">Admin (Full access to manage roster & settings)</option>
                </select>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAddUserModal(false)}
                  className="px-4 py-2 rounded-xl bg-zinc-800 text-zinc-300 hover:bg-zinc-700 font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-zinc-950 font-bold shadow-md transition-colors"
                >
                  Create Guildmate Account
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Password Reset Modal */}
      {resetTargetUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4">
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl max-w-sm w-full p-6 shadow-2xl space-y-4 text-xs">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Lock className="w-4 h-4 text-amber-400" />
                Reset Password
              </h3>
              <button
                onClick={() => setResetTargetUser(null)}
                className="text-zinc-500 hover:text-zinc-300 text-sm"
              >
                ✕
              </button>
            </div>

            <p className="text-zinc-400">
              Set a new password for <span className="text-amber-300 font-bold">{resetTargetUser.display_name}</span> ({resetTargetUser.username}):
            </p>

            {resetSuccess && (
              <div className="bg-emerald-950/70 border border-emerald-800 text-emerald-300 p-2.5 rounded-lg flex items-center gap-2">
                <Check className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>Password updated successfully!</span>
              </div>
            )}

            <form onSubmit={handleResetPassword} className="space-y-4">
              <div>
                <label className="block text-zinc-300 font-semibold mb-1">
                  New Password
                </label>
                <input
                  type="password"
                  required
                  placeholder="Enter new password"
                  value={resetPasswordVal}
                  onChange={(e) => setResetPasswordVal(e.target.value)}
                  className="w-full bg-zinc-950 border border-zinc-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:ring-1 focus:ring-amber-500"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setResetTargetUser(null)}
                  className="px-4 py-2 rounded-xl bg-zinc-800 text-zinc-300 hover:bg-zinc-700 font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-zinc-950 font-bold shadow-md transition-colors"
                >
                  Update Password
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
