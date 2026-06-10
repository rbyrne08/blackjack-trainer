import { cardValue, freshShoe } from './cards';
import { hiLoTagForCard } from './counting';
import { handValue, isBlackjack } from './hand';
import { legalActions } from './rules';
import type {
  Action,
  Card,
  GameEvent,
  GameState,
  HandOutcome,
  PlayerHand,
  Rng,
  RuleSet,
} from './types';

/**
 * Pure game state machine. Every transition is deterministic given the shoe;
 * randomness enters only when a shuffle replaces the shoe. Cards are dealt by
 * advancing `dealtCount` through the (immutable) `shoe` array.
 *
 * Phases: betting -> (insurance) -> playerTurn -> dealerTurn -> settlement.
 * DEALER_STEP performs exactly one observable step (reveal or one draw or the
 * settle) so the UI can animate the dealer's play.
 */

export interface GameOptions {
  bankroll?: number;
  baseBet?: number;
}

/** Reshuffle is forced at round end when fewer cards than this remain. */
const MIN_CARDS_TO_DEAL = 20;

export function createStateWithShoe(
  rules: RuleSet,
  shoe: Card[],
  opts: GameOptions = {},
): GameState {
  return {
    rules,
    phase: 'betting',
    shoe,
    dealtCount: 0,
    totalCards: shoe.length,
    needsShuffle: false,
    dealerCards: [],
    holeCardRevealed: false,
    hands: [],
    activeHandIndex: 0,
    bankroll: opts.bankroll ?? 1000,
    baseBet: opts.baseBet ?? 10,
    insuranceBet: 0,
    runningCount: 0,
    roundsSinceShuffle: 0,
    outcomes: [],
    insuranceNet: 0,
  };
}

export function createInitialState(
  rules: RuleSet,
  rng: Rng,
  opts: GameOptions = {},
): GameState {
  return createStateWithShoe(rules, freshShoe(rules.decks, rng), opts);
}

/** Legal actions the player can also afford (double/split need a matching bet). */
export function availableActions(state: GameState): Action[] {
  if (state.phase !== 'playerTurn') return [];
  const hand = state.hands[state.activeHandIndex];
  return legalActions(hand, state.hands.length, state.rules).filter(
    (a) => (a !== 'double' && a !== 'split') || state.bankroll >= hand.bet,
  );
}

// ---------------------------------------------------------------------------
// Internal helpers. All mutate the freshly-cloned draft inside gameReducer.

function clone(state: GameState): GameState {
  return {
    ...state,
    dealerCards: [...state.dealerCards],
    hands: state.hands.map((h) => ({ ...h, cards: [...h.cards] })),
    outcomes: state.outcomes.map((o) => ({ ...o })),
  };
}

/** Deal one card. `exposed` cards update the running count immediately. */
function draw(s: GameState, exposed: boolean): Card {
  if (s.dealtCount >= s.shoe.length) {
    throw new Error('shoe exhausted mid-round; penetration floor should prevent this');
  }
  const card = s.shoe[s.dealtCount];
  s.dealtCount += 1;
  if (exposed) s.runningCount += hiLoTagForCard(card);
  return card;
}

function revealHole(s: GameState): void {
  if (s.holeCardRevealed) return;
  if (s.dealerCards.length < 2) return;
  s.holeCardRevealed = true;
  s.runningCount += hiLoTagForCard(s.dealerCards[1]);
}

function makeHand(cards: Card[], bet: number): PlayerHand {
  return {
    cards,
    bet,
    isDoubled: false,
    isFromSplit: false,
    isSplitAces: false,
    isSurrendered: false,
    isResolved: false,
  };
}

function dealerBlackjack(s: GameState): boolean {
  return s.dealerCards.length === 2 && handValue(s.dealerCards).total === 21;
}

/** A hand the dealer still has to beat: not surrendered, busted, or a natural. */
function hasLiveHand(s: GameState): boolean {
  return s.hands.some(
    (h) =>
      !h.isSurrendered && !isBlackjack(h) && handValue(h.cards).total <= 21,
  );
}

function dealerMustHit(s: GameState): boolean {
  const { total, isSoft } = handValue(s.dealerCards);
  if (total < 17) return true;
  if (total === 17 && isSoft && s.rules.dealerHitsSoft17) return true;
  return false;
}

/**
 * Reveal the hole card (if any), resolve pending insurance, score every hand,
 * apply bankroll changes, and schedule a reshuffle when penetration is passed.
 */
function settle(s: GameState): void {
  revealHole(s);

  const isDealerBJ = dealerBlackjack(s);
  if (s.insuranceBet > 0 && s.insuranceNet === null) {
    if (isDealerBJ) {
      s.bankroll += s.insuranceBet * 3;
      s.insuranceNet = s.insuranceBet * 2;
    } else {
      s.insuranceNet = -s.insuranceBet;
    }
  }

  const dealerTotal = handValue(s.dealerCards).total;
  const outcomes: HandOutcome[] = [];
  s.hands.forEach((hand, handIndex) => {
    const bet = hand.bet;
    const total = handValue(hand.cards).total;
    let outcome: HandOutcome;
    if (hand.isSurrendered) {
      s.bankroll += bet / 2;
      outcome = { handIndex, result: 'surrender', net: -bet / 2 };
    } else if (total > 21) {
      outcome = { handIndex, result: 'lose', net: -bet };
    } else if (isBlackjack(hand)) {
      if (isDealerBJ) {
        s.bankroll += bet;
        outcome = { handIndex, result: 'push', net: 0 };
      } else {
        const win = bet * s.rules.blackjackPayout;
        s.bankroll += bet + win;
        outcome = { handIndex, result: 'blackjack', net: win };
      }
    } else if (isDealerBJ) {
      // ENHC: a dealer natural takes every unit in play, doubles and splits included.
      outcome = { handIndex, result: 'lose', net: -bet };
    } else if (dealerTotal > 21 || total > dealerTotal) {
      s.bankroll += bet * 2;
      outcome = { handIndex, result: 'win', net: bet };
    } else if (total === dealerTotal) {
      s.bankroll += bet;
      outcome = { handIndex, result: 'push', net: 0 };
    } else {
      outcome = { handIndex, result: 'lose', net: -bet };
    }
    outcomes.push(outcome);
  });

  s.outcomes = outcomes;
  s.roundsSinceShuffle += 1;
  const penetrated =
    s.dealtCount >= (s.totalCards * s.rules.penetrationPct) / 100;
  const tooFewCards = s.totalCards - s.dealtCount < MIN_CARDS_TO_DEAL;
  s.needsShuffle = penetrated || tooFewCards;
  s.phase = 'settlement';
}

/**
 * Walk to the next hand needing a decision. Hands arriving from a split get
 * their second card here; split aces and 21s auto-resolve. When every hand is
 * done, control passes to the dealer.
 */
function advance(s: GameState): void {
  while (s.activeHandIndex < s.hands.length) {
    const hand = s.hands[s.activeHandIndex];
    if (hand.cards.length === 1) {
      hand.cards.push(draw(s, true));
      if (hand.isSplitAces) {
        hand.isResolved = true;
      } else if (handValue(hand.cards).total === 21) {
        hand.isResolved = true;
      }
    }
    if (handValue(hand.cards).total >= 21) hand.isResolved = true;
    if (hand.isResolved) {
      s.activeHandIndex += 1;
      continue;
    }
    s.phase = 'playerTurn';
    return;
  }
  s.phase = 'dealerTurn';
}

function startRound(s: GameState, amount: number, rng: Rng): void {
  if (amount <= 0 || amount > s.bankroll) {
    throw new Error(`invalid bet ${amount} with bankroll ${s.bankroll}`);
  }
  if (s.needsShuffle) {
    s.shoe = freshShoe(s.rules.decks, rng);
    s.totalCards = s.shoe.length;
    s.dealtCount = 0;
    s.runningCount = 0;
    s.roundsSinceShuffle = 0;
    s.needsShuffle = false;
  }

  s.bankroll -= amount;
  s.baseBet = amount;
  s.outcomes = [];
  s.insuranceBet = 0;
  s.insuranceNet = 0;
  s.holeCardRevealed = false;
  s.activeHandIndex = 0;

  // Deal order: player, dealer up, player, dealer hole (peek games only —
  // ENHC dealers take their hole card after the players act).
  const p1 = draw(s, true);
  const up = draw(s, true);
  const p2 = draw(s, true);
  s.dealerCards = [up];
  if (s.rules.dealerPeeks) s.dealerCards.push(draw(s, false));
  s.hands = [makeHand([p1, p2], amount)];

  const upValue = cardValue(up.rank);
  const playerBJ = isBlackjack(s.hands[0]);

  if (upValue === 1) {
    // Insurance decision comes before anything else (peek or ENHC).
    s.phase = 'insurance';
    return;
  }

  if (s.rules.dealerPeeks && upValue === 10 && dealerBlackjack(s)) {
    settle(s);
    return;
  }

  if (playerBJ) {
    if (s.rules.dealerPeeks) {
      settle(s); // dealer checked, no natural -> pay 3:2 now
    } else {
      s.hands[0].isResolved = true;
      s.phase = 'dealerTurn'; // ENHC: the dealer's natural can still push
    }
    return;
  }

  advance(s);
}

function resolveInsurance(s: GameState, take: boolean): void {
  if (take) {
    const insBet = s.baseBet / 2;
    if (insBet > s.bankroll) throw new Error('cannot afford insurance');
    s.bankroll -= insBet;
    s.insuranceBet = insBet;
    s.insuranceNet = null; // pending
  }

  if (s.rules.dealerPeeks) {
    if (dealerBlackjack(s)) {
      settle(s);
      return;
    }
    // Peek says no natural: a taken insurance bet is lost immediately.
    if (s.insuranceBet > 0) s.insuranceNet = -s.insuranceBet;
    if (isBlackjack(s.hands[0])) {
      settle(s);
      return;
    }
    advance(s);
    return;
  }

  // ENHC: insurance stays pending until the hole card shows.
  if (isBlackjack(s.hands[0])) {
    s.hands[0].isResolved = true;
    s.phase = 'dealerTurn';
    return;
  }
  advance(s);
}

function applyPlayerAction(s: GameState, action: Action): void {
  const hand = s.hands[s.activeHandIndex];
  const legal = legalActions(hand, s.hands.length, s.rules);
  if (!legal.includes(action)) {
    throw new Error(`illegal action ${action}`);
  }

  switch (action) {
    case 'hit': {
      hand.cards.push(draw(s, true));
      const total = handValue(hand.cards).total;
      if (total >= 21) hand.isResolved = true;
      break;
    }
    case 'stand': {
      hand.isResolved = true;
      break;
    }
    case 'double': {
      if (s.bankroll < hand.bet) throw new Error('cannot afford double');
      s.bankroll -= hand.bet;
      hand.bet *= 2;
      hand.isDoubled = true;
      hand.cards.push(draw(s, true));
      hand.isResolved = true;
      break;
    }
    case 'split': {
      if (s.bankroll < hand.bet) throw new Error('cannot afford split');
      s.bankroll -= hand.bet;
      const [c1, c2] = hand.cards;
      const isAces = cardValue(c1.rank) === 1;
      const first: PlayerHand = {
        ...makeHand([c1], hand.bet),
        isFromSplit: true,
        isSplitAces: isAces,
      };
      const second: PlayerHand = {
        ...makeHand([c2], hand.bet),
        isFromSplit: true,
        isSplitAces: isAces,
      };
      s.hands.splice(s.activeHandIndex, 1, first, second);
      break;
    }
    case 'surrender': {
      hand.isSurrendered = true;
      hand.isResolved = true;
      break;
    }
  }

  if (s.hands[s.activeHandIndex].isResolved) s.activeHandIndex += 1;
  advance(s);
  // advance() may flip us to dealerTurn; if no hand needs the dealer, it
  // still goes through dealerTurn so the hole card reveal stays observable.
}

function dealerStep(s: GameState): void {
  if (!s.holeCardRevealed) {
    if (s.dealerCards.length < 2) s.dealerCards.push(draw(s, false));
    revealHole(s);
    return;
  }
  if (!hasLiveHand(s) || dealerBlackjack(s) || !dealerMustHit(s)) {
    settle(s);
    return;
  }
  s.dealerCards.push(draw(s, true));
}

// ---------------------------------------------------------------------------

export function gameReducer(state: GameState, event: GameEvent, rng: Rng): GameState {
  const s = clone(state);
  switch (event.type) {
    case 'PLACE_BET': {
      if (s.phase !== 'betting') throw new Error(`PLACE_BET in ${s.phase}`);
      startRound(s, event.amount, rng);
      return s;
    }
    case 'INSURANCE': {
      if (s.phase !== 'insurance') throw new Error(`INSURANCE in ${s.phase}`);
      resolveInsurance(s, event.take);
      return s;
    }
    case 'PLAYER_ACTION': {
      if (s.phase !== 'playerTurn') throw new Error(`PLAYER_ACTION in ${s.phase}`);
      applyPlayerAction(s, event.action);
      return s;
    }
    case 'DEALER_STEP': {
      if (s.phase !== 'dealerTurn') throw new Error(`DEALER_STEP in ${s.phase}`);
      dealerStep(s);
      return s;
    }
    case 'NEXT_ROUND': {
      if (s.phase !== 'settlement') throw new Error(`NEXT_ROUND in ${s.phase}`);
      s.phase = 'betting';
      s.hands = [];
      s.dealerCards = [];
      s.holeCardRevealed = false;
      s.outcomes = [];
      s.insuranceBet = 0;
      s.insuranceNet = 0;
      s.activeHandIndex = 0;
      return s;
    }
  }
}
