import { applyDeviations, shouldTakeInsurance, type DeviationEntry } from './deviations';
import { legalActions } from './rules';
import {
  cellKeyForCards,
  optimalAction,
  ratedActionsFor,
  type StrategyTable,
} from './strategy';
import type { Action, CardValue, PlayerHand, RuleSet } from './types';

export interface GradedDecision {
  chosen: Action;
  optimal: Action;
  isCorrect: boolean;
  /** Count-neutral EVs from the strategy table, per unit of initial bet. */
  evChosen: number;
  evOptimal: number;
  /**
   * EV given up by the mistake (count-neutral, >= 0). When the optimal play
   * is a count deviation the neutral table can't price the error, so this is
   * 0 and the mistake shows up as a missed deviation instead.
   */
  evCost: number;
  /** Set when the count moved the optimal play off basic strategy. */
  deviation: DeviationEntry | null;
  /** Strategy cell, e.g. "H16|10" — used for the mistake heat map. */
  cellKey: string;
  dealerUp: CardValue;
  trueCount: number | null;
}

export function gradeDecision(args: {
  hand: PlayerHand;
  handCount: number;
  dealerUp: CardValue;
  rules: RuleSet;
  table: StrategyTable;
  chosen: Action;
  /** Pass the true count in counting mode; null applies pure basic strategy. */
  trueCount: number | null;
}): GradedDecision {
  const { hand, handCount, dealerUp, rules, table, chosen, trueCount } = args;

  const rated = ratedActionsFor(table, hand.cards, dealerUp);
  const legal = legalActions(hand, handCount, rules);
  const basic = optimalAction(table, hand, handCount, rules, dealerUp);
  if (!basic) throw new Error('graded a hand with no decision available');

  let optimal: Action = basic.action;
  let deviation: DeviationEntry | null = null;
  if (trueCount !== null) {
    const result = applyDeviations(basic.action, hand.cards, dealerUp, legal, trueCount, rules);
    optimal = result.action;
    deviation = result.deviation;
  }

  const evOf = (action: Action): number =>
    rated.find((r) => r.action === action)?.ev ?? 0;
  const evChosen = evOf(chosen);
  const evOptimal = evOf(optimal);
  const isCorrect = chosen === optimal;
  const evCost = deviation ? 0 : Math.max(0, evOptimal - evChosen);

  return {
    chosen,
    optimal,
    isCorrect,
    evChosen,
    evOptimal,
    evCost,
    deviation,
    cellKey: `${cellKeyForCards(hand.cards)}|${dealerUp}`,
    dealerUp,
    trueCount,
  };
}

export interface GradedInsurance {
  took: boolean;
  optimalTake: boolean;
  isCorrect: boolean;
  /** EV per unit of side bet at a neutral count (always negative). */
  insuranceEv: number;
  trueCount: number | null;
}

export function gradeInsurance(args: {
  took: boolean;
  table: StrategyTable;
  trueCount: number | null;
}): GradedInsurance {
  const optimalTake = shouldTakeInsurance(args.trueCount);
  return {
    took: args.took,
    optimalTake,
    isCorrect: args.took === optimalTake,
    insuranceEv: args.table.insuranceEv,
    trueCount: args.trueCount,
  };
}
