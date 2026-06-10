import { create } from 'zustand';
import { DEFAULT_RULES } from '../engine/rules';
import { DEFAULT_BET_RAMP, type BetRampEntry } from '../engine/counting';
import type { RuleSet } from '../engine/types';
import { load, save, STORAGE_KEYS } from './persistence';

export interface Prefs {
  /** Show per-action EVs before deciding (spoils the answer on purpose). */
  showEvPanel: boolean;
  countingMode: boolean;
  /** 'visible' = training wheels HUD, 'hidden' = quiz-only test mode. */
  countVisibility: 'visible' | 'hidden';
  /** Ask for the count every N rounds (and always before a shuffle). */
  quizEveryNRounds: number;
  /** Currency value of one betting unit for ramp advice. */
  betUnit: number;
  betRamp: BetRampEntry[];
}

export const DEFAULT_PREFS: Prefs = {
  showEvPanel: false,
  countingMode: false,
  countVisibility: 'hidden',
  quizEveryNRounds: 4,
  betUnit: 10,
  betRamp: DEFAULT_BET_RAMP,
};

interface PersistedSettings {
  rules: RuleSet;
  prefs: Prefs;
}

interface SettingsState {
  rules: RuleSet;
  prefs: Prefs;
  setRules(patch: Partial<RuleSet>): void;
  setPrefs(patch: Partial<Prefs>): void;
  resetSettings(): void;
}

function loadSettings(): PersistedSettings {
  const stored = load<Partial<PersistedSettings>>(STORAGE_KEYS.settings, {});
  return {
    rules: { ...DEFAULT_RULES, ...stored.rules },
    prefs: { ...DEFAULT_PREFS, ...stored.prefs },
  };
}

export const useSettingsStore = create<SettingsState>()((set) => ({
  ...loadSettings(),

  setRules: (patch) =>
    set((state) => {
      const rules: RuleSet = { ...state.rules, ...patch };
      // ENHC has no late surrender in this trainer (see rules.ts).
      if (!rules.dealerPeeks) rules.lateSurrender = false;
      save(STORAGE_KEYS.settings, { rules, prefs: state.prefs });
      return { rules };
    }),

  setPrefs: (patch) =>
    set((state) => {
      const prefs: Prefs = { ...state.prefs, ...patch };
      save(STORAGE_KEYS.settings, { rules: state.rules, prefs });
      return { prefs };
    }),

  resetSettings: () =>
    set(() => {
      save(STORAGE_KEYS.settings, { rules: DEFAULT_RULES, prefs: DEFAULT_PREFS });
      return { rules: { ...DEFAULT_RULES }, prefs: { ...DEFAULT_PREFS } };
    }),
}));
