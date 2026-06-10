import { cardValue } from './cards';
import type { Card, CardValue, HandValue, PlayerHand } from './types';

/**
 * Best value of a hand: aces count 1, then one ace is upgraded to 11
 * if that does not bust. At most one ace can ever count as 11.
 */
export function handValue(cards: readonly Card[]): HandValue {
  let hard = 0;
  let hasAce = false;
  for (const c of cards) {
    const v = cardValue(c.rank);
    hard += v;
    if (v === 1) hasAce = true;
  }
  if (hasAce && hard + 10 <= 21) return { total: hard + 10, isSoft: true };
  return { total: hard, isSoft: false };
}

/**
 * Incremental version for EV recursions that track (total, isSoft) instead of
 * card lists. `isSoft` implies an ace currently counted as 11; once a hand goes
 * hard it can never become soft again (hard total with an ace is already >= 12).
 */
export function addCardToTotal(total: number, isSoft: boolean, v: CardValue): HandValue {
  const hardBase = isSoft ? total - 10 : total;
  const newHard = hardBase + v;
  const hasAce = isSoft || v === 1;
  if (hasAce && newHard + 10 <= 21) return { total: newHard + 10, isSoft: true };
  return { total: newHard, isSoft: false };
}

export function isBust(cards: readonly Card[]): boolean {
  return handValue(cards).total > 21;
}

/** Natural: exactly two cards totalling 21 on a non-split hand. */
export function isBlackjack(hand: Pick<PlayerHand, 'cards' | 'isFromSplit'>): boolean {
  return (
    !hand.isFromSplit &&
    hand.cards.length === 2 &&
    handValue(hand.cards).total === 21
  );
}

/** Two cards of the same value class (10/J/Q/K all pair with each other). */
export function isPair(cards: readonly Card[]): boolean {
  return (
    cards.length === 2 && cardValue(cards[0].rank) === cardValue(cards[1].rank)
  );
}
