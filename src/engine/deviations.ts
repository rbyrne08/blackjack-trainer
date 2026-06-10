import { cardValue } from './cards';
import { handValue, isPair } from './hand';
import type { Action, Card, CardValue, RuleSet } from './types';

/**
 * Hi-Lo index plays: the Illustrious 18 and Fab 4 surrenders.
 *
 * Index source: Don Schlesinger, "Blackjack Attack" (multi-deck Hi-Lo
 * indices, S17 base). Published sources disagree by +/-1 on a few cells and
 * on H17 adjustments; where a common H17 override exists it is encoded via
 * h17Index. Each entry expresses the full count-aware play for its cell:
 * take `aboveAction` when TC >= index, `belowAction` otherwise.
 *
 * An entry only changes a graded decision when its prescribed action is
 * legal in the current hand and differs from computed basic strategy, and a
 * non-surrender entry never overrides a basic-strategy surrender (16vT with
 * late surrender stays a surrender at any reasonable count).
 */
export interface DeviationEntry {
  id: string;
  /** Human-readable rule, shown in feedback. */
  label: string;
  hand:
    | { kind: 'hard'; total: number }
    | { kind: 'pair'; pairValue: CardValue };
  dealerUp: CardValue;
  /** True-count threshold (S17 base). */
  index: number;
  /** Replacement index when the dealer hits soft 17. */
  h17Index?: number;
  /** Entry is meaningless under H17 (basic strategy already plays it). */
  s17Only?: boolean;
  aboveAction: Action;
  belowAction: Action;
}

export const INSURANCE_INDEX = 3;

export const ILLUSTRIOUS_18: DeviationEntry[] = [
  // (#1 of the Illustrious 18 is insurance at TC >= +3, handled separately.)
  { id: 'I18-16vT', label: '16 v 10: stand at TC >= 0', hand: { kind: 'hard', total: 16 }, dealerUp: 10, index: 0, aboveAction: 'stand', belowAction: 'hit' },
  { id: 'I18-15vT', label: '15 v 10: stand at TC >= +4', hand: { kind: 'hard', total: 15 }, dealerUp: 10, index: 4, aboveAction: 'stand', belowAction: 'hit' },
  { id: 'I18-TTv5', label: 'T,T v 5: split at TC >= +5', hand: { kind: 'pair', pairValue: 10 }, dealerUp: 5, index: 5, aboveAction: 'split', belowAction: 'stand' },
  { id: 'I18-TTv6', label: 'T,T v 6: split at TC >= +4', hand: { kind: 'pair', pairValue: 10 }, dealerUp: 6, index: 4, aboveAction: 'split', belowAction: 'stand' },
  { id: 'I18-10vT', label: '10 v 10: double at TC >= +4', hand: { kind: 'hard', total: 10 }, dealerUp: 10, index: 4, aboveAction: 'double', belowAction: 'hit' },
  { id: 'I18-12v3', label: '12 v 3: stand at TC >= +2', hand: { kind: 'hard', total: 12 }, dealerUp: 3, index: 2, aboveAction: 'stand', belowAction: 'hit' },
  { id: 'I18-12v2', label: '12 v 2: stand at TC >= +3', hand: { kind: 'hard', total: 12 }, dealerUp: 2, index: 3, aboveAction: 'stand', belowAction: 'hit' },
  { id: 'I18-11vA', label: '11 v A: double at TC >= +1 (S17)', hand: { kind: 'hard', total: 11 }, dealerUp: 1, index: 1, s17Only: true, aboveAction: 'double', belowAction: 'hit' },
  { id: 'I18-9v2', label: '9 v 2: double at TC >= +1', hand: { kind: 'hard', total: 9 }, dealerUp: 2, index: 1, aboveAction: 'double', belowAction: 'hit' },
  { id: 'I18-10vA', label: '10 v A: double at TC >= +4 (+3 H17)', hand: { kind: 'hard', total: 10 }, dealerUp: 1, index: 4, h17Index: 3, aboveAction: 'double', belowAction: 'hit' },
  { id: 'I18-9v7', label: '9 v 7: double at TC >= +3', hand: { kind: 'hard', total: 9 }, dealerUp: 7, index: 3, aboveAction: 'double', belowAction: 'hit' },
  { id: 'I18-16v9', label: '16 v 9: stand at TC >= +5', hand: { kind: 'hard', total: 16 }, dealerUp: 9, index: 5, aboveAction: 'stand', belowAction: 'hit' },
  { id: 'I18-13v2', label: '13 v 2: stand at TC >= -1', hand: { kind: 'hard', total: 13 }, dealerUp: 2, index: -1, aboveAction: 'stand', belowAction: 'hit' },
  { id: 'I18-12v4', label: '12 v 4: stand at TC >= 0', hand: { kind: 'hard', total: 12 }, dealerUp: 4, index: 0, aboveAction: 'stand', belowAction: 'hit' },
  { id: 'I18-12v5', label: '12 v 5: stand at TC >= -2', hand: { kind: 'hard', total: 12 }, dealerUp: 5, index: -2, aboveAction: 'stand', belowAction: 'hit' },
  { id: 'I18-12v6', label: '12 v 6: stand at TC >= -1', hand: { kind: 'hard', total: 12 }, dealerUp: 6, index: -1, aboveAction: 'stand', belowAction: 'hit' },
  { id: 'I18-13v3', label: '13 v 3: stand at TC >= -2', hand: { kind: 'hard', total: 13 }, dealerUp: 3, index: -2, aboveAction: 'stand', belowAction: 'hit' },
];

export const FAB_FOUR: DeviationEntry[] = [
  { id: 'F4-14vT', label: '14 v 10: surrender at TC >= +3', hand: { kind: 'hard', total: 14 }, dealerUp: 10, index: 3, aboveAction: 'surrender', belowAction: 'hit' },
  { id: 'F4-15vT', label: '15 v 10: surrender at TC >= 0', hand: { kind: 'hard', total: 15 }, dealerUp: 10, index: 0, aboveAction: 'surrender', belowAction: 'hit' },
  { id: 'F4-15v9', label: '15 v 9: surrender at TC >= +2', hand: { kind: 'hard', total: 15 }, dealerUp: 9, index: 2, aboveAction: 'surrender', belowAction: 'hit' },
  { id: 'F4-15vA', label: '15 v A: surrender at TC >= +1 (-1 H17)', hand: { kind: 'hard', total: 15 }, dealerUp: 1, index: 1, h17Index: -1, aboveAction: 'surrender', belowAction: 'hit' },
];

/** Surrender deviations take precedence over hit/stand/double deviations. */
const ALL_DEVIATIONS: DeviationEntry[] = [...FAB_FOUR, ...ILLUSTRIOUS_18];

function entryMatches(entry: DeviationEntry, cards: readonly Card[], dealerUp: CardValue): boolean {
  if (entry.dealerUp !== dealerUp) return false;
  if (entry.hand.kind === 'pair') {
    return isPair(cards) && cardValue(cards[0].rank) === entry.hand.pairValue;
  }
  if (isPair(cards)) return false; // pair hands only match pair entries
  const { total, isSoft } = handValue(cards);
  return !isSoft && total === entry.hand.total;
}

export interface DeviationResult {
  action: Action;
  /** The entry that changed the play, or null when basic strategy stands. */
  deviation: DeviationEntry | null;
}

/**
 * Count-adjusted optimal action. `basic` must be the legality-aware basic
 * strategy action (from strategy.optimalAction); `legal` the currently legal
 * actions.
 */
export function applyDeviations(
  basic: Action,
  cards: readonly Card[],
  dealerUp: CardValue,
  legal: readonly Action[],
  trueCount: number,
  rules: RuleSet,
): DeviationResult {
  for (const entry of ALL_DEVIATIONS) {
    if (rules.dealerHitsSoft17 && entry.s17Only) continue;
    if (!entryMatches(entry, cards, dealerUp)) continue;
    // Basic surrender is never overridden by a non-surrender index play.
    if (basic === 'surrender' && entry.aboveAction !== 'surrender') continue;

    const index =
      rules.dealerHitsSoft17 && entry.h17Index !== undefined
        ? entry.h17Index
        : entry.index;
    let action = trueCount >= index ? entry.aboveAction : entry.belowAction;
    if (!legal.includes(action)) action = basic;
    if (action !== basic) return { action, deviation: entry };
    // No change from this entry — keep scanning: a cell can carry both a
    // surrender index and a stand/double index (e.g. 15 v 10), and when
    // surrender is unavailable the second entry still applies.
  }
  return { action: basic, deviation: null };
}

/** Insurance: never by basic strategy; take it at TC >= +3 when counting. */
export function shouldTakeInsurance(trueCount: number | null): boolean {
  return trueCount !== null && trueCount >= INSURANCE_INDEX;
}
