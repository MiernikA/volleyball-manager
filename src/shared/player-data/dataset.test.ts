import { describe, expect, it } from 'vitest';
import { resolvePlayerProfile } from '@/pages/match-simulation/model';
import realFileJson from '../../../public/data/plusliga-2026-27.json';
import { DATASET_SCHEMA_VERSION, DatasetError, parsePlayerDataset, seasonStartYear } from './dataset';

/** Kopia prawdziwego pliku z bazy — test sprawdza, że migracja go nie psuje. */
const realFile = structuredClone(realFileJson);

const record = (overrides: Record<string, unknown> = {}) => ({
  id: 'p1', firstName: 'Jan', lastName: 'Test', displayName: 'Jan Test', position: 'OH', birthDate: null,
  nationality: null, heightCm: null, weightKg: null, attackReachCm: null, blockReachCm: null, photoUrl: null,
  sourceUrl: 'https://www.plusliga.pl', ...overrides,
});
const metadata = { season: '2026/2027', importedAt: '2026-10-14', source: 'test', coverage: 'test', complete: false, notes: [] };

describe('migracja obecnego pliku JSON (v1 → v2)', () => {
  const { dataset, issues } = parsePlayerDataset(realFile);

  it('nie gubi ani nie zmienia żadnego zawodnika', () => {
    expect(issues).toEqual([]);
    expect(dataset.schemaVersion).toBe(DATASET_SCHEMA_VERSION);
    expect(dataset.players).toEqual(realFile.players);
    expect(dataset.metadata).toEqual(realFile.metadata);
  });

  it('każdy zawodnik z bazy dostaje kompletny profil symulacyjny', () => {
    const context = { seasonStartYear: seasonStartYear(dataset.metadata) };
    expect(context.seasonStartYear).toBe(2026);
    for (const player of dataset.players) {
      const resolution = resolvePlayerProfile(
        { role: player.position, heightCm: player.heightCm, attackReachCm: player.attackReachCm, blockReachCm: player.blockReachCm, birthDate: player.birthDate },
        player.simulation,
        context,
      );
      expect(resolution.ok, player.id).toBe(true);
    }
  });

  it('migracja jest idempotentna (v2 wczytuje się bez zmian)', () => {
    expect(parsePlayerDataset(dataset).dataset).toEqual(dataset);
  });
});

describe('rekordy w pliku', () => {
  it('zachowuje dane symulacyjne zawodnika', () => {
    const simulation = { skills: { attack: 90 } };
    const { dataset } = parsePlayerDataset({ schemaVersion: 2, metadata, players: [record({ simulation })] });
    expect(dataset.players[0].simulation).toEqual(simulation);
  });

  it('uzupełnia brakujące pola biograficzne wartością null', () => {
    const { id, firstName, lastName, displayName, position, sourceUrl } = record();
    const { dataset, issues } = parsePlayerDataset({ metadata, players: [{ id, firstName, lastName, displayName, position, sourceUrl }] });
    expect(issues).toEqual([]);
    expect(dataset.players[0]).toMatchObject({ heightCm: null, birthDate: null, photoUrl: null });
  });

  it('pomija błędne rekordy z opisem, zostawiając resztę bazy', () => {
    const { dataset, issues } = parsePlayerDataset({
      metadata,
      players: [
        record(),
        record({ id: 'p2', position: 'XX' }),
        record({ id: '' }),
        record({ id: 'p3', heightCm: '201' }),
        'nie-obiekt',
        record({ firstName: 'Duplikat' }),
        record({ id: 'p4' }),
      ],
    });
    expect(dataset.players.map(player => player.id)).toEqual(['p1', 'p4']);
    expect(issues.map(issue => issue.index)).toEqual([1, 2, 3, 4, 5]);
    expect(issues[0].message).toContain('nieznana pozycja XX');
    expect(issues[4].message).toContain('zduplikowane id p1');
  });

  it('odrzuca plik, którego nie da się użyć', () => {
    expect(() => parsePlayerDataset(null)).toThrow(DatasetError);
    expect(() => parsePlayerDataset({ schemaVersion: 3, metadata, players: [] })).toThrow('Nieobsługiwana wersja');
    expect(() => parsePlayerDataset({ schemaVersion: 'abc', metadata, players: [] })).toThrow(DatasetError);
    expect(() => parsePlayerDataset({ metadata, players: {} })).toThrow('Brak listy zawodników');
    expect(() => parsePlayerDataset({ players: [] })).toThrow('Brak metadanych');
  });
});
