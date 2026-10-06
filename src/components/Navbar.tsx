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
  Coins
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

  useEffect(() => {
    // Fetch logged in user
    fetch('/api/auth/me')
      .then((res) => res.json())
      .then((data) => {
        if (data.user) setUser(data.user);
      })
      .catch(() => {});

    // Fetch public settings
    fetch('/api/settings')
      .then((res) => res.json())
      .then((data) => {
        if (data.settings) setSettings(data.settings);
      })
      .catch(() => {});

    // Check sound preference
    const soundPref = localStorage.getItem('mule_sound_enabled');
    if (soundPref !== null) {
      setSoundEnabled(soundPref === 'true');
    }
  }, []);

  const toggleSound = () => {
    const next = !soundEnabled;
    setSoundEnabled(next);
    localStorage.setItem('mule_sound_enabled', String(next));
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

  const guildName = settings?.guild_name || 'Ironforge Courier';
  const guildTag = settings?.guild_tag || '<MULE>';

  return (
    <>
      <header className="sticky top-0 z-50 bg-zinc-950/90 backdrop-blur-md border-b border-zinc-800 text-zinc-100 shadow-md">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            {/* Logo and Brand */}
            <div className="flex items-center gap-4">
              <Link href="/" className="flex items-center gap-2.5 group">
                <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-amber-600 to-amber-900 flex items-center justify-center border border-amber-500/40 shadow-inner group-hover:scale-105 transition-transform">
                  <Coins className="w-5 h-5 text-amber-200" />
                </div>
                <div>
                  <div className="flex items-center gap-1.5 font-bold tracking-tight text-white group-hover:text-amber-300 transition-colors">
                    <span>{guildName}</span>
                    <span className="text-xs px-1.5 py-0.5 rounded bg-amber-950/80 border border-amber-600/50 text-amber-400 font-mono">
                      {guildTag}
                    </span>
                  </div>
                  <p className="text-[11px] text-zinc-400 font-medium">M&M Camp Mule & Courier</p>
                </div>
              </Link>

              {/* Main Nav Links */}
              <nav className="hidden md:flex items-center gap-1 ml-6 text-sm">
                <Link
                  href="/"
                  className={`px-3 py-1.5 rounded-md transition-colors ${
                    pathname === '/'
                      ? 'bg-amber-500/20 text-amber-300 font-semibold border border-amber-500/30'
                      : 'text-zinc-300 hover:text-white hover:bg-zinc-800/60'
                  }`}
                >
                  Request Mule
                </Link>

                <button
                  onClick={() => setShowTrackModal(true)}
                  className="px-3 py-1.5 rounded-md text-zinc-300 hover:text-white hover:bg-zinc-800/60 transition-colors flex items-center gap-1.5"
                >
                  <Search className="w-3.5 h-3.5 text-zinc-400" />
                  Track Order
                </button>

                {user && (
                  <>
                    <div className="h-4 w-px bg-zinc-800 mx-2" />
                    <Link
                      href="/dashboard"
                      className={`px-3 py-1.5 rounded-md transition-colors flex items-center gap-1.5 ${
                        pathname === '/dashboard'
                          ? 'bg-amber-500/20 text-amber-300 font-semibold border border-amber-500/30'
                          : 'text-zinc-300 hover:text-white hover:bg-zinc-800/60'
                      }`}
                    >
                      <Package className="w-4 h-4 text-amber-400" />
                      Orders Queue
                    </Link>

                    <Link
                      href="/items"
                      className={`px-3 py-1.5 rounded-md transition-colors flex items-center gap-1.5 ${
                        pathname === '/items'
                          ? 'bg-amber-500/20 text-amber-300 font-semibold border border-amber-500/30'
                          : 'text-zinc-300 hover:text-white hover:bg-zinc-800/60'
                      }`}
                    >
                      <Layers className="w-4 h-4 text-cyan-400" />
                      Price Catalog
                    </Link>

                    {user.role === 'admin' && (
                      <Link
                        href="/admin"
                        className={`px-3 py-1.5 rounded-md transition-colors flex items-center gap-1.5 ${
                          pathname === '/admin'
                            ? 'bg-amber-500/20 text-amber-300 font-semibold border border-amber-500/30'
                            : 'text-zinc-300 hover:text-white hover:bg-zinc-800/60'
                        }`}
                      >
                        <Shield className="w-4 h-4 text-purple-400" />
                        Guild Admin
                      </Link>
                    )}
                  </>
                )}
              </nav>
            </div>

            {/* Right Side: Sound Toggle & Auth */}
            <div className="flex items-center gap-3">
              {user && (
                <button
                  type="button"
                  onClick={toggleSound}
                  title={soundEnabled ? 'Order Audio Chime Enabled' : 'Order Audio Chime Muted'}
                  className={`p-2 rounded-md border text-xs transition-colors flex items-center gap-1.5 ${
                    soundEnabled
                      ? 'bg-emerald-950/40 border-emerald-600/40 text-emerald-300 hover:bg-emerald-950/60'
                      : 'bg-zinc-900 border-zinc-800 text-zinc-500 hover:bg-zinc-800'
                  }`}
                >
                  {soundEnabled ? <Bell className="w-4 h-4 text-emerald-400" /> : <BellOff className="w-4 h-4" />}
                  <span className="hidden sm:inline text-[11px]">{soundEnabled ? 'Chime ON' : 'Chime OFF'}</span>
                </button>
              )}

              {user ? (
                <div className="flex items-center gap-3">
                  <div className="hidden sm:flex flex-col text-right">
                    <span className="text-xs font-semibold text-zinc-200">{user.display_name}</span>
                    <span className="text-[10px] text-amber-400 font-mono capitalize">
                      {user.role === 'admin' ? 'Guild Leader / Admin' : 'Runner'}
                    </span>
                  </div>
                  <button
                    onClick={handleLogout}
                    title="Sign Out"
                    className="p-2 rounded-md bg-zinc-900 border border-zinc-800 text-zinc-400 hover:text-rose-300 hover:border-rose-900/50 hover:bg-rose-950/30 transition-colors"
                  >
                    <LogOut className="w-4 h-4" />
                  </button>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setShowTrackModal(true)}
                    className="md:hidden p-2 rounded-md bg-zinc-900 border border-zinc-800 text-zinc-300"
                  >
                    <Search className="w-4 h-4" />
                  </button>
                  <Link
                    href="/login"
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-zinc-900 hover:bg-zinc-800 border border-zinc-700/80 text-zinc-200 hover:text-white text-xs font-medium transition-colors"
                  >
                    <LogIn className="w-3.5 h-3.5 text-amber-400" />
                    <span>Guild Login</span>
                  </Link>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Mobile Navigation bar */}
        {user && (
          <div className="md:hidden border-t border-zinc-800/80 px-4 py-2 bg-zinc-950/95 flex items-center justify-around text-xs">
            <Link
              href="/"
              className={`p-1.5 ${pathname === '/' ? 'text-amber-400 font-bold' : 'text-zinc-400'}`}
            >
              Order
            </Link>
            <Link
              href="/dashboard"
              className={`p-1.5 ${pathname === '/dashboard' ? 'text-amber-400 font-bold' : 'text-zinc-400'}`}
            >
              Queue
            </Link>
            <Link
              href="/items"
              className={`p-1.5 ${pathname === '/items' ? 'text-amber-400 font-bold' : 'text-zinc-400'}`}
            >
              Catalog
            </Link>
            {user.role === 'admin' && (
              <Link
                href="/admin"
                className={`p-1.5 ${pathname === '/admin' ? 'text-amber-400 font-bold' : 'text-zinc-400'}`}
              >
                Admin
              </Link>
            )}
          </div>
        )}
      </header>

      {/* Track Order Modal */}
      {showTrackModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-xs p-4">
          <div className="bg-zinc-900 border border-zinc-700 rounded-xl shadow-2xl max-w-md w-full p-6 text-zinc-100">
            <h3 className="text-lg font-bold text-white mb-2 flex items-center gap-2">
              <Search className="w-5 h-5 text-amber-400" />
              Track Existing Order
            </h3>
            <p className="text-xs text-zinc-400 mb-4">
              Enter your Order Code (e.g. <span className="font-mono text-amber-300">MM-4821</span>) to check current runner status, quote updates, and arrival.
            </p>

            <form onSubmit={handleTrackSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-zinc-300 mb-1">Order Code</label>
                <input
                  type="text"
                  autoFocus
                  required
                  placeholder="MM-XXXX"
                  value={trackId}
                  onChange={(e) => setTrackId(e.target.value)}
                  className="w-full bg-zinc-950 border border-zinc-700 rounded-lg px-3.5 py-2.5 text-sm font-mono text-white placeholder-zinc-600 focus:outline-none focus:ring-2 focus:ring-amber-500 uppercase"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowTrackModal(false)}
                  className="px-4 py-2 rounded-lg bg-zinc-800 text-zinc-300 hover:bg-zinc-700 text-xs font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-lg bg-amber-600 hover:bg-amber-500 text-zinc-950 text-xs font-bold"
                >
                  Find Order
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
