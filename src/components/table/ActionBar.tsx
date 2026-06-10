import { availableActions } from '../../engine/game';
import { actionLabel } from '../../lib/format';
import { useGameStore } from '../../store/gameStore';
import type { Action } from '../../engine/types';

const ORDER: Action[] = ['hit', 'stand', 'double', 'split', 'surrender'];

export function ActionBar() {
  const game = useGameStore((s) => s.game);
  const playerAct = useGameStore((s) => s.playerAct);
  const actions = new Set(availableActions(game));

  return (
    <div className="action-bar">
      {ORDER.filter((a) => actions.has(a)).map((action) => (
        <button key={action} className="btn" onClick={() => playerAct(action)}>
          {actionLabel(action)}
        </button>
      ))}
    </div>
  );
}
