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
  Star
} from 'lucide-react';
import { CoinDisplay } from '@/components/CoinDisplay';
import { Order, OrderStatus } from '@/types';

interface OrderPageProps {
  params: Promise<{ id: string }>;
}

function OrderTrackingContent({ orderId }: { orderId: string }) {
  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [customerToken, setCustomerToken] = useState<string | null>(null);

  // Interaction states
  const [copiedLink, setCopiedLink] = useState(false);
  const [copiedTell, setCopiedTell] = useState(false);
  const [chatMessage, setChatMessage] = useState('');
  const [isSendingMsg, setIsSendingMsg] = useState(false);
  const [isCancelling, setIsCancelling] = useState(false);
  const [cancelModal, setCancelModal] = useState(false);

  // Fetch order data
  const fetchOrder = useCallback(async (isPolling = false) => {
    try {
      const res = await fetch(`/api/orders/${encodeURIComponent(orderId)}`);
      if (!res.ok) {
        if (res.status === 404) {
          setError('Order not found. Please check your order code.');
        } else {
          setError('Failed to load order details.');
        }
        setLoading(false);
        return;
      }
      const data = await res.json();
      setOrder(data.order);
      setLoading(false);
    } catch {
      if (!isPolling) {
        setError('Connection error loading order.');
        setLoading(false);
      }
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
      const tellText = `/tell ${runnerName} Hey, I'm at ${order?.camp_location || 'camp'} (${order?.zone})`;
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
          message: 'Cancelled by customer'
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
          <p className="text-sm text-zinc-400">Loading Order #{orderId}...</p>
        </div>
      </div>
    );
  }

  if (error || !order) {
    return (
      <div className="min-h-screen bg-zinc-950 text-zinc-100 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-zinc-900 border border-zinc-800 rounded-2xl p-6 text-center space-y-4">
          <AlertCircle className="w-12 h-12 text-rose-500 mx-auto" />
          <h2 className="text-xl font-bold text-white">Order Not Found</h2>
          <p className="text-xs text-zinc-400">{error || 'Unable to locate order.'}</p>
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
                  Runner <span className="font-bold underline">{order.assigned_runner_name}</span> is standing at your camp. Please open trade in-game.
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
              <div className="w-12 h-12 rounded-xl bg-amber-900/60 border border-amber-500 flex items-center justify-center text-amber-300">
                <Clock className="w-6 h-6 text-amber-400" />
              </div>
              <div>
                <h3 className="text-base font-bold text-white">Courier Dispatched & En Route!</h3>
                <p className="text-xs text-amber-200">
                  <span className="font-semibold text-white">{order.assigned_runner_name}</span> is running to your camp location. Estimated Travel Time: <span className="font-bold underline">{order.runner_eta || 'En route'}</span>.
                </p>
              </div>
            </div>
            {order.assigned_runner_name && (
              <button
                onClick={() => handleCopyTell(order.assigned_runner_name!)}
                className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-zinc-950 text-xs font-bold flex items-center gap-1.5 shadow-md"
              >
                {copiedTell ? <Check className="w-4 h-4" /> : <MessageSquare className="w-4 h-4" />}
                <span>{copiedTell ? 'Whisper Copied!' : `Whisper /tell ${order.assigned_runner_name}`}</span>
              </button>
            )}
          </div>
        )}

        {order.status === 'completed' && (
          <div className="bg-emerald-950/50 border border-emerald-600/50 rounded-2xl p-5 shadow-xl flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-emerald-900/60 border border-emerald-500 flex items-center justify-center text-emerald-300">
              <CheckCircle2 className="w-6 h-6 text-emerald-400" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white">Trade Completed Successfully!</h3>
              <p className="text-xs text-emerald-200">
                Loot sold and coins delivered. Thank you for using The Pillar Men Trade Service! Good luck on your camp!
              </p>
            </div>
          </div>
        )}

        {order.status === 'cancelled' && (
          <div className="bg-rose-950/50 border border-rose-600/50 rounded-2xl p-5 shadow-xl flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-rose-900/60 border border-rose-500 flex items-center justify-center text-rose-300">
              <XCircle className="w-6 h-6 text-rose-400" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white">Order Cancelled</h3>
              <p className="text-xs text-rose-200">This order has been cancelled.</p>
            </div>
          </div>
        )}

        {/* Visual Progress Stepper */}
        <div className="bg-zinc-900/90 border border-zinc-800 rounded-2xl p-6 shadow-xl">
          <h2 className="text-xs font-bold uppercase tracking-wider text-zinc-400 mb-6">
            Courier Dispatch Progress
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-5 gap-4 relative">
            {steps.map((st, idx) => {
              const state = getStepStatus(st.key);
              return (
                <div key={st.key} className="flex flex-col items-start sm:items-center text-left sm:text-center relative">
                  <div
                    className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-xs mb-2 transition-all ${
                      state === 'done'
                        ? 'bg-emerald-950 border-2 border-emerald-500 text-emerald-300 shadow-[0_0_10px_rgba(16,185,129,0.3)]'
                        : state === 'current'
                        ? 'bg-amber-950 border-2 border-amber-400 text-amber-300 animate-pulse shadow-[0_0_12px_rgba(245,158,11,0.5)]'
                        : 'bg-zinc-800 border-2 border-zinc-700 text-zinc-500'
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

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-zinc-800 text-zinc-400 pb-2">
                      <th className="pb-2 font-medium">Item</th>
                      <th className="pb-2 font-medium text-center">Qty</th>
                      <th className="pb-2 font-medium text-right">Vendor Value</th>
                      <th className="pb-2 font-medium text-right">Your Payout</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-800/60">
                    {order.items?.map((it) => (
                      <tr key={it.id} className="hover:bg-zinc-800/30">
                        <td className="py-3">
                          <span className="font-semibold text-zinc-200">{it.item_name}</span>
                          {it.is_preferred === 1 && (
                            <span className="ml-2 inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] bg-amber-950/80 border border-amber-500/50 text-amber-300 font-bold">
                              <Star className="w-3 h-3 fill-amber-300" />
                              Bounty
                            </span>
                          )}
                          {!it.is_priced && (
                            <span className="ml-2 inline-flex items-center px-1.5 py-0.5 rounded text-[10px] bg-amber-950/60 border border-amber-600/40 text-amber-400">
                              Awaiting Runner Quote
                            </span>
                          )}
                        </td>
                        <td className="py-3 text-center font-mono text-zinc-300">
                          {it.quantity}
                        </td>
                        <td className="py-3 text-right">
                          {it.vendor_unit_copper > 0 ? (
                            <CoinDisplay copper={it.vendor_unit_copper * it.quantity} size="sm" />
                          ) : (
                            <span className="text-zinc-500">—</span>
                          )}
                        </td>
                        <td className="py-3 text-right">
                          {it.payout_unit_copper > 0 ? (
                            <CoinDisplay copper={it.payout_unit_copper * it.quantity} size="sm" />
                          ) : (
                            <span className="text-amber-400/80 text-[11px] italic">Pending quote</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Order Totals Banner */}
              <div className="mt-4 pt-4 border-t border-zinc-800 bg-zinc-950/60 rounded-xl p-4 flex flex-col sm:flex-row items-center justify-between gap-3">
                <div className="text-xs text-zinc-400">
                  <span>Total Town Vendor Sell Value: </span>
                  <CoinDisplay copper={order.total_vendor_copper} size="sm" className="ml-1 inline-flex" />
                </div>

                <div className="flex items-center gap-2">
                  <span className="text-xs font-semibold text-zinc-300">Total Coins to Receive:</span>
                  <CoinDisplay copper={order.total_payout_copper} size="lg" showZero />
                </div>
              </div>
            </div>
          </div>

          {/* Right Col: Courier Dispatch Card & Live Timeline / Chat */}
          <div className="space-y-6">
            {/* Runner Card */}
            <div className="bg-zinc-900/90 border border-zinc-800 rounded-2xl p-5 shadow-xl space-y-4">
              <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-400 flex items-center gap-1.5">
                <User className="w-4 h-4 text-cyan-400" />
                Assigned Courier
              </h3>

              {order.assigned_runner_name ? (
                <div className="bg-zinc-950 border border-zinc-800/80 rounded-xl p-4 space-y-3">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-600 to-amber-900 border border-amber-500/40 flex items-center justify-center font-bold text-sm text-white">
                      {order.assigned_runner_name.slice(0, 1)}
                    </div>
                    <div>
                      <div className="text-sm font-bold text-white">{order.assigned_runner_name}</div>
                      <div className="text-[11px] text-amber-400 font-mono">The Pillar Men Courier</div>
                    </div>
                  </div>

                  <div className="flex items-center justify-between text-xs pt-1 border-t border-zinc-800/80">
                    <span className="text-zinc-400">ETA / Transit:</span>
                    <span className="font-semibold text-emerald-400 font-mono">{order.runner_eta || 'En route'}</span>
                  </div>

                  <button
                    onClick={() => handleCopyTell(order.assigned_runner_name!)}
                    className="w-full mt-2 py-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 text-xs font-medium text-zinc-200 flex items-center justify-center gap-1.5 transition-colors"
                  >
                    {copiedTell ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <MessageSquare className="w-3.5 h-3.5 text-zinc-400" />}
                    <span>{copiedTell ? 'Whisper Copied!' : `/tell ${order.assigned_runner_name}`}</span>
                  </button>
                </div>
              ) : (
                <div className="bg-zinc-950 border border-zinc-800 rounded-xl p-4 text-center space-y-2">
                  <Clock className="w-8 h-8 text-zinc-600 mx-auto" />
                  <p className="text-xs text-zinc-400 font-medium">Awaiting Courier Claim</p>
                  <p className="text-[11px] text-zinc-500">
                    Orders are broadcast to online runners. A runner will claim this shortly!
                  </p>
                </div>
              )}
            </div>

            {/* Live Timeline & Camp Chat */}
            <div className="bg-zinc-900/90 border border-zinc-800 rounded-2xl p-5 shadow-xl flex flex-col h-[400px]">
              <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-400 mb-3 flex items-center gap-1.5">
                <MessageSquare className="w-4 h-4 text-amber-400" />
                Live Dispatch Log & Updates
              </h3>

              {/* Event Log Scroll Area */}
              <div className="flex-1 overflow-y-auto space-y-3 pr-1 text-xs">
                {order.events && order.events.length > 0 ? (
                  order.events.map((ev) => (
                    <div
                      key={ev.id}
                      className="bg-zinc-950/80 border border-zinc-800/60 rounded-xl p-2.5 space-y-1"
                    >
                      <div className="flex items-center justify-between text-[10px]">
                        <span className="font-semibold text-amber-400">{ev.actor_name}</span>
                        <span className="text-zinc-500 font-mono">
                          {new Date(ev.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                      <p className="text-zinc-300 leading-relaxed text-[11px]">{ev.message}</p>
                    </div>
                  ))
                ) : (
                  <p className="text-center text-zinc-500 py-8 text-xs">No updates yet.</p>
                )}
              </div>

              {/* Chat Input for Customer */}
              {order.status !== 'completed' && order.status !== 'cancelled' && (
                <form onSubmit={handleSendMessage} className="mt-3 pt-3 border-t border-zinc-800 flex gap-2">
                  <input
                    type="text"
                    placeholder="Send camp update (e.g. repop at camp)..."
                    value={chatMessage}
                    onChange={(e) => setChatMessage(e.target.value)}
                    className="flex-1 bg-zinc-950 border border-zinc-700 rounded-lg px-3 py-1.5 text-xs text-white placeholder-zinc-600 focus:outline-none focus:ring-1 focus:ring-amber-500"
                  />
                  <button
                    type="submit"
                    disabled={isSendingMsg || !chatMessage.trim()}
                    className="px-3 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-500 text-zinc-950 text-xs font-bold disabled:opacity-50 flex items-center justify-center"
                  >
                    <Send className="w-3.5 h-3.5" />
                  </button>
                </form>
              )}
            </div>
          </div>
        </div>
      </main>

      {/* Cancel Confirmation Modal */}
      {cancelModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-xs p-4">
          <div className="bg-zinc-900 border border-zinc-700 rounded-2xl shadow-2xl max-w-sm w-full p-6 text-zinc-100 space-y-4">
            <AlertTriangle className="w-10 h-10 text-rose-400 mx-auto" />
            <div className="text-center">
              <h3 className="text-base font-bold text-white">Cancel Mule Order?</h3>
              <p className="text-xs text-zinc-400 mt-1">
                Are you sure you want to cancel this order? The courier will be notified not to make the trek to your camp.
              </p>
            </div>
            <div className="flex items-center justify-center gap-3 pt-2">
              <button
                type="button"
                onClick={() => setCancelModal(false)}
                className="px-4 py-2 rounded-lg bg-zinc-800 text-zinc-300 hover:bg-zinc-700 text-xs font-medium"
              >
                Keep Order
              </button>
              <button
                type="button"
                disabled={isCancelling}
                onClick={handleCancelOrder}
                className="px-4 py-2 rounded-lg bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold"
              >
                {isCancelling ? 'Cancelling...' : 'Yes, Cancel'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function OrderTrackingPage({ params }: OrderPageProps) {
  const { id } = use(params);
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-zinc-950 text-zinc-100 flex items-center justify-center">
          <RefreshCw className="w-8 h-8 text-amber-400 animate-spin" />
        </div>
      }
    >
      <OrderTrackingContent orderId={id} />
    </Suspense>
  );
}
