import assert from "node:assert/strict";
import test from "node:test";
import type {
  ClearEvent,
  PieceType,
  ResolveSummary,
} from "../src/core/board.ts";
import type { CombatEvent } from "../src/core/combatTypes.ts";
import type { GameplayEvent, GameplayState } from "../src/core/gameplayTypes.ts";
import {
  createEnemyAttackTimeline,
  createGameEndTimeline,
  createReshuffleTimeline,
  createTurnTimeline,
  createWaveTransitionTimeline,
} from "../src/ui/combatTimeline.ts";
import { PRESENTATION_TIMING } from "../src/ui/presentationTiming.ts";

test("normal 3-match creates a normal combat timeline", () => {
  const timeline = createTurnTimeline({
    summary: summary(3, 1),
    gameplayEvents: [combat({ type: "enemyDamaged", amount: 6, enemyHp: 24 })],
    chainCount: 1,
  });

  assert.equal(timeline.kind, "normal");
  assert.equal(timeline.durationMs <= PRESENTATION_TIMING.NORMAL_TURN_MAX_MS, true);
  assert.equal(hasEvent(timeline, "character.yizai.attack"), true);
  assert.equal(hasEvent(timeline, "particle.basicProjectile"), true);
});

test("4-match skill creates a skill timeline", () => {
  const timeline = createTurnTimeline({
    summary: summary(4, 1),
    clearEvents: [clearEvent(1, 0, 4)],
    gameplayEvents: [
      skill("skill"),
      combat({ type: "enemyDamaged", amount: 18, enemyHp: 12 }),
    ],
    chainCount: 1,
  });

  assert.equal(timeline.kind, "skill");
  assert.equal(timeline.durationMs <= PRESENTATION_TIMING.SKILL_TURN_MAX_MS, true);
  assert.equal(eventAt(timeline, "ui.skillText"), 100);
  assert.equal(hasEvent(timeline, "character.yizai.skill"), true);
  assert.equal(hasEvent(timeline, "character.yizai.attack"), false);
});

test("5-match creates an ultimate timeline", () => {
  const timeline = createTurnTimeline({
    summary: summary(5, 1),
    clearEvents: [clearEvent(1, 0, 5)],
    gameplayEvents: [
      skill("ultimate"),
      combat({ type: "enemyDamaged", amount: 35, enemyHp: 5 }),
    ],
    chainCount: 1,
  });

  assert.equal(timeline.kind, "ultimate");
  assert.equal(hasEvent(timeline, "character.yizai.ultimate"), true);
  assert.equal(hasEvent(timeline, "particle.ultimateAura"), true);
});

test("chain clears queue yizai actions in clear order", () => {
  const timeline = createTurnTimeline({
    summary: summary(7, 2),
    clearEvents: [clearEvent(1, 0, 3), clearEvent(2, 2, 4)],
    gameplayEvents: [
      skill("skill"),
      combat({ type: "enemyDamaged", amount: 22, enemyHp: 8 }),
    ],
    chainCount: 2,
  });

  const attackAt = eventAt(timeline, "character.yizai.attack");
  const skillAt = eventAt(timeline, "character.yizai.skill");

  assert.equal(timeline.kind, "skill");
  assert.equal(attackAt, 100);
  assert.equal(skillAt, 940);
  assert.equal((attackAt ?? 0) < (skillAt ?? 0), true);
});

test("chain clears present one enemy hit and damage number per damaging clear", () => {
  const timeline = createTurnTimeline({
    summary: summary(7, 2),
    clearEvents: [clearEvent(1, 0, 3), clearEvent(2, 2, 4)],
    gameplayEvents: [
      skill("skill"),
      combat({ type: "enemyDamaged", amount: 24, enemyHp: 66 }),
    ],
    chainCount: 2,
    preState: gameplayState({ enemyHp: 90, enemyMaxHp: 90 }),
  });
  const damageEvents = eventsOfType(timeline, "combat.damageNumber");
  const hitEvents = eventsOfType(timeline, "character.enemy.hit");
  const hpEvents = eventsOfType(timeline, "combat.enemyHpTween");

  assert.equal(hitEvents.length, 2);
  assert.equal(damageEvents.length, 2);
  assert.deepEqual(
    damageEvents.map((event) => event.data?.amount),
    [6, 18],
  );
  assert.deepEqual(
    hpEvents.map((event) => event.data?.hp),
    [84, 66],
  );
});

test("lethal early chain hit stops later yizai actions before the next wave starts", () => {
  const timeline = createTurnTimeline({
    summary: summary(12, 3),
    clearEvents: [
      clearEvent(1, 0, 3),
      clearEvent(2, 2, 4),
      clearEvent(3, 4, 5),
    ],
    gameplayEvents: [
      skill("ultimate"),
      combat({ type: "enemyDamaged", amount: 60, enemyHp: 0 }),
      combat({ type: "enemyDefeated", wave: 1, enemyId: "forest_slime" }),
      combat({ type: "waveStarted", wave: 2, enemyId: "pumpkin_imp" }),
    ],
    chainCount: 3,
    preState: gameplayState({ enemyHp: 6, enemyMaxHp: 90 }),
  });
  const damageEvents = eventsOfType(timeline, "combat.damageNumber");
  const hitEvents = eventsOfType(timeline, "character.enemy.hit");
  const defeat = eventOfType(timeline, "character.enemy.defeat");
  const settle = eventOfType(timeline, "board.settle");
  const waveStart = eventOfType(timeline, "wave.start");

  assert.equal(hasEvent(timeline, "character.yizai.attack"), true);
  assert.equal(hasEvent(timeline, "character.yizai.skill"), false);
  assert.equal(hasEvent(timeline, "character.yizai.ultimate"), false);
  assert.equal(hitEvents.length, 1);
  assert.equal(damageEvents.length, 1);
  assert.equal(damageEvents[0]?.data?.amount, 6);
  assert.equal(eventsOfType(timeline, "combat.enemyHpTween")[0]?.data?.hp, 0);
  assert.equal(waveStart !== undefined, true);
  assert.equal(defeat !== undefined, true);
  assert.equal(settle !== undefined, true);
  assert.equal((waveStart?.atMs ?? 0) >= (defeat?.atMs ?? 0) + (defeat?.durationMs ?? 0), true);
  assert.equal((waveStart?.atMs ?? 0) >= (settle?.atMs ?? 0) + (settle?.durationMs ?? 0), true);
});

test("ultimate timeline never exceeds the configured maximum", () => {
  const timeline = createTurnTimeline({
    summary: summary(5, 4),
    clearEvents: [clearEvent(1, 0, 5)],
    gameplayEvents: [
      skill("ultimate"),
      combat({ type: "enemyDamaged", amount: 35, enemyHp: 5 }),
    ],
    chainCount: 4,
  });

  assert.equal(timeline.durationMs <= PRESENTATION_TIMING.ULTIMATE_TURN_MAX_MS, true);
  assert.equal(timeline.inputUnlockAtMs, PRESENTATION_TIMING.ULTIMATE_TURN_MAX_MS);
});

test("enemyDefeated prevents a follow-up enemy attack presentation", () => {
  const timeline = createEnemyAttackTimeline({
    events: [
      { type: "enemyDefeated", wave: 1, enemyId: "forest_slime" },
      { type: "playerDamaged", amount: 8, playerHp: 92 },
    ],
  });

  assert.equal(timeline.events.length, 0);
  assert.equal(timeline.inputUnlockAtMs, 0);
});

test("turn player damage queues enemy attack and yizai hurt", () => {
  const timeline = createTurnTimeline({
    summary: summary(3, 1),
    clearEvents: [clearEvent(1, 0, 3)],
    gameplayEvents: [
      combat({ type: "enemyDamaged", amount: 6, enemyHp: 84 }),
      combat({ type: "playerDamaged", amount: 6, playerHp: 94 }),
    ],
    chainCount: 1,
  });

  const enemyAttackAt = eventAt(timeline, "character.enemy.attack");
  const yizaiHurtAt = eventAt(timeline, "character.yizai.hurt");

  assert.equal(timeline.kind, "normal");
  assert.equal(hasEvent(timeline, "combat.playerHpTween"), true);
  assert.equal(hasEvent(timeline, "particle.basicProjectile"), true);
  assert.equal(enemyAttackAt !== undefined, true);
  assert.equal(yizaiHurtAt !== undefined, true);
  assert.equal((yizaiHurtAt ?? 0) > (enemyAttackAt ?? 0), true);
  assert.equal(
    (timeline.inputUnlockAtMs ?? 0) <=
      PRESENTATION_TIMING.NORMAL_TURN_MAX_MS +
        PRESENTATION_TIMING.ENEMY_ATTACK_LOCK_MAX_MS,
    true,
  );
});

test("enemy attack timeline leaves enough room for yizai hurt to finish", () => {
  const timeline = createEnemyAttackTimeline({
    events: [{ type: "playerDamaged", amount: 8, playerHp: 92 }],
  });

  const hurt = timeline.events.find((event) => event.type === "character.yizai.hurt");

  assert.equal(hurt?.atMs, 240);
  assert.equal(hurt?.durationMs, 600);
  assert.equal(timeline.inputUnlockAtMs, 840);
});

test("game end timeline waits for full character animations", () => {
  const won = createGameEndTimeline({
    events: [{ type: "gameWon" }],
  });
  const lost = createGameEndTimeline({
    events: [{ type: "gameLost" }],
  });

  assert.equal(eventAt(won, "game.end"), 1334);
  assert.equal(eventAt(lost, "game.end"), 600);
});

test("gameLost blocks later player input", () => {
  const timeline = createTurnTimeline({
    summary: summary(3, 1),
    gameplayEvents: [combat({ type: "gameLost" })],
    chainCount: 1,
  });

  assert.equal(timeline.kind, "gameEnd");
  assert.equal(timeline.inputUnlockAtMs, null);
  assert.equal(timeline.blocksInputAfterEnd, true);
});

test("wave transition stays within timing config", () => {
  const timeline = createWaveTransitionTimeline({
    events: [{ type: "waveStarted", wave: 2, enemyId: "pumpkin_imp" }],
  });

  assert.equal(timeline.durationMs <= PRESENTATION_TIMING.WAVE_TRANSITION_MS, true);
  assert.equal(timeline.inputUnlockAtMs, PRESENTATION_TIMING.WAVE_TRANSITION_MS);
});

test("reshuffle presentation does not trigger combat, particles, or yizai action", () => {
  const timeline = createReshuffleTimeline({
    summary: { ...summary(0, 0), boardWasReshuffled: true },
    events: [{ type: "boardShuffled" }],
  });

  assert.equal(timeline.kind, "reshuffle");
  assert.equal(hasEvent(timeline, "ui.reshuffleNotice"), true);
  assert.equal(
    timeline.events.some(
      (event) =>
        event.type.startsWith("combat.") ||
        event.type.startsWith("particle.") ||
        event.type.startsWith("character.yizai."),
    ),
    false,
  );
});

function hasEvent(
  timeline: ReturnType<typeof createTurnTimeline>,
  type: string,
): boolean {
  return timeline.events.some((event) => event.type === type);
}

function eventAt(
  timeline: ReturnType<typeof createTurnTimeline>,
  type: string,
): number | undefined {
  return timeline.events.find((event) => event.type === type)?.atMs;
}

function eventOfType(
  timeline: ReturnType<typeof createTurnTimeline>,
  type: string,
) {
  return timeline.events.find((event) => event.type === type);
}

function eventsOfType(
  timeline: ReturnType<typeof createTurnTimeline>,
  type: string,
) {
  return timeline.events.filter((event) => event.type === type);
}

function summary(totalCleared: number, chainCount: number): ResolveSummary {
  return {
    totalCleared,
    chainCount,
    wasPlayerMove: true,
  };
}

function clearEvent(
  chain: number,
  row: number,
  length: number,
  type: PieceType = 0,
): ClearEvent {
  return {
    chain,
    damage: length * 2,
    pieces: Array.from({ length }, (_, x) => ({
      id: `c${chain}-${x}`,
      type,
      x,
      y: row,
      isMatched: true,
    })),
  };
}

function skill(level: "skill" | "ultimate"): GameplayEvent {
  return {
    type: "skillTriggered",
    skillId: level === "skill" ? "flameSlash" : "flameSpin",
    level,
    pieceType: 0,
    extraDamage: level === "skill" ? 10 : 25,
  };
}

function combat(event: CombatEvent): GameplayEvent {
  return {
    type: "combat",
    event,
  };
}

function gameplayState(
  overrides: Partial<GameplayState> = {},
): GameplayState {
  return {
    phase: "playing",
    score: 0,
    comboMax: 0,
    playerHp: 100,
    playerMaxHp: 100,
    playerShield: 0,
    enemyHp: 90,
    enemyMaxHp: 90,
    enemyId: "forest_slime",
    enemyName: "森林史莱姆",
    wave: 1,
    totalWaves: 6,
    enemyAttackCounter: 0,
    enemyAttackInterval: 3,
    totalDamageDealt: 0,
    lastDamage: 0,
    lastComboCount: 1,
    lastVfxKeys: [],
    ...overrides,
  };
}
