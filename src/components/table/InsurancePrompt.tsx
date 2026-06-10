import { isBlackjack } from '../../engine/hand';
import { fmtEv, fmtMoney } from '../../lib/format';
import { useGameStore } from '../../store/gameStore';
import { useSettingsStore } from '../../store/settingsStore';
import { buildStrategyTable } from '../../engine/strategy';

export function InsurancePrompt() {
  const game = useGameStore((s) => s.game);
  const decideInsurance = useGameStore((s) => s.decideInsurance);
  const showEv = useSettingsStore((s) => s.prefs.showEvPanel);

  const evenMoney = isBlackjack(game.hands[0]);
  const cost = game.baseBet / 2;
  const canAfford = game.bankroll >= cost;

  return (
    <div className="bet-controls">
      <div className="bet-amount" style={{ fontSize: 17 }}>
        {evenMoney ? 'Dealer shows an ace — take even money?' : 'Dealer shows an ace — insurance?'}
      </div>
      {!evenMoney && (
        <div className="shuffle-note" style={{ color: 'var(--muted)' }}>
          Costs {fmtMoney(cost)}, pays 2:1 if the hole card is a ten
          {showEv && <> · EV {fmtEv(buildStrategyTable(game.rules).insuranceEv)} per unit off the top</>}
        </div>
      )}
      <div className="action-bar">
        <button className="btn" disabled={!canAfford} onClick={() => decideInsurance(true)}>
          {evenMoney ? 'Take even money' : 'Take insurance'}
        </button>
        <button className="btn primary" onClick={() => decideInsurance(false)}>
          {evenMoney ? 'Decline' : 'No insurance'}
        </button>
      </div>
    </div>
  );
}
