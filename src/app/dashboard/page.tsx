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
  Users
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
      gain.gain.setValueAtTime(0.15, ctx.currentTime + idx * 0.1);
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
    fetchData(false);

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

  const handleOpenQuoteModal = (order: Order) => {
    setSelectedOrderForQuote(order);
    const initialQuotes: Record<string, {
      vendorCopper: number;
      saveToCatalog: boolean;
      category: string;
      isPreferred: boolean;
      preferredPercent: number;
    }> = {};

    order.items?.forEach((it) => {
      initialQuotes[it.id] = {
        vendorCopper: it.vendor_unit_copper || 0,
        saveToCatalog: true,
        category: 'Loot',
        isPreferred: it.is_preferred === 1,
        preferredPercent: 90
      };
    });
    setQuoteInputs(initialQuotes);
  };

  const handleSaveQuotes = async () => {
    if (!selectedOrderForQuote) return;

    const payload = Object.entries(quoteInputs).map(([oiId, data]) => ({
      order_item_id: oiId,
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
      return o.assigned_runner_id === currentUser?.id && ['accepted', 'arrived'].includes(o.status);
    }
    if (filterTab === 'completed') {
      return o.status === 'completed';
    }
    return true;
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
              </div>
              <p className="text-xs text-zinc-400 mt-1">
                Runner: <span className="text-amber-300 font-semibold">{currentUser?.display_name}</span> • Operating Hours: <span className="text-zinc-300">{hoursOfOperation}</span>
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
              <span>Couriers Currently On Duty:</span>
              <div className="flex flex-wrap gap-1.5">
                {onlineRunners.length > 0 ? (
                  onlineRunners.map((r) => (
                    <span
                      key={r.id}
                      className={`px-2 py-0.5 rounded-md font-mono text-[11px] font-semibold border ${
                        r.id === currentUser?.id
                          ? 'bg-emerald-950/80 border-emerald-500/60 text-emerald-300'
                          : 'bg-zinc-900 border-zinc-700 text-cyan-300'
                      }`}
                    >
                      {r.display_name} {r.id === currentUser?.id && '(You)'}
                    </span>
                  ))
                ) : (
                  <span className="text-zinc-500 italic">No runners on duty (Service is currently closed to incoming live alerts)</span>
                )}
              </div>
            </div>

            <div className="text-[11px] text-zinc-500">
              Service Status: <strong className={isServiceOpen ? 'text-emerald-400' : 'text-zinc-400'}>{isServiceOpen ? '🟢 OPEN' : '🔴 CLOSED'}</strong>
            </div>
          </div>

          {/* Stats Bar */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="bg-zinc-900/90 border border-zinc-800/90 rounded-xl p-4 shadow-sm">
              <div className="text-[11px] text-zinc-400 font-medium">Active Queue Orders</div>
              <div className="text-2xl font-extrabold text-amber-400 font-mono mt-1">
                {orders.filter((o) => ['pending_quote', 'quoted', 'accepted', 'arrived'].includes(o.status)).length}
              </div>
            </div>

            <div className="bg-zinc-900/90 border border-zinc-800/90 rounded-xl p-4 shadow-sm">
              <div className="text-[11px] text-zinc-400 font-medium">Needs Runner Quote</div>
              <div className="text-2xl font-extrabold text-amber-300 font-mono mt-1">
                {orders.filter((o) => o.status === 'pending_quote').length}
              </div>
            </div>

            <div className="bg-zinc-900/90 border border-zinc-800/90 rounded-xl p-4 shadow-sm">
              <div className="text-[11px] text-zinc-400 font-medium">Completed Runs</div>
              <div className="text-2xl font-extrabold text-emerald-400 font-mono mt-1">
                {stats?.totalCompleted || 0}
              </div>
            </div>

            <div className="bg-zinc-900/90 border border-zinc-800/90 rounded-xl p-4 shadow-sm">
              <div className="text-[11px] text-zinc-400 font-medium">Guild Runner Profit</div>
              <div className="mt-1">
                <CoinDisplay copper={stats?.totalProfitCopper || 0} size="md" showZero />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-6 space-y-6">
        {/* Filter Navigation Tabs */}
        <div className="flex flex-wrap items-center gap-2 border-b border-zinc-800 pb-3">
          <button
            onClick={() => setFilterTab('active')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-colors flex items-center gap-1.5 ${
              filterTab === 'active'
                ? 'bg-amber-500 text-zinc-950 shadow-md'
                : 'bg-zinc-900 text-zinc-300 hover:bg-zinc-800'
            }`}
          >
            <span>All Active</span>
            <span className="px-1.5 py-0.2 rounded-full bg-zinc-950/20 text-[10px]">
              {orders.filter((o) => ['pending_quote', 'quoted', 'accepted', 'arrived'].includes(o.status)).length}
            </span>
          </button>

          <button
            onClick={() => setFilterTab('needs_quote')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-colors flex items-center gap-1.5 ${
              filterTab === 'needs_quote'
                ? 'bg-amber-500 text-zinc-950 shadow-md'
                : 'bg-zinc-900 text-zinc-300 hover:bg-zinc-800'
            }`}
          >
            <span>Needs Quote</span>
            <span className="px-1.5 py-0.2 rounded-full bg-zinc-950/20 text-[10px]">
              {orders.filter((o) => o.status === 'pending_quote').length}
            </span>
          </button>

          <button
            onClick={() => setFilterTab('claimable')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-colors flex items-center gap-1.5 ${
              filterTab === 'claimable'
                ? 'bg-amber-500 text-zinc-950 shadow-md'
                : 'bg-zinc-900 text-zinc-300 hover:bg-zinc-800'
            }`}
          >
            <span>Ready to Claim</span>
            <span className="px-1.5 py-0.2 rounded-full bg-zinc-950/20 text-[10px]">
              {orders.filter((o) => o.status === 'quoted').length}
            </span>
          </button>

          <button
            onClick={() => setFilterTab('my_runs')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-colors flex items-center gap-1.5 ${
              filterTab === 'my_runs'
                ? 'bg-amber-500 text-zinc-950 shadow-md'
                : 'bg-zinc-900 text-zinc-300 hover:bg-zinc-800'
            }`}
          >
            <span>My Active Runs</span>
            <span className="px-1.5 py-0.2 rounded-full bg-zinc-950/20 text-[10px]">
              {orders.filter((o) => o.assigned_runner_id === currentUser?.id && ['accepted', 'arrived'].includes(o.status)).length}
            </span>
          </button>

          <button
            onClick={() => setFilterTab('completed')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
              filterTab === 'completed'
                ? 'bg-amber-500 text-zinc-950 shadow-md'
                : 'bg-zinc-900 text-zinc-300 hover:bg-zinc-800'
            }`}
          >
            Completed History
          </button>

          <button
            onClick={() => setFilterTab('all')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
              filterTab === 'all'
                ? 'bg-amber-500 text-zinc-950 shadow-md'
                : 'bg-zinc-900 text-zinc-300 hover:bg-zinc-800'
            }`}
          >
            View All ({orders.length})
          </button>
        </div>

        {/* Orders List */}
        {filteredOrders.length === 0 ? (
          <div className="bg-zinc-900/60 border border-zinc-800 rounded-2xl p-12 text-center space-y-3">
            <Package className="w-12 h-12 text-zinc-700 mx-auto" />
            <h3 className="text-base font-bold text-white">No Orders in this Queue</h3>
            <p className="text-xs text-zinc-400">
              When players submit loot runs from camp, their requests will appear here immediately with audio notifications.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {filteredOrders.map((order) => {
              const estimatedProfit = order.total_vendor_copper - order.total_payout_copper;
              const hasUnpriced = order.items?.some((i) => !i.is_priced || i.vendor_unit_copper === 0);
              const isAssignedToMe = order.assigned_runner_id === currentUser?.id;

              return (
                <div
                  key={order.id}
                  className={`bg-zinc-900/90 border rounded-2xl p-5 shadow-xl flex flex-col justify-between transition-all relative ${
                    order.status === 'arrived'
                      ? 'border-cyan-500/60 shadow-cyan-950/20'
                      : order.status === 'accepted'
                      ? 'border-amber-500/50 shadow-amber-950/20'
                      : order.status === 'pending_quote'
                      ? 'border-amber-700/60'
                      : 'border-zinc-800'
                  }`}
                >
                  <div className="space-y-4">
                    {/* Header: ID, Status, Timestamp */}
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-extrabold text-sm text-white">{order.id}</span>
                        <Link
                          href={`/order/${order.id}`}
                          target="_blank"
                          title="View customer page"
                          className="text-zinc-500 hover:text-amber-400 transition-colors"
                        >
                          <ExternalLink className="w-3.5 h-3.5" />
                        </Link>
                      </div>

                      <span
                        className={`px-2.5 py-0.5 rounded-full text-[11px] font-semibold capitalize ${
                          order.status === 'completed'
                            ? 'bg-emerald-950 border border-emerald-500/40 text-emerald-300'
                            : order.status === 'arrived'
                            ? 'bg-cyan-950 border border-cyan-500/40 text-cyan-300 animate-pulse'
                            : order.status === 'accepted'
                            ? 'bg-amber-950 border border-amber-500/40 text-amber-300'
                            : order.status === 'pending_quote'
                            ? 'bg-rose-950/80 border border-rose-600/40 text-rose-300'
                            : order.status === 'cancelled'
                            ? 'bg-zinc-800 text-zinc-500'
                            : 'bg-zinc-800 border border-zinc-700 text-zinc-300'
                        }`}
                      >
                        {order.status.replace('_', ' ')}
                      </span>
                    </div>

                    {/* Customer & Location */}
                    <div className="bg-zinc-950 border border-zinc-800/80 rounded-xl p-3.5 space-y-2 text-xs">
                      <div className="flex items-center justify-between">
                        <span className="text-zinc-400">Customer Character:</span>
                        <span className="font-bold text-amber-300 text-sm">{order.customer_name}</span>
                      </div>

                      <div className="flex items-center justify-between">
                        <span className="text-zinc-400">Zone:</span>
                        <span className="font-medium text-white">{order.zone}</span>
                      </div>

                      <div className="flex items-start justify-between">
                        <span className="text-zinc-400 shrink-0">Camp Landmarks:</span>
                        <span className="text-zinc-300 text-right ml-2 text-[11px] truncate max-w-[180px]" title={order.camp_location}>
                          {order.camp_location}
                        </span>
                      </div>

                      {order.customer_notes && (
                        <div className="pt-1.5 border-t border-zinc-800/80 text-[11px] text-zinc-400 italic">
                          "{order.customer_notes}"
                        </div>
                      )}
                    </div>

                    {/* Items Summary */}
                    <div>
                      <div className="flex items-center justify-between text-xs mb-1.5">
                        <span className="font-medium text-zinc-300">
                          {order.items?.length || 0} Item(s) in Run:
                        </span>
                        {hasUnpriced && (
                          <span className="text-[10px] text-amber-400 font-semibold flex items-center gap-1">
                            <AlertCircle className="w-3 h-3 text-amber-400" />
                            Unpriced item(s)
                          </span>
                        )}
                      </div>

                      <div className="max-h-24 overflow-y-auto space-y-1 pr-1 text-[11px] text-zinc-400">
                        {order.items?.map((it) => (
                          <div key={it.id} className="flex items-center justify-between">
                            <span className="truncate max-w-[160px] text-zinc-300 flex items-center gap-1">
                              {it.is_preferred === 1 && <Star className="w-2.5 h-2.5 text-amber-400 fill-amber-400" />}
                              <span>{it.quantity}x {it.item_name}</span>
                            </span>
                            {it.is_priced && it.payout_unit_copper > 0 ? (
                              <CoinDisplay copper={it.payout_unit_copper * it.quantity} size="sm" />
                            ) : (
                              <span className="text-amber-400 text-[10px]">Needs Quote</span>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Financials / Profit */}
                    <div className="bg-zinc-950/60 rounded-xl p-3 border border-zinc-800/80 space-y-1 text-xs">
                      <div className="flex items-center justify-between text-zinc-400">
                        <span>Customer Payout:</span>
                        <CoinDisplay copper={order.total_payout_copper} size="sm" showZero />
                      </div>
                      <div className="flex items-center justify-between font-semibold text-emerald-400">
                        <span>Estimated Runner Profit:</span>
                        <CoinDisplay copper={estimatedProfit} size="sm" showZero />
                      </div>
                    </div>

                    {/* Assigned Runner Info */}
                    {order.assigned_runner_name && (
                      <div className="text-[11px] text-zinc-400 flex items-center justify-between border-t border-zinc-800/60 pt-2">
                        <span>Assigned Runner:</span>
                        <span className="font-semibold text-white">
                          {order.assigned_runner_name} {isAssignedToMe && '(You)'}
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Action Buttons */}
                  <div className="mt-5 pt-3 border-t border-zinc-800 space-y-2">
                    {order.status === 'pending_quote' && (
                      <button
                        onClick={() => handleOpenQuoteModal(order)}
                        className="w-full py-2.5 rounded-xl bg-amber-600 hover:bg-amber-500 text-zinc-950 text-xs font-bold flex items-center justify-center gap-1.5 shadow-md transition-colors"
                      >
                        <HelpCircle className="w-4 h-4" />
                        <span>Price Unknown Items & Quote</span>
                      </button>
                    )}

                    {order.status === 'quoted' && (
                      <button
                        onClick={() => {
                          setSelectedOrderForAccept(order);
                          setEtaInput('5 mins');
                        }}
                        className="w-full py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-zinc-950 text-xs font-bold flex items-center justify-center gap-1.5 shadow-md transition-colors"
                      >
                        <Package className="w-4 h-4" />
                        <span>Claim & Dispatch Courier</span>
                      </button>
                    )}

                    {order.status === 'accepted' && (
                      <div className="space-y-1.5">
                        <button
                          onClick={() => handleUpdateStatus(order.id, 'arrived')}
                          className="w-full py-2.5 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-bold flex items-center justify-center gap-1.5 shadow-md transition-colors"
                        >
                          <MapPin className="w-4 h-4" />
                          <span>Mark Arrived at Camp</span>
                        </button>
                        <button
                          onClick={() => handleUpdateStatus(order.id, 'completed')}
                          className="w-full py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-[11px] font-medium"
                        >
                          Direct Complete Trade
                        </button>
                      </div>
                    )}

                    {order.status === 'arrived' && (
                      <button
                        onClick={() => handleUpdateStatus(order.id, 'completed')}
                        className="w-full py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold flex items-center justify-center gap-1.5 shadow-md transition-colors"
                      >
                        <CheckCircle2 className="w-4 h-4" />
                        <span>Trade Complete & Close Order</span>
                      </button>
                    )}

                    <div className="flex items-center justify-between text-[11px] pt-1">
                      <button
                        onClick={() => handleOpenQuoteModal(order)}
                        className="text-zinc-500 hover:text-zinc-300 transition-colors"
                      >
                        Edit Item Quotes
                      </button>

                      {order.status !== 'completed' && order.status !== 'cancelled' && (
                        <button
                          onClick={() => handleUpdateStatus(order.id, 'cancelled', 'Cancelled by runner')}
                          className="text-rose-500 hover:text-rose-400 transition-colors"
                        >
                          Cancel Run
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>

      {/* Quote / Price Setting Modal */}
      {selectedOrderForQuote && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-xs p-4">
          <div className="bg-zinc-900 border border-zinc-700 rounded-2xl shadow-2xl max-w-2xl w-full p-6 text-zinc-100 space-y-5 max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between border-b border-zinc-800 pb-4">
              <div>
                <h3 className="text-lg font-bold text-white flex items-center gap-2">
                  <Coins className="w-5 h-5 text-amber-400" />
                  Evaluate & Quote Items — Order {selectedOrderForQuote.id}
                </h3>
                <p className="text-xs text-zinc-400 mt-0.5">
                  Set town vendor sell price for items. Prices will auto-save to the registry for next time!
                </p>
              </div>
              <button
                onClick={() => setSelectedOrderForQuote(null)}
                className="p-1 rounded-lg text-zinc-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto space-y-4 pr-1">
              {selectedOrderForQuote.items?.map((it) => {
                const currentVendor = quoteInputs[it.id]?.vendorCopper || 0;
                const isBounty = quoteInputs[it.id]?.isPreferred || false;
                const rate = isBounty ? (quoteInputs[it.id]?.preferredPercent || 90) : selectedOrderForQuote.payout_percent;
                let calculatedPayoutUnit = calculatePayout(currentVendor, rate);
                if (it.item_name.toLowerCase() === 'bone chips' && calculatedPayoutUnit === 0 && currentVendor > 0) {
                  calculatedPayoutUnit = 1;
                }

                return (
                  <div
                    key={it.id}
                    className="bg-zinc-950 border border-zinc-800 rounded-xl p-4 space-y-3"
                  >
                    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
                      <div>
                        <div className="text-sm font-bold text-white flex items-center gap-1.5">
                          {isBounty && <Star className="w-3.5 h-3.5 text-amber-400 fill-amber-400" />}
                          <span>{it.quantity}x <span className="text-amber-300">{it.item_name}</span></span>
                        </div>
                        <div className="text-[11px] text-zinc-500">
                          {it.is_priced ? 'Previously priced item' : '⭐ Uncatalogued item submitted by customer'}
                        </div>
                      </div>

                      <div className="text-right">
                        <div className="text-[10px] text-zinc-400">Customer Payout ({rate}%):</div>
                        <CoinDisplay copper={calculatedPayoutUnit * it.quantity} size="sm" showZero />
                      </div>
                    </div>

                    <div>
                      <CoinInput
                        label="Town Vendor Sell Price (per unit):"
                        copperValue={currentVendor}
                        onChange={(copper) => {
                          setQuoteInputs({
                            ...quoteInputs,
                            [it.id]: {
                              ...quoteInputs[it.id],
                              vendorCopper: copper
                            }
                          });
                        }}
                      />
                    </div>

                    <div className="flex flex-wrap items-center justify-between gap-2 pt-1 border-t border-zinc-900 text-xs">
                      <label className="flex items-center gap-2 text-zinc-300 cursor-pointer select-none">
                        <input
                          type="checkbox"
                          checked={quoteInputs[it.id]?.saveToCatalog ?? true}
                          onChange={(e) => {
                            setQuoteInputs({
                              ...quoteInputs,
                              [it.id]: {
                                ...quoteInputs[it.id],
                                saveToCatalog: e.target.checked
                              }
                            });
                          }}
                          className="rounded bg-zinc-900 border-zinc-700 text-amber-500 focus:ring-amber-500"
                        />
                        <span>Save to permanent Item Registry</span>
                      </label>

                      <label className="flex items-center gap-1.5 text-amber-300 font-medium cursor-pointer select-none">
                        <input
                          type="checkbox"
                          checked={isBounty}
                          onChange={(e) => {
                            setQuoteInputs({
                              ...quoteInputs,
                              [it.id]: {
                                ...quoteInputs[it.id],
                                isPreferred: e.target.checked
                              }
                            });
                          }}
                          className="rounded bg-zinc-900 border-zinc-700 text-amber-500 focus:ring-amber-500"
                        />
                        <span>Guild Wanted Bounty (90% Payout)</span>
                      </label>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="flex items-center justify-end gap-3 pt-4 border-t border-zinc-800">
              <button
                type="button"
                onClick={() => setSelectedOrderForQuote(null)}
                className="px-4 py-2 rounded-lg bg-zinc-800 text-zinc-300 hover:bg-zinc-700 text-xs font-semibold"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveQuotes}
                className="px-5 py-2.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-zinc-950 text-xs font-bold shadow-md"
              >
                Save Quotes & Update Order
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Accept & Dispatch Modal */}
      {selectedOrderForAccept && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-xs p-4">
          <div className="bg-zinc-900 border border-zinc-700 rounded-2xl shadow-2xl max-w-md w-full p-6 text-zinc-100 space-y-5">
            <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Package className="w-5 h-5 text-amber-400" />
                Claim & Dispatch to Order {selectedOrderForAccept.id}
              </h3>
              <button
                onClick={() => setSelectedOrderForAccept(null)}
                className="p-1 rounded-lg text-zinc-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-4 text-xs">
              <div>
                <span className="text-zinc-400 block mb-1">Customer Meeting Location:</span>
                <div className="bg-zinc-950 p-3 rounded-xl border border-zinc-800 text-zinc-200">
                  <div className="font-bold text-white">{selectedOrderForAccept.customer_name} @ {selectedOrderForAccept.zone}</div>
                  <div className="text-amber-400 text-[11px] mt-0.5">{selectedOrderForAccept.camp_location}</div>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-zinc-300 mb-1.5">
                  Estimated Travel Time (ETA)
                </label>
                <div className="grid grid-cols-4 gap-2 mb-2">
                  {['2 mins', '5 mins', '8 mins', '12 mins'].map((timePreset) => (
                    <button
                      key={timePreset}
                      type="button"
                      onClick={() => setEtaInput(timePreset)}
                      className={`py-1.5 px-2 rounded-lg text-xs font-medium border text-center transition-colors ${
                        etaInput === timePreset
                          ? 'bg-amber-500/20 border-amber-500 text-amber-300 font-bold'
                          : 'bg-zinc-950 border-zinc-800 text-zinc-400 hover:bg-zinc-800'
                      }`}
                    >
                      {timePreset}
                    </button>
                  ))}
                </div>
                <input
                  type="text"
                  placeholder="Custom ETA (e.g. 7 mins, on boat, running highpass)"
                  value={etaInput}
                  onChange={(e) => setEtaInput(e.target.value)}
                  className="w-full bg-zinc-950 border border-zinc-700 rounded-lg px-3 py-2 text-xs text-white placeholder-zinc-600 focus:outline-none focus:ring-1 focus:ring-amber-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-zinc-300 mb-1">
                  Courier Note (Optional)
                </label>
                <input
                  type="text"
                  placeholder="e.g. Coming on stealth rogue, safe to trade"
                  value={notesInput}
                  onChange={(e) => setNotesInput(e.target.value)}
                  className="w-full bg-zinc-950 border border-zinc-700 rounded-lg px-3 py-2 text-xs text-white placeholder-zinc-600 focus:outline-none focus:ring-1 focus:ring-amber-500"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-3 border-t border-zinc-800">
              <button
                type="button"
                onClick={() => setSelectedOrderForAccept(null)}
                className="px-4 py-2 rounded-lg bg-zinc-800 text-zinc-300 hover:bg-zinc-700 text-xs font-semibold"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleAcceptOrder}
                className="px-5 py-2 rounded-lg bg-amber-500 hover:bg-amber-400 text-zinc-950 text-xs font-bold shadow-md"
              >
                Confirm & Dispatch
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
