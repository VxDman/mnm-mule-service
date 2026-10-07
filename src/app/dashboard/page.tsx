'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Package,
  Clock,
  MapPin,
  User,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
  Coins,
  ChevronRight,
  RefreshCw,
  Bell,
  BellOff,
  Filter,
  DollarSign,
  TrendingUp,
  Layers,
  Check,
  X,
  ExternalLink,
  MessageSquare,
  Radio,
  Star,
  Users,
  Globe
} from 'lucide-react';
import { CoinDisplay } from '@/components/CoinDisplay';
import { CoinInput } from '@/components/CoinInput';
import { Order, OrderItem, User as UserType } from '@/types';
import { calculatePayout } from '@/lib/currency';

function playOrderChime() {
  try {
    const AudioContextClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AudioContextClass) return;
    const ctx = new AudioContextClass();

    const notes = [523.25, 659.25, 783.99, 1046.5];
    notes.forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0.12, ctx.currentTime + idx * 0.1);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + idx * 0.1 + 0.35);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(ctx.currentTime + idx * 0.1);
      osc.stop(ctx.currentTime + idx * 0.1 + 0.35);
    });
  } catch {}
}

export default function RunnerDashboard() {
  const router = useRouter();
  const [currentUser, setCurrentUser] = useState<UserType | null>(null);
  const [orders, setOrders] = useState<Order[]>([]);
  const [onlineRunners, setOnlineRunners] = useState<Array<{ id: string; display_name: string }>>([]);
  const [isServiceOpen, setIsServiceOpen] = useState(false);
  const [hoursOfOperation, setHoursOfOperation] = useState('');
  const [serverName, setServerName] = useState('Tilustra (NA East 2)');
  const [isDutyLoading, setIsDutyLoading] = useState(false);
  const [stats, setStats] = useState<{
    totalCompleted: number;
    activeOrders: number;
    totalProfitCopper: number;
    itemCount: number;
  } | null>(null);

  const [loading, setLoading] = useState(true);
  const [filterTab, setFilterTab] = useState<'active' | 'needs_quote' | 'claimable' | 'my_runs' | 'all' | 'completed'>('active');

  // Modals
  const [selectedOrderForQuote, setSelectedOrderForQuote] = useState<Order | null>(null);
  const [quoteInputs, setQuoteInputs] = useState<Record<string, {
    vendorCopper: number;
    saveToCatalog: boolean;
    category: string;
    isPreferred: boolean;
    preferredPercent: number;
  }>>({});

  const [selectedOrderForAccept, setSelectedOrderForAccept] = useState<Order | null>(null);
  const [etaInput, setEtaInput] = useState('5 mins');
  const [notesInput, setNotesInput] = useState('');

  // Audio alerts
  const [soundEnabled, setSoundEnabled] = useState(true);
  const prevOrderCountRef = useRef<number>(0);

  const fetchData = useCallback(async (isPolling = false) => {
    try {
      // 1. Check user auth
      const authRes = await fetch('/api/auth/me');
      const authData = await authRes.json();
      if (!authData.user) {
        router.push('/login');
        return;
      }
      setCurrentUser(authData.user);

      // 2. Fetch duty status & settings
      const dutyRes = await fetch('/api/runner/duty');
      const dutyData = await dutyRes.json();
      setIsServiceOpen(dutyData.is_service_open);
      setHoursOfOperation(dutyData.hours_of_operation);
      if (dutyData.server_name) setServerName(dutyData.server_name);
      setOnlineRunners(dutyData.online_runners || []);

      // 3. Fetch orders
      const ordersRes = await fetch('/api/orders?status=all');
      const ordersData = await ordersRes.json();
      if (ordersData.orders) {
        const fetchedOrders: Order[] = ordersData.orders;
        const activeCount = fetchedOrders.filter((o) =>
          ['pending_quote', 'quoted', 'accepted', 'arrived'].includes(o.status)
        ).length;

        if (isPolling && activeCount > prevOrderCountRef.current && soundEnabled) {
          playOrderChime();
        }
        prevOrderCountRef.current = activeCount;

        setOrders(fetchedOrders);
      }

      // 4. Fetch stats
      const statsRes = await fetch('/api/stats');
      const statsData = await statsRes.json();
      if (statsData.stats) {
        setStats(statsData.stats);
      }

      setLoading(false);
    } catch {
      setLoading(false);
    }
  }, [router, soundEnabled]);

  useEffect(() => {
    fetchData();

    // Sound preference
    const soundPref = localStorage.getItem('mule_sound_enabled');
    if (soundPref !== null) {
      setSoundEnabled(soundPref === 'true');
    }

    // Live poll queue every 4 seconds
    const interval = setInterval(() => {
      fetchData(true);
    }, 4000);

    return () => clearInterval(interval);
  }, [fetchData]);

  const handleToggleDuty = async () => {
    if (!currentUser || isDutyLoading) return;
    setIsDutyLoading(true);

    const nextDuty = !currentUser.is_online;
    try {
      const res = await fetch('/api/runner/duty', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_online: nextDuty })
      });
      if (res.ok) {
        setCurrentUser({ ...currentUser, is_online: nextDuty ? 1 : 0 });
        fetchData(true);
      }
    } finally {
      setIsDutyLoading(false);
    }
  };

  const openQuoteModal = (order: Order) => {
    setSelectedOrderForQuote(order);
    const initial: Record<string, {
      vendorCopper: number;
      saveToCatalog: boolean;
      category: string;
      isPreferred: boolean;
      preferredPercent: number;
    }> = {};

    order.items?.forEach((it) => {
      initial[it.id] = {
        vendorCopper: it.vendor_unit_copper || 0,
        saveToCatalog: true,
        category: 'Loot',
        isPreferred: !!it.is_preferred,
        preferredPercent: 90
      };
    });
    setQuoteInputs(initial);
  };

  const handleSaveQuotes = async () => {
    if (!selectedOrderForQuote) return;

    const payload = Object.entries(quoteInputs).map(([itemId, data]) => ({
      item_id: itemId,
      item_name: selectedOrderForQuote.items?.find((i) => i.id === itemId)?.item_name || '',
      vendor_unit_copper: data.vendorCopper,
      save_to_catalog: data.saveToCatalog,
      category: data.category,
      is_preferred: data.isPreferred,
      preferred_payout_percent: data.isPreferred ? data.preferredPercent : undefined
    }));

    try {
      const res = await fetch(`/api/orders/${selectedOrderForQuote.id}/quote`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ quotes: payload })
      });
      if (res.ok) {
        setSelectedOrderForQuote(null);
        fetchData(true);
      }
    } catch {}
  };

  const handleAcceptOrder = async () => {
    if (!selectedOrderForAccept) return;

    try {
      const res = await fetch(`/api/orders/${selectedOrderForAccept.id}/accept`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          eta: etaInput.trim(),
          notes: notesInput.trim()
        })
      });
      if (res.ok) {
        setSelectedOrderForAccept(null);
        fetchData(true);
      }
    } catch {}
  };

  const handleUpdateStatus = async (orderId: string, status: Order['status'], message?: string) => {
    try {
      const res = await fetch(`/api/orders/${orderId}/status`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status, message })
      });
      if (res.ok) {
        fetchData(true);
      }
    } catch {}
  };

  const filteredOrders = orders.filter((o) => {
    if (filterTab === 'active') {
      return ['pending_quote', 'quoted', 'accepted', 'arrived'].includes(o.status);
    }
    if (filterTab === 'needs_quote') {
      return o.status === 'pending_quote';
    }
    if (filterTab === 'claimable') {
      return o.status === 'quoted';
    }
    if (filterTab === 'my_runs') {
      return o.assigned_runner_id === currentUser?.id;
    }
    if (filterTab === 'completed') {
      return o.status === 'completed';
    }
    return true; // 'all'
  });

  if (loading) {
    return (
      <div className="min-h-screen bg-zinc-950 text-zinc-100 flex items-center justify-center">
        <div className="text-center space-y-3">
          <RefreshCw className="w-8 h-8 text-amber-400 animate-spin mx-auto" />
          <p className="text-sm text-zinc-400">Loading Dispatch Board...</p>
        </div>
      </div>
    );
  }

  const isOnDuty = !!currentUser?.is_online;

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 pb-20">
      {/* Top Banner / KPIs */}
      <div className="border-b border-zinc-800 bg-zinc-900/60 backdrop-blur-md px-4 sm:px-6 lg:px-8 py-6">
        <div className="max-w-7xl mx-auto space-y-6">
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2.5">
                <h1 className="text-2xl font-black text-white tracking-tight">The Pillar Men Dispatch Board</h1>
                <span className="px-2 py-0.5 rounded bg-amber-950/80 border border-amber-600/50 text-amber-400 text-xs font-mono font-bold">
                  LIVE
                </span>
                <span className="hidden sm:inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold bg-blue-950/80 border border-blue-500/50 text-blue-300">
                  <Globe className="w-3.5 h-3.5 text-blue-400" />
                  {serverName}
                </span>
              </div>
              <p className="text-xs text-zinc-400 mt-1 flex flex-wrap items-center gap-2">
                <span>Runner: <strong className="text-amber-300 font-semibold">{currentUser?.display_name}</strong></span>
                <span>•</span>
                <span>Server: <strong className="text-blue-300 font-semibold">{serverName}</strong></span>
                <span>•</span>
                <span>Operating Hours: <strong className="text-zinc-300">{hoursOfOperation}</strong></span>
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              {/* Duty Toggle Button */}
              <button
                type="button"
                onClick={handleToggleDuty}
                disabled={isDutyLoading}
                className={`px-4 py-2 rounded-xl border text-xs font-bold transition-all flex items-center gap-2 shadow-lg ${
                  isOnDuty
                    ? 'bg-emerald-600 hover:bg-emerald-500 text-zinc-950 border-emerald-400 animate-pulse'
                    : 'bg-zinc-900 hover:bg-zinc-800 text-zinc-400 border-zinc-700'
                }`}
              >
                <Radio className="w-4 h-4" />
                <span>{isOnDuty ? 'YOU ARE ON DUTY (SERVICE OPEN)' : 'GO ON DUTY (OPEN SERVICE)'}</span>
              </button>

              <button
                onClick={() => {
                  setSoundEnabled(!soundEnabled);
                  if (!soundEnabled) playOrderChime();
                }}
                className={`px-3 py-2 rounded-xl border text-xs font-medium flex items-center gap-1.5 transition-colors ${
                  soundEnabled
                    ? 'bg-emerald-950/40 border-emerald-600/40 text-emerald-300'
                    : 'bg-zinc-900 border-zinc-800 text-zinc-500'
                }`}
              >
                {soundEnabled ? <Bell className="w-3.5 h-3.5 text-emerald-400" /> : <BellOff className="w-3.5 h-3.5" />}
                <span>{soundEnabled ? 'Chime ON' : 'Muted'}</span>
              </button>

              <button
                onClick={() => fetchData(true)}
                title="Refresh Queue"
                className="p-2 rounded-xl bg-zinc-900 border border-zinc-800 text-zinc-300 hover:text-white hover:bg-zinc-800 transition-colors"
              >
                <RefreshCw className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Active Online Runners Bar */}
          <div className="bg-zinc-950/80 border border-zinc-800/80 rounded-xl p-3 flex flex-wrap items-center justify-between gap-2 text-xs">
            <div className="flex items-center gap-2 text-zinc-400">
              <Users className="w-4 h-4 text-cyan-400" />
              <span className="font-semibold text-zinc-300">Runners Currently On Duty:</span>
              {onlineRunners.length > 0 ? (
                <div className="flex flex-wrap gap-1.5">
                  {onlineRunners.map((r) => (
                    <span
                      key={r.id}
                      className={`px-2 py-0.5 rounded text-[11px] font-bold ${
                        r.id === currentUser?.id
                          ? 'bg-amber-950/80 border border-amber-600/60 text-amber-300'
                          : 'bg-emerald-950/60 border border-emerald-600/40 text-emerald-300'
                      }`}
                    >
                      {r.display_name} {r.id === currentUser?.id ? '(You)' : ''}
                    </span>
                  ))}
                </div>
              ) : (
                <span className="text-zinc-500 italic">No runners on duty (Service closed to auto dispatch)</span>
              )}
            </div>

            <div className="flex items-center gap-2">
              <span className={`w-2 h-2 rounded-full ${isServiceOpen ? 'bg-emerald-400 animate-pulse' : 'bg-zinc-600'}`} />
              <span className="text-[11px] font-bold text-zinc-300">
                {isServiceOpen ? 'Service Status: OPEN' : 'Service Status: CLOSED'}
              </span>
            </div>
          </div>

          {/* KPI Stat Cards */}
          {stats && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <div className="bg-zinc-950/60 border border-zinc-800 rounded-xl p-3.5">
                <span className="text-[11px] text-zinc-400 font-medium">Active Queue</span>
                <div className="text-xl font-extrabold text-amber-400 mt-1 font-mono">{stats.activeOrders}</div>
              </div>
              <div className="bg-zinc-950/60 border border-zinc-800 rounded-xl p-3.5">
                <span className="text-[11px] text-zinc-400 font-medium">Completed Runs</span>
                <div className="text-xl font-extrabold text-emerald-400 mt-1 font-mono">{stats.totalCompleted}</div>
              </div>
              <div className="bg-zinc-950/60 border border-zinc-800 rounded-xl p-3.5">
                <span className="text-[11px] text-zinc-400 font-medium">Total Guild Profit</span>
                <div className="mt-1">
                  <CoinDisplay copper={stats.totalProfitCopper} compact size="sm" />
                </div>
              </div>
              <div className="bg-zinc-950/60 border border-zinc-800 rounded-xl p-3.5">
                <span className="text-[11px] text-zinc-400 font-medium">Price Catalog Items</span>
                <div className="text-xl font-extrabold text-cyan-400 mt-1 font-mono">{stats.itemCount}</div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Main Queue & Filtering */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-6 space-y-6">
        {/* Tab Filters */}
        <div className="flex items-center gap-2 overflow-x-auto pb-2 border-b border-zinc-800 text-xs">
          <button
            onClick={() => setFilterTab('active')}
            className={`px-3.5 py-2 rounded-xl font-bold whitespace-nowrap transition-colors flex items-center gap-2 ${
              filterTab === 'active'
                ? 'bg-amber-500 text-zinc-950 shadow-md'
                : 'bg-zinc-900 text-zinc-400 hover:text-white'
            }`}
          >
            <span>Active Runs</span>
            <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-zinc-950/30">
              {orders.filter((o) => ['pending_quote', 'quoted', 'accepted', 'arrived'].includes(o.status)).length}
            </span>
          </button>

          <button
            onClick={() => setFilterTab('needs_quote')}
            className={`px-3.5 py-2 rounded-xl font-bold whitespace-nowrap transition-colors flex items-center gap-2 ${
              filterTab === 'needs_quote'
                ? 'bg-amber-500 text-zinc-950 shadow-md'
                : 'bg-zinc-900 text-zinc-400 hover:text-white'
            }`}
          >
            <span>Needs Quote</span>
            <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-zinc-950/30">
              {orders.filter((o) => o.status === 'pending_quote').length}
            </span>
          </button>

          <button
            onClick={() => setFilterTab('claimable')}
            className={`px-3.5 py-2 rounded-xl font-bold whitespace-nowrap transition-colors flex items-center gap-2 ${
              filterTab === 'claimable'
                ? 'bg-amber-500 text-zinc-950 shadow-md'
                : 'bg-zinc-900 text-zinc-400 hover:text-white'
            }`}
          >
            <span>Claimable (Quoted)</span>
            <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-zinc-950/30">
              {orders.filter((o) => o.status === 'quoted').length}
            </span>
          </button>

          <button
            onClick={() => setFilterTab('my_runs')}
            className={`px-3.5 py-2 rounded-xl font-bold whitespace-nowrap transition-colors flex items-center gap-2 ${
              filterTab === 'my_runs'
                ? 'bg-amber-500 text-zinc-950 shadow-md'
                : 'bg-zinc-900 text-zinc-400 hover:text-white'
            }`}
          >
            <span>My Runs</span>
            <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-zinc-950/30">
              {orders.filter((o) => o.assigned_runner_id === currentUser?.id).length}
            </span>
          </button>

          <button
            onClick={() => setFilterTab('completed')}
            className={`px-3.5 py-2 rounded-xl font-bold whitespace-nowrap transition-colors ${
              filterTab === 'completed'
                ? 'bg-amber-500 text-zinc-950 shadow-md'
                : 'bg-zinc-900 text-zinc-400 hover:text-white'
            }`}
          >
            Completed
          </button>

          <button
            onClick={() => setFilterTab('all')}
            className={`px-3.5 py-2 rounded-xl font-bold whitespace-nowrap transition-colors ${
              filterTab === 'all'
                ? 'bg-amber-500 text-zinc-950 shadow-md'
                : 'bg-zinc-900 text-zinc-400 hover:text-white'
            }`}
          >
            All Orders ({orders.length})
          </button>
        </div>

        {/* Order Cards List */}
        <div className="space-y-4">
          {filteredOrders.length === 0 ? (
            <div className="bg-zinc-900/60 border border-zinc-800 rounded-2xl p-12 text-center text-zinc-500">
              <Package className="w-10 h-10 mx-auto mb-3 opacity-30 text-amber-400" />
              <p className="text-sm font-medium">No orders in this category right now.</p>
              <p className="text-xs text-zinc-500 mt-1">Keep eyes open for static camps calling on {serverName}!</p>
            </div>
          ) : (
            filteredOrders.map((order) => {
              const profitCopper = Math.max(0, order.total_vendor_copper - order.total_payout_copper);

              return (
                <div
                  key={order.id}
                  className="bg-zinc-900/90 border border-zinc-800 rounded-2xl p-5 shadow-xl hover:border-zinc-700 transition-all space-y-4"
                >
                  <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border-b border-zinc-800/80 pb-3">
                    <div className="flex items-center gap-3">
                      <span className="font-mono text-base font-extrabold text-amber-400">
                        {order.id}
                      </span>
                      <span
                        className={`px-2.5 py-0.5 rounded-full text-xs font-semibold capitalize ${
                          order.status === 'completed'
                            ? 'bg-emerald-950 text-emerald-300 border border-emerald-500/40'
                            : order.status === 'arrived'
                            ? 'bg-cyan-950 text-cyan-300 border border-cyan-500/40 animate-pulse'
                            : order.status === 'accepted'
                            ? 'bg-amber-950 text-amber-300 border border-amber-500/40'
                            : order.status === 'pending_quote'
                            ? 'bg-rose-950 text-rose-300 border border-rose-500/40'
                            : 'bg-zinc-800 text-zinc-300 border border-zinc-700'
                        }`}
                      >
                        {order.status.replace('_', ' ')}
                      </span>
                      <span className="text-xs text-zinc-400">
                        From: <strong className="text-white">{order.customer_name}</strong>
                      </span>
                    </div>

                    <div className="flex items-center gap-3 text-xs text-zinc-400 font-mono">
                      <span>{new Date(order.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                      <Link
                        href={`/order/${order.id}`}
                        target="_blank"
                        className="inline-flex items-center gap-1 text-amber-400 hover:underline"
                      >
                        <span>Tracking Page</span>
                        <ExternalLink className="w-3 h-3" />
                      </Link>
                    </div>
                  </div>

                  {/* Middle Section: Zone, Camp, Inventory Summary, Profit */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
                    {/* Zone & Camp */}
                    <div className="bg-zinc-950/70 border border-zinc-800/80 rounded-xl p-3 space-y-1.5">
                      <div className="flex items-center gap-1.5 text-zinc-400">
                        <MapPin className="w-3.5 h-3.5 text-rose-400 shrink-0" />
                        <span className="font-bold text-white">{order.zone}</span>
                      </div>
                      <p className="text-amber-300 font-medium pl-5 leading-snug">
                        {order.camp_location}
                      </p>
                      {order.customer_notes && (
                        <p className="text-[11px] text-zinc-500 italic pl-5">
                          "{order.customer_notes}"
                        </p>
                      )}
                    </div>

                    {/* Inventory Items Summary */}
                    <div className="bg-zinc-950/70 border border-zinc-800/80 rounded-xl p-3 space-y-1 overflow-y-auto max-h-28">
                      <div className="text-[11px] font-bold text-zinc-400 mb-1 flex items-center justify-between">
                        <span>Items ({order.items?.length || 0})</span>
                        <span>Qty</span>
                      </div>
                      {order.items?.map((it) => (
                        <div key={it.id} className="flex items-center justify-between text-zinc-300 text-[11px]">
                          <span className="truncate max-w-[180px] flex items-center gap-1">
                            {it.is_preferred === 1 && <Star className="w-2.5 h-2.5 text-amber-400 fill-amber-400 shrink-0" />}
                            {it.item_name}
                            {!it.is_priced && (
                              <span className="text-amber-400 font-bold ml-1">(unpriced)</span>
                            )}
                          </span>
                          <span className="font-mono text-zinc-400 font-bold">x{it.quantity}</span>
                        </div>
                      ))}
                    </div>

                    {/* Payout & Guild Profit */}
                    <div className="bg-zinc-950/70 border border-zinc-800/80 rounded-xl p-3 flex flex-col justify-between">
                      <div>
                        <div className="flex items-center justify-between text-zinc-400 mb-1">
                          <span>Customer Payout:</span>
                          <CoinDisplay copper={order.total_payout_copper} size="sm" />
                        </div>
                        <div className="flex items-center justify-between text-zinc-400">
                          <span>Est. Guild Profit:</span>
                          <CoinDisplay copper={profitCopper} compact size="sm" />
                        </div>
                      </div>

                      {order.assigned_runner_name && (
                        <div className="pt-2 border-t border-zinc-800/80 text-[11px] text-zinc-400 flex items-center justify-between">
                          <span>Runner: <strong className="text-amber-300">{order.assigned_runner_name}</strong></span>
                          {order.runner_eta && <span className="text-zinc-300 font-mono">ETA: {order.runner_eta}</span>}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Actions Bar */}
                  <div className="flex flex-wrap items-center justify-end gap-2 pt-2 border-t border-zinc-800/80">
                    {/* If Needs Quote */}
                    {order.status === 'pending_quote' && (
                      <button
                        onClick={() => openQuoteModal(order)}
                        className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-zinc-950 text-xs font-bold shadow-md transition-colors flex items-center gap-1.5"
                      >
                        <Coins className="w-3.5 h-3.5" />
                        <span>Fill Price Quote</span>
                      </button>
                    )}

                    {/* If Quoted -> Claim Run */}
                    {order.status === 'quoted' && (
                      <button
                        onClick={() => {
                          setSelectedOrderForAccept(order);
                          setEtaInput('5 mins');
                          setNotesInput('');
                        }}
                        className="px-4 py-2 rounded-xl bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-400 hover:to-emerald-500 text-zinc-950 text-xs font-bold shadow-md transition-colors flex items-center gap-1.5"
                      >
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span>Claim Run & Dispatch</span>
                      </button>
                    )}

                    {/* If Accepted -> Arrived */}
                    {order.status === 'accepted' && (
                      <button
                        onClick={() => handleUpdateStatus(order.id, 'arrived', `Runner ${currentUser?.display_name} has arrived at the camp!`)}
                        className="px-4 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-zinc-950 text-xs font-bold transition-colors flex items-center gap-1.5"
                      >
                        <MapPin className="w-3.5 h-3.5" />
                        <span>Mark Arrived at Camp</span>
                      </button>
                    )}

                    {/* If Arrived -> Complete Trade */}
                    {order.status === 'arrived' && (
                      <button
                        onClick={() => handleUpdateStatus(order.id, 'completed', 'Trade successfully concluded. Coins handed over.')}
                        className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-zinc-950 text-xs font-bold transition-colors flex items-center gap-1.5"
                      >
                        <Check className="w-3.5 h-3.5" />
                        <span>Complete Trade</span>
                      </button>
                    )}

                    {order.status !== 'completed' && order.status !== 'cancelled' && (
                      <button
                        onClick={() => {
                          const reason = prompt('Reason for cancelling order (optional):');
                          handleUpdateStatus(order.id, 'cancelled', reason ? `Cancelled by runner: ${reason}` : 'Cancelled by runner.');
                        }}
                        className="px-3 py-2 rounded-xl bg-zinc-800 hover:bg-rose-950/60 text-zinc-400 hover:text-rose-300 text-xs font-medium transition-colors"
                      >
                        Cancel
                      </button>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </main>

      {/* Fill Quote Modal */}
      {selectedOrderForQuote && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4">
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl max-w-2xl w-full p-6 shadow-2xl space-y-5 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
              <div>
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  <Coins className="w-5 h-5 text-amber-400" />
                  Fill Quote for Order {selectedOrderForQuote.id}
                </h3>
                <p className="text-xs text-zinc-400">
                  Customer: <span className="text-amber-300">{selectedOrderForQuote.customer_name}</span> at {selectedOrderForQuote.zone} ({selectedOrderForQuote.camp_location})
                </p>
              </div>
              <button
                onClick={() => setSelectedOrderForQuote(null)}
                className="text-zinc-500 hover:text-zinc-300 text-sm"
              >
                ✕
              </button>
            </div>

            <p className="text-xs text-zinc-300">
              Enter the vendor sale value for items below. Checked items will be automatically remembered in the price catalog for future customers.
            </p>

            <div className="space-y-4">
              {selectedOrderForQuote.items?.map((it) => {
                const currentInput = quoteInputs[it.id] || {
                  vendorCopper: 0,
                  saveToCatalog: true,
                  category: 'Loot',
                  isPreferred: false,
                  preferredPercent: 90
                };

                return (
                  <div key={it.id} className="p-4 rounded-xl bg-zinc-950 border border-zinc-800 space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-sm text-white">{it.item_name}</span>
                      <span className="text-xs font-mono text-zinc-400">Qty: x{it.quantity}</span>
                    </div>

                    <div>
                      <label className="block text-[11px] text-zinc-400 mb-1">
                        Vendor Unit Sale Price (Coins):
                      </label>
                      <CoinInput
                        copper={currentInput.vendorCopper}
                        onChange={(cop) => setQuoteInputs({
                          ...quoteInputs,
                          [it.id]: { ...currentInput, vendorCopper: cop }
                        })}
                      />
                    </div>

                    <div className="flex flex-wrap items-center gap-4 text-xs pt-1 border-t border-zinc-900">
                      <label className="flex items-center gap-1.5 cursor-pointer text-zinc-300">
                        <input
                          type="checkbox"
                          checked={currentInput.saveToCatalog}
                          onChange={(e) => setQuoteInputs({
                            ...quoteInputs,
                            [it.id]: { ...currentInput, saveToCatalog: e.target.checked }
                          })}
                          className="rounded border-zinc-700 text-amber-500 focus:ring-amber-500"
                        />
                        <span>Save to Price Catalog</span>
                      </label>

                      <label className="flex items-center gap-1.5 cursor-pointer text-amber-300">
                        <input
                          type="checkbox"
                          checked={currentInput.isPreferred}
                          onChange={(e) => setQuoteInputs({
                            ...quoteInputs,
                            [it.id]: { ...currentInput, isPreferred: e.target.checked }
                          })}
                          className="rounded border-zinc-700 text-amber-500 focus:ring-amber-500"
                        />
                        <span>Guild Bounty Item</span>
                      </label>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-zinc-800">
              <button
                type="button"
                onClick={() => setSelectedOrderForQuote(null)}
                className="px-4 py-2 rounded-xl bg-zinc-800 text-zinc-300 hover:bg-zinc-700 text-xs font-medium"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveQuotes}
                className="px-5 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-zinc-950 text-xs font-bold shadow-md transition-colors"
              >
                Save Quote & Notify Customer
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Claim / Dispatch Order Modal */}
      {selectedOrderForAccept && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4">
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4 text-xs">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                Claim Run {selectedOrderForAccept.id}
              </h3>
              <button
                onClick={() => setSelectedOrderForAccept(null)}
                className="text-zinc-500 hover:text-zinc-300 text-sm"
              >
                ✕
              </button>
            </div>

            <p className="text-zinc-300">
              You are accepting the run to <strong className="text-white">{selectedOrderForAccept.customer_name}</strong> at <strong className="text-amber-300">{selectedOrderForAccept.zone}</strong> ({selectedOrderForAccept.camp_location}).
            </p>

            <div className="space-y-3">
              <div>
                <label className="block text-zinc-300 font-semibold mb-1">
                  Estimated Travel Time (ETA):
                </label>
                <input
                  type="text"
                  value={etaInput}
                  onChange={(e) => setEtaInput(e.target.value)}
                  placeholder="e.g. 5 mins or Running through EC"
                  className="w-full bg-zinc-950 border border-zinc-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:ring-1 focus:ring-amber-500 font-bold"
                />
              </div>

              <div>
                <label className="block text-zinc-300 font-semibold mb-1">
                  Runner Note to Customer (Optional):
                </label>
                <input
                  type="text"
                  value={notesInput}
                  onChange={(e) => setNotesInput(e.target.value)}
                  placeholder="e.g. Grabbing coins from bank, whisper me if you pull adds"
                  className="w-full bg-zinc-950 border border-zinc-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:ring-1 focus:ring-amber-500"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setSelectedOrderForAccept(null)}
                className="px-4 py-2 rounded-xl bg-zinc-800 text-zinc-300 hover:bg-zinc-700 font-medium"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleAcceptOrder}
                className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-zinc-950 font-bold shadow-md transition-colors"
              >
                Confirm Claim & Dispatch
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
