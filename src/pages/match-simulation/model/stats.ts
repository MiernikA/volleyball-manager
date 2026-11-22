import { opponent } from './rules';
import { pointScoringReasons, type MatchEvent, type RallyEndReason, type TeamSide } from './types';

export interface TeamMatchStats {
  points: number;
  aces: number;
  attackKills: number;
  blockPoints: number;
  /** Błędy własne: zagrywka, atak i pozostałe. */
  errors: number;
  /** Punkty zdobyte, gdy drużyna odbierała zagrywkę. */
  sideOuts: number;
  receptions: number;
}

const emptyStats = (): TeamMatchStats => ({ points: 0, aces: 0, attackKills: 0, blockPoints: 0, errors: 0, sideOuts: 0, receptions: 0 });

/** Zlicza statystyki drużyn z listy zdarzeń meczu. */
export function summarizeMatch(events: readonly MatchEvent[]): Record<TeamSide, TeamMatchStats> {
  const stats: Record<TeamSide, TeamMatchStats> = { A: emptyStats(), B: emptyStats() };
  for (const event of events) {
    if (event.type !== 'rally_ended') continue;
    const receiving = opponent(event.serving);
    stats[receiving].receptions++;
    stats[event.winner].points++;
    if (event.winner === receiving) stats[receiving].sideOuts++;

    const actor: TeamSide = pointScoringReasons.has(event.reason) ? event.winner : opponent(event.winner);
    const counters: Record<RallyEndReason, keyof TeamMatchStats> = {
      ace: 'aces',
      attack_kill: 'attackKills',
      block_point: 'blockPoints',
      service_error: 'errors',
      attack_error: 'errors',
      unforced_error: 'errors',
    };
    stats[actor][counters[event.reason]]++;
  }
  return stats;
}
