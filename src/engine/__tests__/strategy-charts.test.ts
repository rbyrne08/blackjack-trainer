import { describe, expect, it } from 'vitest';
import { buildStrategyTable, type RatedAction } from '../strategy';
import { DEFAULT_RULES } from '../rules';
import type { Action, RuleSet } from '../types';
import { ALL_FIXTURES, ALLOWLIST, type ChartFixture } from './fixtures/charts';

/** Chart column order: dealer 2..10 then ace. */
const UPCARD_ORDER = [2, 3, 4, 5, 6, 7, 8, 9, 10, 1] as const;

interface CodeMeaning {
  primary: Action;
  /** What the chart prescribes when the primary action is unavailable. */
  fallback?: Action;
}

const CODES: Record<string, CodeMeaning> = {
  H: { primary: 'hit' },
  S: { primary: 'stand' },
  D: { primary: 'double', fallback: 'hit' },
  Ds: { primary: 'double', fallback: 'stand' },
  P: { primary: 'split' },
  Rh: { primary: 'surrender', fallback: 'hit' },
  Rs: { primary: 'surrender', fallback: 'stand' },
  Rp: { primary: 'surrender', fallback: 'split' },
};

function bestAmong(rated: RatedAction[], available: Set<Action>): RatedAction {
  for (const r of rated) {
    if (available.has(r.action)) return r;
  }
  throw new Error('no available action in cell');
}

function evOf(rated: RatedAction[], action: Action): number {
  const found = rated.find((r) => r.action === action);
  if (!found) throw new Error(`action ${action} not rated in cell`);
  return found.ev;
}

function checkFixture(fixture: ChartFixture): string[] {
  const rules: RuleSet = { ...DEFAULT_RULES, ...fixture.rules };
  const table = buildStrategyTable(rules);
  const surrenderAvailable = rules.lateSurrender && rules.dealerPeeks;
  const failures: string[] = [];

  for (const [rowKey, rowCodes] of Object.entries(fixture.rows)) {
    const codes = rowCodes.trim().split(/\s+/);
    expect(codes).toHaveLength(10);
    const isPairRow = rowKey.startsWith('P');

    codes.forEach((code, col) => {
      const meaning = CODES[code];
      if (!meaning) throw new Error(`unknown code ${code} in ${rowKey}`);
      const up = UPCARD_ORDER[col];
      const cellKey = `${rowKey}|${up}`;
      const rated = table.cells[cellKey];
      if (!rated) throw new Error(`missing cell ${cellKey}`);

      // First-decision availability: two fresh cards.
      const available = new Set<Action>(['hit', 'stand']);
      if (rated.some((r) => r.action === 'double')) available.add('double');
      if (isPairRow) available.add('split');
      if (surrenderAvailable) available.add('surrender');

      const best = bestAmong(rated, available);
      if (best.action !== meaning.primary) {
        const gap = best.ev - evOf(rated, meaning.primary);
        const allow = ALLOWLIST[`${fixture.name}:${cellKey}`];
        if (allow && gap <= allow.maxGap) return;
        failures.push(
          `${fixture.name} ${cellKey}: chart=${meaning.primary} engine=${best.action} ` +
            `(ev ${best.ev.toFixed(4)} vs ${evOf(rated, meaning.primary).toFixed(4)}, gap ${gap.toFixed(4)})`,
        );
        return;
      }

      // Composite codes also pin the fallback (e.g. D-else-hit on 3+ cards).
      if (meaning.fallback) {
        const without = new Set(available);
        without.delete(meaning.primary);
        const fb = bestAmong(rated, without);
        if (fb.action !== meaning.fallback) {
          failures.push(
            `${fixture.name} ${cellKey}: fallback chart=${meaning.fallback} engine=${fb.action} ` +
              `(ev ${fb.ev.toFixed(4)} vs ${evOf(rated, meaning.fallback).toFixed(4)})`,
          );
        }
      }
    });
  }
  return failures;
}

describe('strategy table vs published charts', () => {
  for (const fixture of ALL_FIXTURES) {
    it(`matches ${fixture.name}`, () => {
      const failures = checkFixture(fixture);
      expect(failures, failures.join('\n')).toEqual([]);
    });
  }
});

describe('EV sanity', () => {
  const table = buildStrategyTable(DEFAULT_RULES);

  it('produces sane magnitudes on landmark cells', () => {
    const stand20v6 = evOf(table.cells['H20|6'], 'stand');
    expect(stand20v6).toBeGreaterThan(0.65);
    expect(stand20v6).toBeLessThan(0.75);

    const hit16v10 = evOf(table.cells['H16|10'], 'hit');
    const stand16v10 = evOf(table.cells['H16|10'], 'stand');
    expect(hit16v10).toBeGreaterThan(-0.6);
    expect(hit16v10).toBeLessThan(-0.45);
    // The most famous near-tie in blackjack: hit edges out stand by a hair.
    expect(hit16v10).toBeGreaterThan(stand16v10);
    expect(hit16v10 - stand16v10).toBeLessThan(0.02);

    const double11v6 = evOf(table.cells['H11|6'], 'double');
    expect(double11v6).toBeGreaterThan(0.5);
    expect(double11v6).toBeLessThan(0.8);

    const split8v6 = evOf(table.cells['P8|6'], 'split');
    expect(split8v6).toBeGreaterThan(0.15);
  });

  it('computes the exact 6-deck insurance EV', () => {
    // 96 tens / 311 cards behind the ace: 3 * 96/311 - 1
    expect(table.insuranceEv).toBeCloseTo(3 * (96 / 311) - 1, 12);
    expect(table.insuranceEv).toBeLessThan(0);
  });

  it('orders every cell by descending EV', () => {
    for (const rated of Object.values(table.cells)) {
      for (let i = 1; i < rated.length; i++) {
        expect(rated[i - 1].ev).toBeGreaterThanOrEqual(rated[i].ev);
      }
    }
  });

  it('builds quickly enough to recompute on settings changes', () => {
    const start = performance.now();
    buildStrategyTable({ ...DEFAULT_RULES, decks: 5 }); // uncached rule set
    const elapsed = performance.now() - start;
    expect(elapsed).toBeLessThan(250);
  });
});
