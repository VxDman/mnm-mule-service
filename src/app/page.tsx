'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  Package,
  MapPin,
  User,
  Plus,
  Trash2,
  Sparkles,
  HelpCircle,
  ArrowRight,
  ShieldAlert,
  Coins,
  Compass,
  CheckCircle2,
  Clock,
  Radio,
  Star,
  Info,
  Globe,
  Shield
} from 'lucide-react';
import { CoinDisplay } from '@/components/CoinDisplay';
import { Item, AppSettings } from '@/types';
import { calculatePayout } from '@/lib/currency';

interface OrderItemInput {
  item_name: string;
  quantity: number;
  catalog_item?: Item;
  notes?: string;
}

const COMMON_ZONES = [
  'Blackburrow',
  'East Commonlands',
  'West Commonlands',
  'Qeynos Hills',
  'Oasis of Marr',
  'Highpass Hold',
  'Northern Karana',
  'Southern Karana',
  'Befallen',
  'Runnyeye Citadel',
  'Misty Thicket',
  'Feerrott',
  'Innothule Swamp',
  'Upper Guk',
  'Kithicor Forest',
  'Everfrost Peaks',
  'Halas Foothills'
];

export default function OrderPage() {
  const router = useRouter();

  // Settings & Catalog
  const [settings, setSettings] = useState<AppSettings>({
    guild_name: 'The Pillar Men',
    server_name: 'Tilustra (NA East 2)',
    hours_of_operation: 'Daily 6:00 PM - 2:00 AM EST (or whenever runners are on duty)',
    default_payout_percent: 75,
    motd: ''
  });
  const [catalogItems, setCatalogItems] = useState<Item[]>([]);
  const [preferredItems, setPreferredItems] = useState<Item[]>([]);
  const [tierItems, setTierItems] = useState<Item[]>([]);
  const [recentOrders, setRecentOrders] = useState<string[]>([]);

  // Form state
  const [customerName, setCustomerName] = useState('');
  const [zone, setZone] = useState('');
  const [campLocation, setCampLocation] = useState('');
  const [customerNotes, setCustomerNotes] = useState('');
  const [items, setItems] = useState<OrderItemInput[]>([
    { item_name: '', quantity: 1 }
  ]);

  // Autocomplete state
  const [activeSearchIndex, setActiveSearchIndex] = useState<number | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    // Load settings
    fetch('/api/settings')
      .then((res) => res.json())
      .then((data) => {
        if (data.settings) setSettings(data.settings);
      })
      .catch(() => {});

    // Preload item catalog for fast search
    fetch('/api/items?limit=500')
      .then((res) => res.json())
      .then((data) => {
        if (data.items) setCatalogItems(data.items);
      })
      .catch(() => {});

    // Preload preferred bounty items
    fetch('/api/items?preferred=true')
      .then((res) => res.json())
      .then((data) => {
        if (data.items) setPreferredItems(data.items);
      })
      .catch(() => {});

    // Preload standard tier equipment items
    fetch('/api/items?tier=true')
      .then((res) => res.json())
      .then((data) => {
        if (data.items) setTierItems(data.items);
      })
      .catch(() => {});

    // Check localStorage for previous orders
    try {
      const stored = localStorage.getItem('mule_my_orders');
      if (stored) {
        setRecentOrders(JSON.parse(stored));
      }
      const savedName = localStorage.getItem('mule_customer_name');
      if (savedName) {
        setCustomerName(savedName);
      }
    } catch {}
  }, []);

  // Filter items for autocomplete
  const filteredCatalog = searchQuery.trim() === ''
    ? catalogItems.slice(0, 12)
    : catalogItems.filter((it) =>
        it.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (it.notes && it.notes.toLowerCase().includes(searchQuery.toLowerCase()))
      ).slice(0, 12);

  const handleSelectItem = (index: number, selectedItem: Item) => {
    const updated = [...items];
    updated[index] = {
      ...updated[index],
      item_name: selectedItem.name,
      catalog_item: selectedItem
    };
    setItems(updated);
    setActiveSearchIndex(null);
    setSearchQuery('');
  };

  const handleCustomItemName = (index: number, name: string) => {
    const updated = [...items];
    const match = catalogItems.find((it) => it.name.toLowerCase() === name.trim().toLowerCase());
    updated[index] = {
      ...updated[index],
      item_name: name,
      catalog_item: match || undefined
    };
    setItems(updated);
    setSearchQuery(name);
  };

  const handleQuantityChange = (index: number, qty: number) => {
    const updated = [...items];
    updated[index].quantity = Math.max(1, qty || 1);
    setItems(updated);
  };

  const addItemRow = () => {
    setItems([...items, { item_name: '', quantity: 1 }]);
  };

  const addSpecificItem = (item: Item) => {
    const existingIndex = items.findIndex((i) => i.item_name.toLowerCase() === item.name.toLowerCase());
    if (existingIndex >= 0) {
      const updated = [...items];
      updated[existingIndex].quantity += 1;
      setItems(updated);
    } else {
      if (items.length === 1 && !items[0].item_name.trim()) {
        setItems([{ item_name: item.name, quantity: 1, catalog_item: item }]);
      } else {
        setItems([...items, { item_name: item.name, quantity: 1, catalog_item: item }]);
      }
    }
  };

  const removeItemRow = (index: number) => {
    if (items.length === 1) {
      setItems([{ item_name: '', quantity: 1 }]);
      return;
    }
    const updated = items.filter((_, i) => i !== index);
    setItems(updated);
  };

  // Calculate live quote
  let knownVendorTotal = 0;
  let knownPayoutTotal = 0;
  let unpricedCount = 0;

  for (const it of items) {
    if (!it.item_name.trim()) continue;
    if (it.catalog_item && it.catalog_item.vendor_price_copper > 0) {
      const vendorUnit = it.catalog_item.vendor_price_copper;
      const effectiveRate = (it.catalog_item.is_preferred && it.catalog_item.preferred_payout_percent)
        ? it.catalog_item.preferred_payout_percent
        : settings.default_payout_percent;

      let payoutUnit = calculatePayout(vendorUnit, effectiveRate);
      if (it.catalog_item.name.toLowerCase() === 'bone chips' && payoutUnit === 0) {
        payoutUnit = 1;
      }

      knownVendorTotal += vendorUnit * it.quantity;
      knownPayoutTotal += payoutUnit * it.quantity;
    } else {
      unpricedCount += 1;
    }
  }

  const handleSubmitOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');

    if (!customerName.trim()) {
      setErrorMsg('Please enter your in-game character name.');
      return;
    }
    if (!zone.trim()) {
      setErrorMsg('Please select or specify your current zone.');
      return;
    }
    if (!campLocation.trim()) {
      setErrorMsg('Please enter your camp location description and landmarks.');
      return;
    }

    const validItems = items.filter((it) => it.item_name.trim().length > 0);
    if (validItems.length === 0) {
      setErrorMsg('Please add at least one item you wish to sell.');
      return;
    }

    // Check for unbuyable 1c items (except bone chips)
    for (const vi of validItems) {
      const match = catalogItems.find((c) => c.name.toLowerCase() === vi.item_name.toLowerCase());
      if (match && match.can_buy === 0) {
        setErrorMsg(`"${match.name}" is a 1-copper item that our couriers do not purchase. Please remove it from your order.`);
        return;
      }
    }

    setIsSubmitting(true);

    try {
      const res = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customer_name: customerName.trim(),
          zone: zone.trim(),
          camp_location: campLocation.trim(),
          customer_notes: customerNotes.trim(),
          items: validItems.map((it) => ({
            item_name: it.item_name.trim(),
            quantity: it.quantity,
            notes: it.notes
          }))
        })
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to submit order');
      }

      // Save to localStorage for convenience
      try {
        localStorage.setItem('mule_customer_name', customerName.trim());
        const existing = JSON.parse(localStorage.getItem('mule_my_orders') || '[]');
        if (!existing.includes(data.order.id)) {
          existing.unshift(data.order.id);
          localStorage.setItem('mule_my_orders', JSON.stringify(existing.slice(0, 10)));
        }
        localStorage.setItem(`mule_token_${data.order.id}`, data.customer_token);
      } catch {}

      router.push(`/order/${data.order.id}`);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error submitting order';
      setErrorMsg(msg);
      setIsSubmitting(false);
    }
  };

  const serverName = settings.server_name || 'Tilustra (NA East 2)';
  const isOpen = settings.is_service_open ?? false;
  const onlineRunnersCount = settings.online_runners?.length || 0;

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 pb-20">
      {/* Top Banner / MOTD */}
      {settings.motd && (
        <div className="bg-amber-950/40 border-b border-amber-800/40 px-4 py-2 text-center text-xs text-amber-300 font-medium flex items-center justify-center gap-2">
          <Sparkles className="w-3.5 h-3.5 text-amber-400 shrink-0" />
          <span>{settings.motd}</span>
        </div>
      )}

      {/* Hero Section */}
      <section className="relative overflow-hidden border-b border-zinc-800/80 bg-gradient-to-b from-zinc-900 to-zinc-950 py-12 px-4 sm:px-6 lg:px-8">
        <div className="absolute inset-0 bg-[radial-gradient(#3f3f46_1px,transparent_1px)] [background-size:16px_16px] opacity-20 pointer-events-none" />
        <div className="max-w-4xl mx-auto relative z-10 text-center">
          {/* Live Duty & Hours & Server Badge */}
          <div className="flex flex-wrap items-center justify-center gap-2 mb-4">
            {/* Server Name Prominent Badge */}
            <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full text-xs font-bold bg-blue-950/90 border border-blue-500/60 text-blue-300 shadow-md">
              <Globe className="w-3.5 h-3.5 text-blue-400 shrink-0" />
              <span>Server: {serverName}</span>
            </div>

            <div
              className={`inline-flex items-center gap-2 px-3.5 py-1 rounded-full text-xs font-semibold border ${
                isOpen
                  ? 'bg-emerald-950/80 border-emerald-500/50 text-emerald-300'
                  : 'bg-zinc-900 border-zinc-700 text-zinc-400'
              }`}
            >
              <Radio className={`w-3.5 h-3.5 ${isOpen ? 'text-emerald-400 animate-pulse' : 'text-zinc-500'}`} />
              <span>
                {isOpen
                  ? `Couriers On Duty (${onlineRunnersCount} active runner${onlineRunnersCount === 1 ? '' : 's'})`
                  : 'Currently Offline / Couriers Resting'}
              </span>
            </div>

            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-zinc-900 border border-zinc-800 text-zinc-400 text-xs font-mono">
              <Clock className="w-3.5 h-3.5 text-amber-400" />
              <span>{settings.hours_of_operation}</span>
            </div>
          </div>

          <h1 className="text-3xl sm:text-5xl font-black tracking-tight text-white mb-4">
            Full Bags at Camp? <br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-amber-400 via-amber-200 to-amber-500">
              The Pillar Men Buy Your Loot On The Spot
            </span>
          </h1>

          <p className="max-w-2xl mx-auto text-sm sm:text-base text-zinc-400 mb-8 leading-relaxed">
            Operating on <strong className="text-blue-300">{serverName}</strong>. Never break camp or lose your monster spawns. Submit your inventory below, get an instant coin quote, describe your camp location, and our couriers will run coins straight to your group.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 max-w-2xl mx-auto text-left">
            <div className="bg-zinc-900/80 border border-zinc-800 rounded-xl p-4 shadow-sm">
              <div className="w-8 h-8 rounded-lg bg-amber-950/60 border border-amber-500/30 flex items-center justify-center mb-2.5">
                <Coins className="w-4 h-4 text-amber-400" />
              </div>
              <h4 className="text-xs font-bold text-white mb-1">Instant Camp Cash</h4>
              <p className="text-[11px] text-zinc-400">Receive fair coin value instantly on the spot without running back to town.</p>
            </div>

            <div className="bg-zinc-900/80 border border-zinc-800 rounded-xl p-4 shadow-sm">
              <div className="w-8 h-8 rounded-lg bg-cyan-950/60 border border-cyan-500/30 flex items-center justify-center mb-2.5">
                <MapPin className="w-4 h-4 text-cyan-400" />
              </div>
              <h4 className="text-xs font-bold text-white mb-1">Direct to Camp</h4>
              <p className="text-[11px] text-zinc-400">Runners travel out to your exact camp description across dungeons and overland zones.</p>
            </div>

            <div className="bg-zinc-900/80 border border-zinc-800 rounded-xl p-4 shadow-sm">
              <div className="w-8 h-8 rounded-lg bg-purple-950/60 border border-purple-500/30 flex items-center justify-center mb-2.5">
                <Star className="w-4 h-4 text-purple-400" />
              </div>
              <h4 className="text-xs font-bold text-white mb-1">Bounties &amp; Tiers</h4>
              <p className="text-[11px] text-zinc-400">Fast grouped tier entries (T2 Chain, T3 Bronze) and premium rates for Bone Chips &amp; silk!</p>
            </div>
          </div>
        </div>
      </section>

      {/* Main Order Form Section */}
      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 mt-8 space-y-6">
        {/* Offline Notice (If Closed) */}
        {!isOpen && (
          <div className="bg-zinc-900/90 border border-amber-600/40 rounded-2xl p-4 flex items-start gap-3 text-xs text-zinc-300 shadow-md">
            <Info className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
            <div>
              <span className="font-bold text-amber-300 block mb-0.5">
                No runners currently on duty — You can still submit your order!
              </span>
              <span>
                Standard hours: <strong className="text-white">{settings.hours_of_operation}</strong> on <strong className="text-blue-300">{serverName}</strong>. Orders placed while runners are resting will remain queued and claimed as soon as a courier logs on.
              </span>
            </div>
          </div>
        )}

        {/* Recent Orders Alert for Returning Customer */}
        {recentOrders.length > 0 && (
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-3 sm:p-4 flex flex-wrap items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-2 text-zinc-300">
              <Clock className="w-4 h-4 text-amber-400 shrink-0" />
              <span>Your recent active orders on {serverName}:</span>
              <div className="flex flex-wrap gap-2">
                {recentOrders.map((ordId) => (
                  <button
                    key={ordId}
                    onClick={() => router.push(`/order/${ordId}`)}
                    className="px-2.5 py-1 rounded-md bg-zinc-800 border border-zinc-700 text-amber-300 font-mono font-bold hover:bg-zinc-700 transition-colors"
                  >
                    {ordId}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Standard Equipment Tiers Showcase & Quick Add */}
        {tierItems.length > 0 && (
          <div className="bg-gradient-to-r from-blue-950/30 via-zinc-900 to-indigo-950/30 border border-blue-600/40 rounded-2xl p-5 shadow-xl">
            <div className="flex items-center justify-between mb-3 border-b border-zinc-800 pb-2.5">
              <div className="flex items-center gap-2">
                <Shield className="w-5 h-5 text-blue-400" />
                <h3 className="text-sm font-bold text-white uppercase tracking-wider">
                  ⚡ Standard Equipment Tiers — Quick Inventory Add
                </h3>
              </div>
              <span className="text-[11px] text-blue-300 font-mono font-semibold">
                Instant Quotes
              </span>
            </div>

            <p className="text-xs text-zinc-400 mb-3">
              No need to type individual piece names! Click standard tier groups to add your armor and weapons directly to your order:
            </p>

            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
              {tierItems.map((tier) => {
                const payout = calculatePayout(tier.vendor_price_copper, settings.default_payout_percent);
                return (
                  <button
                    key={tier.id}
                    type="button"
                    onClick={() => addSpecificItem(tier)}
                    className="text-left p-2.5 rounded-xl bg-zinc-950/80 border border-zinc-700/60 hover:border-blue-400 hover:bg-blue-950/30 transition-all flex flex-col justify-between group shadow-sm"
                  >
                    <div className="font-bold text-xs text-white group-hover:text-blue-300 truncate">
                      + {tier.name}
                    </div>
                    <div className="mt-1 flex items-center justify-between text-[11px]">
                      <span className="text-zinc-400 font-mono">
                        <CoinDisplay copper={payout} compact size="sm" />
                      </span>
                      <span className="text-blue-300 font-bold text-[10px] bg-blue-950/80 px-1 py-0.5 rounded border border-blue-700/50">
                        + Add
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Guild Wanted Bounties Showcase (Preferred Items) */}
        {preferredItems.length > 0 && (
          <div className="bg-gradient-to-r from-amber-950/40 via-zinc-900 to-amber-950/30 border border-amber-600/40 rounded-2xl p-5 shadow-xl">
            <div className="flex items-center justify-between mb-3 border-b border-zinc-800 pb-2.5">
              <div className="flex items-center gap-2">
                <Star className="w-5 h-5 text-amber-400 fill-amber-400/20" />
                <h3 className="text-sm font-bold text-white uppercase tracking-wider">
                  ⭐ Guild Wanted Bounties — Bonus Cash Offers
                </h3>
              </div>
              <span className="text-[11px] text-amber-300 font-mono font-semibold">
                High Demand
              </span>
            </div>

            <p className="text-xs text-zinc-400 mb-3">
              We pay premium coin quotes for these high-demand items (e.g. Bone Chips are bought even at 1c!). Click to add to your order:
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5">
              {preferredItems.map((bounty) => {
                const payout = bounty.name.toLowerCase() === 'bone chips'
                  ? 1
                  : calculatePayout(bounty.vendor_price_copper, bounty.preferred_payout_percent || settings.default_payout_percent);

                return (
                  <button
                    key={bounty.id}
                    type="button"
                    onClick={() => addSpecificItem(bounty)}
                    className="p-2.5 rounded-xl bg-zinc-950/80 border border-amber-800/40 hover:border-amber-500 hover:bg-zinc-900 text-left transition-all flex items-center justify-between group shadow-sm"
                  >
                    <div>
                      <div className="text-xs font-bold text-white group-hover:text-amber-300 flex items-center gap-1.5">
                        <span>{bounty.name}</span>
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-950 border border-amber-700/50 text-amber-300 font-semibold">
                          Guild Bounty
                        </span>
                      </div>
                      <div className="text-[10px] text-zinc-500 truncate max-w-[170px]">
                        {bounty.preferred_bounty_notes || bounty.category}
                      </div>
                    </div>

                    <div className="text-right shrink-0 ml-2">
                      <CoinDisplay copper={payout} size="sm" />
                      <span className="text-[9px] text-amber-400 block font-semibold">+ Add</span>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {errorMsg && (
          <div className="bg-rose-950/80 border border-rose-800 text-rose-200 text-xs sm:text-sm p-4 rounded-xl flex items-center gap-3">
            <ShieldAlert className="w-5 h-5 text-rose-400 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        <form onSubmit={handleSubmitOrder} className="space-y-6">
          {/* Section 1: Customer & Camp Location */}
          <div className="bg-zinc-900/90 border border-zinc-800 rounded-2xl p-6 shadow-xl space-y-5">
            <div className="flex items-center gap-3 border-b border-zinc-800 pb-4">
              <div className="w-8 h-8 rounded-lg bg-amber-500/20 text-amber-400 flex items-center justify-center font-bold text-sm">
                1
              </div>
              <div>
                <h2 className="text-lg font-bold text-white">Character &amp; Camp Coordinates</h2>
                <p className="text-xs text-zinc-400">
                  Where should our runner meet you in Monsters &amp; Memories?
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
              {/* Customer In-Game Name */}
              <div>
                <label className="block text-xs font-semibold text-zinc-300 mb-1.5 flex items-center gap-1.5">
                  <User className="w-3.5 h-3.5 text-amber-400" />
                  Your In-Game Character Name <span className="text-rose-400">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Grimjaw"
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  className="w-full bg-zinc-950 border border-zinc-700 rounded-lg px-3.5 py-2.5 text-sm text-white placeholder-zinc-600 focus:outline-none focus:ring-2 focus:ring-amber-500"
                />
                <span className="text-[11px] text-zinc-500 mt-1 block">Your character name in Monsters &amp; Memories ({serverName})</span>
              </div>

              {/* Zone */}
              <div>
                <label className="block text-xs font-semibold text-zinc-300 mb-1.5 flex items-center gap-1.5">
                  <Compass className="w-3.5 h-3.5 text-cyan-400" />
                  Current Zone <span className="text-rose-400">*</span>
                </label>
                <div className="relative">
                  <input
                    type="text"
                    required
                    list="zone-list"
                    placeholder="e.g. Blackburrow or East Commonlands"
                    value={zone}
                    onChange={(e) => setZone(e.target.value)}
                    className="w-full bg-zinc-950 border border-zinc-700 rounded-lg px-3.5 py-2.5 text-sm text-white placeholder-zinc-600 focus:outline-none focus:ring-2 focus:ring-amber-500"
                  />
                  <datalist id="zone-list">
                    {COMMON_ZONES.map((z) => (
                      <option key={z} value={z} />
                    ))}
                  </datalist>
                </div>
                <span className="text-[11px] text-zinc-500 mt-1 block">Type or pick from common zones</span>
              </div>
            </div>

            {/* Camp Location Description & Landmarks */}
            <div>
              <label className="block text-xs font-semibold text-zinc-300 mb-1.5 flex items-center gap-1.5">
                <MapPin className="w-3.5 h-3.5 text-rose-400" />
                Camp Location &amp; Landmarks <span className="text-rose-400">*</span>
              </label>
              <input
                type="text"
                required
                placeholder="e.g. at ZL with East Commonlands, lower gnoll pit, behind wooden bridge..."
                value={campLocation}
                onChange={(e) => setCampLocation(e.target.value)}
                className="w-full bg-zinc-950 border border-zinc-700 rounded-lg px-3.5 py-2.5 text-sm text-white placeholder-zinc-600 focus:outline-none focus:ring-2 focus:ring-amber-500"
              />
              <span className="text-[11px] text-zinc-500 mt-1 block">
                Describe landmarks, nearby monster spawns, group position, or &quot;at ZL with [other zone name]&quot; (Zone Line) so our runner can navigate directly to you.
              </span>
            </div>

            {/* Customer Notes */}
            <div>
              <label className="block text-xs font-semibold text-zinc-300 mb-1.5">
                Special Delivery Instructions (Optional)
              </label>
              <input
                type="text"
                placeholder="e.g. Aggressive adds nearby, or group pulling fast"
                value={customerNotes}
                onChange={(e) => setCustomerNotes(e.target.value)}
                className="w-full bg-zinc-950 border border-zinc-700 rounded-lg px-3.5 py-2 text-xs text-white placeholder-zinc-600 focus:outline-none focus:ring-2 focus:ring-amber-500"
              />
            </div>
          </div>

          {/* Section 2: Inventory Items to Sell */}
          <div className="bg-zinc-900/90 border border-zinc-800 rounded-2xl p-6 shadow-xl space-y-6">
            <div className="flex items-center justify-between border-b border-zinc-800 pb-4">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-amber-500/20 text-amber-400 flex items-center justify-center font-bold text-sm">
                  2
                </div>
                <div>
                  <h2 className="text-lg font-bold text-white">Inventory to Sell</h2>
                  <p className="text-xs text-zinc-400">
                    Use tier items (T2 Chain, T3 Bronze) or specific names. Known items get an instant quote; unlisted items will be quoted by the runner.
                  </p>
                </div>
              </div>

              <div className="hidden sm:flex items-center gap-1.5 px-3 py-1 bg-zinc-800/80 border border-zinc-700 rounded-lg text-xs font-mono text-amber-300">
                <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                <span>Instant Camp Quotes</span>
              </div>
            </div>

            {/* Item Rows */}
            <div className="space-y-3">
              {items.map((row, index) => {
                const isCataloged = !!row.catalog_item && row.catalog_item.vendor_price_copper > 0;
                const unitVendor = isCataloged ? row.catalog_item!.vendor_price_copper : 0;
                const isPreferred = !!row.catalog_item?.is_preferred;
                const effectiveRate = (isPreferred && row.catalog_item?.preferred_payout_percent)
                  ? row.catalog_item.preferred_payout_percent
                  : settings.default_payout_percent;

                let unitPayout = calculatePayout(unitVendor, effectiveRate);
                if (row.catalog_item?.name.toLowerCase() === 'bone chips' && unitPayout === 0) {
                  unitPayout = 1;
                }
                const subtotalPayout = unitPayout * row.quantity;

                return (
                  <div
                    key={index}
                    className={`p-3.5 rounded-xl bg-zinc-950/80 border transition-colors relative ${
                      isPreferred ? 'border-amber-600/60 shadow-[0_0_12px_rgba(245,158,11,0.1)]' : 'border-zinc-800 hover:border-zinc-700'
                    }`}
                  >
                    <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
                      {/* Item Name Input with Autocomplete */}
                      <div className="relative flex-1">
                        <div className="relative">
                          <input
                            type="text"
                            required
                            placeholder="Type item name (e.g. T2 Chain Armor, T3 Bronze Weapon, Bone Chips...)"
                            value={row.item_name}
                            onFocus={() => {
                              setActiveSearchIndex(index);
                              setSearchQuery(row.item_name);
                            }}
                            onChange={(e) => {
                              handleCustomItemName(index, e.target.value);
                              setActiveSearchIndex(index);
                            }}
                            className="w-full bg-zinc-900 border border-zinc-700 rounded-lg px-3.5 py-2 text-xs sm:text-sm text-white placeholder-zinc-600 focus:outline-none focus:ring-2 focus:ring-amber-500"
                          />
                          {isPreferred && (
                            <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-amber-400 flex items-center gap-1 text-[11px] font-bold">
                              <Star className="w-3.5 h-3.5 fill-amber-400" />
                              <span className="hidden sm:inline">Guild Bounty</span>
                            </span>
                          )}
                        </div>

                        {/* Autocomplete Dropdown */}
                        {activeSearchIndex === index && (
                          <div
                            className="absolute z-30 left-0 right-0 mt-1 max-h-60 overflow-y-auto bg-zinc-900 border border-zinc-700 rounded-lg shadow-2xl divide-y divide-zinc-800"
                            onMouseDown={(e) => e.preventDefault()}
                          >
                            {filteredCatalog.map((catalogItem) => {
                              const itemRate = (catalogItem.is_preferred && catalogItem.preferred_payout_percent)
                                ? catalogItem.preferred_payout_percent
                                : settings.default_payout_percent;
                              let calculatedPayout = calculatePayout(catalogItem.vendor_price_copper, itemRate);
                              if (catalogItem.name.toLowerCase() === 'bone chips' && calculatedPayout === 0) {
                                calculatedPayout = 1;
                              }

                              const isTierItem = catalogItem.category === 'Tier Equipment' || /^T[1-4]\s/i.test(catalogItem.name);

                              return (
                                <button
                                  key={catalogItem.id}
                                  type="button"
                                  onClick={() => handleSelectItem(index, catalogItem)}
                                  className="w-full text-left px-3.5 py-2.5 hover:bg-zinc-800 flex items-center justify-between transition-colors group"
                                >
                                  <div>
                                    <div className="text-xs font-semibold text-zinc-200 group-hover:text-amber-300 flex items-center gap-1.5">
                                      {catalogItem.is_preferred === 1 && (
                                        <Star className="w-3.5 h-3.5 text-amber-400 fill-amber-400/40" />
                                      )}
                                      {isTierItem && (
                                        <span className="px-1.5 py-0.2 rounded text-[9px] font-bold bg-blue-900/60 text-blue-300 border border-blue-700/50">
                                          Tier Gear
                                        </span>
                                      )}
                                      <span>{catalogItem.name}</span>
                                    </div>
                                    <div className="text-[10px] text-zinc-500">
                                      {catalogItem.notes ? catalogItem.notes : `${catalogItem.category} • Stack of ${catalogItem.stack_size}`}
                                    </div>
                                  </div>
                                  <div className="text-right">
                                    <div className="text-[10px] text-zinc-400">
                                      Quote Offer:
                                    </div>
                                    <CoinDisplay copper={calculatedPayout} size="sm" />
                                  </div>
                                </button>
                              );
                            })}

                            {filteredCatalog.length === 0 && row.item_name.trim().length > 0 && (
                              <div className="px-3.5 py-3 text-xs text-zinc-400 bg-zinc-900/90">
                                <span className="font-semibold text-amber-300">&quot;{row.item_name}&quot;</span> is not yet in our database.
                                <p className="text-[11px] text-zinc-500 mt-0.5">
                                  Submit it anyway! Our runner will quote the price when they receive your order, and it will be saved for next time.
                                </p>
                              </div>
                            )}

                            <div className="px-3 py-1.5 bg-zinc-950 text-right">
                              <button
                                type="button"
                                onClick={() => setActiveSearchIndex(null)}
                                className="text-[10px] text-zinc-500 hover:text-zinc-300"
                              >
                                Close suggestions ✕
                              </button>
                            </div>
                          </div>
                        )}
                      </div>

                      {/* Quantity Input */}
                      <div className="w-full sm:w-28 flex items-center gap-2">
                        <label className="sm:hidden text-xs text-zinc-400">Qty:</label>
                        <div className="relative flex-1">
                          <input
                            type="number"
                            min="1"
                            max="999"
                            required
                            value={row.quantity}
                            onChange={(e) => handleQuantityChange(index, parseInt(e.target.value, 10))}
                            className="w-full bg-zinc-900 border border-zinc-700 rounded-lg px-2.5 py-2 text-xs sm:text-sm text-center font-mono text-white focus:outline-none focus:ring-2 focus:ring-amber-500"
                          />
                        </div>
                      </div>

                      {/* Quote Preview */}
                      <div className="min-w-[130px] flex items-center justify-between sm:justify-end gap-2 text-right">
                        {isCataloged ? (
                          <div className="flex flex-col items-end">
                            <span className="text-[10px] text-zinc-400">Total Offer:</span>
                            <CoinDisplay copper={subtotalPayout} size="sm" />
                          </div>
                        ) : (
                          <span className="px-2 py-1 rounded bg-amber-950/40 border border-amber-700/40 text-amber-300 text-[10px] font-medium flex items-center gap-1">
                            <HelpCircle className="w-3 h-3 text-amber-400" />
                            Pending Quote
                          </span>
                        )}

                        {/* Remove Row Button */}
                        <button
                          type="button"
                          onClick={() => removeItemRow(index)}
                          title="Remove item"
                          className="p-1.5 rounded-lg text-zinc-500 hover:text-rose-400 hover:bg-rose-950/30 transition-colors ml-1"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Add More Items Button */}
            <div className="pt-2 flex flex-wrap items-center justify-between gap-3">
              <button
                type="button"
                onClick={addItemRow}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs font-semibold border border-zinc-700 transition-colors"
              >
                <Plus className="w-4 h-4 text-amber-400" />
                <span>Add Another Item Row</span>
              </button>

              <div className="text-right text-xs text-zinc-400">
                {unpricedCount > 0 && (
                  <span className="text-amber-400 font-medium">
                    ⚠️ {unpricedCount} item(s) will be quoted by runner
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Quote Summary & Submit Order */}
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 shadow-2xl">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-zinc-800 pb-5">
              <div>
                <h3 className="text-base font-bold text-white">Estimated Camp Payout</h3>
                <p className="text-xs text-zinc-400">
                  {serverName} • Delivered to your camp location
                </p>
              </div>

              <div className="text-left sm:text-right">
                <div className="text-xs text-zinc-400 mb-1">Instant Cash Quote:</div>
                <CoinDisplay copper={knownPayoutTotal} size="lg" />
              </div>
            </div>

            <div className="mt-5 flex flex-col sm:flex-row items-center justify-between gap-4">
              <div className="text-xs text-zinc-400 space-y-1">
                <p>• No login required — you will receive a unique tracking link.</p>
                <p>• Our runner will whisper you in-game upon claiming the run.</p>
              </div>

              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-8 py-3.5 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-zinc-950 font-black text-sm tracking-wide shadow-lg shadow-amber-500/20 disabled:opacity-50 transition-all cursor-pointer"
              >
                {isSubmitting ? (
                  <span>Summoning Courier...</span>
                ) : (
                  <>
                    <span>Request Camp Courier</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </div>
          </div>
        </form>
      </main>
    </div>
  );
}
