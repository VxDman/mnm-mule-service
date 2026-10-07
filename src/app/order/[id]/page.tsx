'use client';

import React, { useState, useEffect, useCallback, use, Suspense } from 'react';
import Link from 'next/link';
import {
  Package,
  MapPin,
  Clock,
  User,
  ShieldCheck,
  CheckCircle2,
  AlertCircle,
  Copy,
  Check,
  MessageSquare,
  Send,
  ArrowLeft,
  Coins,
  Compass,
  AlertTriangle,
  XCircle,
  RefreshCw,
  Star,
  Globe
} from 'lucide-react';
import { CoinDisplay } from '@/components/CoinDisplay';
import { Order, OrderStatus } from '@/types';

interface OrderPageProps {
  params: Promise<{ id: string }>;
}

function OrderContent({ orderId }: { orderId: string }) {
  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [customerToken, setCustomerToken] = useState('');
  const [copiedLink, setCopiedLink] = useState(false);
  const [copiedTell, setCopiedTell] = useState(false);

  // Chat input
  const [chatMessage, setChatMessage] = useState('');
  const [isSendingMsg, setIsSendingMsg] = useState(false);

  // Cancel order modal
  const [cancelModal, setCancelModal] = useState(false);
  const [isCancelling, setIsCancelling] = useState(false);

  const fetchOrder = useCallback(async (quiet = false) => {
    if (!quiet) setLoading(true);
    try {
      const res = await fetch(`/api/orders/${orderId}`);
      if (!res.ok) {
        if (res.status === 404) throw new Error('Order not found');
        throw new Error('Failed to load order');
      }
      const data = await res.json();
      setOrder(data.order);
      setError('');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Error loading order');
    } finally {
      if (!quiet) setLoading(false);
    }
  }, [orderId]);

  useEffect(() => {
    try {
      const tok = localStorage.getItem(`mule_token_${orderId}`);
      if (tok) setCustomerToken(tok);
    } catch {}

    fetchOrder(false);

    // Poll every 4 seconds for live updates
    const interval = setInterval(() => {
      fetchOrder(true);
    }, 4000);

    return () => clearInterval(interval);
  }, [orderId, fetchOrder]);

  const handleCopyLink = () => {
    if (typeof window !== 'undefined') {
      navigator.clipboard.writeText(window.location.href);
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2000);
    }
  };

  const handleCopyTell = (runnerName: string) => {
    if (typeof window !== 'undefined') {
      const tellText = `/tell ${runnerName} Hey, I'm at ${order?.camp_location || 'camp'} (${order?.zone} - Tilustra)`;
      navigator.clipboard.writeText(tellText);
      setCopiedTell(true);
      setTimeout(() => setCopiedTell(false), 2000);
    }
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatMessage.trim() || !order) return;

    setIsSendingMsg(true);
    try {
      const res = await fetch(`/api/orders/${order.id}/message`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: chatMessage.trim(),
          token: customerToken
        })
      });

      if (res.ok) {
        setChatMessage('');
        fetchOrder(true);
      }
    } finally {
      setIsSendingMsg(false);
    }
  };

  const handleCancelOrder = async () => {
    if (!order) return;
    setIsCancelling(true);
    try {
      const res = await fetch(`/api/orders/${order.id}/status`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status: 'cancelled',
          token: customerToken,
          message: 'Customer cancelled the order from camp.'
        })
      });
      if (res.ok) {
        setCancelModal(false);
        fetchOrder(true);
      }
    } finally {
      setIsCancelling(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-zinc-950 text-zinc-100 flex items-center justify-center">
        <div className="text-center space-y-3">
          <RefreshCw className="w-8 h-8 text-amber-400 animate-spin mx-auto" />
          <p className="text-sm text-zinc-400">Loading Order {orderId}...</p>
        </div>
      </div>
    );
  }

  if (error || !order) {
    return (
      <div className="min-h-screen bg-zinc-950 text-zinc-100 flex items-center justify-center p-4">
        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-8 max-w-md w-full text-center space-y-4">
          <div className="w-12 h-12 rounded-xl bg-rose-950/60 border border-rose-600/40 text-rose-400 flex items-center justify-center mx-auto">
            <XCircle className="w-6 h-6" />
          </div>
          <h2 className="text-xl font-bold text-white">Order Not Found</h2>
          <p className="text-xs text-zinc-400">
            Could not find an order with ID <span className="font-mono text-amber-300 font-bold">{orderId}</span>. Please verify the ID or request a new run.
          </p>
          <div className="pt-2">
            <Link
              href="/"
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-amber-600 hover:bg-amber-500 text-zinc-950 text-xs font-bold transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
              Return to Mule Request Form
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // Stepper calculations
  const steps: { key: OrderStatus; label: string; desc: string }[] = [
    { key: 'pending_quote', label: 'Order Placed', desc: 'Received in queue' },
    { key: 'quoted', label: 'Quote Ready', desc: 'All items priced' },
    { key: 'accepted', label: 'Runner Dispatched', desc: 'Courier en route' },
    { key: 'arrived', label: 'Runner Arrived', desc: 'Ready to trade' },
    { key: 'completed', label: 'Trade Complete', desc: 'Coins delivered' }
  ];

  const getStepStatus = (stepKey: OrderStatus) => {
    if (order.status === 'cancelled') return 'cancelled';

    const orderHierarchy: Record<OrderStatus, number> = {
      pending_quote: 1,
      quoted: 2,
      accepted: 3,
      arrived: 4,
      completed: 5,
      cancelled: -1
    };

    const currentLevel = orderHierarchy[order.status] || 1;
    const targetLevel = orderHierarchy[stepKey] || 1;

    if (currentLevel > targetLevel) return 'done';
    if (currentLevel === targetLevel) return 'current';
    return 'upcoming';
  };

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 pb-20">
      {/* Top Header */}
      <div className="border-b border-zinc-800 bg-zinc-900/80 backdrop-blur-md px-4 sm:px-6 lg:px-8 py-5">
        <div className="max-w-5xl mx-auto flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Link
              href="/"
              className="p-2 rounded-lg bg-zinc-800 text-zinc-400 hover:text-white hover:bg-zinc-700 transition-colors"
              title="Back"
            >
              <ArrowLeft className="w-4 h-4" />
            </Link>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl sm:text-2xl font-extrabold text-white font-mono">
                  Order {order.id}
                </h1>
                <span
                  className={`px-2.5 py-0.5 rounded-full text-xs font-semibold capitalize ${
                    order.status === 'completed'
                      ? 'bg-emerald-950 border border-emerald-500/40 text-emerald-300'
                      : order.status === 'arrived'
                      ? 'bg-cyan-950 border border-cyan-500/40 text-cyan-300 animate-pulse'
                      : order.status === 'accepted'
                      ? 'bg-amber-950 border border-amber-500/40 text-amber-300'
                      : order.status === 'cancelled'
                      ? 'bg-rose-950 border border-rose-500/40 text-rose-300'
                      : 'bg-zinc-800 border border-zinc-700 text-zinc-300'
                  }`}
                >
                  {order.status.replace('_', ' ')}
                </span>
                <span className="hidden sm:inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-blue-950/80 border border-blue-500/40 text-blue-300">
                  <Globe className="w-3 h-3 text-blue-400" />
                  Tilustra (NA East 2)
                </span>
              </div>
              <p className="text-xs text-zinc-400 mt-0.5">
                Character: <span className="text-amber-300 font-semibold">{order.customer_name}</span> • Placed {new Date(order.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            <button
              onClick={handleCopyLink}
              className="flex-1 sm:flex-none inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 text-xs font-medium text-zinc-200 transition-colors"
            >
              {copiedLink ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5 text-zinc-400" />}
              <span>{copiedLink ? 'Link Copied!' : 'Copy Order Link'}</span>
            </button>

            {order.status !== 'completed' && order.status !== 'cancelled' && (
              <button
                onClick={() => setCancelModal(true)}
                className="px-3 py-1.5 rounded-lg bg-rose-950/40 hover:bg-rose-950/80 border border-rose-800/40 text-xs font-medium text-rose-300 transition-colors"
              >
                Cancel Order
              </button>
            )}
          </div>
        </div>
      </div>

      <main className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 mt-6 space-y-6">
        {/* Live Status Banner / Announcement */}
        {order.status === 'arrived' && (
          <div className="bg-cyan-950/70 border-2 border-cyan-500/80 rounded-2xl p-5 shadow-2xl flex flex-col sm:flex-row items-center justify-between gap-4 animate-pulse">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-cyan-900/80 border border-cyan-400 flex items-center justify-center text-cyan-300">
                <MapPin className="w-6 h-6 text-cyan-300" />
              </div>
              <div>
                <h3 className="text-base font-bold text-white">Your Courier Has Arrived at Camp!</h3>
                <p className="text-xs text-cyan-200">
                  Runner <span className="font-bold underline">{order.assigned_runner_name}</span> is standing at your camp on Tilustra. Please open trade in-game.
                </p>
              </div>
            </div>
            {order.assigned_runner_name && (
              <button
                onClick={() => handleCopyTell(order.assigned_runner_name!)}
                className="px-4 py-2 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-zinc-950 text-xs font-bold flex items-center gap-1.5 shadow-md"
              >
                {copiedTell ? <Check className="w-4 h-4" /> : <MessageSquare className="w-4 h-4" />}
                <span>{copiedTell ? 'Whisper Copied!' : `Whisper /tell ${order.assigned_runner_name}`}</span>
              </button>
            )}
          </div>
        )}

        {order.status === 'accepted' && (
          <div className="bg-amber-950/50 border border-amber-600/50 rounded-2xl p-5 shadow-xl flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-amber-900/80 border border-amber-400 flex items-center justify-center text-amber-300">
                <ShieldCheck className="w-6 h-6 text-amber-400" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-base font-bold text-white">
                    Runner {order.assigned_runner_name} Dispatched!
                  </h3>
                  <span className="px-2 py-0.5 rounded text-[10px] bg-amber-500/20 text-amber-300 border border-amber-500/30 font-bold">
                    ETA: {order.runner_eta || 'En Route'}
                  </span>
                </div>
                <p className="text-xs text-zinc-300 mt-0.5">
                  Your courier has left town with pouch full of coins. Hold your camp and watch for incoming tells.
                </p>
              </div>
            </div>

            {order.assigned_runner_name && (
              <button
                onClick={() => handleCopyTell(order.assigned_runner_name!)}
                className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-zinc-950 text-xs font-bold flex items-center gap-1.5 shadow-md shrink-0"
              >
                {copiedTell ? <Check className="w-4 h-4" /> : <MessageSquare className="w-4 h-4" />}
                <span>{copiedTell ? 'Whisper Copied!' : `Whisper /tell ${order.assigned_runner_name}`}</span>
              </button>
            )}
          </div>
        )}

        {order.status === 'pending_quote' && (
          <div className="bg-zinc-900 border border-amber-600/40 rounded-2xl p-4 flex items-center gap-3 text-xs text-amber-300">
            <AlertCircle className="w-5 h-5 shrink-0 text-amber-400" />
            <span>
              Your order contains uncataloged items. A Pillar Men runner will review and quote your loot shortly.
            </span>
          </div>
        )}

        {/* Stepper Progress Visualizer */}
        <div className="bg-zinc-900/90 border border-zinc-800 rounded-2xl p-6 shadow-xl">
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
            {steps.map((st, idx) => {
              const state = getStepStatus(st.key);

              return (
                <div
                  key={st.key}
                  className={`flex flex-col items-center text-center p-3 rounded-xl border transition-all ${
                    state === 'current'
                      ? 'bg-amber-950/40 border-amber-500/60 shadow-lg shadow-amber-500/10'
                      : state === 'done'
                      ? 'bg-zinc-950 border-emerald-500/30'
                      : 'bg-zinc-950/60 border-zinc-800/80 opacity-60'
                  }`}
                >
                  <div
                    className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs mb-2 ${
                      state === 'current'
                        ? 'bg-amber-500 text-zinc-950 animate-pulse'
                        : state === 'done'
                        ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40'
                        : 'bg-zinc-800 text-zinc-500'
                    }`}
                  >
                    {state === 'done' ? (
                      <Check className="w-5 h-5 text-emerald-400" />
                    ) : (
                      <span>{idx + 1}</span>
                    )}
                  </div>

                  <span className={`text-xs font-bold ${state === 'current' ? 'text-amber-300' : state === 'done' ? 'text-white' : 'text-zinc-500'}`}>
                    {st.label}
                  </span>
                  <span className="text-[11px] text-zinc-400 mt-0.5 hidden sm:block">
                    {st.desc}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* 2-Column Grid: Order Details & Receipt + Timeline/Chat */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left 2 Cols: Details & Itemized Receipt */}
          <div className="lg:col-span-2 space-y-6">
            {/* Camp Location Card */}
            <div className="bg-zinc-900/90 border border-zinc-800 rounded-2xl p-5 shadow-xl">
              <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-400 mb-3 flex items-center gap-1.5">
                <MapPin className="w-4 h-4 text-rose-400" />
                Camp & Meeting Location
              </h3>

              <div className="bg-zinc-950 border border-zinc-800/80 rounded-xl p-4 space-y-3">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-zinc-400">Server:</span>
                  <span className="font-semibold text-blue-300 flex items-center gap-1">
                    <Globe className="w-3.5 h-3.5 text-blue-400" />
                    Tilustra (NA East 2)
                  </span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-zinc-400">Zone:</span>
                  <span className="font-semibold text-white">{order.zone}</span>
                </div>
                <div className="flex items-start justify-between text-xs">
                  <span className="text-zinc-400">Camp Location / Landmarks:</span>
                  <span className="font-semibold text-amber-300 text-right max-w-[280px]">
                    {order.camp_location}
                  </span>
                </div>
                {order.customer_notes && (
                  <div className="pt-2 border-t border-zinc-800/80 text-xs">
                    <span className="text-zinc-400 block mb-0.5">Notes from Character:</span>
                    <p className="text-zinc-300 italic bg-zinc-900/50 p-2 rounded-lg">{order.customer_notes}</p>
                  </div>
                )}
              </div>
            </div>

            {/* Itemized Inventory & Quote Receipt */}
            <div className="bg-zinc-900/90 border border-zinc-800 rounded-2xl p-5 shadow-xl space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-400 flex items-center gap-1.5">
                  <Package className="w-4 h-4 text-amber-400" />
                  Itemized Quote Receipt
                </h3>
                <span className="text-xs font-mono text-zinc-400">
                  Base Payout Rate: <span className="text-amber-400 font-bold">{order.payout_percent}%</span>
                </span>
              </div>

              <div className="divide-y divide-zinc-800/80 border border-zinc-800 rounded-xl overflow-hidden bg-zinc-950">
                <div className="grid grid-cols-12 px-4 py-2.5 text-[10px] font-semibold text-zinc-400 uppercase tracking-wider bg-zinc-900/80">
                  <span className="col-span-6 sm:col-span-7">Item Description</span>
                  <span className="col-span-2 text-center">Qty</span>
                  <span className="col-span-4 sm:col-span-3 text-right">Payout</span>
                </div>

                {order.items?.map((it) => (
                  <div key={it.id} className="grid grid-cols-12 px-4 py-3 text-xs items-center hover:bg-zinc-900/40">
                    <div className="col-span-6 sm:col-span-7">
                      <div className="font-medium text-white flex items-center gap-1.5">
                        {it.is_preferred === 1 && (
                          <Star className="w-3.5 h-3.5 text-amber-400 fill-amber-400/30" />
                        )}
                        <span>{it.item_name}</span>
                      </div>
                      {it.notes && (
                        <div className="text-[10px] text-zinc-500">{it.notes}</div>
                      )}
                    </div>

                    <div className="col-span-2 text-center font-mono font-bold text-zinc-300">
                      x{it.quantity}
                    </div>

                    <div className="col-span-4 sm:col-span-3 text-right">
                      {it.is_priced ? (
                        <div>
                          <CoinDisplay copper={it.payout_unit_copper * it.quantity} size="sm" />
                          <div className="text-[9px] text-zinc-500 font-mono">
                            ({it.payout_unit_copper}c / ea)
                          </div>
                        </div>
                      ) : (
                        <span className="text-[10px] text-amber-400 font-medium italic">
                          Awaiting runner quote
                        </span>
                      )}
                    </div>
                  </div>
                ))}

                <div className="p-4 bg-zinc-900/60 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border-t border-zinc-800">
                  <div className="text-xs text-zinc-400">
                    <div>Gross Vendor Value: <CoinDisplay copper={order.total_vendor_copper} compact size="sm" /></div>
                  </div>

                  <div className="flex items-center gap-3">
                    <span className="text-xs font-bold text-white uppercase tracking-wider">
                      Total Payout Cash:
                    </span>
                    <CoinDisplay copper={order.total_payout_copper} size="lg" />
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Right Col: Timeline & Camp Chat */}
          <div className="space-y-6">
            <div className="bg-zinc-900/90 border border-zinc-800 rounded-2xl p-5 shadow-xl flex flex-col h-[520px]">
              <div className="border-b border-zinc-800 pb-3 mb-3 flex items-center justify-between">
                <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-400 flex items-center gap-1.5">
                  <MessageSquare className="w-4 h-4 text-cyan-400" />
                  Camp Dispatch Log
                </h3>
                <span className="text-[10px] text-zinc-500">Live Updates</span>
              </div>

              {/* Chat Message List */}
              <div className="flex-1 overflow-y-auto space-y-2.5 pr-1 text-xs">
                {order.events?.map((evt) => (
                  <div
                    key={evt.id}
                    className={`p-2.5 rounded-xl border ${
                      evt.event_type.startsWith('status_')
                        ? 'bg-amber-950/20 border-amber-600/30 text-amber-200'
                        : evt.event_type === 'chat_message'
                        ? 'bg-zinc-950 border-zinc-800 text-zinc-200'
                        : 'bg-zinc-900 border-zinc-800 text-zinc-300'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1 text-[10px] text-zinc-400 font-mono">
                      <span className="font-bold text-amber-400">{evt.actor_name}</span>
                      <span>{new Date(evt.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                    </div>
                    <p className="text-zinc-200 leading-relaxed">{evt.message}</p>
                  </div>
                ))}
              </div>

              {/* Chat Input */}
              {order.status !== 'completed' && order.status !== 'cancelled' && (
                <form onSubmit={handleSendMessage} className="mt-3 pt-3 border-t border-zinc-800 flex gap-2">
                  <input
                    type="text"
                    placeholder="Send message to courier..."
                    value={chatMessage}
                    onChange={(e) => setChatMessage(e.target.value)}
                    className="flex-1 bg-zinc-950 border border-zinc-700 rounded-lg px-3 py-1.5 text-xs text-white placeholder-zinc-500 focus:outline-none focus:ring-1 focus:ring-amber-500"
                  />
                  <button
                    type="submit"
                    disabled={isSendingMsg || !chatMessage.trim()}
                    className="px-3 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-zinc-950 text-xs font-bold transition-colors disabled:opacity-50"
                  >
                    <Send className="w-3.5 h-3.5" />
                  </button>
                </form>
              )}
            </div>
          </div>
        </div>
      </main>

      {/* Cancel Modal */}
      {cancelModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4">
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl max-w-sm w-full p-6 shadow-2xl space-y-4">
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-rose-400" />
              Cancel This Order?
            </h3>
            <p className="text-xs text-zinc-400">
              Are you sure you want to cancel Order <span className="font-mono text-amber-400">{order.id}</span>? Our couriers will be informed that you no longer need loot pickup.
            </p>
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setCancelModal(false)}
                className="px-4 py-2 rounded-xl bg-zinc-800 text-zinc-300 hover:bg-zinc-700 text-xs font-medium"
              >
                No, Keep Order
              </button>
              <button
                type="button"
                onClick={handleCancelOrder}
                disabled={isCancelling}
                className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold transition-colors disabled:opacity-50"
              >
                {isCancelling ? 'Cancelling...' : 'Yes, Cancel Order'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function OrderTrackingPage({ params }: OrderPageProps) {
  const unwrappedParams = use(params);

  return (
    <Suspense fallback={
      <div className="min-h-screen bg-zinc-950 text-zinc-100 flex items-center justify-center">
        <RefreshCw className="w-8 h-8 text-amber-400 animate-spin" />
      </div>
    }>
      <OrderContent orderId={unwrappedParams.id} />
    </Suspense>
  );
}
