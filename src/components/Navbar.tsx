'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  Package,
  Shield,
  Layers,
  LogIn,
  LogOut,
  Search,
  Bell,
  BellOff,
  Coins,
  Radio,
  Globe,
  Menu,
  X
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
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

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
      <header className="sticky top-0 z-50 bg-zinc-950/90 backdrop-blur-md border-b border-zinc-800 text-zinc-100 shadow-md w-full overflow-x-clip">
        <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 w-full">
          <div className="flex items-center justify-between h-16 gap-2 sm:gap-4 min-w-0">
            {/* Logo and Brand */}
            <div className="flex items-center gap-2.5 sm:gap-3 shrink-0 min-w-0">
              <Link href="/" className="flex items-center gap-2.5 group min-w-0">
                <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-lg bg-gradient-to-br from-amber-600 to-amber-900 flex items-center justify-center border border-amber-500/40 shadow-inner group-hover:scale-105 transition-transform shrink-0">
                  <Coins className="w-5 h-5 text-amber-200" />
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5 font-black tracking-tight text-white group-hover:text-amber-300 transition-colors leading-tight">
                    <span className="text-sm sm:text-base truncate max-w-[130px] sm:max-w-[200px] xl:max-w-[260px]" title={guildName}>
                      {guildName}
                    </span>
                    <span
                      className="hidden sm:inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[9px] font-bold bg-blue-950/70 border border-blue-500/40 text-blue-300 shrink-0"
                      title={`Server: ${serverName}`}
                    >
                      <Globe className="w-2.5 h-2.5 text-blue-400" />
                      <span>{serverName.includes(' ') ? serverName.split(' ')[0] : serverName}</span>
                    </span>
                  </div>
                  <p className="text-[10px] sm:text-[11px] text-zinc-400 font-medium leading-tight truncate max-w-[160px] sm:max-w-[220px]">
                    Camp Trade &amp; Courier Service
                  </p>
                </div>
              </Link>

              {/* Service Open/Closed Live Indicator (Visible on 2XL screens) */}
              <div className="hidden 2xl:flex items-center gap-2 pl-2 border-l border-zinc-800 text-xs shrink-0">
                <span
                  className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold border ${
                    isOpen
                      ? 'bg-emerald-950/80 border-emerald-500/50 text-emerald-300'
                      : 'bg-zinc-900 border-zinc-700 text-zinc-400'
                  }`}
                  title={settings?.hours_of_operation}
                >
                  <span
                    className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                      isOpen ? 'bg-emerald-400 animate-pulse' : 'bg-zinc-500'
                    }`}
                  />
                  <span>{isOpen ? `${onlineRunnersCount} Active` : 'Closed'}</span>
                </span>
              </div>
            </div>

            {/* Center Navigation Links (Desktop) */}
            <nav className="hidden lg:flex items-center gap-1 text-xs xl:text-sm shrink-0">
              <Link
                href="/"
                className={`px-2.5 xl:px-3 py-1.5 rounded-md transition-colors whitespace-nowrap ${
                  pathname === '/'
                    ? 'bg-amber-500/20 text-amber-300 font-semibold border border-amber-500/30'
                    : 'text-zinc-300 hover:text-white hover:bg-zinc-800/60'
                }`}
              >
                <span>Request</span>
                <span className="hidden xl:inline"> Courier</span>
              </Link>

              <button
                onClick={() => setShowTrackModal(true)}
                className="px-2.5 xl:px-3 py-1.5 rounded-md text-zinc-300 hover:text-white hover:bg-zinc-800/60 transition-colors flex items-center gap-1.5 whitespace-nowrap"
              >
                <Search className="w-3.5 h-3.5 text-zinc-400 shrink-0" />
                <span>Track</span>
                <span className="hidden xl:inline"> Order</span>
              </button>

              {user && (
                <>
                  <div className="h-4 w-px bg-zinc-800 mx-1" />
                  <Link
                    href="/dashboard"
                    className={`px-2.5 xl:px-3 py-1.5 rounded-md transition-colors flex items-center gap-1.5 whitespace-nowrap ${
                      pathname === '/dashboard'
                        ? 'bg-amber-500/20 text-amber-300 font-semibold border border-amber-500/30'
                        : 'text-zinc-300 hover:text-white hover:bg-zinc-800/60'
                    }`}
                  >
                    <Package className="w-4 h-4 text-amber-400 shrink-0" />
                    <span>Queue</span>
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
                    <span>Prices</span>
                    <span className="hidden xl:inline"> &amp; Bounties</span>
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
                      <span>Admin</span>
                    </Link>
                  )}
                </>
              )}
            </nav>

            {/* Right Side: Duty, Sound, User, Auth & Mobile Menu */}
            <div className="flex items-center gap-1.5 sm:gap-2.5 shrink-0">
              {/* Runner Duty Status Switch */}
              {user && (
                <button
                  type="button"
                  onClick={handleToggleDuty}
                  disabled={isDutyLoading}
                  className={`px-2 sm:px-2.5 py-1.5 rounded-lg border text-xs font-bold transition-all flex items-center gap-1.5 shadow-sm shrink-0 ${
                    user.is_online
                      ? 'bg-emerald-600 hover:bg-emerald-500 text-zinc-950 border-emerald-400 animate-pulse'
                      : 'bg-zinc-900 hover:bg-zinc-800 text-zinc-400 border-zinc-700'
                  }`}
                  title="Click to toggle your active courier duty status and open/close service"
                >
                  <Radio className="w-3.5 h-3.5 shrink-0" />
                  <span className="text-[11px] font-bold whitespace-nowrap">{user.is_online ? 'ON DUTY' : 'OFF DUTY'}</span>
                </button>
              )}

              {/* Sound toggle button */}
              {user && (
                <button
                  type="button"
                  onClick={toggleSound}
                  title={soundEnabled ? 'Order Audio Chime Enabled' : 'Order Audio Chime Muted'}
                  className={`p-2 rounded-lg border text-xs transition-colors flex items-center justify-center shrink-0 ${
                    soundEnabled
                      ? 'bg-emerald-950/40 border-emerald-600/40 text-emerald-300 hover:bg-emerald-950/60'
                      : 'bg-zinc-900 border-zinc-800 text-zinc-500 hover:bg-zinc-800'
                  }`}
                >
                  {soundEnabled ? <Bell className="w-3.5 h-3.5 text-emerald-400 shrink-0" /> : <BellOff className="w-3.5 h-3.5 shrink-0" />}
                </button>
              )}

              {/* User Profile */}
              {user ? (
                <div className="flex items-center gap-2 shrink-0">
                  <div className="hidden sm:flex flex-col text-right shrink-0">
                    <span className="text-xs font-bold text-white truncate max-w-[90px] xl:max-w-[140px]" title={user.display_name}>
                      {user.display_name}
                    </span>
                    <span className="text-[10px] text-zinc-400 capitalize">{user.role}</span>
                  </div>
                  <button
                    onClick={handleLogout}
                    title="Log Out"
                    className="p-2 rounded-lg bg-zinc-900 border border-zinc-800 text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors shrink-0"
                  >
                    <LogOut className="w-3.5 h-3.5" />
                  </button>
                </div>
              ) : (
                <Link
                  href="/login"
                  className="px-3 py-1.5 rounded-lg bg-zinc-900 hover:bg-zinc-800 border border-zinc-700 text-xs font-medium text-zinc-300 hover:text-white transition-colors flex items-center gap-1.5 shrink-0 whitespace-nowrap"
                >
                  <LogIn className="w-3.5 h-3.5 shrink-0" />
                  <span>Guild Login</span>
                </Link>
              )}

              {/* Mobile Menu Hamburger */}
              <button
                type="button"
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                className="lg:hidden p-2 rounded-lg bg-zinc-900 border border-zinc-800 text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors shrink-0"
                aria-label="Toggle navigation menu"
              >
                {mobileMenuOpen ? <X className="w-4 h-4" /> : <Menu className="w-4 h-4" />}
              </button>
            </div>
          </div>
        </div>

        {/* Mobile Navigation Dropdown Drawer */}
        {mobileMenuOpen && (
          <div className="lg:hidden bg-zinc-950/98 border-t border-zinc-800/80 px-4 py-3 space-y-1.5 text-xs shadow-2xl">
            <Link
              href="/"
              onClick={() => setMobileMenuOpen(false)}
              className={`block px-3 py-2 rounded-lg font-medium transition-colors ${
                pathname === '/' ? 'bg-amber-500/20 text-amber-300 font-bold' : 'text-zinc-300 hover:bg-zinc-900'
              }`}
            >
              Request Courier
            </Link>
            <button
              onClick={() => {
                setMobileMenuOpen(false);
                setShowTrackModal(true);
              }}
              className="w-full text-left px-3 py-2 rounded-lg text-zinc-300 hover:bg-zinc-900 flex items-center gap-2"
            >
              <Search className="w-3.5 h-3.5 text-zinc-400" />
              <span>Track Order</span>
            </button>
            {user && (
              <>
                <div className="h-px bg-zinc-800 my-1.5" />
                <Link
                  href="/dashboard"
                  onClick={() => setMobileMenuOpen(false)}
                  className={`flex items-center gap-2 px-3 py-2 rounded-lg transition-colors ${
                    pathname === '/dashboard' ? 'bg-amber-500/20 text-amber-300 font-bold' : 'text-zinc-300 hover:bg-zinc-900'
                  }`}
                >
                  <Package className="w-4 h-4 text-amber-400" />
                  <span>Orders Queue</span>
                </Link>
                <Link
                  href="/items"
                  onClick={() => setMobileMenuOpen(false)}
                  className={`flex items-center gap-2 px-3 py-2 rounded-lg transition-colors ${
                    pathname === '/items' ? 'bg-amber-500/20 text-amber-300 font-bold' : 'text-zinc-300 hover:bg-zinc-900'
                  }`}
                >
                  <Layers className="w-4 h-4 text-cyan-400" />
                  <span>Prices &amp; Bounties</span>
                </Link>
                {user.role === 'admin' && (
                  <Link
                    href="/admin"
                    onClick={() => setMobileMenuOpen(false)}
                    className={`flex items-center gap-2 px-3 py-2 rounded-lg transition-colors ${
                      pathname === '/admin' ? 'bg-amber-500/20 text-amber-300 font-bold' : 'text-zinc-300 hover:bg-zinc-900'
                    }`}
                  >
                    <Shield className="w-4 h-4 text-purple-400" />
                    <span>Guild Admin</span>
                  </Link>
                )}
                <div className="pt-2 px-3 text-[11px] text-zinc-500 flex items-center justify-between">
                  <span>Logged in as <strong className="text-zinc-300">{user.display_name}</strong></span>
                  <span className="capitalize text-zinc-400">({user.role})</span>
                </div>
              </>
            )}
          </div>
        )}
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
