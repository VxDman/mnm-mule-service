'use client';

import React from 'react';
import { copperToCoins } from '@/lib/currency';

interface CoinDisplayProps {
  copper: number;
  size?: 'sm' | 'md' | 'lg';
  compact?: boolean;
  showZero?: boolean;
  className?: string;
}

export function CoinDisplay({ copper, size = 'md', compact = false, showZero = false, className = '' }: CoinDisplayProps) {
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
    <span className={`inline-flex items-center flex-wrap ${sizeClasses.wrap} ${className}`}>
      {pp > 0 && (
        <span className={`inline-flex items-center gap-1 bg-cyan-950/80 border border-cyan-500/50 text-cyan-200 shadow-sm ${sizeClasses.coin}`}>
          <span className={`rounded-full bg-cyan-400 inline-block shadow-sm ${sizeClasses.dot}`} />
          <span>{pp}</span>
          <span className="text-cyan-400 font-bold text-[10px] uppercase">pp</span>
        </span>
      )}

      {gp > 0 && (
        <span className={`inline-flex items-center gap-1 bg-amber-950/80 border border-amber-500/50 text-amber-200 shadow-sm ${sizeClasses.coin}`}>
          <span className={`rounded-full bg-amber-400 inline-block shadow-sm ${sizeClasses.dot}`} />
          <span>{gp}</span>
          <span className="text-amber-400 font-bold text-[10px] uppercase">gp</span>
        </span>
      )}

      {sp > 0 && (
        <span className={`inline-flex items-center gap-1 bg-zinc-800 border border-zinc-600 text-zinc-200 shadow-sm ${sizeClasses.coin}`}>
          <span className={`rounded-full bg-zinc-300 inline-block shadow-sm ${sizeClasses.dot}`} />
          <span>{sp}</span>
          <span className="text-zinc-400 font-bold text-[10px] uppercase">sp</span>
        </span>
      )}

      {(cp > 0 || (!hasAny && showZero)) && (
        <span className={`inline-flex items-center gap-1 bg-orange-950/80 border border-orange-700/60 text-orange-200 shadow-sm ${sizeClasses.coin}`}>
          <span className={`rounded-full bg-amber-700 inline-block shadow-sm ${sizeClasses.dot}`} />
          <span>{cp}</span>
          <span className="text-amber-600 font-bold text-[10px] uppercase">cp</span>
        </span>
      )}
    </span>
  );
}
