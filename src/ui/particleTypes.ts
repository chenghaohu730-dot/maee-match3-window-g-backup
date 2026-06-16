import type { SkillLevel } from "../core/skillTypes.ts";
import type {
  CharacterAnchorName,
  CharacterAnimationRuntimeEvent,
  CharacterId,
} from "./characterAnimationTypes.ts";

export interface ParticlePoint {
  x: number;
  y: number;
}

export type ParticleType = "projectile" | "burst" | "aura" | "flash";

export type ParticleTone =
  | "red"
  | "blue"
  | "yellow"
  | "green"
  | "purple"
  | "orange"
  | "generic";

export type ParticleTarget = "player" | "enemy" | "board" | "battle";

export type ParticleLevel = "basic" | SkillLevel | "fallback";

export type ParticleSource = "character" | "battleVfx";

export interface ParticleBase<Type extends ParticleType> {
  id: string;
  type: Type;
  key: string;
  color: string;
  tone: ParticleTone;
  durationMs: number;
  size: number;
  createdAt: number;
  expiresAt: number;
  priority: number;
  className: string;
  source: ParticleSource;
}

export interface ParticleProjectile extends ParticleBase<"projectile"> {
  from: ParticlePoint;
  to: ParticlePoint;
}

export interface ParticleBurst extends ParticleBase<"burst"> {
  position: ParticlePoint;
  count: number;
}

export interface ParticleAura extends ParticleBase<"aura"> {
  target: ParticleTarget;
  position: ParticlePoint;
}

export interface ParticleFlash extends ParticleBase<"flash"> {
  position: ParticlePoint;
}

export type Particle =
  | ParticleProjectile
  | ParticleBurst
  | ParticleAura
  | ParticleFlash;

export interface ParticlePreset {
  key: string;
  color: string;
  tone: ParticleTone;
  level: ParticleLevel;
  cssClass: string;
  durationMs: number;
  size: number;
  projectile: boolean;
  burst: boolean;
  aura: boolean;
  flash: boolean;
  burstCount: number;
  priority: number;
  target: ParticleTarget;
  auraTarget: ParticleTarget;
  maxParticles: number;
}

export interface ParticleEmitContext {
  now?: number;
  vfxKey?: string;
  from?: ParticlePoint;
  to?: ParticlePoint;
  position?: ParticlePoint;
  playerCenter?: ParticlePoint;
  enemyHitPoint?: ParticlePoint;
  battleCenter?: ParticlePoint;
}

export interface ParticlePrimitiveInput {
  key: string;
  now?: number;
  from?: ParticlePoint;
  to?: ParticlePoint;
  position?: ParticlePoint;
  target?: ParticleTarget;
  color?: string;
  durationMs?: number;
  size?: number;
  count?: number;
  source?: ParticleSource;
}

export interface ParticleEmitResult {
  created: Particle[];
  removed: Particle[];
  active: Particle[];
}

export interface CharacterParticleLayerOptions {
  vfxKey?: string;
}

export type CharacterParticleEvent = CharacterAnimationRuntimeEvent;

export type ParticleAnchorResolver = (
  characterId: CharacterId,
  anchorName?: CharacterAnchorName,
) => ParticlePoint;
