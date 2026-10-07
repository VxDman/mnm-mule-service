'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  Package,
  Shield,
  Layers,
  Users,
  LogIn,
  LogOut,
  Search,
  Bell,
  BellOff,
  Coins,
  Radio,
  CheckCircle2,
  Clock,
  Globe
} from 'lucide-react';
import { User, AppSettings } from '@/types';

export function Navbar() {
  const pathname = usePathname();
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [trackId, setTrackId] = useState('');
  const [showTrackModal, setShowTrackModal] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [isDutyLoading, setIsDutyLoading] = useState(false);

  const fetchStatus = () => {
    fetch('/api/settings')
      .then((res) => res.json())
      .then((data) => {
        if (data.settings) setSettings(data.settings);
      })
      .catch(() => {});
  };

  useEffect(() => {
    // Fetch logged in user
    fetch('/api/auth/me')
      .then((res) => res.json())
      .then((data) => {
        if (data.user) setUser(data.user);
      })
      .catch(() => {});

    fetchStatus();

    // Check sound preference
    const soundPref = localStorage.getItem('mule_sound_enabled');
    if (soundPref !== null) {
      setSoundEnabled(soundPref === 'true');
    }

    const interval = setInterval(fetchStatus, 10000);
    return () => clearInterval(interval);
  }, []);

  const toggleSound = () => {
    const next = !soundEnabled;
    setSoundEnabled(next);
    localStorage.setItem('mule_sound_enabled', String(next));
  };

  const handleToggleDuty = async () => {
    if (!user || isDutyLoading) return;
    setIsDutyLoading(true);

    const nextDuty = !user.is_online;
    try {
      const res = await fetch('/api/runner/duty', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_online: nextDuty })
      });
      if (res.ok) {
        setUser({ ...user, is_online: nextDuty ? 1 : 0 });
        fetchStatus();
      }
    } finally {
      setIsDutyLoading(false);
    }
  };

  const handleLogout = async () => {
    await fetch('/api/auth/logout', { method: 'POST' });
    setUser(null);
    router.push('/');
    router.refresh();
  };

  const handleTrackSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!trackId.trim()) return;
    setShowTrackModal(false);
    router.push(`/order/${encodeURIComponent(trackId.trim().toUpperCase())}`);
    setTrackId('');
  };

  const guildName = settings?.guild_name || 'The Pillar Men';
  const serverName = settings?.server_name || 'Tilustra (NA East 2)';
  const isOpen = settings?.is_service_open ?? false;
  const onlineRunnersCount = settings?.online_runners?.length || 0;

  return (
    <>
      <header className="sticky top-0 z-50 bg-zinc-950/90 backdrop-blur-md border-b border-zinc-800 text-zinc-100 shadow-md">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16 gap-3">
            {/* Logo and Brand */}
            <div className="flex items-center gap-3 sm:gap-4 shrink-0 min-w-0">
              <Link href="/" className="flex items-center gap-2.5 group shrink-0 whitespace-nowrap">
                <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-amber-600 to-amber-900 flex items-center justify-center border border-amber-500/40 shadow-inner group-hover:scale-105 transition-transform shrink-0">
                  <Coins className="w-5 h-5 text-amber-200" />
                </div>
                <div className="shrink-0 whitespace-nowrap">
                  <div className="flex items-center gap-2 font-black tracking-tight text-white group-hover:text-amber-300 transition-colors whitespace-nowrap leading-tight">
                    <span className="text-base whitespace-nowrap">{guildName}</span>
                  </div>
                  <p className="text-[11px] text-zinc-400 font-medium whitespace-nowrap leading-tight">Camp Trade &amp; Courier Service</p>
                </div>
              </Link>

              {/* Server Name Prominent Badge */}
              <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold bg-blue-950/70 border border-blue-500/40 text-blue-300 shadow-sm shrink-0 whitespace-nowrap">
                <Globe className="w-3.5 h-3.5 text-blue-400 shrink-0" />
                <span className="whitespace-nowrap">Server: {serverName}</span>
              </div>

              {/* Service Open/Closed Live Indicator */}
              <div className="hidden md:flex items-center gap-2 pl-2 border-l border-zinc-800 text-xs shrink-0 whitespace-nowrap">
                <span
                  className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold border shrink-0 whitespace-nowrap ${
                    isOpen
                      ? 'bg-emerald-950/80 border-emerald-500/50 text-emerald-300'
                      : 'bg-zinc-900 border-zinc-700 text-zinc-400'
                  }`}
                  title={settings?.hours_of_operation}
                >
                  <span
                    className={`w-2 h-2 rounded-full shrink-0 ${
                      isOpen ? 'bg-emerald-400 animate-pulse' : 'bg-zinc-500'
                    }`}
                  />
                  <span className="whitespace-nowrap">{isOpen ? `Service Open (${onlineRunnersCount} runner${onlineRunnersCount === 1 ? '' : 's'})` : 'Closed / Off Duty'}</span>
                </span>
              </div>

              {/* Main Nav Links */}
              <nav className="hidden lg:flex items-center gap-1 ml-1 xl:ml-2 text-xs xl:text-sm shrink-0">
                <Link
                  href="/"
                  className={`px-2.5 xl:px-3 py-1.5 rounded-md transition-colors whitespace-nowrap ${
                    pathname === '/'
                      ? 'bg-amber-500/20 text-amber-300 font-semibold border border-amber-500/30'
                      : 'text-zinc-300 hover:text-white hover:bg-zinc-800/60'
                  }`}
                >
                  Request Courier
                </Link>

                <button
                  onClick={() => setShowTrackModal(true)}
                  className="px-2.5 xl:px-3 py-1.5 rounded-md text-zinc-300 hover:text-white hover:bg-zinc-800/60 transition-colors flex items-center gap-1.5 whitespace-nowrap"
                >
                  <Search className="w-3.5 h-3.5 text-zinc-400 shrink-0" />
                  <span>Track Order</span>
                </button>

                {user && (
                  <>
                    <div className="h-4 w-px bg-zinc-800 mx-1.5" />
                    <Link
                      href="/dashboard"
                      className={`px-2.5 xl:px-3 py-1.5 rounded-md transition-colors flex items-center gap-1.5 whitespace-nowrap ${
                        pathname === '/dashboard'
                          ? 'bg-amber-500/20 text-amber-300 font-semibold border border-amber-500/30'
                          : 'text-zinc-300 hover:text-white hover:bg-zinc-800/60'
                      }`}
                    >
                      <Package className="w-4 h-4 text-amber-400 shrink-0" />
                      <span>Orders Queue</span>
                    </Link>

                    <Link
                      href="/items"
                      className={`px-2.5 xl:px-3 py-1.5 rounded-md transition-colors flex items-center gap-1.5 whitespace-nowrap ${
                        pathname === '/items'
                          ? 'bg-amber-500/20 text-amber-300 font-semibold border border-amber-500/30'
                          : 'text-zinc-300 hover:text-white hover:bg-zinc-800/60'
                      }`}
                    >
                      <Layers className="w-4 h-4 text-cyan-400 shrink-0" />
                      <span>Prices &amp; Bounties</span>
                    </Link>

                    {user.role === 'admin' && (
                      <Link
                        href="/admin"
                        className={`px-2.5 xl:px-3 py-1.5 rounded-md transition-colors flex items-center gap-1.5 whitespace-nowrap ${
                          pathname === '/admin'
                            ? 'bg-amber-500/20 text-amber-300 font-semibold border border-amber-500/30'
                            : 'text-zinc-300 hover:text-white hover:bg-zinc-800/60'
                        }`}
                      >
                        <Shield className="w-4 h-4 text-purple-400 shrink-0" />
                        <span>Guild Admin</span>
                      </Link>
                    )}
                  </>
                )}
              </nav>
            </div>

            {/* Right Side: Runner Duty Switch & Sound & Auth */}
            <div className="flex items-center gap-2 sm:gap-3 shrink-0">
              {/* Runner Duty Status Switch */}
              {user && (
                <button
                  type="button"
                  onClick={handleToggleDuty}
                  disabled={isDutyLoading}
                  className={`px-2.5 sm:px-3 py-1.5 rounded-lg border text-xs font-bold transition-all flex items-center gap-1.5 shadow-sm shrink-0 ${
                    user.is_online
                      ? 'bg-emerald-600 hover:bg-emerald-500 text-zinc-950 border-emerald-400 animate-pulse'
                      : 'bg-zinc-900 hover:bg-zinc-800 text-zinc-400 border-zinc-700'
                  }`}
                  title="Click to toggle your active courier duty status and open/close service"
                >
                  <Radio className="w-3.5 h-3.5 shrink-0" />
                  <span className="whitespace-nowrap">{user.is_online ? 'ON DUTY' : 'OFF DUTY'}</span>
                </button>
              )}

              {user && (
                <button
                  type="button"
                  onClick={toggleSound}
                  title={soundEnabled ? 'Order Audio Chime Enabled' : 'Order Audio Chime Muted'}
                  className={`p-2 rounded-md border text-xs transition-colors flex items-center gap-1.5 shrink-0 ${
                    soundEnabled
                      ? 'bg-emerald-950/40 border-emerald-600/40 text-emerald-300 hover:bg-emerald-950/60'
                      : 'bg-zinc-900 border-zinc-800 text-zinc-500 hover:bg-zinc-800'
                  }`}
                >
                  {soundEnabled ? <Bell className="w-4 h-4 text-emerald-400 shrink-0" /> : <BellOff className="w-4 h-4 shrink-0" />}
                  <span className="hidden xl:inline text-[11px] whitespace-nowrap">{soundEnabled ? 'Chime ON' : 'Chime OFF'}</span>
                </button>
              )}

              {user ? (
                <div className="flex items-center gap-2 sm:gap-3 shrink-0">
                  <div className="hidden sm:flex flex-col text-right shrink-0 whitespace-nowrap">
                    <span className="text-xs font-bold text-white whitespace-nowrap">{user.display_name}</span>
                    <span className="text-[10px] text-zinc-400 capitalize">{user.role}</span>
                  </div>
                  <button
                    onClick={handleLogout}
                    title="Log Out"
                    className="p-2 rounded-lg bg-zinc-900 border border-zinc-800 text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors shrink-0"
                  >
                    <LogOut className="w-4 h-4" />
                  </button>
                </div>
              ) : (
                <Link
                  href="/login"
                  className="px-3 py-1.5 rounded-lg bg-zinc-900 hover:bg-zinc-800 border border-zinc-700 text-xs font-medium text-zinc-300 hover:text-white transition-colors flex items-center gap-1.5 shrink-0 whitespace-nowrap"
                >
                  <LogIn className="w-3.5 h-3.5 shrink-0" />
                  <span className="whitespace-nowrap">Guild Login</span>
                </Link>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Track Order Modal */}
      {showTrackModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Search className="w-4 h-4 text-amber-400" />
                Track In-Flight Order
              </h3>
              <button
                onClick={() => setShowTrackModal(false)}
                className="text-zinc-500 hover:text-zinc-300 text-sm"
              >
                ✕
              </button>
            </div>
            <p className="text-xs text-zinc-400">
              Enter your Order ID (e.g. <span className="text-amber-400 font-mono">MM-1042</span>) to check status, runner ETA, or camp chat.
            </p>
            <form onSubmit={handleTrackSubmit} className="space-y-4">
              <input
                type="text"
                placeholder="e.g. MM-2490"
                value={trackId}
                onChange={(e) => setTrackId(e.target.value)}
                autoFocus
                className="w-full bg-zinc-950 border border-zinc-700 rounded-xl px-4 py-2.5 text-sm text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-amber-500 font-mono font-bold uppercase"
              />
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowTrackModal(false)}
                  className="px-4 py-2 rounded-xl bg-zinc-800 text-zinc-300 hover:bg-zinc-700 text-xs font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-zinc-950 text-xs font-bold shadow-md transition-colors"
                >
                  Track Order
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
