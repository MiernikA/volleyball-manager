import { describe, expect, it } from 'vitest';
import type { Player, PlayerPosition } from './player';
import { randomLineupTemplate, randomTeams } from './random-teams';
import { emptyTeam, positions, validateTeam } from './team';

const p = (id: string, position: PlayerPosition): Player => ({
  id, firstName: id, lastName: 'Test', displayName: id, position, birthDate: null, nationality: null,
  heightCm: null, weightKg: null, attackReachCm: null, blockReachCm: null, photoUrl: null, sourceUrl: 'https://www.plusliga.pl',
});
const squad = (counts: Record<PlayerPosition, number>) =>
  (Object.entries(counts) as [PlayerPosition, number][]).flatMap(([position, n]) => Array.from({ length: n }, (_, i) => p(`${position}-${i}`, position)));

/** Prosty deterministyczny generator na potrzeby testu. */
const lcg = (seed: number) => () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 2 ** 32);

describe('losowe składy', () => {
  const players = squad({ S: 3, OPP: 3, OH: 5, MB: 5, L: 3 });

  it('tworzy dwa poprawne, rozłączne składy zgodne z pozycjami', () => {
    for (let seed = 0; seed < 50; seed++) {
      const teams = randomTeams(players, lcg(seed))!;
      for (const id of ['A', 'B'] as const) {
        const team = { ...emptyTeam(id), ...teams[id] };
        expect(validateTeam(team, players)).toEqual([]);
        positions.forEach(slot =>
          expect(players.find(player => player.id === team.playerIdsByRotation[slot])!.position).toBe(randomLineupTemplate[slot]),
        );
      }
      const all = (['A', 'B'] as const).flatMap(id => [...Object.values(teams[id].playerIdsByRotation), teams[id].liberoId]);
      expect(new Set(all).size).toBe(14);
    }
  });

  it('ten sam generator daje te same składy, a różne — różne', () => {
    expect(randomTeams(players, lcg(1))).toEqual(randomTeams(players, lcg(1)));
    const variants = new Set(Array.from({ length: 10 }, (_, seed) => JSON.stringify(randomTeams(players, lcg(seed)))));
    expect(variants.size).toBeGreaterThan(1);
  });

  it('zwraca null, gdy brakuje zawodników na pozycję', () => {
    expect(randomTeams(squad({ S: 1, OPP: 2, OH: 4, MB: 4, L: 2 }))).toBeNull();
    expect(randomTeams(squad({ S: 2, OPP: 2, OH: 4, MB: 4, L: 1 }))).toBeNull();
  });
});
