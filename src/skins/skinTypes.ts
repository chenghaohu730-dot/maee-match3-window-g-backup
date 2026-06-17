import type { AssetKey } from "../assets/assetManifest.ts";
import type { PieceType } from "../core/board.ts";

export type FallbackKind =
  | "background"
  | "button"
  | "card"
  | "cell"
  | "hero"
  | "icon"
  | "monster"
  | "panel"
  | "piece"
  | "vfx";

export interface SkinResource {
  key: AssetKey;
  path: string;
  available: boolean;
  fallbackKind: FallbackKind;
  fallbackClass: string;
  fallbackLabel: string;
  productionTier: "pro" | "standard" | "legacy-ai";
  legacyAiSheet: boolean;
  deprecated: boolean;
}

export interface SkinSceneClasses {
  start: string;
  universe: string;
  gameplay: string;
}

export type HeroAnimationState =
  | "idle"
  | "attack"
  | "skill"
  | "ultimate"
  | "hurt";

export type MonsterAssetState = "idle" | "hit" | "attack" | "defeat";

export interface SkinAnimation {
  id: string;
  frames: AssetKey[];
  frameRate: number;
  loop: boolean;
  fallbackClass: string;
  fallbackLabel: string;
}

export interface SkinAnimationSet {
  yizai: Record<HeroAnimationState, SkinAnimation>;
  monsters: Record<string, SkinAnimation>;
  vfx: Record<string, SkinAnimation>;
}

export interface Match3Skin {
  id: string;
  displayName: string;
  resources: Record<AssetKey, SkinResource>;
  pieceAssets: Record<PieceType, AssetKey>;
  monsterAssets: Record<string, AssetKey>;
  monsterStateAssets: Record<string, Record<MonsterAssetState, AssetKey>>;
  vfxAssets: Record<string, AssetKey>;
  animations: SkinAnimationSet;
  sceneClasses: SkinSceneClasses;
}

export function getSkinResource(
  skin: Match3Skin,
  key: AssetKey,
): SkinResource {
  return skin.resources[key];
}

export function hasImageResource(resource: SkinResource): boolean {
  return resource.available && resource.path.length > 0;
}
