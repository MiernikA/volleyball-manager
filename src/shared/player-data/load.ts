import { parsePlayerDataset, type PlayerDataset } from './dataset';

export const datasetUrl = `${import.meta.env.BASE_URL}data/plusliga-2026-27.json`;

/** Pobiera, migruje i normalizuje bazę zawodników (ścieżki portretów względem BASE_URL). */
export async function loadPlayerDataset(): Promise<PlayerDataset> {
  const response = await fetch(datasetUrl);
  if (!response.ok) throw new Error('Nie udało się wczytać zawodników');
  const { dataset, issues } = parsePlayerDataset(await response.json());
  issues.forEach(issue => console.warn(`[dane zawodników] ${issue.message}`));
  return {
    ...dataset,
    players: dataset.players.map(player => ({
      ...player,
      photoUrl: player.photoUrl?.startsWith('/') ? `${import.meta.env.BASE_URL}${player.photoUrl.slice(1)}` : player.photoUrl,
    })),
  };
}
