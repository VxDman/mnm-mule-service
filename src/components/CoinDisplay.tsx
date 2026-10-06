'use client';

import React from 'react';
import { copperToCoins } from '@/lib/currency';

interface CoinDisplayProps {
  copper: number;
  size?: 'sm' | 'md' | 'lg';
  showZero?: boolean;
  className?: string;
}

export function CoinDisplay({ copper, size = 'md', showZero = false, className = '' }: CoinDisplayProps) {
  const { pp, gp, sp, cp } = copperToCoins(copper);

  const sizeClasses = {
    sm: {
      wrap: 'text-xs gap-1.5',
      coin: 'px-1.5 py-0.5 rounded text-[11px] font-mono font-medium',
      dot: 'w-2 h-2'
    },
    md: {
      wrap: 'text-sm gap-2',
      coin: 'px-2 py-0.5 rounded-md text-xs font-mono font-semibold',
      dot: 'w-2.5 h-2.5'
    },
    lg: {
      wrap: 'text-base gap-2.5',
      coin: 'px-2.5 py-1 rounded-md text-sm font-mono font-bold',
      dot: 'w-3 h-3'
    }
  }[size];

  const hasAny = pp > 0 || gp > 0 || sp > 0 || cp > 0;

  if (!hasAny && !showZero) {
    return (
      <span className={`inline-flex items-center text-zinc-400 font-mono ${className}`}>
        0 <span className="text-amber-700/80 text-[10px] ml-0.5 font-bold uppercase">cp</span>
      </span>
    );
  }

  return (
    <div className={`inline-flex items-center flex-wrap ${sizeClasses.wrap} ${className}`}>
      {pp > 0 && (
        <span className={`inline-flex items-center gap-1 bg-cyan-950/70 border border-cyan-500/40 text-cyan-200 shadow-sm ${sizeClasses.coin}`} title={`${pp} Platinum (${pp * 1000} Copper)`}>
          <span className={`rounded-full bg-cyan-300 ring-1 ring-cyan-200/60 shadow-[0_0_6px_rgba(103,232,249,0.7)] ${sizeClasses.dot}`} />
          <span>{pp.toLocaleString()}</span>
          <span className="text-cyan-400/80 text-[10px] uppercase tracking-wider">pp</span>
        </span>
      )}

      {(gp > 0 || (pp > 0 && (sp > 0 || cp > 0))) && (
        <span className={`inline-flex items-center gap-1 bg-amber-950/70 border border-amber-500/50 text-amber-200 shadow-sm ${sizeClasses.coin}`} title={`${gp} Gold (${gp * 100} Copper)`}>
          <span className={`rounded-full bg-amber-400 ring-1 ring-amber-300/60 shadow-[0_0_6px_rgba(251,191,36,0.7)] ${sizeClasses.dot}`} />
          <span>{gp}</span>
          <span className="text-amber-400/80 text-[10px] uppercase tracking-wider">gp</span>
        </span>
      )}

      {(sp > 0 || ((pp > 0 || gp > 0) && cp > 0)) && (
        <span className={`inline-flex items-center gap-1 bg-slate-800/80 border border-slate-400/50 text-slate-200 shadow-sm ${sizeClasses.coin}`} title={`${sp} Silver (${sp * 10} Copper)`}>
          <span className={`rounded-full bg-slate-300 ring-1 ring-slate-200/60 shadow-[0_0_5px_rgba(203,213,225,0.7)] ${sizeClasses.dot}`} />
          <span>{sp}</span>
          <span className="text-slate-400 text-[10px] uppercase tracking-wider">sp</span>
        </span>
      )}

      {(cp > 0 || (!pp && !gp && !sp)) && (
        <span className={`inline-flex items-center gap-1 bg-orange-950/70 border border-orange-600/50 text-orange-200 shadow-sm ${sizeClasses.coin}`} title={`${cp} Copper`}>
          <span className={`rounded-full bg-orange-500 ring-1 ring-orange-400/60 shadow-[0_0_5px_rgba(249,115,22,0.7)] ${sizeClasses.dot}`} />
          <span>{cp}</span>
          <span className="text-orange-400/80 text-[10px] uppercase tracking-wider">cp</span>
        </span>
      )}
    </div>
  );
}
