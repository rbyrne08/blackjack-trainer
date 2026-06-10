import { fmtMoney } from '../../lib/format';
import { useGameStore } from '../../store/gameStore';
import { BetAdviceChip } from '../counting/BetAdviceChip';

const CHIPS = [5, 10, 25, 100] as const;

/**
 * Chip controls for composing the bet. The big Deal button itself is overlaid
 * on the table (see GameTable); both share the store's pendingBet.
 */
export function BetControls() {
  const game = useGameStore((s) => s.game);
  const pendingBet = useGameStore((s) => s.pendingBet);
  const setPendingBet = useGameStore((s) => s.setPendingBet);
  const rebuy = useGameStore((s) => s.rebuy);

  const broke = game.bankroll < 1;

  return (
    <div className="bet-controls">
      {game.needsShuffle && game.dealtCount > 0 && (
        <div className="shuffle-note">⟳ Shuffling a fresh shoe before the next deal</div>
      )}
      <BetAdviceChip onApply={(amount) => setPendingBet(amount)} />
      <div className="bet-amount">Bet: {fmtMoney(pendingBet)}</div>
      <div className="chip-row">
        {CHIPS.map((c) => (
          <button
            key={c}
            className={`chip c${c}`}
            onClick={() => setPendingBet(pendingBet + c)}
            disabled={broke}
          >
            +{c}
          </button>
        ))}
        <button className="btn ghost" onClick={() => setPendingBet(0)} disabled={broke}>
          Clear
        </button>
      </div>
      {broke && (
        <button className="btn primary" onClick={rebuy}>
          Rebuy $1,000
        </button>
      )}
    </div>
  );
}
