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
  Globe,
  Edit2
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

  // Edit In-Game Name Modal
  const [editTargetUser, setEditTargetUser] = useState<User | null>(null);
  const [editDisplayNameVal, setEditDisplayNameVal] = useState('');
  const [editNameSuccess, setEditNameSuccess] = useState(false);
  const [editNameError, setEditNameError] = useState('');

  // Save Settings State
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [saveError, setSaveError] = useState('');

  const loadData = useCallback(async () => {
    try {
      // Check auth
      const meRes = await fetch('/api/auth/me');
      const meData = await meRes.json();
      if (!meData.user || meData.user.role !== 'admin') {
        router.push('/login');
        return;
      }
      setCurrentUser(meData.user);

      // Load Users
      const usersRes = await fetch('/api/admin/users');
      const usersData = await usersRes.json();
      if (usersData.users) {
        setGuildUsers(usersData.users);
      }

      // Load Settings
      const setRes = await fetch('/api/settings');
      const setData = await setRes.json();
      if (setData.settings) {
        setSettings(setData.settings);
      }
    } catch {
      // Ignore
    } finally {
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

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to reset password');
      }

      setResetSuccess(true);
      setTimeout(() => {
        setResetTargetUser(null);
        setResetPasswordVal('');
        setResetSuccess(false);
      }, 1200);
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Error updating password');
    }
  };

  const handleEditDisplayName = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editTargetUser || !editDisplayNameVal.trim()) return;

    try {
      setEditNameError('');
      const res = await fetch('/api/admin/users', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: editTargetUser.id,
          display_name: editDisplayNameVal.trim()
        })
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to update runner name');
      }

      setEditNameSuccess(true);
      setTimeout(() => {
        setEditTargetUser(null);
        setEditNameSuccess(false);
        loadData();
      }, 1000);
    } catch (err: unknown) {
      setEditNameError(err instanceof Error ? err.message : 'Error updating runner name');
    }
  };

  const handleDeleteUser = async (id: string, username: string) => {
    if (!confirm(`Are you sure you want to remove guildmate credentials for "${username}"?`)) {
      return;
    }

    try {
      const res = await fetch(`/api/admin/users?id=${id}`, { method: 'DELETE' });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to delete');
      }
      loadData();
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Error deleting user');
    }
  };

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaveError('');
    setSaveSuccess(false);

    try {
      const res = await fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings)
      });

      if (!res.ok) {
        throw new Error('Failed to save settings');
      }

      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (err: unknown) {
      setSaveError(err instanceof Error ? err.message : 'Failed to save settings');
    }
  };

  if (loading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center text-zinc-500">
        Loading Guild Administration...
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-10">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-zinc-800 pb-6">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-purple-950/70 border border-purple-500/40 text-purple-300">
              Admin Control Panel
            </span>
            <span className="text-xs text-zinc-500 font-mono">
              Server: {settings.server_name}
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight flex items-center gap-2.5">
            <Shield className="w-7 h-7 text-purple-400" />
            Guild Roster &amp; Service Settings
          </h1>
          <p className="text-xs sm:text-sm text-zinc-400 mt-1">
            Manage guild runner credentials, set the server name, and configure payout rates for <span className="text-amber-300 font-semibold">{settings.guild_name}</span>.
          </p>
        </div>

        <button
          onClick={() => {
            setShowAddUserModal(true);
            setAddUserError('');
          }}
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs shadow-lg shadow-purple-900/30 transition-colors"
        >
          <UserPlus className="w-4 h-4" />
          <span>Add Guild Runner</span>
        </button>
      </div>

      {/* Section 1: Guild Runners Roster */}
      <div className="bg-zinc-900/90 border border-zinc-800 rounded-2xl overflow-hidden shadow-xl">
        <div className="p-5 border-b border-zinc-800 flex items-center justify-between">
          <div>
            <h2 className="text-base font-bold text-white flex items-center gap-2">
              <Users className="w-5 h-5 text-purple-400" />
              Active Guild Runners &amp; Staff ({guildUsers.length})
            </h2>
            <p className="text-xs text-zinc-400 mt-0.5">
              These members have credentials to accept orders, sprint to camps, and quote prices.
            </p>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-zinc-950/80 border-b border-zinc-800 text-zinc-400 uppercase text-[10px] tracking-wider">
              <tr>
                <th className="py-3 px-4 font-semibold">Login Username</th>
                <th className="py-3 px-4 font-semibold">Runner In-Game Name</th>
                <th className="py-3 px-4 font-semibold">Duty Status</th>
                <th className="py-3 px-4 font-semibold">Role</th>
                <th className="py-3 px-4 font-semibold text-right">Credentials &amp; Actions</th>
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
                          setEditTargetUser(u);
                          setEditDisplayNameVal(u.display_name);
                          setEditNameSuccess(false);
                          setEditNameError('');
                        }}
                        className="px-2.5 py-1 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-[11px] font-medium transition-colors flex items-center gap-1"
                        title="Edit Runner In-Game Name"
                      >
                        <Edit2 className="w-3 h-3 text-cyan-400" />
                        <span>Edit Name</span>
                      </button>

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
            Server &amp; Service Configuration
          </h2>
          <p className="text-xs text-zinc-400 mt-0.5">
            Configure guild details, server realm, and service availability.
          </p>
        </div>

        <form onSubmit={handleSaveSettings} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Guild Name */}
            <div>
              <label className="block text-xs font-semibold text-zinc-300 mb-1.5">
                Guild Name
              </label>
              <input
                type="text"
                required
                value={settings.guild_name}
                onChange={(e) => setSettings({ ...settings, guild_name: e.target.value })}
                className="w-full bg-zinc-950 border border-zinc-700 rounded-lg px-3.5 py-2.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-amber-500"
              />
              <span className="text-[11px] text-zinc-500 mt-1 block">Branding displayed on customer-facing headers</span>
            </div>

            {/* Server Realm */}
            <div>
              <label className="block text-xs font-semibold text-zinc-300 mb-1.5 flex items-center gap-1.5">
                <Globe className="w-3.5 h-3.5 text-blue-400" />
                Monsters &amp; Memories Server Realm
              </label>
              <input
                type="text"
                required
                value={settings.server_name}
                onChange={(e) => setSettings({ ...settings, server_name: e.target.value })}
                className="w-full bg-zinc-950 border border-zinc-700 rounded-lg px-3.5 py-2.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <span className="text-[11px] text-zinc-500 mt-1 block">Server name prominently featured on all order quotes</span>
            </div>

            {/* Hours of Operation */}
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
                className="w-full bg-zinc-950 border border-zinc-700 rounded-lg px-3.5 py-2.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-amber-500"
              />
              <span className="text-[11px] text-zinc-500 mt-1 block">Visible to customers in the order form banner</span>
            </div>

            {/* Service Status Mode */}
            <div>
              <label className="block text-xs font-semibold text-zinc-300 mb-1.5 flex items-center gap-1.5">
                <Radio className="w-3.5 h-3.5 text-emerald-400" />
                Service Open/Closed Control Mode
              </label>
              <select
                value={settings.service_status_mode}
                onChange={(e) => setSettings({ ...settings, service_status_mode: e.target.value as 'auto' | 'open' | 'closed' })}
                className="w-full bg-zinc-950 border border-zinc-700 rounded-lg px-3.5 py-2.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-amber-500"
              >
                <option value="auto">Auto (Open whenever at least 1 runner is ON DUTY)</option>
                <option value="open">Force Always OPEN</option>
                <option value="closed">Force CLOSED (Maintenance / Off-Duty)</option>
              </select>
              <span className="text-[11px] text-zinc-500 mt-1 block">
                Automatic mode calculates status based on logged-in runners toggling duty.
              </span>
            </div>

            {/* Default Payout Percent */}
            <div>
              <label className="block text-xs font-semibold text-zinc-300 mb-1.5 flex items-center justify-between">
                <span>Default Camp Payout Rate (%)</span>
                <span className="font-mono text-amber-400 font-bold">{settings.default_payout_percent}%</span>
              </label>
              <div className="flex items-center gap-3">
                <input
                  type="range"
                  min="50"
                  max="95"
                  step="5"
                  value={settings.default_payout_percent}
                  onChange={(e) => setSettings({ ...settings, default_payout_percent: parseInt(e.target.value, 10) })}
                  className="w-full accent-amber-500"
                />
                <span className="text-xs font-mono text-zinc-300 w-12 text-right">
                  {settings.default_payout_percent}%
                </span>
              </div>
              <span className="text-[11px] text-zinc-500 mt-1 block">
                Percentage of vendor resale value paid to customers for standard items.
              </span>
            </div>

            {/* MOTD */}
            <div className="md:col-span-2">
              <label className="block text-xs font-semibold text-zinc-300 mb-1.5">
                Guild Announcement Banner (MOTD)
              </label>
              <textarea
                rows={2}
                value={settings.motd || ''}
                onChange={(e) => setSettings({ ...settings, motd: e.target.value })}
                placeholder="Notice to customers on homepage..."
                className="w-full bg-zinc-950 border border-zinc-700 rounded-lg px-3.5 py-2 text-xs text-white focus:outline-none focus:ring-2 focus:ring-amber-500"
              />
            </div>
          </div>

          {saveSuccess && (
            <div className="bg-emerald-950/70 border border-emerald-800 text-emerald-300 text-xs p-3 rounded-xl flex items-center gap-2">
              <Check className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>Settings updated successfully!</span>
            </div>
          )}

          {saveError && (
            <div className="bg-rose-950/70 border border-rose-800 text-rose-300 text-xs p-3 rounded-xl flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
              <span>{saveError}</span>
            </div>
          )}

          <div className="flex justify-end pt-2">
            <button
              type="submit"
              className="px-6 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-zinc-950 font-bold text-xs shadow-lg shadow-amber-500/20 transition-colors"
            >
              Save Configuration
            </button>
          </div>
        </form>
      </div>

      {/* Add Guildmate Modal */}
      {showAddUserModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4">
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <UserPlus className="w-5 h-5 text-purple-400" />
                Add New Guild Runner
              </h3>
              <button
                onClick={() => setShowAddUserModal(false)}
                className="text-zinc-500 hover:text-zinc-300 text-sm"
              >
                ✕
              </button>
            </div>

            {addUserError && (
              <div className="bg-rose-950/70 border border-rose-800 text-rose-300 text-xs p-3 rounded-xl">
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
                  className="w-full bg-zinc-950 border border-zinc-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:ring-1 focus:ring-purple-500"
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
                  className="w-full bg-zinc-950 border border-zinc-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:ring-1 focus:ring-purple-500"
                />
                <span className="text-[10px] text-zinc-500 mt-0.5 block">Visible to customers when claiming orders</span>
              </div>

              <div>
                <label className="block text-zinc-300 font-semibold mb-1">
                  Initial Password
                </label>
                <input
                  type="password"
                  required
                  placeholder="Enter secure password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="w-full bg-zinc-950 border border-zinc-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:ring-1 focus:ring-purple-500"
                />
              </div>

              <div>
                <label className="block text-zinc-300 font-semibold mb-1">
                  Role
                </label>
                <select
                  value={newRole}
                  onChange={(e) => setNewRole(e.target.value as 'runner' | 'admin')}
                  className="w-full bg-zinc-950 border border-zinc-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:ring-1 focus:ring-purple-500"
                >
                  <option value="runner">Courier Runner (Manage Orders &amp; Prices)</option>
                  <option value="admin">Administrator (Full Access)</option>
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
                  className="px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-bold shadow-md transition-colors"
                >
                  Create Guildmate Account
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit In-Game Character Name Modal */}
      {editTargetUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4">
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl max-w-sm w-full p-6 shadow-2xl space-y-4 text-xs">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Edit2 className="w-4 h-4 text-cyan-400" />
                Edit In-Game Character Name
              </h3>
              <button
                onClick={() => setEditTargetUser(null)}
                className="text-zinc-500 hover:text-zinc-300 text-sm"
              >
                ✕
              </button>
            </div>

            <p className="text-zinc-400">
              Change in-game runner name for account <span className="text-zinc-200 font-mono font-bold">{editTargetUser.username}</span>:
            </p>

            {editNameSuccess && (
              <div className="bg-emerald-950/70 border border-emerald-800 text-emerald-300 p-2.5 rounded-lg flex items-center gap-2">
                <Check className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>Runner in-game name updated!</span>
              </div>
            )}

            {editNameError && (
              <div className="bg-rose-950/70 border border-rose-800 text-rose-300 p-2.5 rounded-lg">
                {editNameError}
              </div>
            )}

            <form onSubmit={handleEditDisplayName} className="space-y-4">
              <div>
                <label className="block text-zinc-300 font-semibold mb-1">
                  Runner In-Game Name
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Ptah"
                  value={editDisplayNameVal}
                  onChange={(e) => setEditDisplayNameVal(e.target.value)}
                  className="w-full bg-zinc-950 border border-zinc-700 rounded-lg px-3 py-2 text-white placeholder-zinc-500 focus:outline-none focus:ring-1 focus:ring-cyan-500"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setEditTargetUser(null)}
                  className="px-3 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-300 font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white font-bold transition-colors"
                >
                  Save In-Game Name
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
