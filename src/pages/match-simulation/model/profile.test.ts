import { describe, expect, it } from 'vitest';
import { exampleMatchInput } from './examples';
import {
  attributeKeys,
  overallRating,
  playerRoles,
  resolvePlayerProfile,
  roleBaselineProfile,
  roleBaselines,
  roleWeights,
  skillKeys,
  validatePlayerProfile,
  type PlayerBio,
  type ProfileResolution,
} from './profile';
import { validateMatchInput } from './rules';
import type { MatchInput, PlayerRole } from './types';

const context = { seasonStartYear: 2026 };
const bio = (role: PlayerRole, extra: Partial<PlayerBio> = {}): PlayerBio => ({
  role, heightCm: null, attackReachCm: null, blockReachCm: null, birthDate: null, ...extra,
});
const ok = (resolution: ProfileResolution) => {
  if (!resolution.ok) throw new Error(resolution.issues.map(issue => issue.message).join('; '));
  return resolution.profile;
};
const codes = (resolution: ProfileResolution) => (resolution.ok ? [] : resolution.issues.map(issue => `${issue.code}@${issue.path}`));

const completeRecord = {
  schemaVersion: 1,
  skills: { servePower: 90, serveAccuracy: 70, reception: 35, setting: 20, attack: 93, block: 72, defense: 40 },
  attributes: { jumping: 95, stamina: 80, consistency: 75, experience: 85 },
  secondaryPositions: ['OH'],
};

describe('rekord kompletny', () => {
  it('używa wszystkich wartości z danych', () => {
    const profile = ok(resolvePlayerProfile(bio('OPP', { attackReachCm: 330 }), completeRecord, context));
    expect(profile.skills).toEqual(completeRecord.skills);
    expect(profile.attributes).toEqual(completeRecord.attributes);
    expect(profile.positions).toEqual({ primary: 'OPP', secondary: ['OH'] });
    expect(new Set(Object.values(profile.sources))).toEqual(new Set(['data']));
    expect(validatePlayerProfile(profile)).toEqual([]);
  });

  it('akceptuje wartości graniczne 0 i 100', () => {
    expect(resolvePlayerProfile(bio('L'), { skills: { attack: 0, defense: 100 } }, context).ok).toBe(true);
  });
});

describe('rekord niekompletny — jawna strategia braków', () => {
  it('bez danych: profil bazowy pozycji, każde pole oznaczone jako role_default', () => {
    for (const role of playerRoles) {
      const profile = ok(resolvePlayerProfile(bio(role), undefined, context));
      expect(profile.skills).toEqual(roleBaselines[role].skills);
      expect(profile.attributes).toEqual(roleBaselines[role].attributes);
      expect(Object.keys(profile.sources)).toHaveLength(skillKeys.length + attributeKeys.length);
      expect(new Set(Object.values(profile.sources))).toEqual(new Set(['role_default']));
    }
  });

  it('częściowe dane: podane pola z danych, reszta z bio albo z pozycji', () => {
    const profile = ok(resolvePlayerProfile(
      bio('MB', { attackReachCm: 365, birthDate: '1996-04-01' }),
      { skills: { block: 88 } },
      context,
    ));
    expect(profile.skills.block).toBe(88);
    expect(profile.sources['skills.block']).toBe('data');
    expect(profile.skills.attack).toBe(roleBaselines.MB.skills.attack);
    expect(profile.sources['skills.attack']).toBe('role_default');
    expect(profile.attributes.jumping).toBe(90);
    expect(profile.sources['attributes.jumping']).toBe('bio');
    expect(profile.attributes.experience).toBe(80); // 30 lat w sezonie 2026: 20 + 12 × 5
    expect(profile.sources['attributes.experience']).toBe('bio');
  });

  it('dane mają pierwszeństwo przed bio', () => {
    const profile = ok(resolvePlayerProfile(bio('OH', { attackReachCm: 365 }), { attributes: { jumping: 50 } }, context));
    expect(profile.attributes.jumping).toBe(50);
  });

  it('wyprowadzenie z bio jest ograniczone do 0–100 i deterministyczne', () => {
    const high = ok(resolvePlayerProfile(bio('OPP', { attackReachCm: 400, birthDate: '1970-01-01' }), null, context));
    const low = ok(resolvePlayerProfile(bio('OPP', { blockReachCm: 250 }), null, context));
    expect(high.attributes.jumping).toBe(100);
    expect(high.attributes.experience).toBe(100);
    expect(low.attributes.jumping).toBe(0);
    expect(resolvePlayerProfile(bio('OPP', { attackReachCm: 341 }), null, context)).toEqual(
      resolvePlayerProfile(bio('OPP', { attackReachCm: 341 }), null, context),
    );
  });

  it('nieprawidłowa data urodzenia nie jest zgadywana', () => {
    const profile = ok(resolvePlayerProfile(bio('S', { birthDate: '01.02.1999' }), null, context));
    expect(profile.sources['attributes.experience']).toBe('role_default');
  });
});

describe('rekord błędny — walidacja bez przycinania', () => {
  it.each([
    ['rating ponad 100', { skills: { attack: 101 } }, 'out_of_range@skills.attack'],
    ['rating ujemny', { attributes: { stamina: -1 } }, 'out_of_range@attributes.stamina'],
    ['rating niecałkowity', { skills: { block: 70.5 } }, 'invalid_rating@skills.block'],
    ['rating jako tekst', { skills: { block: '70' } }, 'invalid_rating@skills.block'],
    ['NaN', { skills: { block: Number.NaN } }, 'invalid_rating@skills.block'],
    ['literówka w umiejętności', { skills: { atack: 80 } }, 'unknown_field@skills.atack'],
    ['nieznane pole', { mood: 'happy' }, 'unknown_field@mood'],
    ['sekcja nie jest obiektem', { skills: [1, 2] }, 'not_an_object@skills'],
    ['nieobsługiwana wersja', { schemaVersion: 99 }, 'unsupported_version@schemaVersion'],
    ['nieznana pozycja', { secondaryPositions: ['XYZ'] }, 'invalid_position@secondaryPositions'],
    ['pozycja podstawowa jako dodatkowa', { secondaryPositions: ['OPP'] }, 'invalid_position@secondaryPositions'],
    ['libero jako pozycja dodatkowa gracza z pola', { secondaryPositions: ['L'] }, 'invalid_position@secondaryPositions'],
  ])('%s', (_, raw, expected) => {
    const resolution = resolvePlayerProfile(bio('OPP'), raw, context);
    expect(resolution.ok).toBe(false);
    expect(codes(resolution)).toContain(expected);
  });

  it('rekord, który nie jest obiektem, jest odrzucony', () => {
    expect(codes(resolvePlayerProfile(bio('S'), 'mocny', context))).toEqual(['not_an_object@']);
  });

  it('raportuje wszystkie błędy naraz', () => {
    const resolution = resolvePlayerProfile(bio('S'), { skills: { attack: 200, setting: 'x' } }, context);
    expect(codes(resolution)).toEqual(['invalid_rating@skills.setting', 'out_of_range@skills.attack']);
  });

  it('validatePlayerProfile wykrywa niekompletny lub uszkodzony gotowy profil', () => {
    const profile = roleBaselineProfile('OH');
    expect(validatePlayerProfile(undefined)).toHaveLength(1);
    const { attack: _attack, ...skills } = profile.skills;
    void _attack;
    expect(validatePlayerProfile({ ...profile, skills }).map(issue => issue.code)).toEqual(['missing_field']);
    expect(validatePlayerProfile({ ...profile, attributes: { ...profile.attributes, stamina: 140 } }).map(issue => issue.code)).toEqual(['out_of_range']);
  });
});

describe('specjalizacje pozycji', () => {
  /** Umiejętności o najwyższej wadze dla pozycji (libero ma dwie równorzędne). */
  const keySkills = (role: PlayerRole) => {
    const top = Math.max(...Object.values(roleWeights[role]));
    return Object.entries(roleWeights[role]).filter(([, weight]) => weight === top).map(([key]) => key).sort();
  };

  it('kluczowa umiejętność pozycji jest najwyżej oceniana w jej profilu bazowym', () => {
    expect(keySkills('S')).toEqual(['setting']);
    expect(keySkills('OPP')).toEqual(['attack']);
    expect(keySkills('MB')).toEqual(['block']);
    expect(keySkills('OH')).toEqual(['attack', 'reception']);
    expect(keySkills('L')).toEqual(['defense', 'reception']);
    for (const role of playerRoles) {
      const skills = roleBaselines[role].skills;
      const strongest = Object.entries(skills).filter(([, value]) => value === Math.max(...Object.values(skills))).map(([key]) => key);
      expect(keySkills(role)).toEqual(expect.arrayContaining(strongest));
    }
  });

  it('zawodnik jest oceniany najwyżej na swojej pozycji', () => {
    for (const role of playerRoles) {
      const profile = roleBaselineProfile(role);
      const own = overallRating(profile);
      for (const other of playerRoles.filter(candidate => candidate !== role)) {
        expect(overallRating(profile, other)).toBeLessThan(own);
      }
    }
  });

  it('wagi każdej pozycji sumują się do 1', () => {
    for (const role of playerRoles) {
      expect(Object.values(roleWeights[role]).reduce((sum, weight) => sum + weight, 0)).toBeCloseTo(1);
    }
  });
});

describe('dopuszczenie do meczu', () => {
  it('zawodnik bez kompletnego profilu blokuje mecz', () => {
    const [first, ...rest] = exampleMatchInput.teams.A.players;
    const broken = { ...first, profile: { ...first.profile, skills: { ...first.profile.skills, setting: 150 } } };
    const input: MatchInput = { ...exampleMatchInput, teams: { ...exampleMatchInput.teams, A: { ...exampleMatchInput.teams.A, players: [broken, ...rest] } } };
    expect(validateMatchInput(input).map(issue => issue.code)).toEqual(['invalid_profile']);
  });

  it('profil musi zgadzać się z pozycją zawodnika', () => {
    const [first, ...rest] = exampleMatchInput.teams.A.players;
    const input: MatchInput = {
      ...exampleMatchInput,
      teams: { ...exampleMatchInput.teams, A: { ...exampleMatchInput.teams.A, players: [{ ...first, profile: roleBaselineProfile('MB') }, ...rest] } },
    };
    expect(validateMatchInput(input).map(issue => issue.code)).toEqual(['invalid_profile']);
  });
});
