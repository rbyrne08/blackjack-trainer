import { handValue, isBlackjack } from '../../engine/hand';
import { fmtMoney } from '../../lib/format';
import type { HandOutcome, PlayerHand } from '../../engine/types';
import { PlayingCard } from './PlayingCard';

const RESULT_LABELS: Record<HandOutcome['result'], string> = {
  blackjack: 'Blackjack',
  win: 'Win',
  push: 'Push',
  lose: 'Lose',
  surrender: 'Surr.',
};

export function PlayerHandView({
  hand,
  isActive,
  outcome,
}: {
  hand: PlayerHand;
  isActive: boolean;
  outcome: HandOutcome | null;
}) {
  const value = handValue(hand.cards);
  const bust = value.total > 21;
  const natural = isBlackjack(hand);

  return (
    <div className={`hand${isActive ? ' active' : ''}`}>
      {outcome && (
        <div className={`result-tag ${outcome.result}`}>
          {RESULT_LABELS[outcome.result]}
          {outcome.net !== 0 && ` ${outcome.net > 0 ? '+' : ''}${outcome.net}`}
        </div>
      )}
      <div className="card-row">
        {hand.cards.map((card) => (
          <PlayingCard key={card.id} card={card} />
        ))}
      </div>
      <div className="hand-meta">
        <span className={`total-chip${bust ? ' bust' : ''}${natural ? ' bj' : ''}`}>
          {natural
            ? 'Blackjack'
            : bust
              ? `${value.total} · Bust`
              : `${value.isSoft ? 'Soft ' : ''}${value.total}`}
        </span>
        <span className="bet-chip">
          {fmtMoney(hand.bet)}
          {hand.isDoubled ? ' ×2' : ''}
        </span>
        {hand.isSurrendered && <span className="bet-chip">surrendered</span>}
      </div>
    </div>
  );
}
