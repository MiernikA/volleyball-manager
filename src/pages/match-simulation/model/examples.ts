import { roleBaselineProfile } from './profile';
import type { MatchInput } from './types';

/**
 * Przykładowe pełne wejście meczu. Wynik dla seedu `exampleSeed` jest zapisany w
 * docs/examples/match-example.result.json i weryfikowany testem engine.test.ts.
 */
export const exampleSeed = 'plusliga-2026-27-demo';

export const exampleMatchInput: MatchInput = {
  teams: {
    A: {
      name: 'Orły',
      rotation: { 1: 'a-setter', 2: 'a-oh-1', 3: 'a-mb-1', 4: 'a-opp', 5: 'a-oh-2', 6: 'a-mb-2' },
      liberoId: 'a-libero',
      players: [
        { id: 'a-setter', name: 'Adam Rozgrywający', role: 'S', profile: roleBaselineProfile('S') },
        { id: 'a-opp', name: 'Artur Atakujący', role: 'OPP', profile: roleBaselineProfile('OPP') },
        { id: 'a-oh-1', name: 'Aleksander Przyjmujący', role: 'OH', profile: roleBaselineProfile('OH') },
        { id: 'a-oh-2', name: 'Antoni Przyjmujący', role: 'OH', profile: roleBaselineProfile('OH') },
        { id: 'a-mb-1', name: 'Adrian Środkowy', role: 'MB', profile: roleBaselineProfile('MB') },
        { id: 'a-mb-2', name: 'Albert Środkowy', role: 'MB', profile: roleBaselineProfile('MB') },
        { id: 'a-libero', name: 'Arkadiusz Libero', role: 'L', profile: roleBaselineProfile('L') },
      ],
    },
    B: {
      name: 'Wilki',
      rotation: { 1: 'b-setter', 2: 'b-oh-1', 3: 'b-mb-1', 4: 'b-opp', 5: 'b-oh-2', 6: 'b-mb-2' },
      liberoId: 'b-libero',
      players: [
        { id: 'b-setter', name: 'Bartosz Rozgrywający', role: 'S', profile: roleBaselineProfile('S') },
        { id: 'b-opp', name: 'Bogdan Atakujący', role: 'OPP', profile: roleBaselineProfile('OPP') },
        { id: 'b-oh-1', name: 'Bartłomiej Przyjmujący', role: 'OH', profile: roleBaselineProfile('OH') },
        { id: 'b-oh-2', name: 'Borys Przyjmujący', role: 'OH', profile: roleBaselineProfile('OH') },
        { id: 'b-mb-1', name: 'Bruno Środkowy', role: 'MB', profile: roleBaselineProfile('MB') },
        { id: 'b-mb-2', name: 'Błażej Środkowy', role: 'MB', profile: roleBaselineProfile('MB') },
        { id: 'b-libero', name: 'Benedykt Libero', role: 'L', profile: roleBaselineProfile('L') },
      ],
    },
  },
};
