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
  Ban,
  Globe
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
    server_name: 'Tilustra (NA East 2)',
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
  const [itemCategory, setItemCategory] = useState('Tier Equipment');
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
    setItemCategory('Tier Equipment');
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
    setStackSize(it.stack_size || 1);
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
            <div className="flex items-center gap-2.5">
              <h1 className="text-2xl font-black text-white tracking-tight flex items-center gap-2.5">
                <Layers className="w-6 h-6 text-cyan-400" />
                Item Prices, Tiers & Bounties
              </h1>
              <span className="hidden sm:inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold bg-blue-950/80 border border-blue-500/50 text-blue-300">
                <Globe className="w-3.5 h-3.5 text-blue-400" />
                {settings.server_name || 'Tilustra (NA East 2)'}
              </span>
            </div>
            <p className="text-xs text-zinc-400 mt-1">
              Master registry of town vendor prices. Includes standard gear tiers (T2 Chain Armor, T3 Bronze Weapon) and high-value bounties.
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
              placeholder="Search items by name, tier (T1, T2, T3), weapon, armor, bone chips..."
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
              Total: <span className="font-mono font-bold text-amber-400">{filteredItems.length}</span>
            </div>
          </div>
        </div>

        {/* Catalog Table */}
        <div className="bg-zinc-900/90 border border-zinc-800 rounded-2xl shadow-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-zinc-950/80 border-b border-zinc-800 text-zinc-400 uppercase text-[10px] tracking-wider">
                <tr>
                  <th className="py-3 px-4 font-semibold">Item Name</th>
                  <th className="py-3 px-4 font-semibold">Category</th>
                  <th className="py-3 px-4 font-semibold">Vendor Price</th>
                  <th className="py-3 px-4 font-semibold">Standard Payout</th>
                  <th className="py-3 px-4 font-semibold">Bounty Status</th>
                  <th className="py-3 px-4 font-semibold text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800/60">
                {filteredItems.map((it) => {
                  const effectivePayoutRate = (it.is_preferred && it.preferred_payout_percent)
                    ? it.preferred_payout_percent
                    : settings.default_payout_percent;

                  let customerPayout = calculatePayout(it.vendor_price_copper, effectivePayoutRate);
                  if (it.name.toLowerCase() === 'bone chips' && customerPayout === 0) {
                    customerPayout = 1;
                  }

                  const isTierItem = it.category === 'Tier Equipment' || /^T[1-4]\s/i.test(it.name);

                  return (
                    <tr key={it.id} className="hover:bg-zinc-800/30 transition-colors">
                      <td className="py-3 px-4">
                        <div className="font-bold text-white flex items-center gap-1.5">
                          {it.is_preferred === 1 && (
                            <Star className="w-3.5 h-3.5 text-amber-400 fill-amber-400" />
                          )}
                          {isTierItem && (
                            <span className="px-1.5 py-0.2 rounded text-[9px] font-bold bg-blue-900/60 text-blue-300 border border-blue-700/50">
                              Tier
                            </span>
                          )}
                          <span>{it.name}</span>
                          {it.can_buy === 0 && (
                            <span className="px-1.5 py-0.2 rounded text-[9px] bg-rose-950 text-rose-300 border border-rose-800 font-semibold flex items-center gap-0.5">
                              <Ban className="w-2.5 h-2.5" /> Not Bought (1c)
                            </span>
                          )}
                        </div>
                        {it.notes && (
                          <div className="text-[10px] text-zinc-400 mt-0.5 max-w-sm truncate">
                            {it.notes}
                          </div>
                        )}
                      </td>

                      <td className="py-3 px-4">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-medium ${
                          isTierItem
                            ? 'bg-blue-950/80 text-blue-300 border border-blue-800/40'
                            : 'bg-zinc-800 text-zinc-300'
                        }`}>
                          {it.category}
                        </span>
                      </td>

                      <td className="py-3 px-4 font-mono font-medium">
                        <CoinDisplay copper={it.vendor_price_copper} size="sm" />
                      </td>

                      <td className="py-3 px-4 font-mono">
                        {it.can_buy === 0 ? (
                          <span className="text-zinc-500 italic text-[11px]">—</span>
                        ) : (
                          <div className="flex items-center gap-1.5">
                            <CoinDisplay copper={customerPayout} size="sm" />
                            <span className="text-[10px] text-amber-400 font-bold">({effectivePayoutRate}%)</span>
                          </div>
                        )}
                      </td>

                      <td className="py-3 px-4">
                        {it.is_preferred === 1 ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-950/80 border border-amber-600/60 text-amber-300">
                            ⭐ Bounty ({it.preferred_payout_percent}%)
                          </span>
                        ) : (
                          <span className="text-zinc-600 text-[11px]">Regular</span>
                        )}
                      </td>

                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => handleOpenEdit(it)}
                            className="p-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-300 transition-colors"
                            title="Edit Item"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleDeleteItem(it.id)}
                            className="p-1.5 rounded-lg bg-rose-950/40 hover:bg-rose-950 text-rose-400 border border-rose-900/50 transition-colors"
                            title="Delete Item"
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

      {/* Add / Edit Item Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4">
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Package className="w-4 h-4 text-amber-400" />
                {editingItem ? 'Edit Item' : 'Add Item to Registry'}
              </h3>
              <button
                onClick={() => setShowModal(false)}
                className="text-zinc-500 hover:text-zinc-300 text-sm"
              >
                ✕
              </button>
            </div>

            {modalError && (
              <div className="bg-rose-950/60 border border-rose-800 text-rose-200 text-xs p-3 rounded-lg">
                {modalError}
              </div>
            )}

            <form onSubmit={handleSaveItem} className="space-y-4 text-xs">
              <div>
                <label className="block text-zinc-300 font-semibold mb-1">
                  Item Name
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. T2 Chain Armor or Bat Tooth"
                  value={itemName}
                  onChange={(e) => setItemName(e.target.value)}
                  className="w-full bg-zinc-950 border border-zinc-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:ring-1 focus:ring-amber-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-zinc-300 font-semibold mb-1">
                    Category
                  </label>
                  <select
                    value={itemCategory}
                    onChange={(e) => setItemCategory(e.target.value)}
                    className="w-full bg-zinc-950 border border-zinc-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:ring-1 focus:ring-amber-500"
                  >
                    <option value="Tier Equipment">Tier Equipment</option>
                    <option value="Weapon">Weapon</option>
                    <option value="Armor / Shield">Armor / Shield</option>
                    <option value="Reagent / Trade Skill">Reagent / Trade Skill</option>
                    <option value="Pelt / Leather">Pelt / Leather</option>
                    <option value="Food / Provision">Food / Provision</option>
                    <option value="Loot">Loot</option>
                  </select>
                </div>

                <div>
                  <label className="block text-zinc-300 font-semibold mb-1">
                    Stack Size
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="1000"
                    value={stackSize}
                    onChange={(e) => setStackSize(parseInt(e.target.value, 10) || 1)}
                    className="w-full bg-zinc-950 border border-zinc-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:ring-1 focus:ring-amber-500 font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="block text-zinc-300 font-semibold mb-1">
                  Vendor Unit Sale Price (Coins):
                </label>
                <CoinInput
                  copper={vendorCopper}
                  onChange={(cop) => setVendorCopper(cop)}
                />
                <span className="text-[11px] text-zinc-500 mt-1 block">
                  Gross price a town merchant pays for 1 unit of this item.
                </span>
              </div>

              <div>
                <label className="block text-zinc-300 font-semibold mb-1">
                  Notes / Classification
                </label>
                <input
                  type="text"
                  placeholder="e.g. Standard T2 Chain piece or Tailoring reagent"
                  value={itemNotes}
                  onChange={(e) => setItemNotes(e.target.value)}
                  className="w-full bg-zinc-950 border border-zinc-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:ring-1 focus:ring-amber-500"
                />
              </div>

              {/* Buyable Toggle */}
              <div className="p-3 bg-zinc-950 border border-zinc-800 rounded-xl space-y-2">
                <label className="flex items-center gap-2 cursor-pointer text-zinc-300">
                  <input
                    type="checkbox"
                    checked={canBuy}
                    onChange={(e) => setCanBuy(e.target.checked)}
                    className="rounded border-zinc-700 text-amber-500 focus:ring-amber-500"
                  />
                  <span className="font-semibold">Couriers Purchase This Item</span>
                </label>
                <span className="text-[10px] text-zinc-500 block">
                  Uncheck for 1c vendor junk that couriers refuse to haul back to town.
                </span>
              </div>

              {/* Preferred / Bounty Configuration */}
              <div className="p-3 bg-amber-950/20 border border-amber-800/40 rounded-xl space-y-3">
                <label className="flex items-center gap-2 cursor-pointer text-amber-300">
                  <input
                    type="checkbox"
                    checked={isPreferred}
                    onChange={(e) => setIsPreferred(e.target.checked)}
                    className="rounded border-zinc-700 text-amber-500 focus:ring-amber-500"
                  />
                  <span className="font-bold flex items-center gap-1">
                    <Star className="w-3.5 h-3.5 fill-amber-400" />
                    Mark as Preferred Guild Bounty
                  </span>
                </label>

                {isPreferred && (
                  <div className="space-y-3 pt-2 border-t border-amber-900/40">
                    <div>
                      <label className="block text-zinc-300 font-semibold mb-1">
                        Bonus Payout Rate: <span className="font-mono text-amber-400 font-bold">{preferredPercent}%</span>
                      </label>
                      <input
                        type="range"
                        min="70"
                        max="100"
                        step="5"
                        value={preferredPercent}
                        onChange={(e) => setPreferredPercent(parseInt(e.target.value, 10))}
                        className="w-full accent-amber-500 cursor-pointer"
                      />
                    </div>

                    <div>
                      <label className="block text-zinc-300 font-semibold mb-1">
                        Bounty Description / Reason
                      </label>
                      <input
                        type="text"
                        placeholder="e.g. ⭐ High Demand Spell Reagent Bounty"
                        value={preferredNotes}
                        onChange={(e) => setPreferredNotes(e.target.value)}
                        className="w-full bg-zinc-950 border border-zinc-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:ring-1 focus:ring-amber-500"
                      />
                    </div>
                  </div>
                )}
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-zinc-800">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 rounded-xl bg-zinc-800 text-zinc-300 hover:bg-zinc-700 font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-zinc-950 font-bold shadow-md transition-colors"
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
