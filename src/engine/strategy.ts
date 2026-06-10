import { cardValue } from './cards';
import {
  evDouble,
  evHit,
  evSplit,
  evStand,
  evSurrender,
  insuranceEv,
  makeEvContext,
  type EvContext,
} from './ev';
import { handValue, isPair } from './hand';
import { legalActions, rulesHash } from './rules';
import type { Action, Card, CardValue, PlayerHand, RuleSet } from './types';

export interface RatedAction {
  action: Action;
  /** EV per unit of initial bet. */
  ev: number;
}

/**
 * Full strategy table for a rule set. Cells are keyed `${cellKey}|${upcard}`
 * where cellKey is H4..H21 (hard), S12..S21 (soft), or P1..P10 (pairs, P1 =
 * aces), and upcard is the value class 1..10.
 *
 * Each cell holds EVERY in-principle action sorted by EV descending. At
 * decision time the optimal action is the highest-EV action that is currently
 * legal — this resolves "can't double on 3 cards", split caps, and
 * surrender-only-first without baking those dynamics into the table.
 */
export interface StrategyTable {
  hash: string;
  cells: Record<string, RatedAction[]>;
  /** EV per unit of insurance side bet (always negative off the top). */
  insuranceEv: number;
}

const tableCache = new Map<string, StrategyTable>();

function doubleAllowedAtBuild(total: number, isSoft: boolean, rules: RuleSet): boolean {
  if (rules.doubleRestriction === 'any2') return true;
  if (isSoft) return false;
  const min = rules.doubleRestriction === '9-11' ? 9 : 10;
  return total >= min && total <= 11;
}

function ratedCell(
  ctx: EvContext,
  total: number,
  isSoft: boolean,
  opts: { pairValue?: CardValue; surrenderAllowed: boolean },
): RatedAction[] {
  const rules = ctx.rules;
  const rated: RatedAction[] = [
    { action: 'stand', ev: evStand(ctx, total) },
    { action: 'hit', ev: evHit(ctx, total, isSoft) },
  ];
  if (doubleAllowedAtBuild(total, isSoft, rules)) {
    rated.push({ action: 'double', ev: evDouble(ctx, total, isSoft) });
  }
  if (opts.pairValue !== undefined) {
    rated.push({ action: 'split', ev: evSplit(ctx, opts.pairValue) });
  }
  if (opts.surrenderAllowed) {
    rated.push({ action: 'surrender', ev: evSurrender() });
  }
  rated.sort((a, b) => b.ev - a.ev);
  return rated;
}

export function buildStrategyTable(rules: RuleSet): StrategyTable {
  const hash = rulesHash(rules);
  const cached = tableCache.get(hash);
  if (cached) return cached;

  const surrenderAllowed = rules.lateSurrender && rules.dealerPeeks;
  const cells: Record<string, RatedAction[]> = {};

  for (let up = 1 as CardValue; up <= 10; up++) {
    const ctx = makeEvContext(up as CardValue, rules);
    for (let t = 4; t <= 21; t++) {
      cells[`H${t}|${up}`] = ratedCell(ctx, t, false, { surrenderAllowed });
    }
    for (let t = 12; t <= 21; t++) {
      cells[`S${t}|${up}`] = ratedCell(ctx, t, true, { surrenderAllowed });
    }
    for (let pv = 1 as CardValue; pv <= 10; pv++) {
      const total = pv === 1 ? 12 : pv * 2;
      const isSoft = pv === 1;
      cells[`P${pv}|${up}`] = ratedCell(ctx, total, isSoft, {
        pairValue: pv as CardValue,
        surrenderAllowed,
      });
    }
  }

  const table: StrategyTable = { hash, cells, insuranceEv: insuranceEv(rules) };
  tableCache.set(hash, table);
  return table;
}

/** P-cell for pairs, otherwise S/H by best total. */
export function cellKeyForCards(cards: readonly Card[]): string {
  if (isPair(cards)) return `P${cardValue(cards[0].rank)}`;
  const { total, isSoft } = handValue(cards);
  return isSoft ? `S${total}` : `H${total}`;
}

/** All rated actions for the hand's cell, EV-descending (legality not applied). */
export function ratedActionsFor(
  table: StrategyTable,
  cards: readonly Card[],
  dealerUpcard: CardValue,
): RatedAction[] {
  return table.cells[`${cellKeyForCards(cards)}|${dealerUpcard}`] ?? [];
}

/**
 * The optimal action right now: the highest-EV action that is legal for this
 * hand in this game state. Returns null when there is no decision to make.
 */
export function optimalAction(
  table: StrategyTable,
  hand: PlayerHand,
  handCount: number,
  rules: RuleSet,
  dealerUpcard: CardValue,
): RatedAction | null {
  const legal = new Set(legalActions(hand, handCount, rules));
  if (legal.size === 0) return null;
  for (const rated of ratedActionsFor(table, hand.cards, dealerUpcard)) {
    if (legal.has(rated.action)) return rated;
  }
  return null;
}
