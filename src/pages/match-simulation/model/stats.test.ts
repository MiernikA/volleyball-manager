import { describe, expect, it } from 'vitest';
import { simulateMatch } from './engine';
import { exampleMatchInput, exampleSeed } from './examples';
import { createSeededRng } from './rng';
import { summarizeMatch } from './stats';

describe('statystyki meczu', () => {
  it('suma punktów i akcji zgadza się z wynikiem', () => {
    const result = simulateMatch(exampleMatchInput, createSeededRng(exampleSeed));
    const stats = summarizeMatch(result.events);
    for (const side of ['A', 'B'] as const) {
      const s = stats[side];
      expect(s.points).toBe(result.sets.reduce((sum, set) => sum + set.points[side], 0));
      // Każdy punkt to akcja własna albo błąd przeciwnika.
      const other = stats[side === 'A' ? 'B' : 'A'];
      expect(s.aces + s.attackKills + s.blockPoints + other.errors).toBe(s.points);
      expect(s.sideOuts).toBeLessThanOrEqual(s.receptions);
    }
    expect(stats.A.receptions + stats.B.receptions).toBe(result.totalRallies);
  });
});
