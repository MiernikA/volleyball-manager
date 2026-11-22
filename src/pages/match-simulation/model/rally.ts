import { chance, pick, pickWeighted } from './rng';
import { frontRowSlots, opponent, playersInSlots, rotationSlots } from './rules';
import type { PlayerId, RallyContext, RallyEndReason, RallyResolver, RandomSource, TeamSide } from './types';

/**
 * Parametry rozkładu bazowego. Wartości są zbliżone do średnich z ligi męskiej (ok. 62% skutecznego wyjścia
 * spod zagrywki), ale nie zależą od zawodników — do czasu modelu statystyk z SIM-19.
 */
export interface BaselineRallyParams {
  aceRate: number;
  serviceErrorRate: number;
  /** Szansa, że drużyna odbierająca wygra wymianę, która nie skończyła się na zagrywce. */
  receivingWinRate: number;
  /** Jak wymiana kończy się po zagrywce: wagi przyczyn z perspektywy zwycięzcy. */
  endWeights: Readonly<Record<Exclude<RallyEndReason, 'ace' | 'service_error'>, number>>;
}

export const baselineRallyParams: BaselineRallyParams = {
  aceRate: 0.06,
  serviceErrorRate: 0.15,
  receivingWinRate: 0.595,
  endWeights: { attack_kill: 0.65, block_point: 0.15, attack_error: 0.12, unforced_error: 0.08 },
};

export function createBaselineRallyResolver(params: BaselineRallyParams = baselineRallyParams): RallyResolver {
  return (context: RallyContext, rng: RandomSource) => {
    const { serving, rotations } = context;
    const receiving = opponent(serving);
    const serverId = rotations[serving][1];

    const serveRoll = rng.next();
    if (serveRoll < params.aceRate) return { winner: serving, reason: 'ace', playerId: serverId };
    if (serveRoll < params.aceRate + params.serviceErrorRate) {
      return { winner: receiving, reason: 'service_error', playerId: serverId };
    }

    const winner: TeamSide = chance(rng, params.receivingWinRate) ? receiving : serving;
    const loser = opponent(winner);
    const reason = pickWeighted(rng, Object.entries(params.endWeights) as [RallyEndReason, number][]);
    // Blok tylko z pierwszej linii; atak i błędy — dowolny zawodnik szóstki (uproszczenie, patrz dokumentacja).
    const candidates: PlayerId[] =
      reason === 'block_point'
        ? playersInSlots(rotations[winner], frontRowSlots)
        : playersInSlots(rotations[reason === 'attack_kill' ? winner : loser], rotationSlots);
    return { winner, reason, playerId: pick(rng, candidates) };
  };
}

export const baselineRallyResolver: RallyResolver = createBaselineRallyResolver();
