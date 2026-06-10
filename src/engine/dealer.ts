import { shoeComposition } from './cards';
import { addCardToTotal } from './hand';
import { rulesHash } from './rules';
import type { CardValue, RuleSet } from './types';

/**
 * Probability distribution over the dealer's final outcome, given the upcard.
 *
 * Model: fixed composition of the full n-deck shoe with only the upcard
 * removed; draws are sampled WITH replacement (constant probabilities). This
 * is the total-dependent approximation that published basic strategy charts
 * are built on. For peek games (American hole card) with an A or T up, the
 * hole-card draw excludes the blackjack-completing rank and renormalizes,
 * which makes the whole distribution conditional on "no dealer blackjack" —
 * exactly the situation in which the player makes decisions. For ENHC the
 * natural stays in the distribution as pBJ.
 */
export interface DealerDistribution {
  p17: number;
  p18: number;
  p19: number;
  p20: number;
  /** 21 made with three or more cards (not a natural). */
  p21: number;
  /** Two-card natural. Always 0 when the dealer peeks. */
  pBJ: number;
  pBust: number;
}

/**
 * Per-value draw probabilities for everything dealt this round: the full shoe
 * minus the dealer upcard, with replacement. Index by CardValue 1..10.
 */
export function drawProbs(upcard: CardValue, rules: RuleSet): readonly number[] {
  const comp = shoeComposition(rules.decks);
  comp[upcard] -= 1;
  const total = comp.reduce((s, n) => s + n, 0);
  return comp.map((n) => n / total);
}

function dealerStands(total: number, isSoft: boolean, hitsSoft17: boolean): boolean {
  if (total >= 18) return true;
  if (total === 17) return !(isSoft && hitsSoft17);
  return false;
}

// Buckets used by the internal DP: [17, 18, 19, 20, 21, bust].
type Buckets = [number, number, number, number, number, number];

const cache = new Map<string, DealerDistribution>();

export function dealerDistribution(
  upcard: CardValue,
  rules: RuleSet,
  /**
   * Test hook: explicit rank counts (index 1..10, only ratios matter) used
   * as-is — no upcard removal, no caching. Lets tests pin the exact
   * infinite-deck model (p(v)=1/13, p(T)=4/13).
   */
  compositionOverride?: readonly number[],
): DealerDistribution {
  const key = `${upcard}|${rulesHash(rules)}`;
  if (!compositionOverride) {
    const hit = cache.get(key);
    if (hit) return hit;
  }

  let probs: readonly number[];
  if (compositionOverride) {
    const total = compositionOverride.reduce((s, n) => s + n, 0);
    probs = compositionOverride.map((n) => n / total);
  } else {
    probs = drawProbs(upcard, rules);
  }

  const h17 = rules.dealerHitsSoft17;

  // Final-outcome distribution from a dealer state that must still draw.
  const memo = new Map<number, Buckets>();
  function fromState(total: number, isSoft: boolean): Buckets {
    const memoKey = total * 2 + (isSoft ? 1 : 0);
    const found = memo.get(memoKey);
    if (found) return found;
    const out: Buckets = [0, 0, 0, 0, 0, 0];
    for (let v = 1 as CardValue; v <= 10; v++) {
      const p = probs[v];
      if (p === 0) continue;
      const next = addCardToTotal(total, isSoft, v as CardValue);
      if (next.total > 21) {
        out[5] += p;
      } else if (dealerStands(next.total, next.isSoft, h17)) {
        out[next.total - 17] += p;
      } else {
        const sub = fromState(next.total, next.isSoft);
        for (let i = 0; i < 6; i++) out[i] += p * sub[i];
      }
    }
    memo.set(memoKey, out);
    return out;
  }

  const startTotal = upcard === 1 ? 11 : upcard;
  const startSoft = upcard === 1;

  // Hole-card (first-draw) probabilities, peek-conditioned when applicable.
  const canBJ = upcard === 1 || upcard === 10;
  const bjRank: CardValue | null = upcard === 1 ? 10 : upcard === 10 ? 1 : null;
  let firstProbs = probs;
  if (rules.dealerPeeks && canBJ && bjRank !== null) {
    const pExcluded = probs[bjRank];
    firstProbs = probs.map((p, v) => (v === bjRank ? 0 : p / (1 - pExcluded)));
  }

  const buckets: Buckets = [0, 0, 0, 0, 0, 0];
  let pBJ = 0;
  for (let v = 1 as CardValue; v <= 10; v++) {
    const p = firstProbs[v];
    if (p === 0) continue;
    const next = addCardToTotal(startTotal, startSoft, v as CardValue);
    if (canBJ && next.total === 21) {
      pBJ += p; // two-card natural (only reachable from A or T upcards)
    } else if (dealerStands(next.total, next.isSoft, h17)) {
      buckets[next.total - 17] += p;
    } else {
      const sub = fromState(next.total, next.isSoft);
      for (let i = 0; i < 6; i++) buckets[i] += p * sub[i];
    }
  }

  const dist: DealerDistribution = {
    p17: buckets[0],
    p18: buckets[1],
    p19: buckets[2],
    p20: buckets[3],
    p21: buckets[4],
    pBJ,
    pBust: buckets[5],
  };
  if (!compositionOverride) cache.set(key, dist);
  return dist;
}
