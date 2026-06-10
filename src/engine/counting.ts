import { cardValue } from './cards';
import type { Card, CardValue } from './types';

/** Hi-Lo tags: 2-6 are +1, 7-9 are 0, tens and aces are -1. */
export function hiLoTag(v: CardValue): -1 | 0 | 1 {
  if (v >= 2 && v <= 6) return 1;
  if (v >= 7 && v <= 9) return 0;
  return -1; // 10s and aces
}

export function hiLoTagForCard(card: Card): -1 | 0 | 1 {
  return hiLoTag(cardValue(card.rank));
}

/**
 * Decks remaining estimated to the nearest half deck, floored at half a deck —
 * the granularity a human counter actually uses at the table.
 */
export function decksRemaining(totalCards: number, dealtCount: number): number {
  const exact = (totalCards - dealtCount) / 52;
  return Math.max(0.5, Math.round(exact * 2) / 2);
}

/** True count: running count divided by (half-deck-rounded) decks remaining. */
export function trueCount(
  runningCount: number,
  totalCards: number,
  dealtCount: number,
): number {
  return runningCount / decksRemaining(totalCards, dealtCount);
}

export interface BetRampEntry {
  /** Apply this bet when the true count is at least this value. */
  minTc: number;
  units: number;
}

/** Classic 1-12 spread: 1 unit at TC <= +1, then 2 / 4 / 8 / 12. */
export const DEFAULT_BET_RAMP: BetRampEntry[] = [
  { minTc: 2, units: 2 },
  { minTc: 3, units: 4 },
  { minTc: 4, units: 8 },
  { minTc: 5, units: 12 },
];

export function recommendedUnits(tc: number, ramp: BetRampEntry[] = DEFAULT_BET_RAMP): number {
  let units = 1;
  let bestMin = -Infinity;
  for (const entry of ramp) {
    if (tc >= entry.minTc && entry.minTc > bestMin) {
      bestMin = entry.minTc;
      units = entry.units;
    }
  }
  return units;
}
