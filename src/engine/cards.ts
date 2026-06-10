import type { Card, CardValue, Rank, Rng, Suit } from './types';

export const RANKS: readonly Rank[] = [
  'A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K',
];

export const SUITS: readonly Suit[] = ['S', 'H', 'D', 'C'];

export function cardValue(rank: Rank): CardValue {
  if (rank === 'A') return 1;
  if (rank === '10' || rank === 'J' || rank === 'Q' || rank === 'K') return 10;
  return Number(rank) as CardValue;
}

/** Build an unshuffled shoe of `decks` standard 52-card decks with unique ids. */
export function buildShoe(decks: number): Card[] {
  const cards: Card[] = [];
  let id = 0;
  for (let d = 0; d < decks; d++) {
    for (const suit of SUITS) {
      for (const rank of RANKS) {
        cards.push({ rank, suit, id: id++ });
      }
    }
  }
  return cards;
}

/** Fisher-Yates shuffle, in place, using the injected RNG. Returns the same array. */
export function shuffle<T>(items: T[], rng: Rng): T[] {
  for (let i = items.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    const tmp = items[i];
    items[i] = items[j];
    items[j] = tmp;
  }
  return items;
}

export function freshShoe(decks: number, rng: Rng): Card[] {
  return shuffle(buildShoe(decks), rng);
}

/**
 * Rank counts by value class for a full n-deck shoe: 4 of each rank per deck,
 * so per deck each value class 1..9 has 4 cards and class 10 has 16.
 */
export function shoeComposition(decks: number): number[] {
  const counts = new Array<number>(11).fill(0); // index by CardValue 1..10
  for (let v = 1; v <= 9; v++) counts[v] = 4 * decks;
  counts[10] = 16 * decks;
  return counts;
}
