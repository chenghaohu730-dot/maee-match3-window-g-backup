import assert from "node:assert/strict";
import test from "node:test";
import type { MatchGroup, PieceType, ResolveSummary } from "../src/core/board.ts";
import type { EnemyWave } from "../src/core/combatTypes.ts";
import { GameplayController } from "../src/core/gameplayController.ts";
import { SkillSystem } from "../src/core/skills.ts";
import {
  getParticlePreset,
  REQUIRED_PARTICLE_VFX_KEYS,
} from "../src/ui/particleConfig.ts";
import {
  MAX_ACTIVE_PARTICLES,
  ParticleSystem,
} from "../src/ui/particleSystem.ts";
import type {
  CharacterParticleEvent,
  Particle,
  ParticleAura,
  ParticleBurst,
  ParticleProjectile,
} from "../src/ui/particleTypes.ts";

const RED: PieceType = 0;
const PURPLE: PieceType = 4;

const playableTypes: PieceType[][] = [
  [0, 1, 0, 2, 3, 4, 5, 1],
  [2, 0, 3, 4, 5, 0, 1, 2],
  [2, 3, 4, 5, 0, 1, 2, 3],
  [3, 4, 5, 0, 1, 2, 3, 4],
  [4, 5, 0, 1, 2, 3, 4, 5],
  [5, 0, 1, 2, 3, 4, 5, 0],
  [0, 1, 2, 3, 4, 5, 0, 1],
  [1, 2, 3, 4, 5, 0, 1, 2],
];

test("particle config covers all 6-color skill and ultimate vfx keys", () => {
  const tones = new Set<string>();

  for (const key of REQUIRED_PARTICLE_VFX_KEYS) {
    const preset = getParticlePreset(key);

    assert.equal(preset.key, key);
    assert.equal(preset.color.startsWith("#"), true);
    assert.equal(preset.durationMs > 0, true);
    assert.equal(preset.size > 0, true);
    assert.equal(preset.projectile || preset.burst || preset.aura || preset.flash, true);
    tones.add(preset.tone);

    if (preset.level === "skill") {
      assert.equal(preset.maxParticles <= 20, true);
    }

    if (preset.level === "ultimate") {
      assert.equal(preset.maxParticles <= 40, true);
    }
  }

  assert.deepEqual([...tones].sort(), [
    "blue",
    "green",
    "orange",
    "purple",
    "red",
    "yellow",
  ]);
});

test("unknown particle vfx keys fall back to generic_particle", () => {
  const preset = getParticlePreset("future_unknown_vfx");
  const result = new ParticleSystem().handleBattleVfxKey(
    "future_unknown_vfx",
    battleContext(),
  );

  assert.equal(preset.key, "generic_particle");
  assert.equal(result.created.length > 0, true);
  assert.equal(result.created.every((particle) => particle.key === "generic_particle"), true);
});

test("projectile particles are created from from to to", () => {
  const from = { x: 12, y: 20 };
  const to = { x: 120, y: 60 };
  const result = new ParticleSystem().emitProjectile({
    key: "red_skill_slash",
    from,
    to,
  });
  const projectile = findParticle<ParticleProjectile>(
    result.created,
    "projectile",
  );

  assert.deepEqual(projectile?.from, from);
  assert.deepEqual(projectile?.to, to);
});

test("burst particles are created at position", () => {
  const position = { x: 80, y: 42 };
  const result = new ParticleSystem().emitBurst({
    key: "blue_skill_freeze",
    position,
  });
  const burst = findParticle<ParticleBurst>(result.created, "burst");

  assert.deepEqual(burst?.position, position);
  assert.equal((burst?.count ?? 0) > 0, true);
});

test("aura particles bind to the requested target", () => {
  const result = new ParticleSystem().emitAura({
    key: "green_skill_shield",
    position: { x: 30, y: 40 },
    target: "player",
  });
  const aura = findParticle<ParticleAura>(result.created, "aura");

  assert.equal(aura?.target, "player");
});

test("particle lifecycle cleanup removes expired particles", () => {
  let now = 100;
  const system = new ParticleSystem({ now: () => now });

  system.emitFlash({
    key: "generic_particle",
    position: { x: 1, y: 1 },
    durationMs: 100,
  });
  assert.equal(system.getActiveParticles().length, 1);

  now = 201;
  const removed = system.cleanupExpired();

  assert.equal(removed.length, 1);
  assert.equal(system.getActiveParticles().length, 0);
});

test("MAX_ACTIVE_PARTICLES limit removes the oldest low-priority particles", () => {
  const system = new ParticleSystem({ maxActiveParticles: 3 });

  for (let index = 0; index < 5; index++) {
    system.emitFlash({
      key: "generic_particle",
      position: { x: index, y: 0 },
      now: index,
    });
  }

  const active = system.getActiveParticles();

  assert.equal(MAX_ACTIVE_PARTICLES, 80);
  assert.equal(active.length, 3);
  assert.deepEqual(
    active.map((particle) => particle.createdAt),
    [2, 3, 4],
  );
});

test("CharacterAnimationRuntimeEvent emitProjectile creates a projectile", () => {
  const result = new ParticleSystem().handleCharacterRuntimeEvent(
    runtimeEvent("emitProjectile", "skill_projectile", "handRight"),
    {
      ...battleContext(),
      vfxKey: "red_skill_slash",
    },
  );
  const projectile = findParticle<ParticleProjectile>(
    result.created,
    "projectile",
  );

  assert.equal(projectile?.key, "red_skill_slash");
  assert.deepEqual(projectile?.from, battleContext().from);
  assert.deepEqual(projectile?.to, battleContext().to);
});

test("CharacterAnimationRuntimeEvent hitFrame creates burst feedback", () => {
  const result = new ParticleSystem().handleCharacterRuntimeEvent(
    runtimeEvent("hitFrame", "yizai_basic_hit", "swordTip"),
    battleContext(),
  );

  assert.equal(result.created.some((particle) => particle.type === "burst"), true);
  assert.equal(result.created.some((particle) => particle.type === "flash"), true);
});

test("CharacterAnimationRuntimeEvent spawnParticle creates flash and aura", () => {
  const result = new ParticleSystem().handleCharacterRuntimeEvent(
    runtimeEvent("spawnParticle", "skill_charge", "handRight"),
    battleContext(),
  );

  assert.equal(result.created.some((particle) => particle.type === "flash"), true);
  assert.equal(result.created.some((particle) => particle.type === "aura"), true);
});

test("particle system does not modify board combat or skill results", () => {
  const controller = new GameplayController({
    initialTypes: playableTypes,
    rng: fixedRng(0.73),
    waves: [wave("training", 300, 0, 0)],
  });
  controller.startGame();
  const skillResult = new SkillSystem().buildSkillPlan(
    matchSummary(matchGroup(PURPLE, 5)),
  );
  const beforeState = controller.getState();
  const beforeBoard = controller.board.getSnapshot();
  const beforeSkillResult = structuredClone(skillResult);

  new ParticleSystem().handleBattleVfxKey(
    "purple_ultimate_magic_circle",
    battleContext(),
  );

  assert.deepEqual(controller.getState(), beforeState);
  assert.deepEqual(controller.board.getSnapshot(), beforeBoard);
  assert.deepEqual(skillResult, beforeSkillResult);
  assert.equal(controller.board.grid.flat().length, 64);
  assert.equal(controller.board.hasHoles(), false);
});

function findParticle<T extends Particle>(
  particles: readonly Particle[],
  type: T["type"],
): T | undefined {
  return particles.find((particle): particle is T => particle.type === type);
}

function battleContext() {
  return {
    from: { x: 24, y: 48 },
    to: { x: 180, y: 72 },
    position: { x: 180, y: 72 },
    playerCenter: { x: 36, y: 80 },
    enemyHitPoint: { x: 180, y: 72 },
    battleCenter: { x: 104, y: 70 },
  };
}

function runtimeEvent(
  type: CharacterParticleEvent["type"],
  key: string,
  anchor: NonNullable<CharacterParticleEvent["anchor"]>,
): CharacterParticleEvent {
  return {
    characterId: "yizai",
    animation: type === "hitFrame" ? "attack" : "skill",
    frame: 5,
    type,
    key,
    anchor,
  };
}

function matchSummary(group: MatchGroup): ResolveSummary {
  return {
    totalCleared: group.length,
    chainCount: 1,
    wasPlayerMove: true,
    groups: [group],
    maxMatchLength: group.length,
  };
}

function matchGroup(type: PieceType, length: number): MatchGroup {
  return {
    type,
    length,
    cells: Array.from({ length }, (_, x) => ({ x, y: 0 })),
    orientation: "row",
  };
}

function fixedRng(value: number): () => number {
  return () => value;
}

function wave(
  id: string,
  hp: number,
  attackInterval: number,
  damage: number,
): EnemyWave {
  return {
    id,
    name: id,
    hp,
    attackInterval,
    damage,
  };
}
