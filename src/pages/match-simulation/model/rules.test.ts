import { describe, expect, it } from 'vitest';
import { createSeededRng, pick, pickWeighted, seedToUint32 } from './rng';
import { defaultRules, matchWinner, rotate, setWinner } from './rules';

describe('seedowany RNG', () => {
  it('ten sam seed daje tę samą sekwencję', () => {
    const a = createSeededRng('abc');
    const b = createSeededRng('abc');
    const seqA = Array.from({ length: 50 }, () => a.next());
    const seqB = Array.from({ length: 50 }, () => b.next());
    expect(seqA).toEqual(seqB);
  });

  it('sekwencja jest stała między wersjami (regresja algorytmu)', () => {
    const rng = createSeededRng(42);
    expect(seedToUint32('42')).toBe(seedToUint32(42));
    expect(Array.from({ length: 3 }, () => rng.next().toFixed(10))).toMatchInlineSnapshot(`
      [
        "0.3077305786",
        "0.3676118436",
        "0.2313355443",
      ]
    `);
  });

  it('zwraca liczby z przedziału [0, 1)', () => {
    const rng = createSeededRng(7);
    for (let i = 0; i < 10_000; i++) {
      const value = rng.next();
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThan(1);
    }
  });

  it('różne seedy dają różne sekwencje', () => {
    expect(createSeededRng(1).next()).not.toBe(createSeededRng(2).next());
  });

  it('pick i pickWeighted są deterministyczne i respektują wagi', () => {
    const rng = createSeededRng('weights');
    const counts = { a: 0, b: 0 };
    for (let i = 0; i < 10_000; i++) counts[pickWeighted(rng, [['a', 3], ['b', 1]] as const)]++;
    expect(counts.a / 10_000).toBeCloseTo(0.75, 1);
    expect(pickWeighted(rng, [['only', 0], ['x', 1]] as const)).toBe('x');
    expect(() => pick(rng, [])).toThrow();
    expect(() => pickWeighted(rng, [['a', 0]] as const)).toThrow();
  });
});

describe('punktacja', () => {
  it.each([
    [{ A: 25, B: 23 }, 1, 'A'],
    [{ A: 25, B: 24 }, 1, null],
    [{ A: 26, B: 28 }, 1, 'B'],
    [{ A: 15, B: 13 }, 5, 'A'],
    [{ A: 15, B: 13 }, 4, null],
    [{ A: 14, B: 16 }, 5, 'B'],
  ] as const)('%o w secie %i → %s', (points, set, expected) => {
    expect(setWinner(points, set, defaultRules)).toBe(expected);
  });

  it('mecz kończy się po trzech wygranych setach', () => {
    expect(matchWinner({ A: 2, B: 2 }, defaultRules)).toBeNull();
    expect(matchWinner({ A: 3, B: 1 }, defaultRules)).toBe('A');
  });
});

describe('przejście', () => {
  it('przesuwa zawodników 2→1→6→5→4→3→2 i po 6 przejściach wraca do ustawienia', () => {
    const start = { 1: 'p1', 2: 'p2', 3: 'p3', 4: 'p4', 5: 'p5', 6: 'p6' } as const;
    expect(rotate(start)).toEqual({ 1: 'p2', 2: 'p3', 3: 'p4', 4: 'p5', 5: 'p6', 6: 'p1' });
    let rotation = rotate(start);
    for (let i = 1; i < 6; i++) rotation = rotate(rotation);
    expect(rotation).toEqual(start);
  });
});
