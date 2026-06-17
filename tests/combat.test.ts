import assert from "node:assert/strict";
import test from "node:test";
import { CombatSystem } from "../src/core/combat.ts";
import type { CombatEvent, EnemyWave } from "../src/core/combatTypes.ts";
import {
  ENDLESS_CHALLENGE_WAVES,
  ENDLESS_DEMON_KING_WAVE,
  FAIRY_DRAGON_BOSS_WAVE,
  FAIRY_TALE_WAVES,
} from "../src/core/waves.ts";

test("initializes the player and first wave", () => {
  const combat = new CombatSystem();
  const state = combat.getState();

  assert.equal(state.player.maxHp, 100);
  assert.equal(state.player.hp, 100);
  assert.equal(state.player.shield, 0);
  assert.equal(state.wave, 1);
  assert.equal(state.status, "playing");
  assert.equal(state.enemy?.id, "forest_slime");
  assert.equal(state.enemy?.name, "森林史莱姆");
  assert.equal(state.enemy?.hp, 60);
  assert.equal(state.enemy?.attackInterval, 0);
  assert.equal(state.enemy?.damage, 0);
});

test("applies base damage from cleared pieces", () => {
  const combat = new CombatSystem();

  const events = combat.applyPlayerMoveResult({ totalCleared: 3 });
  const state = combat.getState();

  assert.deepEqual(events[0], {
    type: "enemyDamaged",
    amount: 6,
    enemyHp: 54,
  });
  assert.equal(state.enemy?.hp, 54);
});

test("does not let the first wave attack", () => {
  const combat = new CombatSystem();

  const events = combat.applyPlayerMoveResult({
    totalCleared: 3,
    chainCount: 1,
    wasPlayerMove: true,
  });
  const state = combat.getState();

  assert.equal(hasEvent(events, "playerDamaged"), false);
  assert.equal(hasEvent(events, "enemyAttackCounterChanged"), false);
  assert.equal(state.player.hp, 100);
  assert.equal(state.enemy?.attackCounter, 0);
});

test("starts the next wave and heals the player after an enemy is defeated", () => {
  const combat = new CombatSystem([
    wave("training-a", 20, 1, 10),
    wave("training-b", 30, 2, 5),
  ]);

  combat.applyPlayerMoveResult({ totalCleared: 3 });
  const events = combat.applyPlayerMoveResult({ totalCleared: 7 });
  const state = combat.getState();

  assert.equal(state.wave, 2);
  assert.equal(state.enemy?.id, "training-b");
  assert.equal(state.player.hp, 100);
  assert.equal(hasEvent(events, "enemyDefeated"), true);
  assert.deepEqual(events.find((event) => event.type === "waveStarted"), {
    type: "waveStarted",
    wave: 2,
    enemyId: "training-b",
  });
  assert.deepEqual(events.find((event) => event.type === "playerHealed"), {
    type: "playerHealed",
    amount: 10,
    playerHp: 100,
  });
  assert.equal(hasEvent(events, "playerDamaged"), false);
});

test("advances the enemy attack counter when the enemy survives", () => {
  const combat = new CombatSystem([wave("counter-test", 50, 3, 5)]);

  const events = combat.applyPlayerMoveResult({ totalCleared: 3 });
  const state = combat.getState();

  assert.deepEqual(events.find((event) => event.type === "enemyAttackCounterChanged"), {
    type: "enemyAttackCounterChanged",
    current: 1,
    max: 3,
  });
  assert.equal(state.enemy?.attackCounter, 1);
  assert.equal(state.player.hp, 100);
});

test("damages the player when the enemy attack counter fills", () => {
  const combat = new CombatSystem([wave("attack-test", 50, 2, 7)]);

  combat.applyPlayerMoveResult({ totalCleared: 3 });
  const events = combat.applyPlayerMoveResult({ totalCleared: 3 });
  const state = combat.getState();

  assert.deepEqual(events.find((event) => event.type === "playerDamaged"), {
    type: "playerDamaged",
    amount: 7,
    playerHp: 93,
  });
  assert.equal(state.enemy?.attackCounter, 0);
  assert.equal(state.player.hp, 93);
});

test("uses shield before hp when the enemy attacks", () => {
  const combat = new CombatSystem([wave("shield-test", 50, 1, 12)]);

  combat.addShield(8);
  const events = combat.applyPlayerMoveResult({ totalCleared: 3 });
  const state = combat.getState();

  assert.deepEqual(events.find((event) => event.type === "playerDamaged"), {
    type: "playerDamaged",
    amount: 4,
    playerHp: 96,
  });
  assert.equal(state.player.shield, 0);
  assert.equal(state.player.hp, 96);
});

test("prevents attack counter progress while the enemy is frozen", () => {
  const combat = new CombatSystem([wave("freeze-test", 50, 1, 12)]);

  combat.freezeEnemy(1);
  const frozenEvents = combat.applyPlayerMoveResult({ totalCleared: 3 });
  const frozenState = combat.getState();

  assert.equal(hasEvent(frozenEvents, "enemyAttackCounterChanged"), false);
  assert.equal(hasEvent(frozenEvents, "playerDamaged"), false);
  assert.equal(frozenState.enemy?.attackCounter, 0);
  assert.equal(frozenState.freezeTurns, 0);

  const nextEvents = combat.applyPlayerMoveResult({ totalCleared: 3 });
  assert.equal(hasEvent(nextEvents, "playerDamaged"), true);
});

test("applies armor break to increase enemy damage taken", () => {
  const combat = new CombatSystem([wave("armor-break-test", 45, 0, 0)]);

  combat.applyArmorBreak(1, 1.3);
  const events = combat.applyPlayerMoveResult({ totalCleared: 3 });
  const state = combat.getState();

  assert.deepEqual(events[0], {
    type: "enemyDamaged",
    amount: 7.8,
    enemyHp: 37.2,
  });
  assert.equal(state.armorBreak, null);
});

test("fairy tale waves configure the required six monsters", () => {
  assert.deepEqual(
    FAIRY_TALE_WAVES.map((wave) => [wave.id, wave.name]),
    [
      ["forest_slime", "森林史莱姆"],
      ["pumpkin_imp", "南瓜小妖"],
      ["fairy_crow", "童话乌鸦"],
      ["tree_spirit", "森林树精"],
      ["forest_wolf", "森林狼"],
      ["fairy_dragon_boss", "童话龙王"],
    ],
  );
  assert.equal(FAIRY_TALE_WAVES.length, 6);
  assert.equal(FAIRY_TALE_WAVES[5]?.id, "fairy_dragon_boss");
  assert.equal(FAIRY_TALE_WAVES[5]?.name, "童话龙王");
});

test("defeating the sixth fairy dragon boss wins normal mode", () => {
  const combat = new CombatSystem();

  for (let index = 0; index < 5; index++) {
    combat.applyPlayerMoveResult({ totalCleared: 100 });
  }

  const events = combat.applyPlayerMoveResult({ totalCleared: 150 });
  const state = combat.getState();

  assert.equal(state.status, "won");
  assert.equal(state.wave, 6);
  assert.equal(state.enemy?.id, "fairy_dragon_boss");
  assert.equal(state.enemy?.name, "童话龙王");
  assert.equal(hasEvent(events, "enemyDefeated"), true);
  assert.equal(hasEvent(events, "gameWon"), true);
});

test("endless demon king reuses dragon attack values and never dies", () => {
  const combat = new CombatSystem(ENDLESS_CHALLENGE_WAVES);
  const initial = combat.getState();

  assert.equal(initial.enemy?.id, "endless_demon_king");
  assert.equal(initial.enemy?.name, "魔王");
  assert.equal(initial.enemy?.damage, FAIRY_DRAGON_BOSS_WAVE.damage);
  assert.equal(
    initial.enemy?.attackInterval,
    FAIRY_DRAGON_BOSS_WAVE.attackInterval,
  );
  assert.equal(initial.enemy?.infiniteHp, true);

  const events = combat.applyPlayerMoveResult({ totalCleared: 999 });
  const state = combat.getState();

  assert.equal(ENDLESS_DEMON_KING_WAVE.infiniteHp, true);
  assert.equal(state.status, "playing");
  assert.equal(state.enemy?.hp, Number.POSITIVE_INFINITY);
  assert.equal(state.enemy?.maxHp, Number.POSITIVE_INFINITY);
  assert.equal(state.totalDamageDealt, 1998);
  assert.equal(hasEvent(events, "enemyDefeated"), false);
  assert.equal(hasEvent(events, "gameWon"), false);
});

test("endless demon king can attack and player death ends endless challenge", () => {
  const combat = new CombatSystem([
    {
      ...ENDLESS_DEMON_KING_WAVE,
      attackInterval: 1,
      damage: 120,
    },
  ]);

  const events = combat.applyPlayerMoveResult({ totalCleared: 3 });
  const state = combat.getState();

  assert.equal(hasEvent(events, "playerDamaged"), true);
  assert.equal(hasEvent(events, "gameLost"), true);
  assert.equal(state.status, "lost");
  assert.equal(state.player.hp, 0);
  assert.equal(state.enemy?.id, "endless_demon_king");
  assert.equal(state.enemy?.hp, Number.POSITIVE_INFINITY);
});

test("sets status to won after the last finite wave is defeated", () => {
  const combat = new CombatSystem([wave("boss", 6, 0, 0)]);

  const events = combat.applyPlayerMoveResult({ totalCleared: 3 });
  const state = combat.getState();

  assert.equal(state.status, "won");
  assert.equal(hasEvent(events, "gameWon"), true);
});

test("sets status to lost when player hp reaches zero", () => {
  const combat = new CombatSystem([wave("loss-test", 999, 1, 120)]);

  const events = combat.applyPlayerMoveResult({ totalCleared: 3 });
  const state = combat.getState();

  assert.equal(state.status, "lost");
  assert.equal(state.player.hp, 0);
  assert.equal(hasEvent(events, "gameLost"), true);
});

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

function hasEvent(events: CombatEvent[], type: CombatEvent["type"]): boolean {
  return events.some((event) => event.type === type);
}
