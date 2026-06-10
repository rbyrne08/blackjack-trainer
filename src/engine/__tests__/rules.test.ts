import { describe, expect, it } from 'vitest';
import { DEFAULT_RULES, legalActions, rulesHash } from '../rules';
import type { Card, PlayerHand, Rank, RuleSet } from '../types';

let nextId = 0;
function c(rank: Rank): Card {
  return { rank, suit: 'H', id: nextId++ };
}

function hand(ranks: Rank[], overrides: Partial<PlayerHand> = {}): PlayerHand {
  return {
    cards: ranks.map(c),
    bet: 10,
    isDoubled: false,
    isFromSplit: false,
    isSplitAces: false,
    isSurrendered: false,
    isResolved: false,
    ...overrides,
  };
}

function rules(overrides: Partial<RuleSet> = {}): RuleSet {
  return { ...DEFAULT_RULES, ...overrides };
}

describe('rulesHash', () => {
  it('differs when any rule differs', () => {
    const base = rulesHash(DEFAULT_RULES);
    expect(rulesHash(rules({ decks: 1 }))).not.toBe(base);
    expect(rulesHash(rules({ dealerHitsSoft17: true }))).not.toBe(base);
    expect(rulesHash(rules({ dealerPeeks: false }))).not.toBe(base);
    expect(rulesHash(rules({ doubleRestriction: '10-11' }))).not.toBe(base);
  });
});

describe('legalActions', () => {
  it('offers hit/stand/double/surrender on a fresh two-card hand', () => {
    const actions = legalActions(hand(['10', '6']), 1, rules());
    expect(actions).toContain('hit');
    expect(actions).toContain('stand');
    expect(actions).toContain('double');
    expect(actions).toContain('surrender');
    expect(actions).not.toContain('split');
  });

  it('offers split on pairs, including mixed ten-cards', () => {
    expect(legalActions(hand(['K', 'Q']), 1, rules())).toContain('split');
    expect(legalActions(hand(['8', '8']), 1, rules())).toContain('split');
  });

  it('blocks split at the max-hands cap', () => {
    expect(legalActions(hand(['8', '8'], { isFromSplit: true }), 4, rules())).not.toContain('split');
    expect(legalActions(hand(['8', '8'], { isFromSplit: true }), 3, rules())).toContain('split');
  });

  it('removes double after a hit', () => {
    expect(legalActions(hand(['2', '3', '6']), 1, rules())).not.toContain('double');
  });

  it('respects DAS', () => {
    const split = hand(['5', '6'], { isFromSplit: true });
    expect(legalActions(split, 2, rules({ doubleAfterSplit: true }))).toContain('double');
    expect(legalActions(split, 2, rules({ doubleAfterSplit: false }))).not.toContain('double');
  });

  it('respects double restrictions and excludes soft totals from them', () => {
    expect(legalActions(hand(['5', '4']), 1, rules({ doubleRestriction: '9-11' }))).toContain('double');
    expect(legalActions(hand(['5', '4']), 1, rules({ doubleRestriction: '10-11' }))).not.toContain('double');
    expect(legalActions(hand(['A', '8']), 1, rules({ doubleRestriction: '9-11' }))).not.toContain('double');
    expect(legalActions(hand(['A', '8']), 1, rules({ doubleRestriction: 'any2' }))).toContain('double');
  });

  it('limits surrender to the first decision of the original hand', () => {
    expect(legalActions(hand(['10', '6'], { isFromSplit: true }), 2, rules())).not.toContain('surrender');
    expect(legalActions(hand(['10', '2', '4']), 1, rules())).not.toContain('surrender');
    expect(legalActions(hand(['10', '6']), 1, rules({ lateSurrender: false }))).not.toContain('surrender');
    expect(legalActions(hand(['10', '6']), 1, rules({ dealerPeeks: false }))).not.toContain('surrender');
  });

  it('gives split aces no further actions', () => {
    const splitAce = hand(['A', '9'], { isFromSplit: true, isSplitAces: true, isResolved: true });
    expect(legalActions(splitAce, 2, rules())).toEqual([]);
  });

  it('returns nothing on 21 or resolved hands', () => {
    expect(legalActions(hand(['A', 'K']), 1, rules())).toEqual([]);
    expect(legalActions(hand(['10', '6'], { isResolved: true }), 1, rules())).toEqual([]);
  });
});
