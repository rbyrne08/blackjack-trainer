import type { Card } from '../../engine/types';

const SUIT_GLYPHS = { S: '♠', H: '♥', D: '♦', C: '♣' } as const;

export function PlayingCard({ card, faceDown = false }: { card: Card; faceDown?: boolean }) {
  if (faceDown) {
    return <div className="pcard down" aria-label="face-down card" />;
  }
  const glyph = SUIT_GLYPHS[card.suit];
  const isRed = card.suit === 'H' || card.suit === 'D';
  return (
    <div className={`pcard${isRed ? ' red' : ''}`} aria-label={`${card.rank}${glyph}`}>
      <div className="corner">
        {card.rank}
        <span className="suit-small">{glyph}</span>
      </div>
      <div className="pip">{glyph}</div>
    </div>
  );
}
