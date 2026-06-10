import { recommendedUnits, trueCount } from '../../engine/counting';
import { fmtMoney, fmtTc } from '../../lib/format';
import { useGameStore } from '../../store/gameStore';
import { useSettingsStore } from '../../store/settingsStore';

/**
 * Bet-sizing advice during the betting phase. Shown only when the count is
 * visible (in hidden/test mode it would leak the answer); the suggested
 * amount is clickable to apply it.
 */
export function BetAdviceChip({ onApply }: { onApply: (amount: number) => void }) {
  const game = useGameStore((s) => s.game);
  const prefs = useSettingsStore((s) => s.prefs);

  if (!prefs.countingMode || prefs.countVisibility !== 'visible') return null;
  if (game.phase !== 'betting') return null;

  const tc = trueCount(game.runningCount, game.totalCards, game.dealtCount);
  const units = recommendedUnits(tc, prefs.betRamp);
  const amount = Math.min(units * prefs.betUnit, Math.max(game.bankroll, 0));

  return (
    <button
      type="button"
      className="bet-advice"
      onClick={() => onApply(amount)}
      title="Apply suggested bet"
    >
      TC {fmtTc(tc)} → bet {units} unit{units === 1 ? '' : 's'} ({fmtMoney(amount)})
    </button>
  );
}
