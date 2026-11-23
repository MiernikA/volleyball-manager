/**
 * Profil symulacyjny zawodnika (SIM-02): ratingi umiejętności, atrybuty pomocnicze i preferencje pozycyjne.
 *
 * Strategia braków jest jawna i deterministyczna: każda wartość pochodzi z danych (`data`), z danych
 * biograficznych (`bio`) albo z profilu bazowego pozycji (`role_default`). Nic nie jest losowane.
 * Szczegóły: docs/sim-02-profil-zawodnika.md.
 */
import type { PlayerRole } from './types';

export const PROFILE_SCHEMA_VERSION = 1;
export const RATING_MIN = 0;
export const RATING_MAX = 100;

export const skillKeys = ['servePower', 'serveAccuracy', 'reception', 'setting', 'attack', 'block', 'defense'] as const;
export const attributeKeys = ['jumping', 'stamina', 'consistency', 'experience'] as const;
export const playerRoles: readonly PlayerRole[] = ['S', 'OPP', 'OH', 'MB', 'L'];

export type SkillKey = (typeof skillKeys)[number];
export type AttributeKey = (typeof attributeKeys)[number];
/** Liczba całkowita z przedziału 0–100. */
export type Rating = number;
export type SkillRatings = Readonly<Record<SkillKey, Rating>>;
export type Attributes = Readonly<Record<AttributeKey, Rating>>;
export type ProfileField = `skills.${SkillKey}` | `attributes.${AttributeKey}`;
export type FieldSource = 'data' | 'bio' | 'role_default';

export interface PositionPreferences {
  primary: PlayerRole;
  /** Pozycje, na których zawodnik może awaryjnie zagrać, w kolejności preferencji. */
  secondary: readonly PlayerRole[];
}

export interface PlayerProfile {
  schemaVersion: typeof PROFILE_SCHEMA_VERSION;
  skills: SkillRatings;
  attributes: Attributes;
  positions: PositionPreferences;
  /** Pochodzenie każdej wartości. */
  sources: Readonly<Record<ProfileField, FieldSource>>;
}

/** Dane biograficzne, z których można wyprowadzić część atrybutów. */
export interface PlayerBio {
  role: PlayerRole;
  heightCm: number | null;
  attackReachCm: number | null;
  blockReachCm: number | null;
  /** Format RRRR-MM-DD. */
  birthDate: string | null;
}

export interface ProfileContext {
  /** Rok rozpoczęcia sezonu (np. 2026 dla 2026/2027) — punkt odniesienia dla wieku, zamiast zegara. */
  seasonStartYear: number;
}

// ── Profile bazowe pozycji ──────────────────────────────────────────────────

interface RoleBaseline {
  skills: SkillRatings;
  attributes: Attributes;
}

/**
 * Średni zawodnik ligowy na danej pozycji. Specjalizacja widoczna jest w kluczowych umiejętnościach,
 * np. rozgrywający 78 w rozegraniu, libero 5 w ataku.
 */
export const roleBaselines: Readonly<Record<PlayerRole, RoleBaseline>> = {
  S: {
    skills: { servePower: 55, serveAccuracy: 65, reception: 40, setting: 78, attack: 45, block: 50, defense: 60 },
    attributes: { jumping: 60, stamina: 70, consistency: 65, experience: 60 },
  },
  OPP: {
    skills: { servePower: 75, serveAccuracy: 55, reception: 30, setting: 25, attack: 78, block: 60, defense: 45 },
    attributes: { jumping: 70, stamina: 65, consistency: 60, experience: 60 },
  },
  OH: {
    skills: { servePower: 62, serveAccuracy: 62, reception: 70, setting: 35, attack: 70, block: 52, defense: 62 },
    attributes: { jumping: 65, stamina: 70, consistency: 60, experience: 60 },
  },
  MB: {
    skills: { servePower: 58, serveAccuracy: 62, reception: 20, setting: 25, attack: 65, block: 76, defense: 35 },
    attributes: { jumping: 70, stamina: 65, consistency: 62, experience: 60 },
  },
  L: {
    skills: { servePower: 10, serveAccuracy: 10, reception: 78, setting: 45, attack: 5, block: 5, defense: 80 },
    attributes: { jumping: 40, stamina: 70, consistency: 68, experience: 60 },
  },
};

/** Wagi umiejętności dla oceny ogólnej na pozycji — definiują, co znaczy „dobry” zawodnik danej specjalizacji. */
export const roleWeights: Readonly<Record<PlayerRole, Partial<Record<SkillKey | AttributeKey, number>>>> = {
  S: { setting: 0.5, defense: 0.15, serveAccuracy: 0.1, block: 0.1, servePower: 0.05, consistency: 0.1 },
  OPP: { attack: 0.5, servePower: 0.2, block: 0.15, jumping: 0.1, consistency: 0.05 },
  OH: { attack: 0.3, reception: 0.3, defense: 0.15, servePower: 0.1, serveAccuracy: 0.05, consistency: 0.1 },
  MB: { block: 0.45, attack: 0.3, jumping: 0.15, serveAccuracy: 0.1 },
  L: { reception: 0.45, defense: 0.45, consistency: 0.1 },
};

/** Ocena ogólna 0–100 profilu grającego na danej pozycji (domyślnie na pozycji podstawowej). */
export function overallRating(profile: PlayerProfile, role: PlayerRole = profile.positions.primary): Rating {
  const values: Record<SkillKey | AttributeKey, number> = { ...profile.skills, ...profile.attributes };
  let sum = 0;
  let total = 0;
  for (const [key, weight] of Object.entries(roleWeights[role]) as [SkillKey | AttributeKey, number][]) {
    sum += values[key] * weight;
    total += weight;
  }
  return Math.round(sum / total);
}

// ── Wyprowadzanie z danych biograficznych ────────────────────────────────────

const clampRating = (value: number): Rating => Math.min(RATING_MAX, Math.max(RATING_MIN, Math.round(value)));
const linear = (value: number, from: number, to: number, fromRating: number, toRating: number) =>
  clampRating(fromRating + ((value - from) / (to - from)) * (toRating - fromRating));

/** Skoczność z zasięgu w ataku (320 cm → 40, 365 cm → 90), a gdy go brak — z zasięgu w bloku (300 → 40, 345 → 90). */
export function jumpingFromBio(bio: PlayerBio): Rating | null {
  if (bio.attackReachCm != null) return linear(bio.attackReachCm, 320, 365, 40, 90);
  if (bio.blockReachCm != null) return linear(bio.blockReachCm, 300, 345, 40, 90);
  return null;
}

/** Doświadczenie z wieku w sezonie: 18 lat → 20, każdy rok +5, maks. 100. */
export function experienceFromBio(bio: PlayerBio, context: ProfileContext): Rating | null {
  const match = bio.birthDate ? /^(\d{4})-\d{2}-\d{2}$/.exec(bio.birthDate) : null;
  if (!match) return null;
  const age = context.seasonStartYear - Number(match[1]);
  return clampRating(20 + (age - 18) * 5);
}

// ── Walidacja i rozwiązywanie profilu ─────────────────────────────────────────

export type ProfileIssueCode =
  | 'not_an_object'
  | 'unsupported_version'
  | 'unknown_field'
  | 'invalid_rating'
  | 'out_of_range'
  | 'invalid_position'
  | 'missing_field';

export interface ProfileIssue {
  code: ProfileIssueCode;
  path: string;
  message: string;
}

export type ProfileResolution =
  | { ok: true; profile: PlayerProfile }
  | { ok: false; issues: ProfileIssue[] };

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

function checkRating(value: unknown, path: string, issues: ProfileIssue[]): value is Rating {
  if (typeof value !== 'number' || !Number.isInteger(value)) {
    issues.push({ code: 'invalid_rating', path, message: `${path}: rating musi być liczbą całkowitą` });
    return false;
  }
  if (value < RATING_MIN || value > RATING_MAX) {
    issues.push({ code: 'out_of_range', path, message: `${path}: rating ${value} poza zakresem ${RATING_MIN}–${RATING_MAX}` });
    return false;
  }
  return true;
}

function checkPositions(primary: PlayerRole, secondary: unknown, issues: ProfileIssue[]): PlayerRole[] {
  const path = 'secondaryPositions';
  if (!Array.isArray(secondary)) {
    issues.push({ code: 'invalid_position', path, message: `${path}: oczekiwano listy pozycji` });
    return [];
  }
  const result: PlayerRole[] = [];
  for (const role of secondary) {
    if (!playerRoles.includes(role as PlayerRole)) {
      issues.push({ code: 'invalid_position', path, message: `${path}: nieznana pozycja ${String(role)}` });
    } else if (role === primary || result.includes(role as PlayerRole)) {
      issues.push({ code: 'invalid_position', path, message: `${path}: pozycja ${role} powtórzona` });
    } else if ((role === 'L') !== (primary === 'L')) {
      issues.push({ code: 'invalid_position', path, message: `${path}: libero nie może grać w polu i odwrotnie` });
    } else {
      result.push(role as PlayerRole);
    }
  }
  return result;
}

const rawTopLevelKeys = new Set(['schemaVersion', 'skills', 'attributes', 'secondaryPositions']);

/**
 * Buduje kompletny profil z (opcjonalnych) danych symulacyjnych zawodnika.
 * Braki uzupełnia jawnie: dane → dane biograficzne → profil bazowy pozycji.
 * Błędne wartości nie są przycinane ani zastępowane — zwracany jest wynik z listą problemów.
 */
export function resolvePlayerProfile(bio: PlayerBio, raw: unknown, context: ProfileContext): ProfileResolution {
  const issues: ProfileIssue[] = [];
  const input: unknown = raw ?? {};
  if (!isRecord(input)) {
    return { ok: false, issues: [{ code: 'not_an_object', path: '', message: 'Profil symulacyjny musi być obiektem' }] };
  }
  const data: Record<string, unknown> = input;
  if (data.schemaVersion !== undefined && data.schemaVersion !== PROFILE_SCHEMA_VERSION) {
    issues.push({ code: 'unsupported_version', path: 'schemaVersion', message: `Nieobsługiwana wersja profilu: ${String(data.schemaVersion)}` });
  }
  for (const key of Object.keys(data)) {
    if (!rawTopLevelKeys.has(key)) issues.push({ code: 'unknown_field', path: key, message: `Nieznane pole: ${key}` });
  }

  const sources = {} as Record<ProfileField, FieldSource>;
  const baseline = roleBaselines[bio.role];
  const derived: Partial<Record<AttributeKey, Rating | null>> = {
    jumping: jumpingFromBio(bio),
    experience: experienceFromBio(bio, context),
  };

  function readGroup<K extends string>(group: 'skills' | 'attributes', keys: readonly K[], defaults: Readonly<Record<K, Rating>>, fromBio: Partial<Record<K, Rating | null>>) {
    const section = data[group] ?? {};
    const values = {} as Record<K, Rating>;
    if (!isRecord(section)) {
      issues.push({ code: 'not_an_object', path: group, message: `${group}: oczekiwano obiektu` });
      return values;
    }
    for (const key of Object.keys(section)) {
      if (!keys.includes(key as K)) issues.push({ code: 'unknown_field', path: `${group}.${key}`, message: `Nieznane pole: ${group}.${key}` });
    }
    for (const key of keys) {
      const path = `${group}.${key}` as ProfileField;
      const value = section[key];
      const bioValue = fromBio[key];
      if (value !== undefined) {
        if (checkRating(value, path, issues)) {
          values[key] = value;
          sources[path] = 'data';
        }
      } else if (bioValue != null) {
        values[key] = bioValue;
        sources[path] = 'bio';
      } else {
        values[key] = defaults[key];
        sources[path] = 'role_default';
      }
    }
    return values;
  }

  const skills = readGroup('skills', skillKeys, baseline.skills, {});
  const attributes = readGroup('attributes', attributeKeys, baseline.attributes, derived);
  const secondary = data.secondaryPositions === undefined ? [] : checkPositions(bio.role, data.secondaryPositions, issues);

  if (issues.length > 0) return { ok: false, issues };
  return {
    ok: true,
    profile: {
      schemaVersion: PROFILE_SCHEMA_VERSION,
      skills,
      attributes,
      positions: { primary: bio.role, secondary },
      sources,
    },
  };
}

/** Sprawdza, czy gotowy profil jest kompletny i poprawny (np. przed meczem albo po deserializacji). */
export function validatePlayerProfile(profile: unknown): ProfileIssue[] {
  const issues: ProfileIssue[] = [];
  if (!isRecord(profile)) return [{ code: 'not_an_object', path: '', message: 'Brak profilu symulacyjnego' }];
  if (profile.schemaVersion !== PROFILE_SCHEMA_VERSION) {
    issues.push({ code: 'unsupported_version', path: 'schemaVersion', message: 'Nieobsługiwana wersja profilu' });
  }
  for (const [group, keys] of [['skills', skillKeys], ['attributes', attributeKeys]] as const) {
    const section = profile[group];
    if (!isRecord(section)) {
      issues.push({ code: 'missing_field', path: group, message: `Brak sekcji ${group}` });
      continue;
    }
    for (const key of keys) {
      const path = `${group}.${key}`;
      if (section[key] === undefined) issues.push({ code: 'missing_field', path, message: `Brak wartości ${path}` });
      else checkRating(section[key], path, issues);
    }
  }
  const positions = profile.positions;
  if (!isRecord(positions) || !playerRoles.includes(positions.primary as PlayerRole)) {
    issues.push({ code: 'invalid_position', path: 'positions.primary', message: 'Brak pozycji podstawowej' });
  } else {
    checkPositions(positions.primary as PlayerRole, positions.secondary, issues);
  }
  return issues;
}

/** Profil bazowy pozycji — np. do przykładów i testów. */
export function roleBaselineProfile(role: PlayerRole): PlayerProfile {
  const resolution = resolvePlayerProfile({ role, heightCm: null, attackReachCm: null, blockReachCm: null, birthDate: null }, null, { seasonStartYear: 0 });
  if (!resolution.ok) throw new Error('Profil bazowy musi być poprawny');
  return resolution.profile;
}
