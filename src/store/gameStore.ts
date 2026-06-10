import { create } from 'zustand';
import { cardValue } from '../engine/cards';
import { trueCount } from '../engine/counting';
import {
  availableActions,
  createInitialState,
  gameReducer,
} from '../engine/game';
import { gradeDecision, gradeInsurance, type GradedDecision, type GradedInsurance } from '../engine/grading';
import { rulesHash } from '../engine/rules';
import { buildStrategyTable } from '../engine/strategy';
import type { Action, CardValue, GameState, RuleSet } from '../engine/types';
import { mulberry32, randomSeed } from '../lib/rng';
import { useSettingsStore } from './settingsStore';
import { useStatsStore } from './statsStore';

const rng = mulberry32(randomSeed());

function currentTrueCount(game: GameState): number | null {
  const { prefs } = useSettingsStore.getState();
  if (!prefs.countingMode) return null;
  return trueCount(game.runningCount, game.totalCards, game.dealtCount);
}

function dealerUpValue(game: GameState): CardValue {
  return cardValue(game.dealerCards[0].rank);
}

/** Record the finished round's net once, on the transition into settlement. */
function recordIfSettled(prev: GameState, next: GameState): void {
  if (next.phase !== 'settlement' || prev.phase === 'settlement') return;
  const handsNet = next.outcomes.reduce((sum, o) => sum + o.net, 0);
  const net = handsNet + (next.insuranceNet ?? 0);
  useStatsStore.getState().recordRound(net);
  useGameStore.setState((s) => ({ roundsSinceQuiz: s.roundsSinceQuiz + 1 }));
}

interface GameStore {
  game: GameState;
  lastGrade: GradedDecision | null;
  lastInsurance: GradedInsurance | null;
  /** The bet being composed in the betting phase (chips UI + deal button). */
  pendingBet: number;
  setPendingBet(amount: number): void;
  /** Rounds completed since the player last answered a count quiz. */
  roundsSinceQuiz: number;
  /** dealtCount at the moment of the last answered/dismissed quiz. */
  lastQuizAtDealtCount: number;
  quizOpen: boolean;
  quizSelfInitiated: boolean;
  placeBet(amount: number): void;
  decideInsurance(take: boolean): void;
  playerAct(action: Action): void;
  dealerStep(): void;
  nextRound(): void;
  newGame(rules: RuleSet): void;
  rebuy(): void;
  openQuiz(selfInitiated: boolean): void;
  submitQuiz(answeredRc: number): void;
  dismissQuiz(): void;
}

export const useGameStore = create<GameStore>()((set, get) => ({
  game: createInitialState(useSettingsStore.getState().rules, rng),
  lastGrade: null,
  lastInsurance: null,
  pendingBet: 10,
  setPendingBet: (amount) =>
    set((state) => ({
      pendingBet: Math.max(0, Math.min(amount, state.game.bankroll)),
    })),
  roundsSinceQuiz: 0,
  lastQuizAtDealtCount: -1,
  quizOpen: false,
  quizSelfInitiated: false,

  placeBet: (amount) => {
    const prev = get().game;
    const next = gameReducer(prev, { type: 'PLACE_BET', amount }, rng);
    set({ game: next, lastGrade: null, lastInsurance: null });
    recordIfSettled(prev, next);
  },

  decideInsurance: (take) => {
    const prev = get().game;
    const table = buildStrategyTable(prev.rules);
    const grade = gradeInsurance({
      took: take,
      table,
      trueCount: currentTrueCount(prev),
    });
    useStatsStore.getState().recordInsurance(grade);
    const next = gameReducer(prev, { type: 'INSURANCE', take }, rng);
    set({ game: next, lastInsurance: grade });
    recordIfSettled(prev, next);
  },

  playerAct: (action) => {
    const prev = get().game;
    if (!availableActions(prev).includes(action)) return;
    const hand = prev.hands[prev.activeHandIndex];
    const table = buildStrategyTable(prev.rules);
    const grade = gradeDecision({
      hand,
      handCount: prev.hands.length,
      dealerUp: dealerUpValue(prev),
      rules: prev.rules,
      table,
      chosen: action,
      trueCount: currentTrueCount(prev),
    });
    useStatsStore.getState().recordDecision(grade);
    const next = gameReducer(prev, { type: 'PLAYER_ACTION', action }, rng);
    set({ game: next, lastGrade: grade });
    recordIfSettled(prev, next);
  },

  dealerStep: () => {
    const prev = get().game;
    if (prev.phase !== 'dealerTurn') return;
    const next = gameReducer(prev, { type: 'DEALER_STEP' }, rng);
    set({ game: next });
    recordIfSettled(prev, next);
  },

  nextRound: () => {
    const prev = get().game;
    if (prev.phase !== 'settlement') return;
    set({ game: gameReducer(prev, { type: 'NEXT_ROUND' }, rng) });
  },

  newGame: (rules) => {
    const bankroll = get().game.bankroll;
    set({
      game: createInitialState(rules, rng, { bankroll: bankroll > 0 ? bankroll : 1000 }),
      lastGrade: null,
      lastInsurance: null,
      roundsSinceQuiz: 0,
      lastQuizAtDealtCount: -1,
      quizOpen: false,
    });
  },

  rebuy: () => {
    set((state) => ({ game: { ...state.game, bankroll: state.game.bankroll + 1000 } }));
  },

  openQuiz: (selfInitiated) => set({ quizOpen: true, quizSelfInitiated: selfInitiated }),

  // Records the answer but leaves the modal open so it can show the result;
  // dismissQuiz() closes it.
  submitQuiz: (answeredRc) => {
    const { game, quizSelfInitiated } = get();
    useStatsStore.getState().recordQuiz({
      expectedRc: game.runningCount,
      answeredRc,
      selfInitiated: quizSelfInitiated,
    });
    set({
      roundsSinceQuiz: 0,
      lastQuizAtDealtCount: game.dealtCount,
    });
  },

  dismissQuiz: () =>
    set((state) => ({
      quizOpen: false,
      lastQuizAtDealtCount: state.game.dealtCount,
    })),
}));

/** A scheduled quiz is due before the next deal (and always before a shuffle). */
export function quizIsDue(store: Pick<GameStore, 'game' | 'roundsSinceQuiz' | 'lastQuizAtDealtCount'>): boolean {
  const { prefs } = useSettingsStore.getState();
  if (!prefs.countingMode) return false;
  const { game } = store;
  if (game.phase !== 'betting' || game.dealtCount === 0) return false;
  if (store.lastQuizAtDealtCount === game.dealtCount) return false;
  return store.roundsSinceQuiz >= prefs.quizEveryNRounds || game.needsShuffle;
}

// A rule change in Settings starts a fresh game with a new shoe.
useSettingsStore.subscribe((state, prev) => {
  if (rulesHash(state.rules) !== rulesHash(prev.rules)) {
    useGameStore.getState().newGame(state.rules);
  }
});
