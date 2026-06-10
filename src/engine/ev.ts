import { dealerDistribution, drawProbs, type DealerDistribution } from './dealer';
import { addCardToTotal } from './hand';
import type { CardValue, RuleSet } from './types';

/**
 * Player action EVs, per unit of initial bet, against a fixed dealer upcard.
 *
 * Model notes (shared with dealer.ts): full n-deck shoe minus the upcard,
 * draws with replacement, recursion on (total, isSoft). For peek games the
 * dealer distribution is conditional on "no dealer blackjack", which is the
 * exact situation the player decides in. For ENHC, pBJ stays in the
 * distribution and every unit the player has put out (including doubles and
 * split bets) loses to a dealer natural — that is what makes plays like
 * doubling 11 vs T wrong under ENHC, and it falls out of the math here.
 *
 * Known approximation: the player's own cards are NOT removed from the deck
 * (total-dependent strategy). Composition-dependent single-deck exceptions
 * (e.g. 7,7 vs T stand) are intentionally outside this model; expect ~0.2%
 * EV drift on a handful of single-deck cells.
 */
export interface EvContext {
  readonly upcard: CardValue;
  readonly rules: RuleSet;
  readonly dist: DealerDistribution;
  readonly probs: readonly number[];
  readonly hitMemo: Map<number, number>;
}

export function makeEvContext(upcard: CardValue, rules: RuleSet): EvContext {
  return {
    upcard,
    rules,
    dist: dealerDistribution(upcard, rules),
    probs: drawProbs(upcard, rules),
    hitMemo: new Map(),
  };
}

export function evStand(ctx: EvContext, total: number): number {
  if (total > 21) return -1;
  const d = ctx.dist;
  let ev = d.pBust - d.pBJ; // dealer bust wins; ENHC natural loses (pBJ=0 for peek)
  const finals: Array<[number, number]> = [
    [17, d.p17],
    [18, d.p18],
    [19, d.p19],
    [20, d.p20],
    [21, d.p21],
  ];
  for (const [t, p] of finals) {
    if (total > t) ev += p;
    else if (total < t) ev -= p;
  }
  return ev;
}

export function evHit(ctx: EvContext, total: number, isSoft: boolean): number {
  const key = total * 2 + (isSoft ? 1 : 0);
  const cached = ctx.hitMemo.get(key);
  if (cached !== undefined) return cached;

  let ev = 0;
  for (let v = 1; v <= 10; v++) {
    const p = ctx.probs[v];
    const next = addCardToTotal(total, isSoft, v as CardValue);
    if (next.total > 21) {
      ev -= p;
    } else {
      ev += p * Math.max(evStand(ctx, next.total), evHit(ctx, next.total, next.isSoft));
    }
  }
  ctx.hitMemo.set(key, ev);
  return ev;
}

/** One forced card, doubled stake. Busting or a dealer natural (ENHC) costs 2. */
export function evDouble(ctx: EvContext, total: number, isSoft: boolean): number {
  let ev = 0;
  for (let v = 1; v <= 10; v++) {
    const p = ctx.probs[v];
    const next = addCardToTotal(total, isSoft, v as CardValue);
    if (next.total > 21) {
      ev -= 2 * p;
    } else {
      ev += p * 2 * evStand(ctx, next.total);
    }
  }
  return ev;
}

export function evSurrender(): number {
  return -0.5;
}

/** Whether a freshly-made two-card post-split hand may double under the rules. */
function postSplitDoubleAllowed(total: number, isSoft: boolean, rules: RuleSet): boolean {
  if (!rules.doubleAfterSplit) return false;
  if (rules.doubleRestriction === 'any2') return true;
  if (isSoft) return false;
  const min = rules.doubleRestriction === '9-11' ? 9 : 10;
  return total >= min && total <= 11;
}

/**
 * Standard split approximation: 2 x EV of a single post-split hand that
 * draws its second card and then plays on (no resplits modelled — affects EV
 * by <0.05% and essentially never flips a decision). Split aces get exactly
 * one card and stand; a resulting 21 is not a natural.
 */
export function evSplit(ctx: EvContext, pairValue: CardValue): number {
  const { probs, rules } = ctx;

  if (pairValue === 1) {
    let ev = 0;
    for (let v = 1; v <= 10; v++) {
      const next = addCardToTotal(11, true, v as CardValue);
      ev += probs[v] * evStand(ctx, next.total);
    }
    return 2 * ev;
  }

  let ev = 0;
  const startTotal = pairValue; // single hard card
  for (let v = 1; v <= 10; v++) {
    const next = addCardToTotal(startTotal, false, v as CardValue);
    let best = Math.max(
      evStand(ctx, next.total),
      evHit(ctx, next.total, next.isSoft),
    );
    if (postSplitDoubleAllowed(next.total, next.isSoft, rules)) {
      best = Math.max(best, evDouble(ctx, next.total, next.isSoft));
    }
    ev += probs[v] * best;
  }
  return 2 * ev;
}

/**
 * EV per unit of insurance side bet (pays 2:1 when the hole card is a ten).
 * Negative off the top of a shoe; positive once tens are rich enough — the
 * Hi-Lo index for taking it is TC >= +3.
 */
export function insuranceEv(rules: RuleSet): number {
  const pTen = drawProbs(1, rules)[10];
  return 3 * pTen - 1;
}
