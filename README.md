# ♠ Blackjack Trainer

A blackjack training web app that grades every decision you make against
game-theory-optimal play for your exact table rules, tracks your mistakes over
time, and teaches Hi-Lo card counting interactively.

## Features

- **Playable blackjack** with configurable casino rules: 1–8 decks, dealer
  hits/stands soft 17, double after split, late surrender, 3:2 vs 6:5
  blackjack, double restrictions (any two / 9–11 / 10–11), resplit limits,
  American peek vs European no-hole-card, and shoe penetration.
- **A computational EV engine, not hardcoded charts.** Stand/hit/double/split/
  surrender EVs are computed per rule set from dealer outcome distributions,
  so the "correct" play always matches your settings. Validated cell-by-cell
  against published basic strategy charts in the test suite.
- **Per-decision feedback** — every play is graded instantly, mistakes priced
  in EV ("Cost ≈ 0.395 bets"), insurance decisions included.
- **Optional EV display** (Settings → Training) shows the expected value of
  every available action *before* you decide.
- **Hi-Lo counting mode**: the app maintains the true count silently and
  quizzes you every N rounds (and always before a shuffle), with the
  decks-remaining → true-count arithmetic shown. Training-wheels mode shows
  the live RC/TC; test mode hides them. Bet-ramp advice (1-2-4-8-12 spread)
  and Illustrious 18 / Fab 4 index-play grading are layered on top.
- **History & stats**: lifetime accuracy, EV lost per 100 decisions, your ten
  most expensive habits by strategy cell, session accuracy trend, count-quiz
  accuracy, all persisted in localStorage.

## Run it

```sh
npm install
npm run dev      # http://localhost:5173
npm test         # 80 engine tests incl. golden-chart validation
npm run build    # production build
```

Keyboard shortcuts during play: **H**it, **S**tand, **D**ouble, s**P**lit,
sur**R**ender, **Y/N** for insurance, **Enter** for next hand.

## Architecture

```
src/engine/   pure TypeScript, no React/storage — fully unit-tested
  dealer.ts     dealer outcome distributions (peek/ENHC conditioned, H17/S17)
  ev.ts         player action EVs with memoized recursion
  strategy.ts   EV-ordered action table per rule set, cached by rules hash
  deviations.ts Illustrious 18 + Fab 4 Hi-Lo indices (Schlesinger)
  game.ts       pure reducer state machine (deterministic with a stacked shoe)
  grading.ts    decision/insurance grading
src/store/    zustand stores + versioned localStorage persistence
src/components/  table, counting, stats, settings views
```

### Model notes

EVs use a total-dependent, fixed-composition model: the full n-deck shoe minus
the dealer upcard, drawn with replacement. This is what published
total-dependent charts represent. The trade-off: composition-dependent
single-deck exceptions (7,7 vs T stand, hard 8 vs 5–6 double) are
intentionally out of scope, and a handful of knife-edge cells (e.g. A,2 vs 5,
EV gap ≈ 0.004) land on the other side of the tie — these are documented in
the test allowlist with both EVs recorded. Split EVs use the standard
no-resplit approximation. Deviation indices follow Schlesinger's multi-deck
Hi-Lo values; published sources disagree by ±1 on a few cells.

This is a training tool. Casinos have better lighting and worse odds.
