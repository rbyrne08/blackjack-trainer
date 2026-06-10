import { availableActions } from '../../engine/game';
import { actionLabel } from '../../lib/format';
import { useGameStore } from '../../store/gameStore';
import type { Action } from '../../engine/types';

// Only legal + affordable actions render; e.g. Split appears solely on pairs
// (any two ten-value cards count as a pair) and Double only on two-card hands.
const ORDER: Action[] = ['hit', 'stand', 'double', 'split', 'surrender'];

const HOTKEYS: Record<Action, string> = {
  hit: 'H',
  stand: 'S',
  double: 'D',
  split: 'P',
  surrender: 'R',
};

export function ActionBar() {
  const game = useGameStore((s) => s.game);
  const playerAct = useGameStore((s) => s.playerAct);
  const actions = new Set(availableActions(game));

  return (
    <div className="action-bar">
      {ORDER.filter((a) => actions.has(a)).map((action) => (
        <button
          key={action}
          className={`btn action-btn action-${action}`}
          title={`Shortcut: ${HOTKEYS[action]}`}
          onClick={() => playerAct(action)}
        >
          {actionLabel(action)}
          <kbd>{HOTKEYS[action]}</kbd>
        </button>
      ))}
    </div>
  );
}
