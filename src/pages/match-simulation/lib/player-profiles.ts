import type { Player } from '@/shared/player-data';
import {
  resolvePlayerProfile,
  type AttributeKey,
  type FieldSource,
  type ProfileResolution,
  type SkillKey,
} from '../model';

/** Profil symulacyjny zawodnika z bazy. Deterministyczny: ten sam rekord i sezon dają ten sam profil. */
export function profileForPlayer(player: Player, seasonStartYear: number): ProfileResolution {
  return resolvePlayerProfile(
    {
      role: player.position,
      heightCm: player.heightCm,
      attackReachCm: player.attackReachCm,
      blockReachCm: player.blockReachCm,
      birthDate: player.birthDate,
    },
    player.simulation,
    { seasonStartYear },
  );
}

export const skillLabels: Record<SkillKey, string> = {
  servePower: 'Siła zagrywki',
  serveAccuracy: 'Precyzja zagrywki',
  reception: 'Przyjęcie',
  setting: 'Rozegranie',
  attack: 'Atak',
  block: 'Blok',
  defense: 'Obrona',
};

export const attributeLabels: Record<AttributeKey, string> = {
  jumping: 'Skoczność',
  stamina: 'Kondycja',
  consistency: 'Regularność',
  experience: 'Doświadczenie',
};

export const sourceLabels: Record<FieldSource, string> = {
  data: 'z danych zawodnika',
  bio: 'wyliczone z danych biograficznych',
  role_default: 'wartość domyślna pozycji',
};
