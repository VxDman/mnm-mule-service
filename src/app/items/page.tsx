'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import {
  Layers,
  Search,
  Plus,
  Trash2,
  Edit2,
  X,
  Coins,
  Package,
  Sparkles,
  ArrowUpDown,
  Filter,
  Check,
  Star,
  Info,
  Ban
} from 'lucide-react';
import { CoinDisplay } from '@/components/CoinDisplay';
import { CoinInput } from '@/components/CoinInput';
import { Item, AppSettings } from '@/types';
import { calculatePayout } from '@/lib/currency';

export default function ItemCatalogPage() {
  const router = useRouter();
  const [items, setItems] = useState<Item[]>([]);
  const [settings, setSettings] = useState<AppSettings>({
    guild_name: 'The Pillar Men',
    hours_of_operation: '',
    default_payout_percent: 75,
    motd: ''
  });
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [filterPreferredOnly, setFilterPreferredOnly] = useState(false);
  const [loading, setLoading] = useState(true);

  // Modal State
  const [showModal, setShowModal] = useState(false);
  const [editingItem, setEditingItem] = useState<Item | null>(null);
  const [itemName, setItemName] = useState('');
  const [itemCategory, setItemCategory] = useState('Loot');
  const [vendorCopper, setVendorCopper] = useState<number>(0);
  const [stackSize, setStackSize] = useState<number>(20);
  const [itemNotes, setItemNotes] = useState('');
  const [isPreferred, setIsPreferred] = useState(false);
  const [preferredPercent, setPreferredPercent] = useState<number>(90);
  const [preferredNotes, setPreferredNotes] = useState('');
  const [canBuy, setCanBuy] = useState(true);
  const [modalError, setModalError] = useState('');

  const loadData = useCallback(async () => {
    try {
      const authRes = await fetch('/api/auth/me');
      const authData = await authRes.json();
      if (!authData.user) {
        router.push('/login');
        return;
      }

      const [itemsRes, settingsRes] = await Promise.all([
        fetch('/api/items?limit=500'),
        fetch('/api/settings')
      ]);

      const itemsData = await itemsRes.json();
      const settingsData = await settingsRes.json();

      if (itemsData.items) setItems(itemsData.items);
      if (settingsData.settings) setSettings(settingsData.settings);

      setLoading(false);
    } catch {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const categories = ['All', ...Array.from(new Set(items.map((it) => it.category).filter(Boolean)))];

  const filteredItems = items.filter((it) => {
    const matchesSearch = it.name.toLowerCase().includes(search.toLowerCase()) ||
      (it.notes && it.notes.toLowerCase().includes(search.toLowerCase()));
    const matchesCat = selectedCategory === 'All' || it.category === selectedCategory;
    const matchesPref = !filterPreferredOnly || it.is_preferred === 1;
    return matchesSearch && matchesCat && matchesPref;
  });

  const handleOpenAdd = () => {
    setEditingItem(null);
    setItemName('');
    setItemCategory('Loot');
    setVendorCopper(0);
    setStackSize(20);
    setItemNotes('');
    setIsPreferred(false);
    setPreferredPercent(90);
    setPreferredNotes('');
    setCanBuy(true);
    setModalError('');
    setShowModal(true);
  };

  const handleOpenEdit = (it: Item) => {
    setEditingItem(it);
    setItemName(it.name);
    setItemCategory(it.category || 'Loot');
    setVendorCopper(it.vendor_price_copper);
    setStackSize(it.stack_size || 20);
    setItemNotes(it.notes || '');
    setIsPreferred(it.is_preferred === 1);
    setPreferredPercent(it.preferred_payout_percent || 90);
    setPreferredNotes(it.preferred_bounty_notes || '');
    setCanBuy(it.can_buy === 1);
    setModalError('');
    setShowModal(true);
  };

  const handleSaveItem = async (e: React.FormEvent) => {
    e.preventDefault();
    setModalError('');

    if (!itemName.trim()) {
      setModalError('Item name is required');
      return;
    }
    if (vendorCopper < 0) {
      setModalError('Vendor price must be positive');
      return;
    }

    try {
      const res = await fetch('/api/items', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: itemName.trim(),
          category: itemCategory.trim(),
          vendor_price_copper: vendorCopper,
          stack_size: stackSize,
          notes: itemNotes.trim(),
          is_preferred: isPreferred,
          preferred_payout_percent: isPreferred ? preferredPercent : null,
          preferred_bounty_notes: isPreferred ? preferredNotes.trim() : null,
          can_buy: canBuy
        })
      });

      if (!res.ok) {
        const d = await res.json();
        throw new Error(d.error || 'Failed to save item');
      }

      setShowModal(false);
      loadData();
    } catch (err: unknown) {
      setModalError(err instanceof Error ? err.message : 'Error saving item');
    }
  };

  const handleDeleteItem = async (id: string) => {
    if (!confirm('Are you sure you want to delete this item from the catalog?')) return;

    try {
      const res = await fetch(`/api/items?id=${id}`, { method: 'DELETE' });
      if (res.ok) {
        loadData();
      }
    } catch {}
  };

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 pb-20">
      {/* Top Banner */}
      <div className="border-b border-zinc-800 bg-zinc-900/60 backdrop-blur-md px-4 sm:px-6 lg:px-8 py-6">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-black text-white tracking-tight flex items-center gap-2.5">
              <Layers className="w-6 h-6 text-cyan-400" />
              Item Prices & Guild Bounties
            </h1>
            <p className="text-xs text-zinc-400 mt-1">
              Master registry of town vendor prices. Synced with guild spreadsheet with preferred items highlighted.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={handleOpenAdd}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-zinc-950 text-xs font-bold shadow-md transition-colors"
            >
              <Plus className="w-4 h-4" />
              <span>Add New Item</span>
            </button>
          </div>
        </div>
      </div>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-6 space-y-6">
        {/* Search, Filter & Bounty Toggle Bar */}
        <div className="bg-zinc-900/90 border border-zinc-800 rounded-2xl p-4 shadow-xl flex flex-col md:flex-row items-stretch md:items-center gap-3">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-zinc-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              placeholder="Search items by name, weapon, root, pelt, bone..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full bg-zinc-950 border border-zinc-700 rounded-xl pl-9 pr-3.5 py-2 text-xs sm:text-sm text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-amber-500"
            />
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Preferred Filter */}
            <button
              type="button"
              onClick={() => setFilterPreferredOnly(!filterPreferredOnly)}
              className={`px-3 py-2 rounded-xl text-xs font-semibold flex items-center gap-1.5 border transition-colors ${
                filterPreferredOnly
                  ? 'bg-amber-500/20 border-amber-500 text-amber-300'
                  : 'bg-zinc-950 border-zinc-700 text-zinc-400 hover:text-white'
              }`}
            >
              <Star className={`w-3.5 h-3.5 ${filterPreferredOnly ? 'fill-amber-400 text-amber-400' : ''}`} />
              <span>Wanted Bounties Only</span>
            </button>

            {/* Category Dropdown */}
            <div className="flex items-center gap-2">
              <Filter className="w-4 h-4 text-zinc-400 shrink-0" />
              <select
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                className="bg-zinc-950 border border-zinc-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:ring-2 focus:ring-amber-500"
              >
                {categories.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat === 'All' ? 'All Categories' : cat}
                  </option>
                ))}
              </select>
            </div>

            <div className="text-xs text-zinc-400 px-2.5 py-2 bg-zinc-950 rounded-xl border border-zinc-800 shrink-0 text-center">
              <span className="font-mono font-bold text-amber-300">{filteredItems.length}</span> items
            </div>
          </div>
        </div>

        {/* Items Table */}
        <div className="bg-zinc-900/90 border border-zinc-800 rounded-2xl shadow-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-zinc-950/80 border-b border-zinc-800 text-zinc-400 uppercase text-[10px] tracking-wider">
                <tr>
                  <th className="py-3 px-4 font-semibold">Item Name</th>
                  <th className="py-3 px-4 font-semibold">Category</th>
                  <th className="py-3 px-4 font-semibold text-center">Stack</th>
                  <th className="py-3 px-4 font-semibold text-right">Vendor Sell Price</th>
                  <th className="py-3 px-4 font-semibold text-right">Customer Payout</th>
                  <th className="py-3 px-4 font-semibold text-right">Runner Margin</th>
                  <th className="py-3 px-4 font-semibold text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800/60">
                {filteredItems.map((item) => {
                  const isPref = item.is_preferred === 1;
                  const rate = isPref && item.preferred_payout_percent ? item.preferred_payout_percent : settings.default_payout_percent;
                  let payout = calculatePayout(item.vendor_price_copper, rate);
                  if (item.name.toLowerCase() === 'bone chips' && payout === 0) {
                    payout = 1;
                  }
                  const margin = Math.max(0, item.vendor_price_copper - payout);

                  return (
                    <tr
                      key={item.id}
                      className={`hover:bg-zinc-800/30 transition-colors ${
                        item.can_buy === 0 ? 'opacity-50' : ''
                      }`}
                    >
                      <td className="py-3 px-4 font-semibold text-zinc-200">
                        <div className="flex items-center gap-1.5">
                          {isPref && (
                            <span title="Guild Preferred Bounty">
                              <Star className="w-3.5 h-3.5 text-amber-400 fill-amber-400 shrink-0" />
                            </span>
                          )}
                          <span>{item.name}</span>
                          {item.can_buy === 0 && (
                            <span className="px-1.5 py-0.5 rounded text-[9px] bg-zinc-800 text-zinc-400 flex items-center gap-1">
                              <Ban className="w-2.5 h-2.5" /> 1c (Not Bought)
                            </span>
                          )}
                        </div>
                        {item.preferred_bounty_notes ? (
                          <span className="block text-[10px] font-normal text-amber-400/90">{item.preferred_bounty_notes}</span>
                        ) : item.notes ? (
                          <span className="block text-[10px] font-normal text-zinc-500">{item.notes}</span>
                        ) : null}
                      </td>
                      <td className="py-3 px-4 text-zinc-400">
                        <span className="px-2 py-0.5 rounded bg-zinc-950 border border-zinc-800 text-[11px]">
                          {item.category}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-center font-mono text-zinc-400">
                        {item.stack_size}
                      </td>
                      <td className="py-3 px-4 text-right">
                        <CoinDisplay copper={item.vendor_price_copper} size="sm" showZero />
                      </td>
                      <td className="py-3 px-4 text-right">
                        {item.can_buy === 0 ? (
                          <span className="text-zinc-500 text-[11px]">Not Bought</span>
                        ) : (
                          <div className="flex flex-col items-end">
                            <CoinDisplay copper={payout} size="sm" showZero />
                            <span className="text-[9px] text-zinc-500 font-mono">({rate}%)</span>
                          </div>
                        )}
                      </td>
                      <td className="py-3 px-4 text-right font-medium text-emerald-400">
                        {item.can_buy === 0 ? (
                          <span className="text-zinc-500 text-[11px]">—</span>
                        ) : (
                          <CoinDisplay copper={margin} size="sm" showZero />
                        )}
                      </td>
                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            onClick={() => handleOpenEdit(item)}
                            title="Edit Item / Bounty"
                            className="p-1.5 rounded-lg text-zinc-400 hover:text-amber-300 hover:bg-zinc-800 transition-colors"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleDeleteItem(item.id)}
                            title="Delete Item"
                            className="p-1.5 rounded-lg text-zinc-400 hover:text-rose-400 hover:bg-rose-950/30 transition-colors"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </main>

      {/* Add / Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-xs p-4">
          <div className="bg-zinc-900 border border-zinc-700 rounded-2xl shadow-2xl max-w-md w-full p-6 text-zinc-100 space-y-5 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Layers className="w-5 h-5 text-amber-400" />
                {editingItem ? 'Edit Item / Bounty' : 'Add Item to Registry'}
              </h3>
              <button
                onClick={() => setShowModal(false)}
                className="p-1 rounded-lg text-zinc-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {modalError && (
              <div className="bg-rose-950/60 border border-rose-800/80 text-rose-200 rounded-lg p-2.5 text-xs">
                {modalError}
              </div>
            )}

            <form onSubmit={handleSaveItem} className="space-y-4 text-xs">
              <div>
                <label className="block text-xs font-semibold text-zinc-300 mb-1">
                  Item Name <span className="text-rose-400">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Bone Chips, Harvallen Root"
                  value={itemName}
                  onChange={(e) => setItemName(e.target.value)}
                  className="w-full bg-zinc-950 border border-zinc-700 rounded-lg px-3 py-2 text-xs text-white placeholder-zinc-600 focus:outline-none focus:ring-1 focus:ring-amber-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-zinc-300 mb-1">Category</label>
                  <input
                    type="text"
                    placeholder="e.g. Weapon, Pelt, Food, Reagent"
                    value={itemCategory}
                    onChange={(e) => setItemCategory(e.target.value)}
                    className="w-full bg-zinc-950 border border-zinc-700 rounded-lg px-3 py-2 text-xs text-white placeholder-zinc-600 focus:outline-none focus:ring-1 focus:ring-amber-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-zinc-300 mb-1">Stack Size</label>
                  <input
                    type="number"
                    min="1"
                    max="999"
                    value={stackSize}
                    onChange={(e) => setStackSize(parseInt(e.target.value, 10) || 1)}
                    className="w-full bg-zinc-950 border border-zinc-700 rounded-lg px-3 py-2 text-xs text-white placeholder-zinc-600 focus:outline-none focus:ring-1 focus:ring-amber-500 font-mono"
                  />
                </div>
              </div>

              <div>
                <CoinInput
                  label="Town Vendor Sell Price (Per Unit):"
                  copperValue={vendorCopper}
                  onChange={setVendorCopper}
                />
              </div>

              {/* Bounty / Preferred Controls */}
              <div className="p-3 bg-zinc-950 border border-amber-800/40 rounded-xl space-y-2">
                <label className="flex items-center gap-2 text-xs font-bold text-amber-300 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={isPreferred}
                    onChange={(e) => setIsPreferred(e.target.checked)}
                    className="rounded bg-zinc-900 border-zinc-700 text-amber-500 focus:ring-amber-500"
                  />
                  <span>Mark as Preferred Guild Bounty (+Bonus Rate)</span>
                </label>

                {isPreferred && (
                  <div className="space-y-2 pt-1 pl-5">
                    <div>
                      <label className="block text-[11px] text-zinc-400 mb-0.5">
                        Bonus Payout Rate Percentage: <strong className="text-amber-300 font-mono">{preferredPercent}%</strong>
                      </label>
                      <input
                        type="range"
                        min="75"
                        max="100"
                        step="5"
                        value={preferredPercent}
                        onChange={(e) => setPreferredPercent(parseInt(e.target.value, 10))}
                        className="w-full accent-amber-500"
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] text-zinc-400 mb-0.5">Bounty Reason / Description</label>
                      <input
                        type="text"
                        placeholder="e.g. High Demand Spell Component"
                        value={preferredNotes}
                        onChange={(e) => setPreferredNotes(e.target.value)}
                        className="w-full bg-zinc-900 border border-zinc-700 rounded-lg px-2.5 py-1.5 text-xs text-white"
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* Can Buy Toggle */}
              <div>
                <label className="flex items-center gap-2 text-xs text-zinc-400 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={canBuy}
                    onChange={(e) => setCanBuy(e.target.checked)}
                    className="rounded bg-zinc-900 border-zinc-700 text-amber-500 focus:ring-amber-500"
                  />
                  <span>Item can be purchased (uncheck to reject 1c trash)</span>
                </label>
              </div>

              <div>
                <label className="block text-xs font-semibold text-zinc-300 mb-1">General Notes</label>
                <input
                  type="text"
                  placeholder="Drop zone or source notes"
                  value={itemNotes}
                  onChange={(e) => setItemNotes(e.target.value)}
                  className="w-full bg-zinc-950 border border-zinc-700 rounded-lg px-3 py-2 text-xs text-white placeholder-zinc-600 focus:outline-none focus:ring-1 focus:ring-amber-500"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-zinc-800">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 rounded-lg bg-zinc-800 text-zinc-300 hover:bg-zinc-700 text-xs font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-lg bg-amber-500 hover:bg-amber-400 text-zinc-950 text-xs font-bold shadow-md"
                >
                  Save Item
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
