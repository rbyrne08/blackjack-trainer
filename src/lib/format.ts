/** Formatting helpers shared by the UI. */

export function fmtEv(ev: number): string {
  const sign = ev > 0 ? '+' : '';
  return `${sign}${ev.toFixed(3)}`;
}

export function fmtMoney(n: number): string {
  const sign = n < 0 ? '-' : '';
  return `${sign}$${Math.abs(n).toLocaleString('en-US', { maximumFractionDigits: 2 })}`;
}

export function fmtPct(ratio: number): string {
  if (!Number.isFinite(ratio)) return '—';
  return `${(ratio * 100).toFixed(1)}%`;
}

export function fmtTc(tc: number): string {
  const sign = tc > 0 ? '+' : '';
  return `${sign}${tc.toFixed(1)}`;
}

export function fmtCount(rc: number): string {
  return rc > 0 ? `+${rc}` : `${rc}`;
}

const ACTION_LABELS: Record<string, string> = {
  hit: 'Hit',
  stand: 'Stand',
  double: 'Double',
  split: 'Split',
  surrender: 'Surrender',
};

export function actionLabel(action: string): string {
  return ACTION_LABELS[action] ?? action;
}

/** "H16|10" -> "Hard 16 vs 10", "P1|6" -> "A,A vs 6". */
export function cellLabel(cellKey: string): string {
  const [cell, up] = cellKey.split('|');
  const upLabel = up === '1' ? 'A' : up;
  const kind = cell[0];
  const rest = cell.slice(1);
  if (kind === 'H') return `Hard ${rest} vs ${upLabel}`;
  if (kind === 'S') return `Soft ${rest} vs ${upLabel}`;
  const pair = rest === '1' ? 'A,A' : `${rest},${rest}`;
  return `${pair} vs ${upLabel}`;
}
