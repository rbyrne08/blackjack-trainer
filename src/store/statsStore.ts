import { create } from 'zustand';
import type { GradedDecision, GradedInsurance } from '../engine/grading';
import type { Action } from '../engine/types';
import { load, save, STORAGE_KEYS } from './persistence';

export interface SessionSummary {
  id: string;
  startedAt: number;
  endedAt: number;
  hands: number;
  decisions: number;
  correct: number;
  evLost: number;
  deviationMisses: number;
  bankrollNet: number;
  insuranceDecisions: number;
  insuranceCorrect: number;
  quizAsked: number;
  quizCorrect: number;
  quizAbsErrorSum: number;
}

export interface DecisionRecord {
  t: number;
  sessionId: string;
  cellKey: string;
  chosen: Action;
  optimal: Action;
  correct: boolean;
  evCost: number;
  deviationId: string | null;
  tc: number | null;
}

export interface CellStat {
  seen: number;
  wrong: number;
  evLost: number;
}

export interface LifetimeStats {
  decisions: number;
  correct: number;
  evLost: number;
  deviationMisses: number;
  hands: number;
  bankrollNet: number;
  insuranceDecisions: number;
  insuranceCorrect: number;
  quizAsked: number;
  quizCorrect: number;
  quizAbsErrorSum: number;
  cells: Record<string, CellStat>;
}

export interface QuizResult {
  expectedRc: number;
  answeredRc: number;
  selfInitiated: boolean;
}

const MAX_DECISIONS = 5000;
const MAX_SESSIONS = 200;

function emptyLifetime(): LifetimeStats {
  return {
    decisions: 0,
    correct: 0,
    evLost: 0,
    deviationMisses: 0,
    hands: 0,
    bankrollNet: 0,
    insuranceDecisions: 0,
    insuranceCorrect: 0,
    quizAsked: 0,
    quizCorrect: 0,
    quizAbsErrorSum: 0,
    cells: {},
  };
}

function newSession(): SessionSummary {
  return {
    id: `s${Date.now().toString(36)}${Math.floor(Math.random() * 1e6).toString(36)}`,
    startedAt: Date.now(),
    endedAt: Date.now(),
    hands: 0,
    decisions: 0,
    correct: 0,
    evLost: 0,
    deviationMisses: 0,
    bankrollNet: 0,
    insuranceDecisions: 0,
    insuranceCorrect: 0,
    quizAsked: 0,
    quizCorrect: 0,
    quizAbsErrorSum: 0,
  };
}

interface StatsState {
  /** Closed sessions plus the live one (kept updated in place, last entry). */
  sessions: SessionSummary[];
  current: SessionSummary;
  decisions: DecisionRecord[];
  lifetime: LifetimeStats;
  recordDecision(grade: GradedDecision): void;
  recordInsurance(grade: GradedInsurance): void;
  recordRound(net: number): void;
  recordQuiz(result: QuizResult): void;
  resetAll(): void;
}

function persist(state: Pick<StatsState, 'sessions' | 'current' | 'decisions' | 'lifetime'>): void {
  const sessions = [...state.sessions.filter((s) => s.id !== state.current.id), state.current]
    .slice(-MAX_SESSIONS);
  save(STORAGE_KEYS.sessions, sessions);
  save(STORAGE_KEYS.decisions, state.decisions);
  save(STORAGE_KEYS.lifetime, state.lifetime);
}

export const useStatsStore = create<StatsState>()((set) => ({
  sessions: load<SessionSummary[]>(STORAGE_KEYS.sessions, []),
  current: newSession(),
  decisions: load<DecisionRecord[]>(STORAGE_KEYS.decisions, []),
  lifetime: load<LifetimeStats>(STORAGE_KEYS.lifetime, emptyLifetime()),

  recordDecision: (grade) =>
    set((state) => {
      const record: DecisionRecord = {
        t: Date.now(),
        sessionId: state.current.id,
        cellKey: grade.cellKey,
        chosen: grade.chosen,
        optimal: grade.optimal,
        correct: grade.isCorrect,
        evCost: grade.evCost,
        deviationId: grade.deviation?.id ?? null,
        tc: grade.trueCount,
      };
      const decisions = [...state.decisions, record].slice(-MAX_DECISIONS);

      const missedDeviation = !grade.isCorrect && grade.deviation !== null;
      const current: SessionSummary = {
        ...state.current,
        endedAt: record.t,
        decisions: state.current.decisions + 1,
        correct: state.current.correct + (grade.isCorrect ? 1 : 0),
        evLost: state.current.evLost + grade.evCost,
        deviationMisses: state.current.deviationMisses + (missedDeviation ? 1 : 0),
      };

      const cells = { ...state.lifetime.cells };
      const cell = cells[grade.cellKey] ?? { seen: 0, wrong: 0, evLost: 0 };
      cells[grade.cellKey] = {
        seen: cell.seen + 1,
        wrong: cell.wrong + (grade.isCorrect ? 0 : 1),
        evLost: cell.evLost + grade.evCost,
      };
      const lifetime: LifetimeStats = {
        ...state.lifetime,
        decisions: state.lifetime.decisions + 1,
        correct: state.lifetime.correct + (grade.isCorrect ? 1 : 0),
        evLost: state.lifetime.evLost + grade.evCost,
        deviationMisses: state.lifetime.deviationMisses + (missedDeviation ? 1 : 0),
        cells,
      };

      const next = { decisions, current, lifetime, sessions: state.sessions };
      persist(next);
      return next;
    }),

  recordInsurance: (grade) =>
    set((state) => {
      const current: SessionSummary = {
        ...state.current,
        endedAt: Date.now(),
        insuranceDecisions: state.current.insuranceDecisions + 1,
        insuranceCorrect: state.current.insuranceCorrect + (grade.isCorrect ? 1 : 0),
      };
      const lifetime: LifetimeStats = {
        ...state.lifetime,
        insuranceDecisions: state.lifetime.insuranceDecisions + 1,
        insuranceCorrect: state.lifetime.insuranceCorrect + (grade.isCorrect ? 1 : 0),
      };
      const next = { ...state, current, lifetime };
      persist(next);
      return { current, lifetime };
    }),

  recordRound: (net) =>
    set((state) => {
      const current: SessionSummary = {
        ...state.current,
        endedAt: Date.now(),
        hands: state.current.hands + 1,
        bankrollNet: state.current.bankrollNet + net,
      };
      const lifetime: LifetimeStats = {
        ...state.lifetime,
        hands: state.lifetime.hands + 1,
        bankrollNet: state.lifetime.bankrollNet + net,
      };
      const next = { ...state, current, lifetime };
      persist(next);
      return { current, lifetime };
    }),

  recordQuiz: (result) =>
    set((state) => {
      const correct = result.expectedRc === result.answeredRc;
      const absError = Math.abs(result.expectedRc - result.answeredRc);
      const current: SessionSummary = {
        ...state.current,
        endedAt: Date.now(),
        quizAsked: state.current.quizAsked + 1,
        quizCorrect: state.current.quizCorrect + (correct ? 1 : 0),
        quizAbsErrorSum: state.current.quizAbsErrorSum + absError,
      };
      const lifetime: LifetimeStats = {
        ...state.lifetime,
        quizAsked: state.lifetime.quizAsked + 1,
        quizCorrect: state.lifetime.quizCorrect + (correct ? 1 : 0),
        quizAbsErrorSum: state.lifetime.quizAbsErrorSum + absError,
      };
      const next = { ...state, current, lifetime };
      persist(next);
      return { current, lifetime };
    }),

  resetAll: () =>
    set(() => {
      const fresh = {
        sessions: [] as SessionSummary[],
        current: newSession(),
        decisions: [] as DecisionRecord[],
        lifetime: emptyLifetime(),
      };
      persist(fresh);
      return fresh;
    }),
}));

/** Sessions including the live one, oldest first. */
export function allSessions(state: Pick<StatsState, 'sessions' | 'current'>): SessionSummary[] {
  return [...state.sessions.filter((s) => s.id !== state.current.id), state.current];
}
