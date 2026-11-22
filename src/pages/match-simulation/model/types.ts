/**
 * Kontrakty domeny symulacji meczu (SIM-01).
 *
 * Ten moduł opisuje wyłącznie dane — bez Reacta, Zustand, zegara i Math.random.
 * Decyzje i uproszczenia względem przepisów: docs/sim-01-domena-meczu.md.
 */

// ── Identyfikatory ────────────────────────────────────────────────────────────

/** Strona meczu. „A” i „B” to drużyny z ekranu „Przygotowanie meczu”. */
export type TeamSide = 'A' | 'B';
export type PlayerId = string;
/** Strefa na boisku zgodnie z przepisami: 1 = zagrywka (prawy tył), dalej przeciwnie do ruchu wskazówek zegara. */
export type RotationSlot = 1 | 2 | 3 | 4 | 5 | 6;
/** Numer seta liczony od 1. */
export type SetNumber = number;

export type PlayerRole = 'S' | 'OPP' | 'OH' | 'MB' | 'L';

// ── Wejście ───────────────────────────────────────────────────────────────────

export interface MatchPlayer {
  id: PlayerId;
  name: string;
  role: PlayerRole;
}

/** Ustawienie sześciu zawodników w strefach 1–6. */
export type Rotation = Readonly<Record<RotationSlot, PlayerId>>;

export interface MatchTeamInput {
  name: string;
  /** Ustawienie startowe każdego seta. */
  rotation: Rotation;
  liberoId: PlayerId | null;
  /** Wszyscy zawodnicy, do których odwołuje się skład (szóstka + libero). */
  players: readonly MatchPlayer[];
}

export interface MatchRules {
  /** Liczba wygranych setów potrzebna do zwycięstwa (3 → mecz do trzech wygranych). */
  setsToWin: number;
  pointsPerSet: number;
  pointsInDecidingSet: number;
  /** Minimalna przewaga punktowa na koniec seta. */
  minLead: number;
  /** Bezpiecznik: przekroczenie oznacza błąd resolvera, a nie normalny mecz. */
  maxRalliesPerSet: number;
}

export interface MatchInput {
  teams: Readonly<Record<TeamSide, MatchTeamInput>>;
  /** Brakujące pola uzupełniają domyślne przepisy (defaultRules). */
  rules?: Partial<MatchRules>;
}

// ── Stan ──────────────────────────────────────────────────────────────────────

export type Score = Readonly<Record<TeamSide, number>>;

/** Stan seta w toku. */
export interface SetState {
  number: SetNumber;
  points: Score;
  /** Drużyna, która zagrywała jako pierwsza w tym secie. */
  firstServer: TeamSide;
}

/**
 * Pełny stan meczu między wymianami. Posiadanie zagrywki to `serving`:
 * zagrywa zawodnik ze strefy 1 drużyny `serving`.
 */
export interface MatchState {
  phase: 'in_progress' | 'finished';
  setsWon: Score;
  completedSets: readonly SetSummary[];
  currentSet: SetState;
  serving: TeamSide;
  rotations: Readonly<Record<TeamSide, Rotation>>;
  /** Liczba rozegranych wymian w całym meczu. */
  rallyCount: number;
  /** Numer ostatniego wyemitowanego zdarzenia (seq). */
  lastSeq: number;
}

// ── Wymiana ───────────────────────────────────────────────────────────────────

/**
 * Przyczyna zakończenia akcji. Opisuje, kto zdobył punkt i dlaczego.
 * W SIM-01 wymiana jest atomowa: liczy się tylko jej wynik.
 * Fazy pośrednie (przyjęcie, rozegranie, obrona) dojdą w kolejnych ticketach.
 */
export type RallyEndReason =
  | 'ace' // as serwisowy — punkt dla zagrywających
  | 'service_error' // błąd zagrywki — punkt dla odbierających
  | 'attack_kill' // skończony atak — punkt dla atakujących
  | 'block_point' // punktowy blok — punkt dla blokujących
  | 'attack_error' // atak w aut / w siatkę — punkt dla przeciwnika
  | 'unforced_error'; // inny błąd własny (dotknięcie siatki, przejście linii…)

/** Przyczyny, przy których punkt zdobywa drużyna popełniająca akcję; pozostałe to błędy przeciwnika. */
export const pointScoringReasons: ReadonlySet<RallyEndReason> = new Set(['ace', 'attack_kill', 'block_point']);

/** Wszystko, co resolver wymiany może wiedzieć o sytuacji. Niemodyfikowalne. */
export interface RallyContext {
  setNumber: SetNumber;
  rallyNumber: number;
  serving: TeamSide;
  score: Score;
  rotations: Readonly<Record<TeamSide, Rotation>>;
  teams: Readonly<Record<TeamSide, MatchTeamInput>>;
}

export interface RallyOutcome {
  winner: TeamSide;
  reason: RallyEndReason;
  /** Zawodnik, któremu przypisujemy akcję (autor punktu albo błędu). */
  playerId: PlayerId;
}

/**
 * Strategia rozstrzygania wymiany. Jedyne miejsce losowości — dostaje wstrzyknięty RNG.
 * SIM-19 dostarczy implementację opartą na statystykach zawodników.
 */
export type RallyResolver = (context: RallyContext, rng: RandomSource) => RallyOutcome;

// ── Losowość ──────────────────────────────────────────────────────────────────

/** Źródło liczb pseudolosowych. `next()` zwraca liczbę z przedziału [0, 1). */
export interface RandomSource {
  next(): number;
}

// ── Zdarzenia i wynik ─────────────────────────────────────────────────────────

interface EventBase {
  /** Numer porządkowy zdarzenia w meczu (od 1); jedyna „oś czasu” domeny. */
  seq: number;
}

export type MatchEvent =
  | (EventBase & { type: 'match_started'; firstServer: TeamSide })
  | (EventBase & { type: 'set_started'; set: SetNumber; server: TeamSide })
  | (EventBase & {
      type: 'rally_ended';
      set: SetNumber;
      rally: number;
      serving: TeamSide;
      serverId: PlayerId;
      winner: TeamSide;
      reason: RallyEndReason;
      playerId: PlayerId;
      score: Score;
    })
  | (EventBase & { type: 'rotated'; side: TeamSide; rotation: Rotation })
  | (EventBase & { type: 'set_ended'; set: SetNumber; winner: TeamSide; score: Score })
  | (EventBase & { type: 'match_ended'; winner: TeamSide; setsWon: Score });

export type MatchEventType = MatchEvent['type'];

export interface SetSummary {
  number: SetNumber;
  points: Score;
  winner: TeamSide;
}

export interface MatchResult {
  winner: TeamSide;
  setsWon: Score;
  sets: readonly SetSummary[];
  totalRallies: number;
  events: readonly MatchEvent[];
}
