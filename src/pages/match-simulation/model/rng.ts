import type { RandomSource } from './types';

/** Zamienia seed (liczbę lub tekst) na 32-bitową liczbę całkowitą bez znaku (hash FNV-1a). */
export function seedToUint32(seed: number | string): number {
  const text = String(seed);
  let hash = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

/**
 * Generator Mulberry32: szybki i w pełni deterministyczny. Nie nadaje się do kryptografii.
 * Ten sam seed daje tę samą sekwencję na każdej platformie, bo działa na arytmetyce 32-bitowej.
 */
export function createSeededRng(seed: number | string): RandomSource {
  let state = seedToUint32(seed);
  return {
    next() {
      state = (state + 0x6d2b79f5) >>> 0;
      let t = state;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    },
  };
}

/** true z prawdopodobieństwem `probability`. */
export function chance(rng: RandomSource, probability: number): boolean {
  return rng.next() < probability;
}

/** Losowy element niepustej tablicy. */
export function pick<T>(rng: RandomSource, items: readonly T[]): T {
  if (items.length === 0) throw new Error('pick() wymaga niepustej tablicy');
  return items[Math.floor(rng.next() * items.length)];
}

/** Losowanie ważone. Wagi muszą być nieujemne i mieć dodatnią sumę. */
export function pickWeighted<T>(rng: RandomSource, entries: readonly (readonly [T, number])[]): T {
  const total = entries.reduce((sum, [, weight]) => sum + weight, 0);
  if (!(total > 0)) throw new Error('pickWeighted() wymaga dodatniej sumy wag');
  let roll = rng.next() * total;
  for (const [value, weight] of entries) {
    roll -= weight;
    if (roll < 0) return value;
  }
  return entries[entries.length - 1][0];
}
