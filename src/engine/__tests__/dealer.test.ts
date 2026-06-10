import { describe, expect, it } from 'vitest';
import { shoeComposition } from '../cards';
import { addCardToTotal } from '../hand';
import { dealerDistribution, type DealerDistribution } from '../dealer';
import { DEFAULT_RULES } from '../rules';
import type { CardValue, RuleSet } from '../types';

function rules(overrides: Partial<RuleSet> = {}): RuleSet {
  return { ...DEFAULT_RULES, ...overrides };
}

const ALL_UPCARDS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10] as const;

/** Infinite deck: only ratios matter, so one of each pip and four tens. */
const INFINITE = [0, 1, 1, 1, 1, 1, 1, 1, 1, 1, 4];

function sumDist(d: DealerDistribution): number {
  return d.p17 + d.p18 + d.p19 + d.p20 + d.p21 + d.pBJ + d.pBust;
}

/**
 * Independent reference: plain tree recursion with no memoization and its own
 * stand logic, over the same with-replacement model. Guards against DP bugs
 * (memo key collisions, bucket misassignment) in the production implementation.
 */
function bruteForce(upcard: CardValue, r: RuleSet): DealerDistribution {
  const comp = shoeComposition(r.decks);
  comp[upcard] -= 1;
  const totalCards = comp.reduce((s, n) => s + n, 0);
  const probs = comp.map((n) => n / totalCards);

  const acc = { p17: 0, p18: 0, p19: 0, p20: 0, p21: 0, pBJ: 0, pBust: 0 };

  function walk(total: number, soft: boolean, p: number, cardsDrawn: number): void {
    if (total > 21) {
      acc.pBust += p;
      return;
    }
    const standsHard17 = total === 17 && !soft;
    const standsSoft17 = total === 17 && soft && !r.dealerHitsSoft17;
    if (total >= 18 || standsHard17 || standsSoft17) {
      if (total === 21 && cardsDrawn === 1 && (upcard === 1 || upcard === 10)) {
        acc.pBJ += p;
      } else {
        if (total === 17) acc.p17 += p;
        if (total === 18) acc.p18 += p;
        if (total === 19) acc.p19 += p;
        if (total === 20) acc.p20 += p;
        if (total === 21) acc.p21 += p;
      }
      return;
    }
    for (let v = 1; v <= 10; v++) {
      let drawP = probs[v];
      if (cardsDrawn === 0 && r.dealerPeeks) {
        // peek: hole card cannot complete a natural
        if (upcard === 1 && v === 10) continue;
        if (upcard === 10 && v === 1) continue;
        if (upcard === 1) drawP = probs[v] / (1 - probs[10]);
        if (upcard === 10) drawP = probs[v] / (1 - probs[1]);
      }
      const next = addCardToTotal(total, soft, v as CardValue);
      walk(next.total, next.isSoft, p * drawP, cardsDrawn + 1);
    }
  }

  walk(upcard === 1 ? 11 : upcard, upcard === 1, 1, 0);
  return acc;
}

describe('dealerDistribution', () => {
  it('sums to 1 across upcards, peek modes, soft-17 rules, and deck counts', () => {
    for (const decks of [1, 2, 6, 8] as const) {
      for (const peek of [true, false]) {
        for (const h17 of [true, false]) {
          const r = rules({ decks, dealerPeeks: peek, dealerHitsSoft17: h17 });
          for (const up of ALL_UPCARDS) {
            expect(sumDist(dealerDistribution(up, r))).toBeCloseTo(1, 9);
          }
        }
      }
    }
  });

  it('matches an independent brute-force enumeration on every upcard', () => {
    for (const peek of [true, false]) {
      for (const h17 of [true, false]) {
        const r = rules({ decks: 2, dealerPeeks: peek, dealerHitsSoft17: h17 });
        for (const up of ALL_UPCARDS) {
          const fast = dealerDistribution(up, r);
          const slow = bruteForce(up, r);
          expect(fast.p17).toBeCloseTo(slow.p17, 9);
          expect(fast.p18).toBeCloseTo(slow.p18, 9);
          expect(fast.p19).toBeCloseTo(slow.p19, 9);
          expect(fast.p20).toBeCloseTo(slow.p20, 9);
          expect(fast.p21).toBeCloseTo(slow.p21, 9);
          expect(fast.pBJ).toBeCloseTo(slow.pBJ, 9);
          expect(fast.pBust).toBeCloseTo(slow.pBust, 9);
        }
      }
    }
  });

  it('peek games have zero natural probability (conditioned out)', () => {
    const r = rules({ dealerPeeks: true });
    expect(dealerDistribution(1, r).pBJ).toBe(0);
    expect(dealerDistribution(10, r).pBJ).toBe(0);
  });

  it('ENHC keeps the natural in the distribution at exactly the hole-card rate', () => {
    const r = rules({ decks: 6, dealerPeeks: false });
    // Ace up: natural iff hole card is a ten -> 96 tens / 311 remaining cards.
    expect(dealerDistribution(1, r).pBJ).toBeCloseTo(96 / 311, 12);
    // Ten up: natural iff hole card is an ace -> 24 aces / 311 remaining.
    expect(dealerDistribution(10, r).pBJ).toBeCloseTo(24 / 311, 12);
    // Pip upcards can never have a natural.
    expect(dealerDistribution(6, r).pBJ).toBe(0);
  });

  it('H17 hits soft 17: fewer 17s, more of everything else, with ace up', () => {
    const s17 = dealerDistribution(1, rules({ dealerHitsSoft17: false }));
    const h17 = dealerDistribution(1, rules({ dealerHitsSoft17: true }));
    expect(h17.p17).toBeLessThan(s17.p17);
    expect(h17.pBust).toBeGreaterThan(s17.pBust);
    // Upcard 8 can still reach soft 17 (e.g. 8 + A + ... never: 8+A=19 soft).
    // A hard upcard whose only path to soft 17 is impossible: 8 + A = soft 19,
    // and any soft total only grows. So H17 = S17 exactly for upcard 8.
    const s17up8 = dealerDistribution(8, rules({ dealerHitsSoft17: false }));
    const h17up8 = dealerDistribution(8, rules({ dealerHitsSoft17: true }));
    expect(h17up8).toEqual(s17up8);
  });

  it('matches the published infinite-deck S17 dealer bust anchor for upcard 6', () => {
    // Wizard of Odds infinite-deck S17 table: P(bust | 6 up) ~= 0.4222
    const d = dealerDistribution(6, rules({ dealerHitsSoft17: false }), INFINITE);
    expect(d.pBust).toBeGreaterThan(0.41);
    expect(d.pBust).toBeLessThan(0.435);
  });

  it('dealer bust probability peaks at upcard 6 among 2..6 and is low for T/A', () => {
    const r = rules();
    const bust = (up: CardValue) => dealerDistribution(up, r).pBust;
    expect(bust(6)).toBeGreaterThan(bust(2));
    expect(bust(6)).toBeGreaterThan(bust(10));
    // Peek-conditioned ace is the strongest dealer card: lowest bust rate.
    for (const up of [2, 3, 4, 5, 6, 7, 8, 9, 10] as const) {
      expect(bust(1)).toBeLessThan(bust(up));
    }
  });
});
