import { useEffect } from 'react';
import { rulesHash } from '../../engine/rules';
import { fmtMoney } from '../../lib/format';
import { quizIsDue, useGameStore } from '../../store/gameStore';
import { useSettingsStore } from '../../store/settingsStore';
import { CountHud } from '../counting/CountHud';
import { CountQuizModal } from '../counting/CountQuizModal';
import { ActionBar } from './ActionBar';
import { BetControls } from './BetControls';
import { DealerArea } from './DealerArea';
import { EvPanel } from './EvPanel';
import { FeedbackBanner } from './FeedbackBanner';
import { InsurancePrompt } from './InsurancePrompt';
import { PlayerHandView, outcomeFor } from './PlayerHandView';

const DEALER_STEP_MS = 650;

function rulesSummary(hash: string): string {
  return hash
    .replace(/^d(\d)/, '$1 decks')
    .replaceAll('-', ' · ')
    .replace('das', 'DAS')
    .replace('ndas', 'no DAS')
    .replace('ls', 'LS')
    .replace('nls', 'no LS')
    .replace('bj1.5', 'BJ 3:2')
    .replace('bj1.2', 'BJ 6:5')
    .replace('dblany2', 'dbl any 2')
    .replace('dbl9-11', 'dbl 9-11')
    .replace('dbl10-11', 'dbl 10-11')
    .replace(/sp(\d)/, 'split to $1')
    .replace('h17', 'H17')
    .replace('s17', 'S17')
    .replace('peek', 'peek')
    .replace('enhc', 'ENHC');
}

export function GameTable() {
  const game = useGameStore((s) => s.game);
  const lastGrade = useGameStore((s) => s.lastGrade);
  const lastInsurance = useGameStore((s) => s.lastInsurance);
  const dealerStep = useGameStore((s) => s.dealerStep);
  const nextRound = useGameStore((s) => s.nextRound);
  const quizOpen = useGameStore((s) => s.quizOpen);
  const roundsSinceQuiz = useGameStore((s) => s.roundsSinceQuiz);
  const lastQuizAtDealtCount = useGameStore((s) => s.lastQuizAtDealtCount);
  const openQuiz = useGameStore((s) => s.openQuiz);
  const showEvPanel = useSettingsStore((s) => s.prefs.showEvPanel);
  const countingMode = useSettingsStore((s) => s.prefs.countingMode);
  const quizEveryNRounds = useSettingsStore((s) => s.prefs.quizEveryNRounds);

  // The dealer plays itself, one observable step at a time.
  useEffect(() => {
    if (game.phase !== 'dealerTurn') return;
    const timer = setTimeout(dealerStep, DEALER_STEP_MS);
    return () => clearTimeout(timer);
  }, [game, dealerStep]);

  // Scheduled quizzes interrupt before the next deal.
  const due = quizIsDue({ game, roundsSinceQuiz, lastQuizAtDealtCount });
  useEffect(() => {
    if (due && !quizOpen) openQuiz(false);
    // countingMode/quizEveryNRounds affect `due` via quizIsDue's getState read
  }, [due, quizOpen, openQuiz, countingMode, quizEveryNRounds]);

  const roundNet =
    game.phase === 'settlement'
      ? game.outcomes.reduce((sum, o) => sum + o.net, 0) + (game.insuranceNet ?? 0)
      : 0;

  return (
    <div className="table-panel">
      <div className="table-topline">
        <div className="rules-strip">{rulesSummary(rulesHash(game.rules))}</div>
        <CountHud />
      </div>

      <DealerArea game={game} />

      <FeedbackBanner grade={lastGrade} insurance={lastInsurance} />

      <div className="player-area">
        <div className="hands-row">
          {game.hands.length === 0 ? (
            <div className="hand">
              <div className="card-row">
                <div className="pcard down" style={{ opacity: 0.25 }} />
                <div className="pcard down" style={{ opacity: 0.25 }} />
              </div>
              <div className="hand-meta">
                <span className="bet-chip">Place a bet to deal</span>
              </div>
            </div>
          ) : (
            game.hands.map((hand, i) => (
              <PlayerHandView
                key={i}
                hand={hand}
                isActive={game.phase === 'playerTurn' && i === game.activeHandIndex}
                outcome={outcomeFor(game, i)}
              />
            ))
          )}
        </div>
        <div className="area-label">Player</div>
      </div>

      <div className="controls-slot">
        {game.phase === 'playerTurn' && showEvPanel && <EvPanel />}
        {game.phase === 'betting' && <BetControls key={game.roundsSinceShuffle} />}
        {game.phase === 'insurance' && <InsurancePrompt />}
        {game.phase === 'playerTurn' && <ActionBar />}
        {game.phase === 'dealerTurn' && (
          <div className="shuffle-note" style={{ color: 'var(--muted)' }}>
            Dealer playing…
          </div>
        )}
        {game.phase === 'settlement' && (
          <>
            <div
              className={`settle-summary ${roundNet > 0 ? 'pos' : roundNet < 0 ? 'neg' : 'even'}`}
            >
              {roundNet > 0 ? `+${fmtMoney(roundNet)}` : roundNet < 0 ? fmtMoney(roundNet) : 'Push'}
            </div>
            <button className="btn primary" onClick={nextRound}>
              Next hand
            </button>
          </>
        )}
      </div>

      {quizOpen && <CountQuizModal />}
    </div>
  );
}
