import { decksRemaining, trueCount } from '../../engine/counting';
import { fmtCount, fmtTc } from '../../lib/format';
import { useGameStore } from '../../store/gameStore';
import { useSettingsStore } from '../../store/settingsStore';

export function CountHud() {
  const game = useGameStore((s) => s.game);
  const openQuiz = useGameStore((s) => s.openQuiz);
  const countingMode = useSettingsStore((s) => s.prefs.countingMode);
  const visibility = useSettingsStore((s) => s.prefs.countVisibility);

  if (!countingMode) return null;

  const decks = decksRemaining(game.totalCards, game.dealtCount);
  const tc = trueCount(game.runningCount, game.totalCards, game.dealtCount);

  return (
    <div className="count-hud">
      <span className="stat">
        Decks left <b>{decks}</b>
      </span>
      {visibility === 'visible' && (
        <>
          <span className="stat">
            RC <b>{fmtCount(game.runningCount)}</b>
          </span>
          <span className="stat">
            TC <b>{fmtTc(tc)}</b>
          </span>
        </>
      )}
      <button className="btn-small" onClick={() => openQuiz(true)}>
        Check my count
      </button>
    </div>
  );
}
