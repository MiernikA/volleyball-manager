/**
 * Schemat i migracje pliku public/data/plusliga-*.json (SIM-02).
 *
 * v1 — pierwotny format importera: { metadata, players } bez pola schemaVersion.
 * v2 — { schemaVersion: 2, metadata, players }, gdzie każdy zawodnik ma opcjonalne pole `simulation`
 *      (surowe dane profilu symulacyjnego, walidowane przy budowie profilu — patrz profile.ts).
 *
 * Migracja jest addytywna: nie usuwa ani nie zmienia istniejących pól, więc stare ekrany działają bez zmian.
 * Uszkodzone rekordy są pomijane z opisem problemu, zamiast psuć całą bazę.
 */

export const DATASET_SCHEMA_VERSION = 2;

export type PlayerPosition = 'S' | 'OPP' | 'OH' | 'MB' | 'L';
export const playerPositions: readonly PlayerPosition[] = ['S', 'OPP', 'OH', 'MB', 'L'];

export interface Player {
  id: string;
  firstName: string;
  lastName: string;
  displayName: string;
  position: PlayerPosition;
  birthDate: string | null;
  nationality: string | null;
  heightCm: number | null;
  weightKg: number | null;
  attackReachCm: number | null;
  blockReachCm: number | null;
  photoUrl: string | null;
  photoCredit?: string | null;
  photoCreditUrl?: string | null;
  sourceUrl: string;
  /** Surowe dane profilu symulacyjnego (v2). Brak = profil z wartości domyślnych pozycji. */
  simulation?: unknown;
}

export interface DatasetMetadata {
  season: string;
  importedAt: string;
  source: string;
  coverage: string;
  complete: boolean;
  notes: string[];
}

export interface PlayerDataset {
  schemaVersion: typeof DATASET_SCHEMA_VERSION;
  metadata: DatasetMetadata;
  players: Player[];
}

export interface DatasetIssue {
  /** Indeks rekordu w tablicy players albo null dla problemów całego pliku. */
  index: number | null;
  playerId: string | null;
  message: string;
}

export class DatasetError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'DatasetError';
  }
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);
const isNullableString = (value: unknown) => value === null || value === undefined || typeof value === 'string';
const isNullableNumber = (value: unknown) => value === null || value === undefined || (typeof value === 'number' && Number.isFinite(value));

function readPlayer(raw: unknown): { player: Player } | { error: string } {
  if (!isRecord(raw)) return { error: 'rekord nie jest obiektem' };
  for (const key of ['id', 'firstName', 'lastName', 'displayName', 'sourceUrl'] as const) {
    if (typeof raw[key] !== 'string' || raw[key] === '') return { error: `brak pola ${key}` };
  }
  if (!playerPositions.includes(raw.position as PlayerPosition)) return { error: `nieznana pozycja ${String(raw.position)}` };
  for (const key of ['birthDate', 'nationality', 'photoUrl'] as const) {
    if (!isNullableString(raw[key])) return { error: `pole ${key} musi być tekstem albo null` };
  }
  for (const key of ['heightCm', 'weightKg', 'attackReachCm', 'blockReachCm'] as const) {
    if (!isNullableNumber(raw[key])) return { error: `pole ${key} musi być liczbą albo null` };
  }
  const player = {
    ...raw,
    birthDate: raw.birthDate ?? null,
    nationality: raw.nationality ?? null,
    heightCm: raw.heightCm ?? null,
    weightKg: raw.weightKg ?? null,
    attackReachCm: raw.attackReachCm ?? null,
    blockReachCm: raw.blockReachCm ?? null,
    photoUrl: raw.photoUrl ?? null,
  } as Player;
  return { player };
}

/** Wersja schematu zapisana w pliku (v1 nie miała pola schemaVersion). */
export function datasetVersion(raw: Record<string, unknown>): number {
  return raw.schemaVersion === undefined ? 1 : Number(raw.schemaVersion);
}

/** v1 → v2: dodaje numer wersji; zawodnicy bez danych symulacyjnych dostaną profil z wartości domyślnych. */
function migrateV1toV2(raw: Record<string, unknown>): Record<string, unknown> {
  return { ...raw, schemaVersion: 2 };
}

const migrations: Record<number, (raw: Record<string, unknown>) => Record<string, unknown>> = { 1: migrateV1toV2 };

/**
 * Wczytuje dowolną obsługiwaną wersję pliku i zwraca dataset w bieżącej wersji.
 * Rzuca DatasetError dla pliku nienadającego się do użycia; błędne rekordy zawodników pomija i raportuje.
 */
export function parsePlayerDataset(raw: unknown): { dataset: PlayerDataset; issues: DatasetIssue[] } {
  if (!isRecord(raw)) throw new DatasetError('Plik danych nie jest obiektem JSON');
  let data = raw;
  let version = datasetVersion(data);
  if (!Number.isInteger(version) || version < 1 || version > DATASET_SCHEMA_VERSION) {
    throw new DatasetError(`Nieobsługiwana wersja danych: ${String(raw.schemaVersion)}`);
  }
  while (version < DATASET_SCHEMA_VERSION) {
    data = migrations[version](data);
    version = datasetVersion(data);
  }

  if (!isRecord(data.metadata) || typeof data.metadata.season !== 'string') throw new DatasetError('Brak metadanych sezonu');
  if (!Array.isArray(data.players)) throw new DatasetError('Brak listy zawodników');

  const issues: DatasetIssue[] = [];
  const players: Player[] = [];
  const seen = new Set<string>();
  data.players.forEach((record, index) => {
    const result = readPlayer(record);
    const playerId = isRecord(record) && typeof record.id === 'string' ? record.id : null;
    if ('error' in result) {
      issues.push({ index, playerId, message: `Pominięto rekord #${index}: ${result.error}` });
    } else if (seen.has(result.player.id)) {
      issues.push({ index, playerId, message: `Pominięto rekord #${index}: zduplikowane id ${result.player.id}` });
    } else {
      seen.add(result.player.id);
      players.push(result.player);
    }
  });

  return {
    dataset: { schemaVersion: DATASET_SCHEMA_VERSION, metadata: data.metadata as unknown as DatasetMetadata, players },
    issues,
  };
}

/** Rok rozpoczęcia sezonu z metadanych („2026/2027” → 2026). */
export function seasonStartYear(metadata: DatasetMetadata): number {
  const year = Number.parseInt(metadata.season, 10);
  if (!Number.isFinite(year)) throw new DatasetError(`Nieprawidłowy sezon: ${metadata.season}`);
  return year;
}
