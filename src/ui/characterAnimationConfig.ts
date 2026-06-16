import type {
  CharacterAnchorConfig,
  CharacterAnchorName,
  CharacterAnchorPoint,
  CharacterAnimationConfigMap,
  CharacterAnimationConfigs,
  CharacterId,
  EnemyAnimationState,
  SpriteAnimationConfig,
  YizaiAnimationState,
} from "./characterAnimationTypes.ts";

export const YIZAI_ANIMATION_CONFIG = {
  idle: {
    key: "yizai_hero_idle_sheet",
    fallbackKey: "yizai_hero_idle",
    frameWidth: 512,
    frameHeight: 512,
    frameCount: 4,
    fps: 6,
    loop: true,
    priority: 0,
  },
  attack: {
    key: "yizai_hero_attack_sheet",
    fallbackKey: "yizai_hero_attack",
    frameWidth: 512,
    frameHeight: 512,
    frameCount: 6,
    fps: 12,
    loop: false,
    returnTo: "idle",
    priority: 10,
    frameEvents: [
      {
        frame: 3,
        type: "hitFrame",
        key: "yizai_basic_hit",
        anchor: "swordTip",
      },
    ],
  },
  skill: {
    key: "yizai_hero_skill_sheet",
    fallbackKey: "yizai_hero_skill",
    frameWidth: 512,
    frameHeight: 512,
    frameCount: 8,
    fps: 12,
    loop: false,
    returnTo: "idle",
    priority: 20,
    frameEvents: [
      {
        frame: 2,
        type: "spawnParticle",
        key: "skill_charge",
        anchor: "handRight",
      },
      {
        frame: 5,
        type: "emitProjectile",
        key: "skill_projectile",
        anchor: "handRight",
      },
    ],
  },
  ultimate: {
    key: "yizai_hero_ultimate_sheet",
    fallbackKey: "yizai_hero_ultimate",
    frameWidth: 512,
    frameHeight: 512,
    frameCount: 10,
    fps: 12,
    loop: false,
    returnTo: "idle",
    priority: 30,
    frameEvents: [
      {
        frame: 2,
        type: "spawnParticle",
        key: "ultimate_charge",
        anchor: "swordTip",
      },
      {
        frame: 5,
        type: "cameraShake",
        key: "ultimate_shake",
      },
      {
        frame: 6,
        type: "playVfx",
        key: "ultimate_burst",
        anchor: "center",
      },
    ],
  },
  hurt: {
    key: "yizai_hero_hurt_sheet",
    fallbackKey: "yizai_hero_hurt",
    frameWidth: 512,
    frameHeight: 512,
    frameCount: 4,
    fps: 10,
    loop: false,
    returnTo: "idle",
    priority: 25,
  },
} as const satisfies CharacterAnimationConfigMap<YizaiAnimationState>;

export const ENEMY_ANIMATION_CONFIG = {
  idle: {
    key: "monster_slime_idle_sheet",
    fallbackKey: "monster_slime_idle",
    frameWidth: 512,
    frameHeight: 512,
    frameCount: 4,
    fps: 6,
    loop: true,
    priority: 0,
  },
  hit: {
    key: "monster_slime_hit_sheet",
    fallbackKey: "monster_slime_hit",
    frameWidth: 512,
    frameHeight: 512,
    frameCount: 4,
    fps: 10,
    loop: false,
    returnTo: "idle",
    priority: 10,
  },
  attack: {
    key: "monster_slime_attack_sheet",
    fallbackKey: "monster_slime_attack",
    frameWidth: 512,
    frameHeight: 512,
    frameCount: 6,
    fps: 12,
    loop: false,
    returnTo: "idle",
    priority: 20,
    frameEvents: [
      {
        frame: 3,
        type: "hitFrame",
        key: "enemy_attack_hit",
        anchor: "enemyHitPoint",
      },
    ],
  },
  defeat: {
    key: "monster_slime_defeat_sheet",
    fallbackKey: "monster_slime_defeat",
    frameWidth: 512,
    frameHeight: 512,
    frameCount: 6,
    fps: 10,
    loop: false,
    returnTo: "idle",
    priority: 40,
  },
} as const satisfies CharacterAnimationConfigMap<EnemyAnimationState>;

export const CHARACTER_ANIMATION_CONFIGS: CharacterAnimationConfigs = {
  yizai: YIZAI_ANIMATION_CONFIG,
  enemy: ENEMY_ANIMATION_CONFIG,
};

export const YIZAI_ANCHORS: CharacterAnchorConfig = {
  center: { x: 0.5, y: 0.55 },
  head: { x: 0.5, y: 0.2 },
  handLeft: { x: 0.35, y: 0.55 },
  handRight: { x: 0.68, y: 0.52 },
  swordTip: { x: 0.28, y: 0.32 },
  chest: { x: 0.5, y: 0.48 },
  feet: { x: 0.5, y: 0.9 },
};

export const ENEMY_ANCHORS: CharacterAnchorConfig = {
  center: { x: 0.5, y: 0.55 },
  head: { x: 0.5, y: 0.25 },
  enemyHitPoint: { x: 0.5, y: 0.5 },
  feet: { x: 0.5, y: 0.9 },
};

export const CHARACTER_ANCHORS: Record<CharacterId, CharacterAnchorConfig> = {
  yizai: YIZAI_ANCHORS,
  enemy: ENEMY_ANCHORS,
};

export function getCharacterAnimationConfig(
  characterId: "yizai",
  state: YizaiAnimationState,
): SpriteAnimationConfig<YizaiAnimationState>;
export function getCharacterAnimationConfig(
  characterId: "enemy",
  state: EnemyAnimationState,
): SpriteAnimationConfig<EnemyAnimationState>;
export function getCharacterAnimationConfig(
  characterId: CharacterId,
  state: string,
): SpriteAnimationConfig {
  if (characterId === "yizai") {
    return (
      YIZAI_ANIMATION_CONFIG[state as YizaiAnimationState] ??
      YIZAI_ANIMATION_CONFIG.idle
    );
  }

  return (
    ENEMY_ANIMATION_CONFIG[state as EnemyAnimationState] ??
    ENEMY_ANIMATION_CONFIG.idle
  );
}

export function getCharacterAnchors(
  characterId: CharacterId,
): CharacterAnchorConfig {
  return CHARACTER_ANCHORS[characterId];
}

export function getCharacterAnchor(
  characterId: CharacterId,
  anchorName: CharacterAnchorName,
): CharacterAnchorPoint | undefined {
  return CHARACTER_ANCHORS[characterId][anchorName];
}
