import type { PlayerProgress } from "./progressionStore.ts";
import { isUniverseUnlocked } from "./progressionStore.ts";

export type SceneName = "start" | "universe" | "gameplay";

export type ModalKind =
  | "leaderboard"
  | "points"
  | "exchange"
  | "settings"
  | "locked";

export interface UniverseCard {
  id: string;
  name: string;
  status: "unlocked" | "locked";
  description: string;
}

export interface UniverseSelectionResult {
  scene: SceneName;
  modal: ModalKind | null;
}

export const UNIVERSE_CARDS: UniverseCard[] = [
  {
    id: "fairy-tale",
    name: "童话宇宙",
    status: "unlocked",
    description: "6 波战斗关卡",
  },
  {
    id: "work",
    name: "打工宇宙",
    status: "locked",
    description: "待积分兑换",
  },
  {
    id: "doors-windows",
    name: "门窗宇宙",
    status: "locked",
    description: "待积分兑换",
  },
];

export function nextSceneForStartButton(): SceneName {
  return "universe";
}

export function selectUniverse(
  progress: PlayerProgress,
  universeId: string,
): UniverseSelectionResult {
  if (isUniverseUnlocked(progress, universeId)) {
    return {
      scene: "gameplay",
      modal: null,
    };
  }

  return {
    scene: "universe",
    modal: "locked",
  };
}
