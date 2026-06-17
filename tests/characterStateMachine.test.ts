import assert from "node:assert/strict";
import test from "node:test";
import type { GameplayEvent, GameplayState } from "../src/core/gameplayTypes.ts";
import {
  ENEMY_ANIMATION_CONFIG,
  YIZAI_ANIMATION_CONFIG,
} from "../src/ui/characterAnimationConfig.ts";
import {
  CharacterStateMachine,
  createCharacterAnimationSnapshot,
} from "../src/ui/characterStateMachine.ts";

test("character animation config covers all required yizai states", () => {
  assert.deepEqual(Object.keys(YIZAI_ANIMATION_CONFIG).sort(), [
    "attack",
    "hurt",
    "idle",
    "skill",
    "ultimate",
  ]);
  assert.equal(YIZAI_ANIMATION_CONFIG.idle.loop, true);

  for (const state of ["attack", "skill", "ultimate", "hurt"] as const) {
    assert.equal(YIZAI_ANIMATION_CONFIG[state].loop, false);
    assert.equal(YIZAI_ANIMATION_CONFIG[state].returnTo, "idle");
  }
});

test("enemy animation config covers all required monster states", () => {
  assert.deepEqual(Object.keys(ENEMY_ANIMATION_CONFIG).sort(), [
    "attack",
    "defeat",
    "hit",
    "idle",
  ]);
  assert.equal(ENEMY_ANIMATION_CONFIG.idle.loop, true);
  assert.equal(ENEMY_ANIMATION_CONFIG.attack.returnTo, "idle");
  assert.equal(ENEMY_ANIMATION_CONFIG.defeat.priority, 40);
});

test("animation priority prevents low priority actions from interrupting ultimate", () => {
  const machine = new CharacterStateMachine();

  assert.equal(machine.play("yizai", "ultimate"), true);
  assert.equal(machine.play("yizai", "attack"), false);
  assert.equal(machine.getSnapshot().yizai, "ultimate");
});

test("hurt can interrupt attack", () => {
  const machine = new CharacterStateMachine();

  assert.equal(machine.play("yizai", "attack"), true);
  assert.equal(machine.play("yizai", "hurt"), true);
  assert.equal(machine.getSnapshot().yizai, "hurt");
});

test("enemyDamaged maps to yizai attack and enemy hit", () => {
  const snapshot = createCharacterAnimationSnapshot(baseState(), [
    combatEvent({ type: "enemyDamaged", amount: 6, enemyHp: 24 }),
  ]);

  assert.deepEqual(snapshot, { yizai: "attack", enemy: "hit" });
});

test("skill and ultimate gameplay events map to yizai actions", () => {
  const skillSnapshot = createCharacterAnimationSnapshot(baseState(), [
    skillEvent("skill"),
  ]);
  const ultimateSnapshot = createCharacterAnimationSnapshot(baseState(), [
    skillEvent("ultimate"),
  ]);

  assert.equal(skillSnapshot.yizai, "skill");
  assert.equal(ultimateSnapshot.yizai, "ultimate");
});

test("playerDamaged maps to yizai hurt and enemy attack", () => {
  const snapshot = createCharacterAnimationSnapshot(baseState(), [
    combatEvent({ type: "playerDamaged", amount: 7, playerHp: 93 }),
  ]);

  assert.deepEqual(snapshot, { yizai: "hurt", enemy: "attack" });
});

test("enemyDefeated maps enemy to defeat", () => {
  const snapshot = createCharacterAnimationSnapshot(baseState(), [
    combatEvent({ type: "enemyDefeated", wave: 1, enemyId: "forest_slime" }),
  ]);

  assert.equal(snapshot.enemy, "defeat");
});

test("infinite hp enemy state does not fall back to defeat", () => {
  const snapshot = createCharacterAnimationSnapshot(
    {
      ...baseState(),
      enemyHp: Number.POSITIVE_INFINITY,
      enemyMaxHp: Number.POSITIVE_INFINITY,
      enemyId: "endless_demon_king",
      enemyName: "魔王",
      enemyInfiniteHp: true,
      isEndlessWave: true,
    },
    [],
  );

  assert.equal(snapshot.enemy, "idle");
});

function skillEvent(level: "skill" | "ultimate"): GameplayEvent {
  return {
    type: "skillTriggered",
    skillId: level === "skill" ? "flameSlash" : "flameSpin",
    level,
    pieceType: 0,
    extraDamage: 20,
  };
}

function combatEvent(
  event: Extract<GameplayEvent, { type: "combat" }>["event"],
): GameplayEvent {
  return {
    type: "combat",
    event,
  };
}

function baseState(): GameplayState {
  return {
    phase: "playing",
    score: 0,
    comboMax: 0,
    playerHp: 100,
    playerMaxHp: 100,
    playerShield: 0,
    enemyHp: 30,
    enemyMaxHp: 30,
    enemyId: "forest_slime",
    enemyName: "森林史莱姆",
    wave: 1,
    totalWaves: 6,
    enemyAttackCounter: 0,
    enemyAttackInterval: 0,
    totalDamageDealt: 0,
    lastDamage: 0,
    lastComboCount: 0,
    lastVfxKeys: [],
  };
}
