export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

export interface PlayerProgress {
  highestScore: number;
  totalPoints: number;
  unlockedUniverses: string[];
}

export const DEFAULT_UNLOCKED_UNIVERSE = "fairy-tale";

const HIGHEST_SCORE_KEY = "highestScore";
const TOTAL_POINTS_KEY = "totalPoints";
const UNLOCKED_UNIVERSES_KEY = "unlockedUniverses";

export function createDefaultProgress(): PlayerProgress {
  return {
    highestScore: 0,
    totalPoints: 0,
    unlockedUniverses: [DEFAULT_UNLOCKED_UNIVERSE],
  };
}

export function loadPlayerProgress(storage: StorageLike | undefined): PlayerProgress {
  const fallback = createDefaultProgress();

  if (!storage) {
    return fallback;
  }

  const progress: PlayerProgress = {
    highestScore: readNumber(storage, HIGHEST_SCORE_KEY),
    totalPoints: readNumber(storage, TOTAL_POINTS_KEY),
    unlockedUniverses: readUnlockedUniverses(storage),
  };

  if (!progress.unlockedUniverses.includes(DEFAULT_UNLOCKED_UNIVERSE)) {
    progress.unlockedUniverses.unshift(DEFAULT_UNLOCKED_UNIVERSE);
  }

  return progress;
}

export function savePlayerProgress(
  progress: PlayerProgress,
  storage: StorageLike | undefined,
): void {
  if (!storage) {
    return;
  }

  storage.setItem(HIGHEST_SCORE_KEY, String(safeInteger(progress.highestScore)));
  storage.setItem(TOTAL_POINTS_KEY, String(safeInteger(progress.totalPoints)));
  storage.setItem(
    UNLOCKED_UNIVERSES_KEY,
    JSON.stringify(normalizeUnlockedUniverses(progress.unlockedUniverses)),
  );
}

export function applyScoreProgress(
  progress: PlayerProgress,
  scoreDelta: number,
  currentScore: number,
): PlayerProgress {
  return {
    highestScore: Math.max(
      safeInteger(progress.highestScore),
      safeInteger(currentScore),
    ),
    totalPoints:
      safeInteger(progress.totalPoints) + Math.max(0, safeInteger(scoreDelta)),
    unlockedUniverses: normalizeUnlockedUniverses(progress.unlockedUniverses),
  };
}

export function isUniverseUnlocked(
  progress: PlayerProgress,
  universeId: string,
): boolean {
  return normalizeUnlockedUniverses(progress.unlockedUniverses).includes(
    universeId,
  );
}

function readNumber(storage: StorageLike, key: string): number {
  const raw = storage.getItem(key);
  const parsed = raw === null ? 0 : Number(raw);
  return safeInteger(parsed);
}

function readUnlockedUniverses(storage: StorageLike): string[] {
  const raw = storage.getItem(UNLOCKED_UNIVERSES_KEY);

  if (!raw) {
    return [DEFAULT_UNLOCKED_UNIVERSE];
  }

  try {
    const parsed: unknown = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      return normalizeUnlockedUniverses(
        parsed.filter((item): item is string => typeof item === "string"),
      );
    }
  } catch {
    return [DEFAULT_UNLOCKED_UNIVERSE];
  }

  return [DEFAULT_UNLOCKED_UNIVERSE];
}

function normalizeUnlockedUniverses(universes: string[]): string[] {
  const seen = new Set<string>();
  const normalized: string[] = [];

  for (const universe of universes) {
    if (!universe || seen.has(universe)) {
      continue;
    }

    seen.add(universe);
    normalized.push(universe);
  }

  if (!seen.has(DEFAULT_UNLOCKED_UNIVERSE)) {
    normalized.unshift(DEFAULT_UNLOCKED_UNIVERSE);
  }

  return normalized;
}

function safeInteger(value: number): number {
  return Number.isFinite(value) ? Math.max(0, Math.floor(value)) : 0;
}
