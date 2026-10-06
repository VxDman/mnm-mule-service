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
  Clock
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
    guild_name: 'Ironforge Courier & Mule Co.',
    guild_tag: '<MULE>',
    default_payout_percent: 75,
    motd: ''
  });
  const [catalogItems, setCatalogItems] = useState<Item[]>([]);
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
    fetch('/api/items?limit=100')
      .then((res) => res.json())
      .then((data) => {
        if (data.items) setCatalogItems(data.items);
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
    ? catalogItems.slice(0, 10)
    : catalogItems.filter((it) =>
        it.name.toLowerCase().includes(searchQuery.toLowerCase())
      ).slice(0, 10);

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
    // Check if name matches any existing catalog item exactly
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
      const payoutUnit = calculatePayout(vendorUnit, settings.default_payout_percent);
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
      setErrorMsg('Please enter your camp location or coordinates (/loc).');
      return;
    }

    const validItems = items.filter((it) => it.item_name.trim().length > 0);
    if (validItems.length === 0) {
      setErrorMsg('Please add at least one item you wish to sell.');
      return;
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
            notes: it.notes || ''
          }))
        })
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to submit order');
      }

      // Save order to localStorage
      try {
        localStorage.setItem('mule_customer_name', customerName.trim());
        const existing = JSON.parse(localStorage.getItem('mule_my_orders') || '[]');
        if (!existing.includes(data.order.id)) {
          existing.unshift(data.order.id);
          localStorage.setItem('mule_my_orders', JSON.stringify(existing.slice(0, 10)));
        }
        // Save customer token for this order
        localStorage.setItem(`mule_token_${data.order.id}`, data.customer_token);
      } catch {}

      // Redirect to customer order tracking page
      router.push(`/order/${data.order.id}`);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error submitting order';
      setErrorMsg(msg);
      setIsSubmitting(false);
    }
  };

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
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs font-semibold mb-4">
            <Coins className="w-3.5 h-3.5 text-amber-400" />
            <span>Monsters & Memories Mule & Trade Courier</span>
          </div>

          <h1 className="text-3xl sm:text-5xl font-extrabold tracking-tight text-white mb-4">
            Full Bags at Camp? <br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-amber-400 via-amber-200 to-amber-500">
              We Come To You & Buy Your Loot
            </span>
          </h1>

          <p className="max-w-2xl mx-auto text-sm sm:text-base text-zinc-400 mb-8 leading-relaxed">
            Never break camp or abandon precious monster spawns again. Enter your inventory below, get an instant coin quote, set your camp location, and our guild runners will deliver coins right to your feet.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 max-w-2xl mx-auto text-left">
            <div className="bg-zinc-900/80 border border-zinc-800 rounded-xl p-4 shadow-sm">
              <div className="w-8 h-8 rounded-lg bg-amber-950/60 border border-amber-500/30 flex items-center justify-center mb-2.5">
                <Coins className="w-4 h-4 text-amber-400" />
              </div>
              <h4 className="text-xs font-bold text-white mb-1">{settings.default_payout_percent}% Instant Payout</h4>
              <p className="text-[11px] text-zinc-400">Receive fair coin value instantly on the spot without running back to town.</p>
            </div>

            <div className="bg-zinc-900/80 border border-zinc-800 rounded-xl p-4 shadow-sm">
              <div className="w-8 h-8 rounded-lg bg-cyan-950/60 border border-cyan-500/30 flex items-center justify-center mb-2.5">
                <MapPin className="w-4 h-4 text-cyan-400" />
              </div>
              <h4 className="text-xs font-bold text-white mb-1">Direct to Camp</h4>
              <p className="text-[11px] text-zinc-400">Runners travel out to your exact coordinates across dungeons and overland zones.</p>
            </div>

            <div className="bg-zinc-900/80 border border-zinc-800 rounded-xl p-4 shadow-sm">
              <div className="w-8 h-8 rounded-lg bg-emerald-950/60 border border-emerald-500/30 flex items-center justify-center mb-2.5">
                <Clock className="w-4 h-4 text-emerald-400" />
              </div>
              <h4 className="text-xs font-bold text-white mb-1">Live ETA Tracking</h4>
              <p className="text-[11px] text-zinc-400">Get a live order tracker with runner character name and travel arrival updates.</p>
            </div>
          </div>
        </div>
      </section>

      {/* Main Order Form Section */}
      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 mt-8">
        {/* Recent Orders Alert for Returning Customer */}
        {recentOrders.length > 0 && (
          <div className="mb-6 bg-zinc-900 border border-zinc-800 rounded-xl p-3 sm:p-4 flex flex-wrap items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-2 text-zinc-300">
              <Clock className="w-4 h-4 text-amber-400 shrink-0" />
              <span>Your recent active orders:</span>
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

        {errorMsg && (
          <div className="mb-6 bg-rose-950/60 border border-rose-800/80 text-rose-200 rounded-xl p-4 text-sm flex items-center gap-3">
            <ShieldAlert className="w-5 h-5 text-rose-400 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        <form onSubmit={handleSubmitOrder} className="space-y-8">
          {/* Section 1: Customer & Location */}
          <div className="bg-zinc-900/90 border border-zinc-800 rounded-2xl p-6 shadow-xl space-y-6">
            <div className="flex items-center gap-3 border-b border-zinc-800 pb-4">
              <div className="w-8 h-8 rounded-lg bg-amber-500/20 text-amber-400 flex items-center justify-center font-bold text-sm">
                1
              </div>
              <div>
                <h2 className="text-lg font-bold text-white">Your Character & Camp Location</h2>
                <p className="text-xs text-zinc-400">Where should our courier meet you for the in-game trade?</p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              {/* Character Name */}
              <div>
                <label className="block text-xs font-semibold text-zinc-300 mb-1.5 flex items-center gap-1.5">
                  <User className="w-3.5 h-3.5 text-amber-400" />
                  In-Game Character Name <span className="text-rose-400">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Grimjaw"
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  className="w-full bg-zinc-950 border border-zinc-700 rounded-lg px-3.5 py-2.5 text-sm text-white placeholder-zinc-600 focus:outline-none focus:ring-2 focus:ring-amber-500"
                />
                <span className="text-[11px] text-zinc-500 mt-1 block">Your character name in Monsters & Memories</span>
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

            {/* Camp Location & Coords */}
            <div>
              <label className="block text-xs font-semibold text-zinc-300 mb-1.5 flex items-center gap-1.5">
                <MapPin className="w-3.5 h-3.5 text-rose-400" />
                Camp Details & /loc Coordinates <span className="text-rose-400">*</span>
              </label>
              <input
                type="text"
                required
                placeholder="e.g. Orc camp 2 by the stone watchtower, /loc -125, +450"
                value={campLocation}
                onChange={(e) => setCampLocation(e.target.value)}
                className="w-full bg-zinc-950 border border-zinc-700 rounded-lg px-3.5 py-2.5 text-sm text-white placeholder-zinc-600 focus:outline-none focus:ring-2 focus:ring-amber-500"
              />
              <span className="text-[11px] text-zinc-500 mt-1 block">
                Give clear landmarks or in-game <code className="bg-zinc-800 px-1 py-0.5 rounded text-amber-300">/loc</code> coordinates so our runner can navigate quickly.
              </span>
            </div>

            {/* Customer Notes */}
            <div>
              <label className="block text-xs font-semibold text-zinc-300 mb-1.5">
                Special Delivery Instructions (Optional)
              </label>
              <input
                type="text"
                placeholder="e.g. Low on rations, or warn runner about roaming griffons"
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
                    Type item names. Known items get an instant quote; unlisted items will be quoted by the runner.
                  </p>
                </div>
              </div>

              <div className="hidden sm:flex items-center gap-1.5 px-3 py-1 bg-zinc-800/80 border border-zinc-700 rounded-lg text-xs font-mono text-amber-300">
                <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                <span>Payout Rate: {settings.default_payout_percent}%</span>
              </div>
            </div>

            {/* Item Rows */}
            <div className="space-y-3">
              {items.map((row, index) => {
                const isCataloged = !!row.catalog_item && row.catalog_item.vendor_price_copper > 0;
                const unitVendor = isCataloged ? row.catalog_item!.vendor_price_copper : 0;
                const unitPayout = calculatePayout(unitVendor, settings.default_payout_percent);
                const subtotalPayout = unitPayout * row.quantity;

                return (
                  <div
                    key={index}
                    className="p-3.5 rounded-xl bg-zinc-950/80 border border-zinc-800 hover:border-zinc-700 transition-colors relative"
                  >
                    <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
                      {/* Item Name Input with Autocomplete */}
                      <div className="relative flex-1">
                        <div className="relative">
                          <input
                            type="text"
                            required
                            placeholder="Type item name (e.g. Wolf Pelt, Bronze Longsword...)"
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
                        </div>

                        {/* Autocomplete Dropdown */}
                        {activeSearchIndex === index && (
                          <div
                            className="absolute z-30 left-0 right-0 mt-1 max-h-56 overflow-y-auto bg-zinc-900 border border-zinc-700 rounded-lg shadow-2xl divide-y divide-zinc-800"
                            onMouseDown={(e) => e.preventDefault()}
                          >
                            {filteredCatalog.map((catalogItem) => (
                              <button
                                key={catalogItem.id}
                                type="button"
                                onClick={() => handleSelectItem(index, catalogItem)}
                                className="w-full text-left px-3.5 py-2.5 hover:bg-zinc-800 flex items-center justify-between transition-colors group"
                              >
                                <div>
                                  <div className="text-xs font-semibold text-zinc-200 group-hover:text-amber-300">
                                    {catalogItem.name}
                                  </div>
                                  <div className="text-[10px] text-zinc-500">
                                    {catalogItem.category} • Stack of {catalogItem.stack_size}
                                  </div>
                                </div>
                                <div className="text-right">
                                  <div className="text-[10px] text-zinc-400">Your Payout:</div>
                                  <CoinDisplay
                                    copper={calculatePayout(catalogItem.vendor_price_copper, settings.default_payout_percent)}
                                    size="sm"
                                  />
                                </div>
                              </button>
                            ))}

                            {filteredCatalog.length === 0 && row.item_name.trim().length > 0 && (
                              <div className="px-3.5 py-3 text-xs text-zinc-400 bg-zinc-900/90">
                                <span className="font-semibold text-amber-300">"{row.item_name}"</span> is not yet in our database.
                                <p className="text-[11px] text-zinc-500 mt-0.5">
                                  Submit it anyway! Our runner will quote the price when they receive your order, and it will be saved for next time.
                                </p>
                              </div>
                            )}

                            <div className="px-3 py-1.5 bg-zinc-950 text-right">
                              <button
                                type="button"
                                onClick={() => setActiveSearchIndex(null)}
                                className="text-[11px] text-zinc-400 hover:text-zinc-200 font-medium"
                              >
                                Close Suggestions
                              </button>
                            </div>
                          </div>
                        )}
                      </div>

                      {/* Quantity */}
                      <div className="w-24 shrink-0">
                        <label className="sm:hidden block text-[10px] text-zinc-400 mb-0.5">Quantity</label>
                        <div className="flex items-center">
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
                            <span className="text-[10px] text-zinc-400">Total Payout:</span>
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
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 text-zinc-200 text-xs font-semibold transition-colors"
              >
                <Plus className="w-3.5 h-3.5 text-amber-400" />
                Add Another Item
              </button>

              <span className="text-[11px] text-zinc-500">
                Tip: You can add unlisted items; runner prices them upon review.
              </span>
            </div>
          </div>

          {/* Section 3: Live Quote & Submission Summary */}
          <div className="bg-gradient-to-br from-zinc-900 to-zinc-950 border border-amber-600/30 rounded-2xl p-6 shadow-2xl">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-zinc-800 pb-5">
              <div>
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  <Coins className="w-5 h-5 text-amber-400" />
                  Estimated Order Summary
                </h3>
                <p className="text-xs text-zinc-400 mt-0.5">
                  Based on current {settings.default_payout_percent}% camp courier payout rate
                </p>
              </div>

              <div className="flex items-center gap-3">
                <div className="text-right">
                  <div className="text-[11px] text-zinc-400 font-medium">Estimated Coin Payout</div>
                  <CoinDisplay copper={knownPayoutTotal} size="lg" showZero />
                </div>
              </div>
            </div>

            <div className="py-4 space-y-2 text-xs">
              <div className="flex items-center justify-between text-zinc-400">
                <span>Items in Order:</span>
                <span className="font-mono font-medium text-white">
                  {items.filter((i) => i.item_name.trim().length > 0).length} items
                </span>
              </div>

              {unpricedCount > 0 && (
                <div className="flex items-center justify-between text-amber-300 bg-amber-950/30 border border-amber-800/40 px-3 py-2 rounded-lg">
                  <span className="flex items-center gap-1.5 font-medium">
                    <HelpCircle className="w-3.5 h-3.5 text-amber-400" />
                    {unpricedCount} item(s) awaiting runner price quote:
                  </span>
                  <span className="text-[11px]">Runner will quote & notify you</span>
                </div>
              )}

              {knownVendorTotal > 0 && (
                <div className="flex items-center justify-between text-zinc-400">
                  <span>Town Vendor Sell Value (Reference):</span>
                  <CoinDisplay copper={knownVendorTotal} size="sm" />
                </div>
              )}
            </div>

            <div className="pt-4 border-t border-zinc-800/80 flex flex-col sm:flex-row items-center justify-between gap-4">
              <div className="text-[11px] text-zinc-500">
                🔒 No account needed! An Order Tracking ID & Secret Link will be generated.
              </div>

              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full sm:w-auto px-6 py-3 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-zinc-950 font-bold text-sm shadow-lg shadow-amber-500/20 flex items-center justify-center gap-2 transition-all disabled:opacity-50"
              >
                {isSubmitting ? (
                  <span>Dispatching Courier...</span>
                ) : (
                  <>
                    <span>Submit Mule Order</span>
                    <ArrowRight className="w-4 h-4 text-zinc-950" />
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
