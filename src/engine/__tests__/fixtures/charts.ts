import type { RuleSet } from '../../types';

/**
 * Golden chart fixtures: published TOTAL-DEPENDENT basic strategy charts.
 * Source: Wizard of Odds basic strategy calculator/charts (4-8 deck and
 * single-deck total-dependent tables).
 *
 * Codes: H hit | S stand | D double-else-hit | Ds double-else-stand |
 *        P split | Rh surrender-else-hit | Rs surrender-else-stand |
 *        Rp surrender-else-split
 *
 * Column order (dealer upcard): 2 3 4 5 6 7 8 9 10 A
 * Row keys: H5..H18 hard totals, S13..S20 soft totals, P2..P10 + P1 (aces).
 */
export interface ChartFixture {
  name: string;
  rules: Partial<RuleSet>;
  rows: Record<string, string>;
}

export const SIX_DECK_S17_DAS_LS: ChartFixture = {
  name: '6d-s17-das-ls',
  rules: {
    decks: 6,
    dealerHitsSoft17: false,
    doubleAfterSplit: true,
    lateSurrender: true,
    dealerPeeks: true,
    doubleRestriction: 'any2',
  },
  rows: {
    H5: 'H H H H H H H H H H',
    H6: 'H H H H H H H H H H',
    H7: 'H H H H H H H H H H',
    H8: 'H H H H H H H H H H',
    H9: 'H D D D D H H H H H',
    H10: 'D D D D D D D D H H',
    H11: 'D D D D D D D D D H',
    H12: 'H H S S S H H H H H',
    H13: 'S S S S S H H H H H',
    H14: 'S S S S S H H H H H',
    H15: 'S S S S S H H H Rh H',
    H16: 'S S S S S H H Rh Rh Rh',
    H17: 'S S S S S S S S S S',
    H18: 'S S S S S S S S S S',
    S13: 'H H H D D H H H H H',
    S14: 'H H H D D H H H H H',
    S15: 'H H D D D H H H H H',
    S16: 'H H D D D H H H H H',
    S17: 'H D D D D H H H H H',
    S18: 'S Ds Ds Ds Ds S S H H H',
    S19: 'S S S S S S S S S S',
    S20: 'S S S S S S S S S S',
    P2: 'P P P P P P H H H H',
    P3: 'P P P P P P H H H H',
    P4: 'H H H P P H H H H H',
    P5: 'D D D D D D D D H H',
    P6: 'P P P P P H H H H H',
    P7: 'P P P P P P H H H H',
    P8: 'P P P P P P P P P P',
    P9: 'P P P P P S P P S S',
    P10: 'S S S S S S S S S S',
    P1: 'P P P P P P P P P P',
  },
};

/** H17 differences vs the S17 chart: 11vA D, 15vA Rh, 17vA Rs, A7v2 Ds, A8v6 Ds, 88vA Rp. */
export const SIX_DECK_H17_DAS_LS: ChartFixture = {
  name: '6d-h17-das-ls',
  rules: {
    decks: 6,
    dealerHitsSoft17: true,
    doubleAfterSplit: true,
    lateSurrender: true,
    dealerPeeks: true,
    doubleRestriction: 'any2',
  },
  rows: {
    ...SIX_DECK_S17_DAS_LS.rows,
    H11: 'D D D D D D D D D D',
    H15: 'S S S S S H H H Rh Rh',
    H17: 'S S S S S S S S S Rs',
    S18: 'Ds Ds Ds Ds Ds S S H H H',
    S19: 'S S S S Ds S S S S S',
    P8: 'P P P P P P P P P Rp',
  },
};

/** No-DAS: only the pair rows tighten (2s/3s vs 2-3, 4s entirely, 6s vs 2). */
export const SIX_DECK_S17_NDAS_LS: ChartFixture = {
  name: '6d-s17-ndas-ls',
  rules: {
    decks: 6,
    dealerHitsSoft17: false,
    doubleAfterSplit: false,
    lateSurrender: true,
    dealerPeeks: true,
    doubleRestriction: 'any2',
  },
  rows: {
    P2: 'H H P P P P H H H H',
    P3: 'H H P P P P H H H H',
    P4: 'H H H H H H H H H H',
    P5: 'D D D D D D D D H H',
    P6: 'H P P P P H H H H H',
    P7: 'P P P P P P H H H H',
    P8: 'P P P P P P P P P P',
    P9: 'P P P P P S P P S S',
    P10: 'S S S S S S S S S S',
    P1: 'P P P P P P P P P P',
  },
};

/**
 * ENHC spot checks (European no-hole-card, S17 DAS, no surrender): the
 * defining departures are refusing to put extra money out against a possible
 * dealer natural — 11vT/11vA no longer double, 8,8 vs T/A no longer split —
 * plus a sample of cells that must NOT change.
 */
export const SIX_DECK_ENHC_SPOTS: ChartFixture = {
  name: '6d-s17-das-enhc',
  rules: {
    decks: 6,
    dealerHitsSoft17: false,
    doubleAfterSplit: true,
    lateSurrender: false,
    dealerPeeks: false,
    doubleRestriction: 'any2',
  },
  rows: {
    H11: 'D D D D D D D D H H',
    H10: 'D D D D D D D D H H',
    H16: 'S S S S S H H H H H',
    H12: 'H H S S S H H H H H',
    S18: 'S Ds Ds Ds Ds S S H H H',
    P8: 'P P P P P P P P H H',
    P9: 'P P P P P S P P S S',
  },
};

/**
 * Single-deck H17 NDAS, no surrender (classic downtown game) — spot checks
 * only. Restricted to cells that are robust under our total-dependent,
 * upcard-only-removal model. Composition-dependent single-deck plays the
 * model intentionally does not capture (e.g. 7,7 vs T stand, hard 8 vs 5-6
 * double) are excluded; see the model note in ev.ts.
 */
export const ONE_DECK_H17_NDAS_SPOTS: ChartFixture = {
  name: '1d-h17-ndas',
  rules: {
    decks: 1,
    dealerHitsSoft17: true,
    doubleAfterSplit: false,
    lateSurrender: false,
    dealerPeeks: true,
    doubleRestriction: 'any2',
  },
  rows: {
    H9: 'D D D D D H H H H H',
    H11: 'D D D D D D D D D D',
    H16: 'S S S S S H H H H H',
    H12: 'H H S S S H H H H H',
    S17: 'D D D D D H H H H H',
    S19: 'S S S S Ds S S S S S',
    P6: 'P P P P P H H H H H',
    P1: 'P P P P P P P P P P',
  },
};

export const ALL_FIXTURES: ChartFixture[] = [
  SIX_DECK_S17_DAS_LS,
  SIX_DECK_H17_DAS_LS,
  SIX_DECK_S17_NDAS_LS,
  SIX_DECK_ENHC_SPOTS,
  ONE_DECK_H17_NDAS_SPOTS,
];

/**
 * Near-tie allowlist: cells where published charts sit on a knife edge and
 * our approximation may land on the other side. For these cells the test
 * demands the EV gap between the engine's best action and the chart's action
 * is below maxGap instead of demanding an exact match. Keep this list short
 * and each entry justified.
 */
export const ALLOWLIST: Record<string, { maxGap: number; reason: string }> = {
  // Split 8,8 vs A under H17 computes within a whisker of surrender's -0.5;
  // published sources themselves disagree (Rp vs P) at this cell.
  '6d-h17-das-ls:P8|1': {
    maxGap: 0.03,
    reason: 'surrender vs split near-tie at -0.5',
  },
  // A,2 vs 5: the most marginal soft double on the chart. Finite-shoe charts
  // double; the with-replacement model lands on hit (hit 0.1360 vs double
  // 0.1318 under S17; 0.1363 vs 0.1331 under H17).
  '6d-s17-das-ls:S13|5': {
    maxGap: 0.006,
    reason: 'with-replacement model prefers hit by ~0.004',
  },
  '6d-h17-das-ls:S13|5': {
    maxGap: 0.006,
    reason: 'with-replacement model prefers hit by ~0.003',
  },
  // Single-deck composition cells: removing the player's own cards from a
  // 52-card deck moves these EVs more than the decision margin. The model
  // deliberately removes only the upcard (see ev.ts).
  '1d-h17-ndas:S17|2': {
    maxGap: 0.02,
    reason: 'A,6 v 2 SD double is composition-driven (hit -0.0093 vs double -0.0236)',
  },
  '1d-h17-ndas:S19|5': {
    maxGap: 0.002,
    reason: 'A,8 v 5 SD H17 is a near-perfect tie (double 0.4605 vs stand 0.4595)',
  },
  '1d-h17-ndas:P6|2': {
    maxGap: 0.03,
    reason: '6,6 v 2 SD split is composition-driven (hit -0.2535 vs split -0.2784)',
  },
};
