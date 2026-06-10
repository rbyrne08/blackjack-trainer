import { handValue, isPair } from './hand';
import type { Action, PlayerHand, RuleSet } from './types';

export const DEFAULT_RULES: RuleSet = {
  decks: 6,
  dealerHitsSoft17: false,
  doubleAfterSplit: true,
  lateSurrender: true,
  blackjackPayout: 1.5,
  doubleRestriction: 'any2',
  maxSplitHands: 4,
  dealerPeeks: true,
  penetrationPct: 75,
};

/** Stable, readable cache key for everything derived from a rule set. */
export function rulesHash(rules: RuleSet): string {
  return [
    `d${rules.decks}`,
    rules.dealerHitsSoft17 ? 'h17' : 's17',
    rules.doubleAfterSplit ? 'das' : 'ndas',
    rules.lateSurrender ? 'ls' : 'nls',
    `bj${rules.blackjackPayout}`,
    `dbl${rules.doubleRestriction}`,
    `sp${rules.maxSplitHands}`,
    rules.dealerPeeks ? 'peek' : 'enhc',
  ].join('-');
}

function doubleTotalAllowed(hand: PlayerHand, rules: RuleSet): boolean {
  if (rules.doubleRestriction === 'any2') return true;
  const { total, isSoft } = handValue(hand.cards);
  if (isSoft) return false; // restricted doubling is hard-total only (Reno style)
  const min = rules.doubleRestriction === '9-11' ? 9 : 10;
  return total >= min && total <= 11;
}

/**
 * Rule-legal actions for the active hand. Bankroll affordability for
 * double/split is a game-state concern checked by the reducer, not here.
 */
export function legalActions(
  hand: PlayerHand,
  handCount: number,
  rules: RuleSet,
): Action[] {
  if (hand.isResolved || hand.isSurrendered) return [];
  const { total } = handValue(hand.cards);
  if (total >= 21) return [];

  const actions: Action[] = ['hit', 'stand'];

  const isTwoCards = hand.cards.length === 2;
  if (
    isTwoCards &&
    !hand.isSplitAces &&
    (!hand.isFromSplit || rules.doubleAfterSplit) &&
    doubleTotalAllowed(hand, rules)
  ) {
    actions.push('double');
  }

  if (isTwoCards && isPair(hand.cards) && handCount < rules.maxSplitHands) {
    actions.push('split');
  }

  // Late surrender: only as the very first decision of the original hand.
  if (
    rules.lateSurrender &&
    rules.dealerPeeks &&
    isTwoCards &&
    !hand.isFromSplit &&
    handCount === 1
  ) {
    actions.push('surrender');
  }

  return actions;
}
