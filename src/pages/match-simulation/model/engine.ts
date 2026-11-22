import { baselineRallyResolver } from './rally';
import { chance } from './rng';
import {
  MatchInputError,
  isDecidingSet,
  matchWinner,
  opponent,
  resolveRules,
  rotate,
  setWinner,
  validateMatchInput,
} from './rules';
import type {
  MatchEvent,
  MatchInput,
  MatchResult,
  MatchState,
  RallyResolver,
  RandomSource,
  SetNumber,
  TeamSide,
} from './types';

/** Wynik jednego kroku silnika: nowy stan i zdarzenia, które do niego doprowadziły. */
export interface MatchStep {
  state: MatchState;
  events: MatchEvent[];
}

/** Zdarzenie bez numeru seq (Omit rozłożony na każdy wariant unii). */
type EventPayload = MatchEvent extends infer E ? (E extends unknown ? Omit<E, 'seq'> : never) : never;

/** Zbiera zdarzenia z kolejnymi numerami seq, zaczynając od `lastSeq`. */
function createEmitter(lastSeq: number) {
  const events: MatchEvent[] = [];
  let seq = lastSeq;
  return {
    events,
    emit(event: EventPayload) {
      events.push({ ...event, seq: ++seq } as MatchEvent);
    },
    get lastSeq() {
      return seq;
    },
  };
}

const coinToss = (rng: RandomSource): TeamSide => (chance(rng, 0.5) ? 'A' : 'B');

/** Rozpoczyna mecz: waliduje wejście, losuje pierwszą zagrywkę i otwiera seta 1. */
export function startMatch(input: MatchInput, rng: RandomSource): MatchStep {
  const issues = validateMatchInput(input);
  if (issues.length > 0) throw new MatchInputError(issues);

  const firstServer = coinToss(rng);
  const out = createEmitter(0);
  out.emit({ type: 'match_started', firstServer });
  out.emit({ type: 'set_started', set: 1, server: firstServer });

  return {
    events: out.events,
    state: {
      phase: 'in_progress',
      setsWon: { A: 0, B: 0 },
      completedSets: [],
      currentSet: { number: 1, points: { A: 0, B: 0 }, firstServer },
      serving: firstServer,
      rotations: { A: input.teams.A.rotation, B: input.teams.B.rotation },
      rallyCount: 0,
      lastSeq: out.lastSeq,
    },
  };
}

/** Rozgrywa jedną wymianę i stosuje jej skutki: punkt, przejście, koniec seta lub meczu. */
export function playRally(
  state: MatchState,
  input: MatchInput,
  rng: RandomSource,
  resolveRally: RallyResolver = baselineRallyResolver,
): MatchStep {
  if (state.phase === 'finished') throw new Error('Mecz jest zakończony');
  const rules = resolveRules(input);
  const { currentSet, serving } = state;
  if (currentSet.points.A + currentSet.points.B >= rules.maxRalliesPerSet) {
    throw new Error(`Set ${currentSet.number} przekroczył limit ${rules.maxRalliesPerSet} wymian`);
  }

  const rally = state.rallyCount + 1;
  const outcome = resolveRally(
    {
      setNumber: currentSet.number,
      rallyNumber: rally,
      serving,
      score: currentSet.points,
      rotations: state.rotations,
      teams: input.teams,
    },
    rng,
  );

  const out = createEmitter(state.lastSeq);
  const points = { ...currentSet.points, [outcome.winner]: currentSet.points[outcome.winner] + 1 };
  out.emit({
    type: 'rally_ended',
    set: currentSet.number,
    rally,
    serving,
    serverId: state.rotations[serving][1],
    winner: outcome.winner,
    reason: outcome.reason,
    playerId: outcome.playerId,
    score: points,
  });

  const setWonBy = setWinner(points, currentSet.number, rules);

  if (!setWonBy) {
    let rotations = state.rotations;
    if (outcome.winner !== serving) {
      // Wygranie zagrywki przez drużynę odbierającą = przejście tej drużyny.
      rotations = { ...rotations, [outcome.winner]: rotate(rotations[outcome.winner]) };
      out.emit({ type: 'rotated', side: outcome.winner, rotation: rotations[outcome.winner] });
    }
    return {
      events: out.events,
      state: {
        ...state,
        currentSet: { ...currentSet, points },
        serving: outcome.winner,
        rotations,
        rallyCount: rally,
        lastSeq: out.lastSeq,
      },
    };
  }

  out.emit({ type: 'set_ended', set: currentSet.number, winner: setWonBy, score: points });
  const setsWon = { ...state.setsWon, [setWonBy]: state.setsWon[setWonBy] + 1 };
  const completedSets = [...state.completedSets, { number: currentSet.number, points, winner: setWonBy }];
  const matchWonBy = matchWinner(setsWon, rules);

  if (matchWonBy) {
    out.emit({ type: 'match_ended', winner: matchWonBy, setsWon });
    return {
      events: out.events,
      state: {
        ...state,
        phase: 'finished',
        setsWon,
        completedSets,
        currentSet: { ...currentSet, points },
        serving: outcome.winner,
        rallyCount: rally,
        lastSeq: out.lastSeq,
      },
    };
  }

  const nextSet: SetNumber = currentSet.number + 1;
  // Sety 2–4: zaczyna drużyna, która nie zaczynała poprzedniego. Tie-break: nowe losowanie.
  const firstServer = isDecidingSet(nextSet, rules) ? coinToss(rng) : opponent(currentSet.firstServer);
  out.emit({ type: 'set_started', set: nextSet, server: firstServer });

  return {
    events: out.events,
    state: {
      ...state,
      setsWon,
      completedSets,
      currentSet: { number: nextSet, points: { A: 0, B: 0 }, firstServer },
      serving: firstServer,
      // Każdy set zaczyna się od ustawienia startowego z wejścia.
      rotations: { A: input.teams.A.rotation, B: input.teams.B.rotation },
      rallyCount: rally,
      lastSeq: out.lastSeq,
    },
  };
}

/** Symuluje cały mecz. Ten sam `input` i RNG z tym samym seedem dają identyczny wynik i kolejność zdarzeń. */
export function simulateMatch(
  input: MatchInput,
  rng: RandomSource,
  resolveRally: RallyResolver = baselineRallyResolver,
): MatchResult {
  let { state, events } = startMatch(input, rng);
  const allEvents = [...events];
  while (state.phase !== 'finished') {
    ({ state, events } = playRally(state, input, rng, resolveRally));
    allEvents.push(...events);
  }
  return {
    winner: matchWinner(state.setsWon, resolveRules(input))!,
    setsWon: state.setsWon,
    sets: state.completedSets,
    totalRallies: state.rallyCount,
    events: allEvents,
  };
}
