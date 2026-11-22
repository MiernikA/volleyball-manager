import { afterEach, describe, expect, it, vi } from 'vitest';
import { playRally, simulateMatch, startMatch } from './engine';
import { exampleMatchInput, exampleSeed } from './examples';
import { createSeededRng } from './rng';
import { MatchInputError, defaultRules, opponent, rotate } from './rules';
import type { MatchEvent, MatchInput, MatchResult, RallyResolver, TeamSide } from './types';

const run = (seed: number | string, input: MatchInput = exampleMatchInput) => simulateMatch(input, createSeededRng(seed));

function deepFreeze<T>(value: T): T {
  if (value && typeof value === 'object') {
    Object.values(value).forEach(deepFreeze);
    Object.freeze(value);
  }
  return value;
}

/** JSON z jednym zdarzeniem na linię — czytelny przykład w docs/examples. */
function formatResult(result: MatchResult): string {
  const { events, ...summary } = result;
  const head = JSON.stringify(summary, null, 2).replace(/\n}$/, '');
  return `${head},\n  "events": [\n${events.map(event => `    ${JSON.stringify(event)}`).join(',\n')}\n  ]\n}\n`;
}

afterEach(() => vi.restoreAllMocks());

describe('determinizm', () => {
  it('ten sam seed i wejście dają identyczny wynik i kolejność zdarzeń', () => {
    const first = run(exampleSeed);
    const second = run(exampleSeed);
    expect(second).toEqual(first);
    expect(second.events.map(event => event.seq)).toEqual(first.events.map(event => event.seq));
  });

  it('różne seedy dają różne przebiegi meczu', () => {
    const outcomes = new Set([1, 2, 3, 4, 5].map(seed => JSON.stringify(run(seed).sets)));
    expect(outcomes.size).toBeGreaterThan(1);
  });

  it('nie korzysta z Math.random ani zegara', () => {
    const random = vi.spyOn(Math, 'random');
    const now = vi.spyOn(Date, 'now');
    const perf = vi.spyOn(performance, 'now');
    run(exampleSeed);
    expect(random).not.toHaveBeenCalled();
    expect(now).not.toHaveBeenCalled();
    expect(perf).not.toHaveBeenCalled();
  });

  it('nie modyfikuje wejścia', () => {
    const input = deepFreeze(structuredClone(exampleMatchInput));
    expect(() => run(exampleSeed, input)).not.toThrow();
    expect(input).toEqual(exampleMatchInput);
  });

  it('symulacja krokowa daje to samo co simulateMatch', () => {
    const rng = createSeededRng(exampleSeed);
    let { state, events } = startMatch(exampleMatchInput, rng);
    const collected = [...events];
    while (state.phase !== 'finished') {
      ({ state, events } = playRally(state, exampleMatchInput, rng));
      collected.push(...events);
    }
    expect(collected).toEqual(run(exampleSeed).events);
  });
});

describe('przykład pełnego meczu (docs/examples)', () => {
  it('wejście i wynik zgadzają się z zapisanym przykładem', async () => {
    await expect(`${JSON.stringify({ seed: exampleSeed, input: exampleMatchInput }, null, 2)}\n`).toMatchFileSnapshot(
      '../../../../docs/examples/match-example.input.json',
    );
    await expect(formatResult(run(exampleSeed))).toMatchFileSnapshot('../../../../docs/examples/match-example.result.json');
  });
});

describe('niezmienniki przepisów (200 seedów)', () => {
  const seeds = Array.from({ length: 200 }, (_, i) => `seed-${i}`);

  it.each(seeds)('%s', seed => {
    const result = run(seed);
    const { events } = result;

    // Kolejność zdarzeń: ciągłe seq, start i koniec meczu.
    expect(events.map(event => event.seq)).toEqual(events.map((_, i) => i + 1));
    expect(events[0].type).toBe('match_started');
    expect(events.at(-1)).toMatchObject({ type: 'match_ended', winner: result.winner, setsWon: result.setsWon });

    // Mecz do trzech wygranych setów.
    expect(result.setsWon[result.winner]).toBe(3);
    expect(result.setsWon[opponent(result.winner)]).toBeLessThan(3);
    expect(result.sets).toHaveLength(result.setsWon.A + result.setsWon.B);

    // Każdy set zakończony zgodnie z przepisami.
    for (const set of result.sets) {
      const target = set.number === 5 ? 15 : 25;
      const winner = set.points[set.winner];
      const loser = set.points[opponent(set.winner)];
      expect(winner).toBeGreaterThanOrEqual(target);
      expect(winner - loser).toBeGreaterThanOrEqual(2);
      if (winner > target) expect(winner - loser).toBe(2);
    }

    // Zagrywka, przejścia i wynik wymiana po wymianie.
    let state ={ A: exampleMatchInput.teams.A.rotation, B: exampleMatchInput.teams.B.rotation };
    let serving: TeamSide | null = null;
    let score = { A: 0, B: 0 };
    const setStarts: Extract<MatchEvent, { type: 'set_started' }>[] = [];
    for (const event of events) {
      if (event.type === 'set_started') {
        setStarts.push(event);
        serving = event.server;
        score = { A: 0, B: 0 };
        state = { A: exampleMatchInput.teams.A.rotation, B: exampleMatchInput.teams.B.rotation };
      }
      if (event.type === 'rally_ended') {
        expect(event.serving).toBe(serving);
        expect(event.serverId).toBe(state[event.serving][1]);
        score = { ...score, [event.winner]: score[event.winner] + 1 };
        expect(event.score).toEqual(score);
        serving = event.winner;
      }
      if (event.type === 'rotated') {
        state = { ...state, [event.side]: rotate(state[event.side]) };
        expect(event.rotation).toEqual(state[event.side]);
      }
    }
    // Sety 2–4 rozpoczyna drużyna, która nie zaczynała poprzedniego.
    for (let i = 1; i < setStarts.length && i < 4; i++) {
      expect(setStarts[i].server).toBe(opponent(setStarts[i - 1].server));
    }
    expect(result.totalRallies).toBe(events.filter(event => event.type === 'rally_ended').length);
  });

  it('przejście następuje dokładnie wtedy, gdy odbierający zdobywa punkt (poza końcem seta)', () => {
    const { events } = run(exampleSeed);
    events.forEach((event, i) => {
      if (event.type !== 'rally_ended') return;
      const next = events[i + 1];
      const sideOut = event.winner !== event.serving;
      if (next.type === 'set_ended') return;
      expect(next.type === 'rotated').toBe(sideOut);
      if (next.type === 'rotated') expect(next.side).toBe(event.winner);
    });
  });
});

describe('wstrzykiwany resolver wymiany', () => {
  it('pozwala podmienić logikę akcji bez zmiany silnika', () => {
    const alwaysA: RallyResolver = context => ({
      winner: 'A',
      reason: 'ace',
      playerId: context.rotations[context.serving][1],
    });
    const result = simulateMatch(exampleMatchInput, createSeededRng(1), alwaysA);
    expect(result.winner).toBe('A');
    expect(result.sets.map(set => set.points)).toEqual([
      { A: 25, B: 0 },
      { A: 25, B: 0 },
      { A: 25, B: 0 },
    ]);
    expect(result.totalRallies).toBe(75);
  });

  it('przerywa nieskończony set limitem wymian', () => {
    const alternate: RallyResolver = context => ({
      winner: context.rallyNumber % 2 ? 'A' : 'B',
      reason: 'attack_kill',
      playerId: context.rotations.A[1],
    });
    expect(() => simulateMatch(exampleMatchInput, createSeededRng(1), alternate)).toThrow(
      `limit ${defaultRules.maxRalliesPerSet} wymian`,
    );
  });

  it('nie pozwala grać po zakończeniu meczu', () => {
    const rng = createSeededRng(exampleSeed);
    let { state } = startMatch(exampleMatchInput, rng);
    while (state.phase !== 'finished') ({ state } = playRally(state, exampleMatchInput, rng));
    expect(() => playRally(state, exampleMatchInput, rng)).toThrow('Mecz jest zakończony');
  });
});

describe('walidacja wejścia', () => {
  const withTeamA = (patch: Partial<MatchInput['teams']['A']>): MatchInput => ({
    ...exampleMatchInput,
    teams: { ...exampleMatchInput.teams, A: { ...exampleMatchInput.teams.A, ...patch } },
  });

  it.each([
    ['duplicate_player', withTeamA({ rotation: { ...exampleMatchInput.teams.A.rotation, 2: 'a-setter' } })],
    ['unknown_player', withTeamA({ rotation: { ...exampleMatchInput.teams.A.rotation, 2: 'ghost' } })],
    ['libero_in_rotation', withTeamA({ rotation: { ...exampleMatchInput.teams.A.rotation, 2: 'a-libero' }, liberoId: null })],
    ['invalid_libero', withTeamA({ rotation: { ...exampleMatchInput.teams.A.rotation, 2: 'a-libero' }, liberoId: 'a-oh-1' })],
    ['incomplete_rotation', withTeamA({ rotation: { ...exampleMatchInput.teams.A.rotation, 6: '' } })],
  ])('%s', (code, input) => {
    try {
      startMatch(input, createSeededRng(1));
      expect.unreachable('powinien zgłosić błąd');
    } catch (error) {
      expect(error).toBeInstanceOf(MatchInputError);
      expect((error as MatchInputError).issues.map(issue => issue.code)).toContain(code);
    }
  });

  it('odrzuca nieprawidłowe przepisy', () => {
    expect(() => startMatch({ ...exampleMatchInput, rules: { setsToWin: 0 } }, createSeededRng(1))).toThrow(MatchInputError);
  });

  it('uwzględnia własne przepisy (mecz do 2 wygranych, sety do 15)', () => {
    const result = simulateMatch(
      { ...exampleMatchInput, rules: { setsToWin: 2, pointsPerSet: 15, pointsInDecidingSet: 11 } },
      createSeededRng(exampleSeed),
    );
    expect(result.setsWon[result.winner]).toBe(2);
    for (const set of result.sets) {
      expect(set.points[set.winner]).toBeGreaterThanOrEqual(set.number === 3 ? 11 : 15);
    }
  });
});
