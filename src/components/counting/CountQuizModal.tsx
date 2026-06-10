import { useState } from 'react';
import { decksRemaining, trueCount } from '../../engine/counting';
import { fmtCount, fmtTc } from '../../lib/format';
import { useGameStore } from '../../store/gameStore';

/**
 * The count quiz: asks for the running count, then shows the truth with the
 * decks-remaining arithmetic so the true-count conversion can be checked too.
 */
export function CountQuizModal() {
  const game = useGameStore((s) => s.game);
  const selfInitiated = useGameStore((s) => s.quizSelfInitiated);
  const submitQuiz = useGameStore((s) => s.submitQuiz);
  const dismissQuiz = useGameStore((s) => s.dismissQuiz);

  const [input, setInput] = useState('');
  const [result, setResult] = useState<{ answered: number; expected: number } | null>(null);

  const expected = game.runningCount;
  const decks = decksRemaining(game.totalCards, game.dealtCount);
  const tc = trueCount(game.runningCount, game.totalCards, game.dealtCount);

  const submit = () => {
    const answered = Number(input);
    if (!Number.isFinite(answered) || input.trim() === '') return;
    setResult({ answered: Math.round(answered), expected });
    submitQuiz(Math.round(answered));
  };

  return (
    <div className="modal-backdrop">
      <div className="modal">
        {result === null ? (
          <>
            <h3>Count check</h3>
            <p className="sub">
              {selfInitiated
                ? 'Self-check — what is the running count right now?'
                : game.needsShuffle
                  ? 'Last call before the shuffle — what is the running count?'
                  : 'Quiz time — what is the running count?'}
            </p>
            <div className="quiz-input-row">
              <input
                autoFocus
                type="number"
                inputMode="numeric"
                placeholder="RC"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') submit();
                }}
              />
              <button className="btn primary" onClick={submit} disabled={input.trim() === ''}>
                Check
              </button>
              {selfInitiated && (
                <button className="btn ghost" onClick={dismissQuiz}>
                  Cancel
                </button>
              )}
            </div>
          </>
        ) : (
          <>
            <h3>Count check</h3>
            <div className={`quiz-verdict ${result.answered === result.expected ? 'good' : 'bad'}`}>
              {result.answered === result.expected
                ? `✓ Correct — running count is ${fmtCount(result.expected)}`
                : `✗ You said ${fmtCount(result.answered)}, it is ${fmtCount(result.expected)} (off by ${Math.abs(result.answered - result.expected)})`}
            </div>
            <div className="quiz-math">
              Cards dealt: <b>{game.dealtCount}</b> of {game.totalCards} · Decks remaining ≈{' '}
              <b>{decks}</b>
              <br />
              True count = RC ÷ decks = {fmtCount(result.expected)} ÷ {decks} ={' '}
              <b>{fmtTc(tc)}</b>
            </div>
            <button className="btn primary" onClick={dismissQuiz}>
              Continue
            </button>
          </>
        )}
      </div>
    </div>
  );
}
