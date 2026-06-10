import { handValue } from '../../engine/hand';
import type { GameState } from '../../engine/types';
import { PlayingCard } from './PlayingCard';

export function DealerArea({ game }: { game: GameState }) {
  const { dealerCards, holeCardRevealed, phase } = game;
  const showTotal = holeCardRevealed && dealerCards.length >= 2;
  const value = showTotal ? handValue(dealerCards) : null;
  const isBust = value !== null && value.total > 21;
  const isBJ = value !== null && value.total === 21 && dealerCards.length === 2;

  return (
    <div className="dealer-area">
      <div className="area-label">Dealer</div>
      <div className="card-row">
        {phase === 'betting' && dealerCards.length === 0 ? (
          <div className="pcard down" style={{ opacity: 0.25 }} />
        ) : (
          dealerCards.map((card, i) => (
            <PlayingCard key={card.id} card={card} faceDown={i === 1 && !holeCardRevealed} />
          ))
        )}
      </div>
      <div className="hand-meta">
        {value !== null ? (
          <span className={`total-chip${isBust ? ' bust' : ''}${isBJ ? ' bj' : ''}`}>
            {isBJ ? 'Blackjack' : isBust ? `${value.total} · Bust` : value.total}
          </span>
        ) : dealerCards.length > 0 ? (
          <span className="total-chip">{handValue([dealerCards[0]]).total} showing</span>
        ) : (
          <span style={{ height: 24 }} />
        )}
      </div>
    </div>
  );
}
