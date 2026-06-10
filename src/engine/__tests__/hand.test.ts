import { describe, expect, it } from 'vitest';
import { buildShoe, cardValue, freshShoe, shoeComposition } from '../cards';
import { addCardToTotal, handValue, isBlackjack, isPair } from '../hand';
import { mulberry32 } from '../../lib/rng';
import type { Card, Rank } from '../types';

let nextId = 0;
function c(rank: Rank): Card {
  return { rank, suit: 'S', id: nextId++ };
}

describe('cardValue', () => {
  it('maps ranks to value classes', () => {
    expect(cardValue('A')).toBe(1);
    expect(cardValue('2')).toBe(2);
    expect(cardValue('9')).toBe(9);
    expect(cardValue('10')).toBe(10);
    expect(cardValue('J')).toBe(10);
    expect(cardValue('Q')).toBe(10);
    expect(cardValue('K')).toBe(10);
  });
});

describe('handValue', () => {
  it('computes hard totals', () => {
    expect(handValue([c('10'), c('6')])).toEqual({ total: 16, isSoft: false });
    expect(handValue([c('2'), c('3'), c('4')])).toEqual({ total: 9, isSoft: false });
  });

  it('counts one ace as 11 when possible', () => {
    expect(handValue([c('A'), c('6')])).toEqual({ total: 17, isSoft: true });
    expect(handValue([c('A'), c('K')])).toEqual({ total: 21, isSoft: true });
  });

  it('demotes the ace when 11 would bust', () => {
    expect(handValue([c('A'), c('6'), c('10')])).toEqual({ total: 17, isSoft: false });
    expect(handValue([c('A'), c('K'), c('5')])).toEqual({ total: 16, isSoft: false });
  });

  it('handles multiple aces (only one counts as 11)', () => {
    expect(handValue([c('A'), c('A')])).toEqual({ total: 12, isSoft: true });
    expect(handValue([c('A'), c('A'), c('9')])).toEqual({ total: 21, isSoft: true });
    expect(handValue([c('A'), c('A'), c('A'), c('K')])).toEqual({ total: 13, isSoft: false });
    expect(handValue([c('A'), c('A'), c('A'), c('8')])).toEqual({ total: 21, isSoft: true });
    expect(handValue([c('A'), c('A'), c('10'), c('9')])).toEqual({ total: 21, isSoft: false });
  });

  it('detects busts', () => {
    expect(handValue([c('10'), c('9'), c('5')]).total).toBeGreaterThan(21);
  });
});

describe('addCardToTotal', () => {
  it('matches handValue across incremental construction', () => {
    // soft 17 + 10 -> hard 17
    expect(addCardToTotal(17, true, 10)).toEqual({ total: 17, isSoft: false });
    // hard 5 + ace -> soft 16
    expect(addCardToTotal(5, false, 1)).toEqual({ total: 16, isSoft: true });
    // hard 12 + ace -> hard 13 (11 would bust)
    expect(addCardToTotal(12, false, 1)).toEqual({ total: 13, isSoft: false });
    // soft 12 (A,A) + 9 -> soft 21
    expect(addCardToTotal(12, true, 9)).toEqual({ total: 21, isSoft: true });
    // soft 21 + ace -> hard 12 (A,10,A... ace demotes, new ace counts 1)
    expect(addCardToTotal(21, true, 1)).toEqual({ total: 12, isSoft: false });
    // hard 16 + 10 -> hard 26 (bust)
    expect(addCardToTotal(16, false, 10)).toEqual({ total: 26, isSoft: false });
  });
});

describe('isBlackjack', () => {
  it('recognizes a natural', () => {
    expect(isBlackjack({ cards: [c('A'), c('K')], isFromSplit: false })).toBe(true);
    expect(isBlackjack({ cards: [c('A'), c('10')], isFromSplit: false })).toBe(true);
  });

  it('rejects 21 in 3+ cards and split 21s', () => {
    expect(isBlackjack({ cards: [c('7'), c('7'), c('7')], isFromSplit: false })).toBe(false);
    expect(isBlackjack({ cards: [c('A'), c('K')], isFromSplit: true })).toBe(false);
  });
});

describe('isPair', () => {
  it('pairs by value class, so all ten-cards pair together', () => {
    expect(isPair([c('K'), c('Q')])).toBe(true);
    expect(isPair([c('10'), c('J')])).toBe(true);
    expect(isPair([c('A'), c('A')])).toBe(true);
    expect(isPair([c('9'), c('10')])).toBe(false);
  });
});

describe('shoe', () => {
  it('builds decks * 52 unique cards', () => {
    const shoe = buildShoe(6);
    expect(shoe).toHaveLength(312);
    expect(new Set(shoe.map((card) => card.id)).size).toBe(312);
  });

  it('shuffles deterministically with a seeded rng', () => {
    const a = freshShoe(1, mulberry32(42));
    const b = freshShoe(1, mulberry32(42));
    expect(a.map((card) => card.id)).toEqual(b.map((card) => card.id));
    // and it actually permutes
    const unshuffled = buildShoe(1);
    expect(a.map((card) => card.id)).not.toEqual(unshuffled.map((card) => card.id));
  });

  it('composition counts 16 ten-class cards per deck', () => {
    const comp = shoeComposition(2);
    expect(comp[1]).toBe(8);
    expect(comp[5]).toBe(8);
    expect(comp[10]).toBe(32);
    expect(comp.reduce((s, n) => s + n, 0)).toBe(104);
  });
});
