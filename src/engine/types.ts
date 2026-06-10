/**
 * Core domain types for the blackjack engine.
 * Everything in src/engine is pure TypeScript: no React, no stores, no storage.
 */

export type Rank =
  | 'A' | '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9' | '10' | 'J' | 'Q' | 'K';

export type Suit = 'S' | 'H' | 'D' | 'C';

export interface Card {
  rank: Rank;
  suit: Suit;
  /** Unique within a shoe; used for React keys and animations. */
  id: number;
}

/**
 * Engine value class: 1 = ace, 2..9 = pip value, 10 = ten/jack/queen/king.
 * All EV math operates on value classes, never on ranks.
 */
export type CardValue = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10;

export type Action = 'hit' | 'stand' | 'double' | 'split' | 'surrender';

export interface RuleSet {
  decks: 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8;
  /** true = H17 (dealer hits soft 17), false = S17. */
  dealerHitsSoft17: boolean;
  /** DAS: doubling allowed on hands created by a split. */
  doubleAfterSplit: boolean;
  /** Late surrender offered as the first decision of the original hand. Requires dealerPeeks. */
  lateSurrender: boolean;
  /** 1.5 = 3:2, 1.2 = 6:5. Affects settlement and overall EV, never strategy decisions. */
  blackjackPayout: 1.5 | 1.2;
  /** Which two-card totals may double. '9-11' / '10-11' restrict to hard totals only. */
  doubleRestriction: 'any2' | '9-11' | '10-11';
  /** Maximum number of hands a round may split into (2 = one split). */
  maxSplitHands: 2 | 3 | 4;
  /** true = American hole card with peek; false = European no-hole-card (ENHC). */
  dealerPeeks: boolean;
  /** Percentage of the shoe dealt before a reshuffle is scheduled (e.g. 75). */
  penetrationPct: number;
}

export interface HandValue {
  /** Best total (one ace counted as 11 when that does not bust). */
  total: number;
  /** true when an ace is currently counted as 11. */
  isSoft: boolean;
}

export interface PlayerHand {
  cards: Card[];
  bet: number;
  isDoubled: boolean;
  isFromSplit: boolean;
  /** Split aces receive exactly one card and are auto-resolved. */
  isSplitAces: boolean;
  isSurrendered: boolean;
  /** No further decisions possible (stood, busted, doubled, surrendered, or 21). */
  isResolved: boolean;
}

export type Phase =
  | 'betting'
  | 'insurance'
  | 'playerTurn'
  | 'dealerTurn'
  | 'settlement';

export type HandResult =
  | 'blackjack'
  | 'win'
  | 'push'
  | 'lose'
  | 'surrender';

export interface HandOutcome {
  handIndex: number;
  result: HandResult;
  /** Net bankroll change for this hand, in currency units (bet already deducted is refunded within). */
  net: number;
}

export interface GameState {
  rules: RuleSet;
  phase: Phase;
  /** Remaining cards; index 0 is the next card dealt. */
  shoe: Card[];
  /** Cards dealt since the last shuffle. */
  dealtCount: number;
  /** decks * 52 */
  totalCards: number;
  /** Penetration exceeded; reshuffle before the next round is dealt. */
  needsShuffle: boolean;
  dealerCards: Card[];
  holeCardRevealed: boolean;
  hands: PlayerHand[];
  activeHandIndex: number;
  bankroll: number;
  /** The bet placed for the current round. */
  baseBet: number;
  insuranceBet: number;
  /** Hi-Lo running count over exposed cards only (hole card counts at reveal). */
  runningCount: number;
  /** Rounds completed since the last shuffle. */
  roundsSinceShuffle: number;
  /** Per-hand results, populated on entry to settlement. */
  outcomes: HandOutcome[];
  /** Insurance result for the round: net change from the insurance side bet. */
  insuranceNet: number;
}

export type GameEvent =
  | { type: 'PLACE_BET'; amount: number }
  | { type: 'INSURANCE'; take: boolean }
  | { type: 'PLAYER_ACTION'; action: Action }
  | { type: 'DEALER_STEP' }
  | { type: 'NEXT_ROUND' };

/** Source of uniform randoms in [0, 1); injectable for deterministic tests. */
export type Rng = () => number;
