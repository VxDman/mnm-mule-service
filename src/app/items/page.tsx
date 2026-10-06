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
  Check
} from 'lucide-react';
import { CoinDisplay } from '@/components/CoinDisplay';
import { CoinInput } from '@/components/CoinInput';
import { Item, AppSettings } from '@/types';
import { calculatePayout } from '@/lib/currency';

export default function ItemCatalogPage() {
  const router = useRouter();
  const [items, setItems] = useState<Item[]>([]);
  const [settings, setSettings] = useState<AppSettings>({
    guild_name: 'Ironforge Courier',
    guild_tag: '<MULE>',
    default_payout_percent: 75,
    motd: ''
  });
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [loading, setLoading] = useState(true);

  // Modal State
  const [showModal, setShowModal] = useState(false);
  const [editingItem, setEditingItem] = useState<Item | null>(null);
  const [itemName, setItemName] = useState('');
  const [itemCategory, setItemCategory] = useState('Loot');
  const [vendorCopper, setVendorCopper] = useState<number>(0);
  const [stackSize, setStackSize] = useState<number>(20);
  const [itemNotes, setItemNotes] = useState('');
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
    return matchesSearch && matchesCat;
  });

  const handleOpenAdd = () => {
    setEditingItem(null);
    setItemName('');
    setItemCategory('Loot');
    setVendorCopper(0);
    setStackSize(20);
    setItemNotes('');
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
          notes: itemNotes.trim()
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
              Item & Price Catalog
            </h1>
            <p className="text-xs text-zinc-400 mt-1">
              Master database of vendor values. As runners evaluate customer orders, new items automatically register here.
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
        {/* Search & Category Filter Bar */}
        <div className="bg-zinc-900/90 border border-zinc-800 rounded-2xl p-4 shadow-xl flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-zinc-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              placeholder="Search items by name, weapon, gem, pelt..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full bg-zinc-950 border border-zinc-700 rounded-xl pl-9 pr-3.5 py-2 text-xs sm:text-sm text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-amber-500"
            />
          </div>

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

          <div className="text-xs text-zinc-400 px-2 py-1 bg-zinc-950 rounded-lg border border-zinc-800 shrink-0 text-center">
            <span className="font-mono font-bold text-amber-300">{filteredItems.length}</span> items
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
                  <th className="py-3 px-4 font-semibold text-right">Vendor Sell Value</th>
                  <th className="py-3 px-4 font-semibold text-right">Customer Payout ({settings.default_payout_percent}%)</th>
                  <th className="py-3 px-4 font-semibold text-right">Runner Profit Margin</th>
                  <th className="py-3 px-4 font-semibold text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800/60">
                {filteredItems.map((item) => {
                  const payout = calculatePayout(item.vendor_price_copper, settings.default_payout_percent);
                  const margin = item.vendor_price_copper - payout;

                  return (
                    <tr key={item.id} className="hover:bg-zinc-800/30 transition-colors group">
                      <td className="py-3 px-4 font-semibold text-zinc-200">
                        {item.name}
                        {item.notes && (
                          <span className="block text-[10px] font-normal text-zinc-500">{item.notes}</span>
                        )}
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
                        <CoinDisplay copper={payout} size="sm" showZero />
                      </td>
                      <td className="py-3 px-4 text-right font-medium text-emerald-400">
                        <CoinDisplay copper={margin} size="sm" showZero />
                      </td>
                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            onClick={() => handleOpenEdit(item)}
                            title="Edit Item"
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
          <div className="bg-zinc-900 border border-zinc-700 rounded-2xl shadow-2xl max-w-md w-full p-6 text-zinc-100 space-y-5">
            <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Layers className="w-5 h-5 text-amber-400" />
                {editingItem ? 'Edit Item in Catalog' : 'Add Item to Catalog'}
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
                  placeholder="e.g. Bronze Longsword"
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
                    placeholder="e.g. Weapon, Pelt, Gem"
                    value={itemCategory}
                    onChange={(e) => setItemCategory(e.target.value)}
                    className="w-full bg-zinc-950 border border-zinc-700 rounded-lg px-3 py-2 text-xs text-white placeholder-zinc-600 focus:outline-none focus:ring-1 focus:ring-amber-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-zinc-300 mb-1">Max Stack Size</label>
                  <input
                    type="number"
                    min="1"
                    max="999"
                    value={stackSize}
                    onChange={(e) => setStackSize(parseInt(e.target.value, 10) || 1)}
                    className="w-full bg-zinc-950 border border-zinc-700 rounded-lg px-3 py-2 text-xs text-white placeholder-zinc-600 focus:outline-none focus:ring-1 focus:ring-amber-500"
                  />
                </div>
              </div>

              <div>
                <CoinInput
                  label="Town Vendor Sell Price (Per Unit):"
                  copperValue={vendorCopper}
                  onChange={setVendorCopper}
                />
                <div className="mt-1 flex items-center justify-between text-[11px] text-zinc-400">
                  <span>Customer Payout ({settings.default_payout_percent}%):</span>
                  <CoinDisplay copper={calculatePayout(vendorCopper, settings.default_payout_percent)} size="sm" showZero />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-zinc-300 mb-1">Notes (Optional)</label>
                <input
                  type="text"
                  placeholder="e.g. Drops off Orc Centurions in Oasis"
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
