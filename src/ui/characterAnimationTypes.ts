import type { AssetKey } from "../assets/assetManifest.ts";

export type CharacterId = "yizai" | "enemy";

export type YizaiAnimationState =
  | "idle"
  | "attack"
  | "skill"
  | "ultimate"
  | "hurt";

export type EnemyAnimationState = "idle" | "hit" | "attack" | "defeat";

export interface CharacterAnimationSnapshot {
  yizai: YizaiAnimationState;
  enemy: EnemyAnimationState;
}

export type CharacterAnchorName =
  | "center"
  | "head"
  | "handLeft"
  | "handRight"
  | "swordTip"
  | "chest"
  | "feet"
  | "enemyHitPoint";

export interface CharacterAnchorPoint {
  x: number;
  y: number;
}

export type CharacterAnchorConfig = Partial<
  Record<CharacterAnchorName, CharacterAnchorPoint>
>;

export type CharacterFrameEventType =
  | "spawnParticle"
  | "hitFrame"
  | "playVfx"
  | "cameraShake"
  | "emitProjectile";

export interface CharacterFrameEvent {
  frame: number;
  type: CharacterFrameEventType;
  key: string;
  anchor?: CharacterAnchorName;
}

export interface CharacterAnimationAlignment {
  baseline: "attack";
  anchor: "feet";
  targetX: number;
  targetY: number;
  tolerancePx: number;
}

export interface SpriteAnimationConfig<StateName extends string = string> {
  key: AssetKey;
  fallbackSheetKey?: AssetKey;
  fallbackKey?: AssetKey;
  frameWidth: number;
  frameHeight: number;
  frameCount: number;
  columns?: number;
  rows?: number;
  fps: number;
  loop: boolean;
  returnTo?: StateName;
  priority: number;
  alignment?: CharacterAnimationAlignment;
  frameEvents?: readonly CharacterFrameEvent[];
  fallbackSheet?: SpriteAnimationFallbackSheetConfig;
}

export interface SpriteAnimationFallbackSheetConfig {
  frameCount: number;
  columns: number;
  rows: number;
  fps?: number;
}

export type CharacterAnimationConfigMap<StateName extends string> = Record<
  StateName,
  SpriteAnimationConfig<StateName>
>;

export interface CharacterAnimationConfigs {
  yizai: CharacterAnimationConfigMap<YizaiAnimationState>;
  enemy: CharacterAnimationConfigMap<EnemyAnimationState>;
}

export interface CharacterAnimationRuntimeEvent {
  characterId: CharacterId;
  animation: string;
  frame: number;
  type: CharacterFrameEventType;
  key: string;
  anchor?: CharacterAnchorName;
  anchorPosition?: CharacterAnchorPoint;
  worldPosition?: CharacterAnchorPoint;
}

export interface CharacterAnimationSource {
  mode: "sheet" | "fallbackImage" | "placeholder";
  key: AssetKey;
  path: string;
  sheet?: SpriteAnimationFallbackSheetConfig;
  fallbackSheetKey?: AssetKey;
  fallbackSheetPath?: string;
  fallbackKey?: AssetKey;
  fallbackPath?: string;
}

export interface CharacterAnimationCompleteEvent {
  characterId: CharacterId;
  animation: string;
  returnTo?: string;
}
