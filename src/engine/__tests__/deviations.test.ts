import { describe, expect, it } from 'vitest';
import { applyDeviations, shouldTakeInsurance } from '../deviations';
import { gradeDecision } from '../grading';
import { buildStrategyTable, optimalAction } from '../strategy';
import { legalActions, DEFAULT_RULES } from '../rules';
import { decksRemaining, hiLoTag, recommendedUnits, trueCount } from '../counting';
import type { Action, Card, PlayerHand, Rank, RuleSet } from '../types';

let nextId = 0;
function c(rank: Rank): Card {
  return { rank, suit: 'D', id: nextId++ };
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

/** Convenience: count-adjusted optimal for a fresh two-card hand. */
function countPlay(
  ranks: Rank[],
  dealerUp: 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10,
  tc: number,
  r: RuleSet = DEFAULT_RULES,
): { action: Action; deviationId: string | null } {
  const h = hand(ranks);
  const table = buildStrategyTable(r);
  const legal = legalActions(h, 1, r);
  const basic = optimalAction(table, h, 1, r, dealerUp);
  if (!basic) throw new Error('no decision');
  const res = applyDeviations(basic.action, h.cards, dealerUp, legal, tc, r);
  return { action: res.action, deviationId: res.deviation?.id ?? null };
}

describe('Illustrious 18 / Fab 4', () => {
  const noLs = rules({ lateSurrender: false });

  it('16 v 10 stands at TC >= 0 and hits below (no surrender game)', () => {
    expect(countPlay(['10', '6'], 10, 0, noLs)).toEqual({ action: 'stand', deviationId: 'I18-16vT' });
    expect(countPlay(['10', '6'], 10, -0.5, noLs)).toEqual({ action: 'hit', deviationId: null });
  });

  it('basic-strategy surrender is never overridden by a stand index', () => {
    // 16 v 10 with LS: basic = surrender; I18 stand must not displace it.
    expect(countPlay(['10', '6'], 10, 3)).toEqual({ action: 'surrender', deviationId: null });
  });

  it('Fab 4: 15 v 10 surrenders at TC >= 0 but hits below', () => {
    // At TC 0 surrender is also the basic play -> no deviation flagged.
    expect(countPlay(['10', '5'], 10, 0)).toEqual({ action: 'surrender', deviationId: null });
    // Below the index the deviation is to NOT surrender.
    expect(countPlay(['10', '5'], 10, -1)).toEqual({ action: 'hit', deviationId: 'F4-15vT' });
  });

  it('15 v 10 without surrender stands at TC >= +4', () => {
    expect(countPlay(['10', '5'], 10, 4, noLs)).toEqual({ action: 'stand', deviationId: 'I18-15vT' });
    expect(countPlay(['10', '5'], 10, 3.5, noLs)).toEqual({ action: 'hit', deviationId: null });
  });

  it('14 v 10 surrenders at TC >= +3', () => {
    expect(countPlay(['10', '4'], 10, 3)).toEqual({ action: 'surrender', deviationId: 'F4-14vT' });
    expect(countPlay(['10', '4'], 10, 2)).toEqual({ action: 'hit', deviationId: null });
  });

  it('T,T splits against 5 and 6 at high counts', () => {
    expect(countPlay(['K', 'Q'], 6, 4)).toEqual({ action: 'split', deviationId: 'I18-TTv6' });
    expect(countPlay(['K', 'Q'], 6, 3.9)).toEqual({ action: 'stand', deviationId: null });
    expect(countPlay(['K', 'Q'], 5, 5)).toEqual({ action: 'split', deviationId: 'I18-TTv5' });
    expect(countPlay(['K', 'Q'], 5, 4.5)).toEqual({ action: 'stand', deviationId: null });
  });

  it('negative indices: 13 v 2 hits below TC -1; 12 v 5 hits below TC -2', () => {
    expect(countPlay(['10', '3'], 2, -1.5)).toEqual({ action: 'hit', deviationId: 'I18-13v2' });
    expect(countPlay(['10', '3'], 2, -1)).toEqual({ action: 'stand', deviationId: null });
    expect(countPlay(['10', '2'], 5, -2.5)).toEqual({ action: 'hit', deviationId: 'I18-12v5' });
    expect(countPlay(['10', '2'], 5, 0)).toEqual({ action: 'stand', deviationId: null });
  });

  it('11 v A doubles at TC >= +1 under S17 only', () => {
    expect(countPlay(['6', '5'], 1, 1)).toEqual({ action: 'double', deviationId: 'I18-11vA' });
    expect(countPlay(['6', '5'], 1, 0.5)).toEqual({ action: 'hit', deviationId: null });
    // H17: doubling 11 v A is already basic strategy, entry must not fire.
    const h17 = rules({ dealerHitsSoft17: true });
    expect(countPlay(['6', '5'], 1, 1, h17)).toEqual({ action: 'double', deviationId: null });
  });

  it('10 v A uses the H17 index override (+3 instead of +4)', () => {
    expect(countPlay(['6', '4'], 1, 3.5)).toEqual({ action: 'hit', deviationId: null });
    const h17 = rules({ dealerHitsSoft17: true });
    expect(countPlay(['6', '4'], 1, 3.5, h17)).toEqual({ action: 'double', deviationId: 'I18-10vA' });
  });

  it('falls back to basic when the deviation action is illegal', () => {
    // Three-card 9 v 2 cannot double; the +1 index play degrades to hit.
    const h = hand(['2', '3', '4']);
    const table = buildStrategyTable(DEFAULT_RULES);
    const legal = legalActions(h, 1, DEFAULT_RULES);
    const basic = optimalAction(table, h, 1, DEFAULT_RULES, 2);
    const res = applyDeviations(basic!.action, h.cards, 2, legal, 2, DEFAULT_RULES);
    expect(res).toMatchObject({ action: 'hit', deviation: null });
  });

  it('pair hands only match pair entries (8,8 v 10 is not hard 16)', () => {
    expect(countPlay(['8', '8'], 10, 2)).toEqual({ action: 'split', deviationId: null });
  });

  it('insurance index is +3', () => {
    expect(shouldTakeInsurance(3)).toBe(true);
    expect(shouldTakeInsurance(2.9)).toBe(false);
    expect(shouldTakeInsurance(null)).toBe(false);
  });
});

describe('gradeDecision', () => {
  const table = buildStrategyTable(DEFAULT_RULES);

  it('grades a correct basic-strategy play with zero cost', () => {
    const g = gradeDecision({
      hand: hand(['10', '6']),
      handCount: 1,
      dealerUp: 10,
      rules: DEFAULT_RULES,
      table,
      chosen: 'surrender',
      trueCount: null,
    });
    expect(g.isCorrect).toBe(true);
    expect(g.evCost).toBe(0);
    expect(g.cellKey).toBe('H16|10');
  });

  it('prices a basic-strategy mistake in EV', () => {
    const g = gradeDecision({
      hand: hand(['10', '10']),
      handCount: 1,
      dealerUp: 6,
      rules: DEFAULT_RULES,
      table,
      chosen: 'hit',
      trueCount: null,
    });
    expect(g.isCorrect).toBe(false);
    expect(g.optimal).toBe('stand');
    expect(g.evCost).toBeGreaterThan(0.5); // hitting 20 v 6 is catastrophic
  });

  it('grades against the deviation play in counting mode', () => {
    const g = gradeDecision({
      hand: hand(['10', '2']),
      handCount: 1,
      dealerUp: 2,
      rules: DEFAULT_RULES,
      table,
      chosen: 'hit',
      trueCount: 3,
    });
    expect(g.optimal).toBe('stand');
    expect(g.isCorrect).toBe(false);
    expect(g.deviation?.id).toBe('I18-12v2');
    expect(g.evCost).toBe(0); // neutral table cannot price a count error
  });
});

describe('counting helpers', () => {
  it('tags cards with Hi-Lo values', () => {
    expect(hiLoTag(2)).toBe(1);
    expect(hiLoTag(6)).toBe(1);
    expect(hiLoTag(7)).toBe(0);
    expect(hiLoTag(9)).toBe(0);
    expect(hiLoTag(10)).toBe(-1);
    expect(hiLoTag(1)).toBe(-1);
  });

  it('estimates decks remaining to the nearest half deck with a floor', () => {
    expect(decksRemaining(312, 0)).toBe(6);
    expect(decksRemaining(312, 130)).toBe(3.5);
    expect(decksRemaining(52, 50)).toBe(0.5);
  });

  it('computes the true count from the half-deck estimate', () => {
    expect(trueCount(6, 312, 156)).toBe(2); // +6 over 3 decks
    expect(trueCount(-4, 104, 52)).toBe(-4); // -4 over 1 deck
  });

  it('maps true counts onto the bet ramp', () => {
    expect(recommendedUnits(-1)).toBe(1);
    expect(recommendedUnits(1.9)).toBe(1);
    expect(recommendedUnits(2)).toBe(2);
    expect(recommendedUnits(3.4)).toBe(4);
    expect(recommendedUnits(4)).toBe(8);
    expect(recommendedUnits(7)).toBe(12);
  });
});
