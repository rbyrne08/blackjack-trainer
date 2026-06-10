import { describe, expect, it } from 'vitest';
import {
  availableActions,
  createStateWithShoe,
  gameReducer,
} from '../game';
import { DEFAULT_RULES } from '../rules';
import { mulberry32 } from '../../lib/rng';
import type { Action, Card, GameState, Rank, RuleSet } from '../types';

const rng = mulberry32(7);

function cardsOf(...ranks: Rank[]): Card[] {
  return ranks.map((rank, i) => ({ rank, suit: 'C' as const, id: i }));
}

function rules(overrides: Partial<RuleSet> = {}): RuleSet {
  return { ...DEFAULT_RULES, ...overrides };
}

/** Start a round with a stacked shoe (deal order: P, Up, P, Hole for peek). */
function deal(
  shoe: Rank[],
  r: RuleSet = DEFAULT_RULES,
  opts: { bankroll?: number; bet?: number } = {},
): GameState {
  const state = createStateWithShoe(r, cardsOf(...shoe), {
    bankroll: opts.bankroll ?? 1000,
  });
  return gameReducer(state, { type: 'PLACE_BET', amount: opts.bet ?? 10 }, rng);
}

function act(state: GameState, action: Action): GameState {
  return gameReducer(state, { type: 'PLAYER_ACTION', action }, rng);
}

function playOutDealer(state: GameState): GameState {
  let s = state;
  let guard = 0;
  while (s.phase === 'dealerTurn') {
    s = gameReducer(s, { type: 'DEALER_STEP' }, rng);
    if (++guard > 30) throw new Error('dealer loop runaway');
  }
  return s;
}

describe('round flow', () => {
  it('plays a simple stand-and-win round with correct count tracking', () => {
    let s = deal(['10', '7', '9', '10']);
    expect(s.phase).toBe('playerTurn');
    // exposed so far: T(-1), 7(0), 9(0); hole stays uncounted
    expect(s.runningCount).toBe(-1);
    expect(s.bankroll).toBe(990);

    s = act(s, 'stand');
    expect(s.phase).toBe('dealerTurn');
    s = playOutDealer(s);
    expect(s.phase).toBe('settlement');
    expect(s.holeCardRevealed).toBe(true);
    expect(s.runningCount).toBe(-2); // hole ten revealed
    expect(s.dealerCards).toHaveLength(2); // dealer stands on 17
    expect(s.outcomes[0]).toMatchObject({ result: 'win', net: 10 });
    expect(s.bankroll).toBe(1010);
  });

  it('pays a natural 3:2 immediately in a peek game', () => {
    const s = deal(['A', '9', 'K', '7']);
    expect(s.phase).toBe('settlement');
    expect(s.outcomes[0]).toMatchObject({ result: 'blackjack', net: 15 });
    expect(s.bankroll).toBe(1015);
    expect(s.holeCardRevealed).toBe(true);
  });

  it('pays a natural 6:5 under that rule', () => {
    const s = deal(['A', '9', 'K', '7'], rules({ blackjackPayout: 1.2 }));
    expect(s.outcomes[0]).toMatchObject({ result: 'blackjack', net: 12 });
    expect(s.bankroll).toBe(1012);
  });

  it('ends the round at the peek when the dealer has a ten-up natural', () => {
    const s = deal(['10', 'K', '6', 'A']);
    expect(s.phase).toBe('settlement');
    expect(s.outcomes[0]).toMatchObject({ result: 'lose', net: -10 });
    expect(s.bankroll).toBe(990);
    expect(s.runningCount).toBe(-2); // T, K, 6, A all exposed at settlement
  });

  it('auto-stands a hand that hits to 21 and beats dealer soft 20', () => {
    let s = deal(['5', 'A', '6', '9', 'K']);
    expect(s.phase).toBe('insurance');
    s = gameReducer(s, { type: 'INSURANCE', take: false }, rng);
    expect(s.phase).toBe('playerTurn');
    s = act(s, 'hit'); // 11 + K = 21, auto-resolved
    expect(s.phase).toBe('dealerTurn');
    s = playOutDealer(s);
    expect(s.dealerCards).toHaveLength(2); // soft 20 stands
    expect(s.outcomes[0]).toMatchObject({ result: 'win' });
    expect(s.bankroll).toBe(1010);
  });

  it('throws on an unaffordable bet', () => {
    const state = createStateWithShoe(DEFAULT_RULES, cardsOf('2', '3', '4', '5'), {
      bankroll: 5,
    });
    expect(() => gameReducer(state, { type: 'PLACE_BET', amount: 10 }, rng)).toThrow();
  });
});

describe('insurance', () => {
  it('insurance pays 2:1 when the dealer has the natural', () => {
    let s = deal(['8', 'A', '7', 'K']);
    expect(s.phase).toBe('insurance');
    s = gameReducer(s, { type: 'INSURANCE', take: true }, rng);
    expect(s.phase).toBe('settlement');
    expect(s.insuranceNet).toBe(10); // 5 staked, 15 returned
    expect(s.outcomes[0]).toMatchObject({ result: 'lose', net: -10 });
    expect(s.bankroll).toBe(1000); // -10 hand, +10 insurance
  });

  it('loses a taken insurance bet immediately after a clear peek', () => {
    let s = deal(['5', 'A', '6', '9', 'K', '4']);
    s = gameReducer(s, { type: 'INSURANCE', take: true }, rng);
    expect(s.phase).toBe('playerTurn');
    expect(s.insuranceNet).toBe(-5);
  });

  it('keeps ENHC insurance pending until the hole card shows', () => {
    let s = deal(
      ['8', 'A', '7', '9', '5'],
      rules({ dealerPeeks: false, lateSurrender: false }),
    );
    expect(s.phase).toBe('insurance');
    s = gameReducer(s, { type: 'INSURANCE', take: true }, rng);
    expect(s.insuranceNet).toBeNull(); // pending
    s = act(s, 'stand');
    s = playOutDealer(s); // hole 9 -> soft 20, no natural
    expect(s.insuranceNet).toBe(-5);
    expect(s.outcomes[0]).toMatchObject({ result: 'lose' }); // 15 vs 20
  });
});

describe('splits and doubles', () => {
  it('handles split, DAS double, and per-hand settlement', () => {
    let s = deal(['8', '6', '8', '10', '3', '10', '10', '10']);
    expect(availableActions(s)).toContain('split');
    s = act(s, 'split');
    expect(s.hands).toHaveLength(2);
    expect(s.hands[0].cards.map((c) => c.rank)).toEqual(['8', '3']); // drew its second card
    expect(availableActions(s)).toContain('double'); // DAS
    s = act(s, 'double');
    expect(s.hands[0].bet).toBe(20);
    expect(s.activeHandIndex).toBe(1);
    expect(s.hands[1].cards.map((c) => c.rank)).toEqual(['8', '10']);
    s = act(s, 'stand');
    s = playOutDealer(s); // 16 draws T, busts
    expect(s.outcomes).toEqual([
      expect.objectContaining({ result: 'win', net: 20 }),
      expect.objectContaining({ result: 'win', net: 10 }),
    ]);
    expect(s.bankroll).toBe(1030);
  });

  it('denies the DAS double when the rule is off', () => {
    let s = deal(['8', '6', '8', '10', '3'], rules({ doubleAfterSplit: false }));
    s = act(s, 'split');
    expect(availableActions(s)).not.toContain('double');
  });

  it('gives split aces one card each, and their 21 is not a natural', () => {
    let s = deal(['A', '6', 'A', '10', 'K', '5', '9']);
    s = act(s, 'split');
    expect(s.phase).toBe('dealerTurn'); // both hands auto-resolved
    expect(s.hands[0].cards.map((c) => c.rank)).toEqual(['A', 'K']);
    expect(s.hands[1].cards.map((c) => c.rank)).toEqual(['A', '5']);
    s = playOutDealer(s); // 16 hits 9 -> bust
    // 21 from split aces pays even money, not 3:2
    expect(s.outcomes[0]).toMatchObject({ result: 'win', net: 10 });
    expect(s.outcomes[1]).toMatchObject({ result: 'win', net: 10 });
    expect(s.bankroll).toBe(1020);
  });

  it('enforces the resplit cap', () => {
    let s = deal(['8', '6', '8', '10', '8', '2', '3', '10', '9', '9', '9'], rules({ maxSplitHands: 3 }));
    s = act(s, 'split');
    expect(s.hands[0].cards.map((c) => c.rank)).toEqual(['8', '8']);
    expect(availableActions(s)).toContain('split'); // 2 hands < cap 3
    s = act(s, 'split');
    expect(s.hands).toHaveLength(3);
    expect(s.hands[0].cards.map((c) => c.rank)).toEqual(['8', '2']);
    expect(availableActions(s)).not.toContain('split'); // at cap now
  });

  it('filters double/split the player cannot afford', () => {
    const s = deal(['8', '6', '8', '10'], DEFAULT_RULES, { bankroll: 15 });
    expect(availableActions(s)).toEqual(expect.arrayContaining(['hit', 'stand']));
    expect(availableActions(s)).not.toContain('double');
    expect(availableActions(s)).not.toContain('split');
  });
});

describe('surrender', () => {
  it('returns half the bet and skips dealer drawing', () => {
    let s = deal(['10', '9', '6', 'K']);
    s = act(s, 'surrender');
    s = playOutDealer(s);
    expect(s.outcomes[0]).toMatchObject({ result: 'surrender', net: -5 });
    expect(s.bankroll).toBe(995);
    expect(s.dealerCards).toHaveLength(2); // dealer never drew
  });
});

describe('soft 17 rule', () => {
  it('S17 dealer stands on soft 17 and loses to 20', () => {
    let s = deal(['10', 'A', '10', '6', '4'], rules({ dealerHitsSoft17: false }));
    s = gameReducer(s, { type: 'INSURANCE', take: false }, rng);
    s = act(s, 'stand');
    s = playOutDealer(s);
    expect(s.dealerCards).toHaveLength(2);
    expect(s.outcomes[0]).toMatchObject({ result: 'win' });
  });

  it('H17 dealer hits soft 17 and makes 21', () => {
    let s = deal(['10', 'A', '10', '6', '4'], rules({ dealerHitsSoft17: true }));
    s = gameReducer(s, { type: 'INSURANCE', take: false }, rng);
    s = act(s, 'stand');
    s = playOutDealer(s);
    expect(s.dealerCards).toHaveLength(3); // A,6,4 = 21
    expect(s.outcomes[0]).toMatchObject({ result: 'lose' });
  });
});

describe('ENHC', () => {
  const enhc = rules({ dealerPeeks: false, lateSurrender: false });

  it('deals no hole card until the dealer turn', () => {
    const s = deal(['6', '10', '5', 'K', 'A'], enhc);
    expect(s.dealerCards).toHaveLength(1);
    expect(s.phase).toBe('playerTurn');
  });

  it('a dealer natural takes the doubled bet in full', () => {
    let s = deal(['6', '10', '5', 'K', 'A'], enhc);
    s = act(s, 'double'); // 11 + K = 21
    s = playOutDealer(s); // hole A -> natural
    expect(s.outcomes[0]).toMatchObject({ result: 'lose', net: -20 });
    expect(s.bankroll).toBe(980);
  });

  it('a player natural pushes a dealer natural', () => {
    let s = deal(['A', '10', 'K', 'A'], enhc);
    expect(s.phase).toBe('dealerTurn'); // player BJ waits for the hole card
    s = playOutDealer(s);
    expect(s.outcomes[0]).toMatchObject({ result: 'push', net: 0 });
    expect(s.bankroll).toBe(1000);
  });
});

describe('shoe lifecycle', () => {
  it('schedules and performs a reshuffle once penetration is passed', () => {
    // 23-card stacked shoe: one 4-card round leaves 19, under the 20-card floor.
    const shoe: Rank[] = ['10', '7', '9', '10', '2', '2', '2', '2', '2', '2', '2', '2', '2', '2', '2', '2', '2', '2', '2', '2', '2', '2', '2'];
    let s = createStateWithShoe(rules({ decks: 1 }), cardsOf(...shoe));
    s = gameReducer(s, { type: 'PLACE_BET', amount: 10 }, rng);
    s = act(s, 'stand');
    s = playOutDealer(s);
    expect(s.needsShuffle).toBe(true);

    const oldShoe = s.shoe;
    s = gameReducer(s, { type: 'NEXT_ROUND' }, rng);
    expect(s.phase).toBe('betting');
    s = gameReducer(s, { type: 'PLACE_BET', amount: 10 }, rng);
    expect(s.shoe).not.toBe(oldShoe);
    expect(s.shoe).toHaveLength(52); // fresh single deck
    expect(s.dealtCount).toBeGreaterThanOrEqual(3); // new round dealt from it
    expect(s.roundsSinceShuffle).toBe(0);
    expect(s.needsShuffle).toBe(false);
  });

  it('busting every hand still reveals the hole card for the count', () => {
    let s = deal(['10', '7', '6', '9', 'K']);
    s = act(s, 'hit'); // 16 + K busts
    expect(s.phase).toBe('dealerTurn');
    s = playOutDealer(s);
    expect(s.holeCardRevealed).toBe(true);
    expect(s.dealerCards).toHaveLength(2);
    expect(s.outcomes[0]).toMatchObject({ result: 'lose', net: -10 });
  });
});
