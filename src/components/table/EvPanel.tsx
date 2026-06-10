import { applyDeviations } from '../../engine/deviations';
import { cardValue } from '../../engine/cards';
import { availableActions } from '../../engine/game';
import { trueCount } from '../../engine/counting';
import { buildStrategyTable, ratedActionsFor } from '../../engine/strategy';
import { actionLabel, fmtEv, fmtTc } from '../../lib/format';
import { useGameStore } from '../../store/gameStore';
import { useSettingsStore } from '../../store/settingsStore';

/**
 * Pre-decision EV display (the optional "spoiler" panel): every legal action
 * for the active hand with its count-neutral EV, best first.
 */
export function EvPanel() {
  const game = useGameStore((s) => s.game);
  const countingMode = useSettingsStore((s) => s.prefs.countingMode);

  if (game.phase !== 'playerTurn') return null;
  const hand = game.hands[game.activeHandIndex];
  const up = cardValue(game.dealerCards[0].rank);
  const table = buildStrategyTable(game.rules);
  const legal = availableActions(game);
  const rated = ratedActionsFor(table, hand.cards, up).filter((r) =>
    legal.includes(r.action),
  );
  if (rated.length === 0) return null;

  const evs = rated.map((r) => r.ev);
  const min = Math.min(...evs, -1);
  const max = Math.max(...evs, 0);
  const span = max - min || 1;

  let deviationNote: string | null = null;
  if (countingMode) {
    const tc = trueCount(game.runningCount, game.totalCards, game.dealtCount);
    const res = applyDeviations(rated[0].action, hand.cards, up, legal, tc, game.rules);
    if (res.deviation) {
      deviationNote = `Count says ${actionLabel(res.action)} — ${res.deviation.label} (TC ${fmtTc(tc)})`;
    }
  }

  return (
    <div className="ev-panel">
      <h4>Action EVs (per bet, neutral count)</h4>
      {rated.map((r, i) => (
        <div key={r.action} className={`ev-row${i === 0 ? ' best' : ''}`}>
          <span className="name">
            {i === 0 ? '★ ' : ''}
            {actionLabel(r.action)}
          </span>
          <span className="ev-bar">
            <span
              className="fill"
              style={{ width: `${Math.max(3, ((r.ev - min) / span) * 100)}%` }}
            />
          </span>
          <span className="val">{fmtEv(r.ev)}</span>
        </div>
      ))}
      {deviationNote && <div className="deviation-note">{deviationNote}</div>}
    </div>
  );
}
