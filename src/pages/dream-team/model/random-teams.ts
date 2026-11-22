import type { PlayerPosition } from './player';
import type { RotationPosition, TeamId } from './team';

export interface TeamLineup {
  playerIdsByRotation: Record<RotationPosition, string>;
  liberoId: string;
}

/**
 * Typowe ustawienie 5-1 w rotacji 1: rozgrywający naprzeciw atakującego,
 * przyjmujący i środkowi po przekątnej.
 */
export const randomLineupTemplate: Record<RotationPosition, Exclude<PlayerPosition, 'L'>> = {
  1: 'S',
  2: 'OH',
  3: 'MB',
  4: 'OPP',
  5: 'OH',
  6: 'MB',
};

/** Funkcja losująca z przedziału [0, 1) — domyślnie Math.random, w testach generator z seedem. */
export type RandomFn = () => number;

function shuffled<T>(items: readonly T[], random: RandomFn): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

/**
 * Losuje dwie rozłączne drużyny zgodne z pozycjami (1 S, 1 OPP, 2 OH, 2 MB + libero).
 * Zwraca null, gdy w bazie brakuje zawodników którejś pozycji.
 */
export function randomTeams(
  players: readonly { id: string; position: PlayerPosition }[],
  random: RandomFn = Math.random,
): Record<TeamId, TeamLineup> | null {
  const pools = new Map<PlayerPosition, string[]>();
  for (const position of ['S', 'OPP', 'OH', 'MB', 'L'] as const) {
    pools.set(position, shuffled(players.filter(player => player.position === position).map(player => player.id), random));
  }
  const take = (position: PlayerPosition): string | undefined => pools.get(position)!.pop();

  const draw = (): TeamLineup | null => {
    const rotation = {} as Record<RotationPosition, string>;
    for (const slot of [1, 2, 3, 4, 5, 6] as const) {
      const id = take(randomLineupTemplate[slot]);
      if (!id) return null;
      rotation[slot] = id;
    }
    const liberoId = take('L');
    return liberoId ? { playerIdsByRotation: rotation, liberoId } : null;
  };

  const A = draw();
  const B = draw();
  return A && B ? { A, B } : null;
}
