'use client';

import React, { useState, useEffect } from 'react';
import { copperToCoins, coinsToCopper } from '@/lib/currency';

interface CoinInputProps {
  copperValue: number;
  onChange: (copper: number) => void;
  label?: string;
  disabled?: boolean;
}

export function CoinInput({ copperValue, onChange, label, disabled = false }: CoinInputProps) {
  const coins = copperToCoins(copperValue);
  const [pp, setPp] = useState<string>(coins.pp > 0 ? String(coins.pp) : '');
  const [gp, setGp] = useState<string>(coins.gp > 0 ? String(coins.gp) : '');
  const [sp, setSp] = useState<string>(coins.sp > 0 ? String(coins.sp) : '');
  const [cp, setCp] = useState<string>(coins.cp > 0 ? String(coins.cp) : '');

  // Keep in sync if copperValue prop changes from outside
  useEffect(() => {
    const updated = copperToCoins(copperValue);
    setPp(updated.pp > 0 ? String(updated.pp) : '');
    setGp(updated.gp > 0 ? String(updated.gp) : '');
    setSp(updated.sp > 0 ? String(updated.sp) : '');
    setCp(updated.cp > 0 ? String(updated.cp) : '');
  }, [copperValue]);

  const update = (newPp: string, newGp: string, newSp: string, newCp: string) => {
    const p = Math.max(0, parseInt(newPp || '0', 10) || 0);
    const g = Math.max(0, parseInt(newGp || '0', 10) || 0);
    const s = Math.max(0, parseInt(newSp || '0', 10) || 0);
    const c = Math.max(0, parseInt(newCp || '0', 10) || 0);
    const total = coinsToCopper({ pp: p, gp: g, sp: s, cp: c });
    onChange(total);
  };

  return (
    <div className="flex flex-col gap-1.5">
      {label && <label className="text-xs font-medium text-zinc-300">{label}</label>}
      <div className="grid grid-cols-4 gap-2">
        {/* Platinum */}
        <div className="relative flex items-center">
          <input
            type="number"
            min="0"
            disabled={disabled}
            value={pp}
            placeholder="0"
            onChange={(e) => {
              setPp(e.target.value);
              update(e.target.value, gp, sp, cp);
            }}
            className="w-full bg-zinc-900 border border-cyan-800/60 rounded-md py-1.5 pl-2.5 pr-7 text-xs font-mono text-cyan-200 placeholder-zinc-600 focus:outline-none focus:ring-1 focus:ring-cyan-500 disabled:opacity-50"
          />
          <span className="absolute right-2 text-[10px] font-bold text-cyan-400 select-none pointer-events-none">
            pp
          </span>
        </div>

        {/* Gold */}
        <div className="relative flex items-center">
          <input
            type="number"
            min="0"
            disabled={disabled}
            value={gp}
            placeholder="0"
            onChange={(e) => {
              setGp(e.target.value);
              update(pp, e.target.value, sp, cp);
            }}
            className="w-full bg-zinc-900 border border-amber-800/60 rounded-md py-1.5 pl-2.5 pr-7 text-xs font-mono text-amber-200 placeholder-zinc-600 focus:outline-none focus:ring-1 focus:ring-amber-500 disabled:opacity-50"
          />
          <span className="absolute right-2 text-[10px] font-bold text-amber-400 select-none pointer-events-none">
            gp
          </span>
        </div>

        {/* Silver */}
        <div className="relative flex items-center">
          <input
            type="number"
            min="0"
            disabled={disabled}
            value={sp}
            placeholder="0"
            onChange={(e) => {
              setSp(e.target.value);
              update(pp, gp, e.target.value, cp);
            }}
            className="w-full bg-zinc-900 border border-slate-700 rounded-md py-1.5 pl-2.5 pr-7 text-xs font-mono text-slate-200 placeholder-zinc-600 focus:outline-none focus:ring-1 focus:ring-slate-400 disabled:opacity-50"
          />
          <span className="absolute right-2 text-[10px] font-bold text-slate-400 select-none pointer-events-none">
            sp
          </span>
        </div>

        {/* Copper */}
        <div className="relative flex items-center">
          <input
            type="number"
            min="0"
            disabled={disabled}
            value={cp}
            placeholder="0"
            onChange={(e) => {
              setCp(e.target.value);
              update(pp, gp, sp, e.target.value);
            }}
            className="w-full bg-zinc-900 border border-orange-800/60 rounded-md py-1.5 pl-2.5 pr-7 text-xs font-mono text-orange-200 placeholder-zinc-600 focus:outline-none focus:ring-1 focus:ring-orange-500 disabled:opacity-50"
          />
          <span className="absolute right-2 text-[10px] font-bold text-orange-400 select-none pointer-events-none">
            cp
          </span>
        </div>
      </div>
    </div>
  );
}
