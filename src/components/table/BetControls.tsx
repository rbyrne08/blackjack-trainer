import { useState } from 'react';
import { fmtMoney } from '../../lib/format';
import { useGameStore } from '../../store/gameStore';
import { BetAdviceChip } from '../counting/BetAdviceChip';

const CHIPS = [5, 10, 25, 100] as const;

export function BetControls() {
  const game = useGameStore((s) => s.game);
  const placeBet = useGameStore((s) => s.placeBet);
  const rebuy = useGameStore((s) => s.rebuy);
  const [bet, setBet] = useState(() => Math.min(game.baseBet, Math.max(game.bankroll, 0)));

  const canDeal = bet >= 1 && bet <= game.bankroll;
  const broke = game.bankroll < 1;

  return (
    <div className="bet-controls">
      {game.needsShuffle && game.dealtCount > 0 && (
        <div className="shuffle-note">⟳ Shuffling a fresh shoe before the next deal</div>
      )}
      <BetAdviceChip onApply={(amount) => setBet(Math.min(amount, game.bankroll))} />
      <div className="bet-amount">Bet: {fmtMoney(bet)}</div>
      <div className="chip-row">
        {CHIPS.map((c) => (
          <button
            key={c}
            className={`chip c${c}`}
            onClick={() => setBet((b) => Math.min(b + c, game.bankroll))}
            disabled={broke}
          >
            +{c}
          </button>
        ))}
        <button className="btn ghost" onClick={() => setBet(0)} disabled={broke}>
          Clear
        </button>
      </div>
      {broke ? (
        <button className="btn primary" onClick={rebuy}>
          Rebuy $1,000
        </button>
      ) : (
        <button className="btn primary" disabled={!canDeal} onClick={() => placeBet(bet)}>
          Deal
        </button>
      )}
    </div>
  );
}
