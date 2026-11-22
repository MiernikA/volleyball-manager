import { validatePlayerProfile } from './profile';
import type { MatchInput, MatchRules, PlayerId, Rotation, RotationSlot, Score, SetNumber, TeamSide } from './types';

export const rotationSlots: readonly RotationSlot[] = [1, 2, 3, 4, 5, 6];
export const frontRowSlots: readonly RotationSlot[] = [2, 3, 4];
export const backRowSlots: readonly RotationSlot[] = [5, 6, 1];

export const defaultRules: MatchRules = {
  setsToWin: 3,
  pointsPerSet: 25,
  pointsInDecidingSet: 15,
  minLead: 2,
  maxRalliesPerSet: 500,
};

export const resolveRules = (input: MatchInput): MatchRules => ({ ...defaultRules, ...input.rules });

export const opponent = (side: TeamSide): TeamSide => (side === 'A' ? 'B' : 'A');

export const isDecidingSet = (set: SetNumber, rules: MatchRules): boolean => set === rules.setsToWin * 2 - 1;

export const pointsToWinSet = (set: SetNumber, rules: MatchRules): number =>
  isDecidingSet(set, rules) ? rules.pointsInDecidingSet : rules.pointsPerSet;

/** Zwycięzca seta albo null, jeśli set trwa. */
export function setWinner(points: Score, set: SetNumber, rules: MatchRules): TeamSide | null {
  const target = pointsToWinSet(set, rules);
  if (points.A >= target && points.A - points.B >= rules.minLead) return 'A';
  if (points.B >= target && points.B - points.A >= rules.minLead) return 'B';
  return null;
}

export function matchWinner(setsWon: Score, rules: MatchRules): TeamSide | null {
  if (setsWon.A >= rules.setsToWin) return 'A';
  if (setsWon.B >= rules.setsToWin) return 'B';
  return null;
}

/**
 * Przejście (rotacja zgodnie z ruchem wskazówek zegara): zawodnik ze strefy 2 przechodzi do 1, z 1 do 6 itd.
 * Ta sama konwencja co rotateTeam na ekranie „Przygotowanie meczu”.
 */
export function rotate(rotation: Rotation): Rotation {
  return {
    1: rotation[2],
    2: rotation[3],
    3: rotation[4],
    4: rotation[5],
    5: rotation[6],
    6: rotation[1],
  };
}

export const playersInSlots = (rotation: Rotation, slots: readonly RotationSlot[]): PlayerId[] =>
  slots.map(slot => rotation[slot]);

// ── Walidacja wejścia ────────────────────────────────────────────────────────

export type MatchInputIssueCode =
  | 'incomplete_rotation'
  | 'duplicate_player'
  | 'unknown_player'
  | 'libero_in_rotation'
  | 'invalid_libero'
  | 'invalid_profile'
  | 'invalid_rules';

export interface MatchInputIssue {
  code: MatchInputIssueCode;
  side?: TeamSide;
  message: string;
}

export class MatchInputError extends Error {
  constructor(readonly issues: readonly MatchInputIssue[]) {
    super(`Nieprawidłowe wejście meczu: ${issues.map(issue => issue.message).join('; ')}`);
    this.name = 'MatchInputError';
  }
}

export function validateMatchInput(input: MatchInput): MatchInputIssue[] {
  const issues: MatchInputIssue[] = [];
  const rules = resolveRules(input);
  if (
    !Number.isInteger(rules.setsToWin) || rules.setsToWin < 1 ||
    rules.pointsPerSet < 1 || rules.pointsInDecidingSet < 1 || rules.minLead < 1 || rules.maxRalliesPerSet < 1
  ) {
    issues.push({ code: 'invalid_rules', message: 'Przepisy meczu muszą mieć dodatnie wartości' });
  }

  for (const side of ['A', 'B'] as const) {
    const team = input.teams[side];
    const roles = new Map(team.players.map(player => [player.id, player.role]));
    const ids = rotationSlots.map(slot => team.rotation[slot]);
    const filled = ids.filter((id): id is PlayerId => typeof id === 'string' && id.length > 0);
    if (filled.length !== 6) {
      issues.push({ code: 'incomplete_rotation', side, message: `${side}: rotacja musi mieć 6 zawodników` });
    }
    const all = team.liberoId ? [...filled, team.liberoId] : filled;
    if (new Set(all).size !== all.length) {
      issues.push({ code: 'duplicate_player', side, message: `${side}: zawodnik występuje więcej niż raz` });
    }
    if (all.some(id => !roles.has(id))) {
      issues.push({ code: 'unknown_player', side, message: `${side}: skład odwołuje się do nieznanego zawodnika` });
    }
    if (filled.some(id => roles.get(id) === 'L')) {
      issues.push({ code: 'libero_in_rotation', side, message: `${side}: libero nie może być w szóstce` });
    }
    if (team.liberoId && roles.has(team.liberoId) && roles.get(team.liberoId) !== 'L') {
      issues.push({ code: 'invalid_libero', side, message: `${side}: miejsce libero zajmuje zawodnik innej pozycji` });
    }
    // SIM-02: każdy zawodnik dopuszczony do meczu musi mieć kompletny, poprawny profil.
    for (const player of team.players.filter(candidate => all.includes(candidate.id))) {
      const profileIssues = validatePlayerProfile(player.profile);
      if (profileIssues.length > 0 || player.profile.positions.primary !== player.role) {
        const reason = profileIssues[0]?.message ?? 'pozycja w profilu nie zgadza się z pozycją zawodnika';
        issues.push({ code: 'invalid_profile', side, message: `${side}: profil zawodnika ${player.id} jest niepoprawny (${reason})` });
      }
    }
  }
  return issues;
}
