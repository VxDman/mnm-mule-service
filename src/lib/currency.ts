export interface Coins {
  pp: number; // Platinum
  gp: number; // Gold
  sp: number; // Silver
  cp: number; // Copper
}

/**
 * Converts total copper into standard MMO coin denominations:
 * 1 Platinum = 1000 Copper
 * 1 Gold = 100 Copper
 * 1 Silver = 10 Copper
 * 1 Copper = 1 Copper
 */
export function copperToCoins(totalCopper: number): Coins {
  const safeCopper = Math.max(0, Math.floor(totalCopper || 0));
  const pp = Math.floor(safeCopper / 1000);
  const remainderAfterPp = safeCopper % 1000;
  const gp = Math.floor(remainderAfterPp / 100);
  const remainderAfterGp = remainderAfterPp % 100;
  const sp = Math.floor(remainderAfterGp / 10);
  const cp = remainderAfterGp % 10;

  return { pp, gp, sp, cp };
}

/**
 * Converts coins object to total copper.
 */
export function coinsToCopper(coins: Partial<Coins>): number {
  const pp = Math.max(0, coins.pp || 0);
  const gp = Math.max(0, coins.gp || 0);
  const sp = Math.max(0, coins.sp || 0);
  const cp = Math.max(0, coins.cp || 0);

  return pp * 1000 + gp * 100 + sp * 10 + cp;
}

/**
 * Calculates customer payout copper from vendor copper and payout percent (e.g. 75%).
 */
export function calculatePayout(vendorCopper: number, payoutPercent: number): number {
  if (vendorCopper <= 0 || payoutPercent <= 0) return 0;
  return Math.floor((vendorCopper * payoutPercent) / 100);
}

/**
 * Formats copper into compact text: e.g. "12p 4g 5s"
 */
export function formatCoinString(totalCopper: number): string {
  if (totalCopper <= 0) return '0c';
  const { pp, gp, sp, cp } = copperToCoins(totalCopper);
  const parts: string[] = [];
  if (pp > 0) parts.push(`${pp}pp`);
  if (gp > 0) parts.push(`${gp}gp`);
  if (sp > 0) parts.push(`${sp}sp`);
  if (cp > 0 || parts.length === 0) parts.push(`${cp}cp`);
  return parts.join(' ');
}
