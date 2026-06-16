import assert from "node:assert/strict";
import test from "node:test";
import {
  Board,
  type MatchGroup,
  type PieceType,
  type ResolveSummary,
} from "../src/core/board.ts";
import { GameplayController } from "../src/core/gameplayController.ts";
import type { GameplayEvent } from "../src/core/gameplayTypes.ts";
import type { EnemyWave } from "../src/core/combatTypes.ts";

const RED: PieceType = 0;
const BLUE: PieceType = 1;
const YELLOW: PieceType = 2;
const GREEN: PieceType = 3;
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

const redSkillSwapTypes: PieceType[][] = [
  [0, 0, 1, 0, 4, 5, 0, 1],
  [1, 2, 0, 4, 5, 0, 1, 2],
  [2, 3, 4, 5, 0, 1, 2, 3],
  [3, 4, 5, 0, 1, 2, 3, 4],
  [4, 5, 0, 1, 2, 3, 4, 5],
  [5, 0, 1, 2, 3, 4, 5, 0],
  [0, 1, 2, 3, 4, 5, 0, 1],
  [1, 2, 3, 4, 5, 0, 1, 2],
];

const deadTypes: PieceType[][] = [
  [0, 1, 2, 3, 4, 5, 0, 1],
  [1, 2, 3, 4, 5, 0, 1, 2],
  [2, 3, 4, 5, 0, 1, 2, 3],
  [3, 4, 5, 0, 1, 2, 3, 4],
  [4, 5, 0, 1, 2, 3, 4, 5],
  [5, 0, 1, 2, 3, 4, 5, 0],
  [0, 1, 2, 3, 4, 5, 0, 1],
  [1, 2, 3, 4, 5, 0, 1, 2],
];

test("startGame moves the gameplay phase to playing", () => {
  const controller = createController();

  controller.startGame();

  assert.equal(controller.getState().phase, "playing");
});

test("a 3-match summary deals base damage and increases score", () => {
  const controller = createController([wave("training", 100, 0, 0)]);
  controller.startGame();

  controller.handleResolveComplete(summary(3));
  const state = controller.getState();

  assert.equal(state.enemyHp, 94);
  assert.equal(state.score, 30);
  assert.equal(state.comboMax, 1);
});

test("a 4-match summary triggers a skill plan and bonus score", () => {
  const controller = createController([wave("training", 100, 0, 0)]);
  controller.startGame();

  const events = controller.handleResolveComplete(
    summary(4, matchGroup(RED, 4)),
  );
  const state = controller.getState();

  assert.equal(state.enemyHp, 66);
  assert.equal(state.score, 240);
  assert.equal(state.lastDamage, 34);
  assert.equal(state.lastComboCount, 2);
  assert.equal(state.lastSkillText, "flameSlash");
  assert.equal(hasGameplayEvent(events, "skillTriggered"), true);
  assert.equal(hasGameplayEvent(events, "boardEffectResolved"), true);
});

test("a 5-match summary triggers an ultimate event", () => {
  const controller = createController([wave("training", 100, 0, 0)]);
  controller.startGame();

  const events = controller.handleResolveComplete(
    summary(5, matchGroup(RED, 5)),
  );
  const skillEvent = events.find((event) => event.type === "skillTriggered");
  const state = controller.getState();

  assert.equal(skillEvent?.type, "skillTriggered");
  assert.equal(skillEvent?.level, "ultimate");
  assert.equal(state.lastSkillText, "flameSpin");
  assert.equal(state.lastVfxKeys.includes("red_ultimate_spin"), true);
});

test("defeating an enemy starts the next wave and prevents death counterattacks", () => {
  const controller = createController([
    wave("low-hp", 18, 1, 99),
    wave("next-wave", 50, 1, 10),
  ]);
  controller.startGame();

  const events = controller.handleResolveComplete(
    summary(4, matchGroup(RED, 4)),
  );
  const state = controller.getState();

  assert.equal(state.wave, 2);
  assert.equal(state.enemyId, "next-wave");
  assert.equal(state.playerHp, 100);
  assert.equal(hasCombatEvent(events, "enemyDefeated"), true);
  assert.equal(hasCombatEvent(events, "playerDamaged"), false);
});

test("defeating the final boss sets phase to won", () => {
  const controller = createController([wave("boss", 6, 1, 99)]);
  controller.startGame();

  controller.handleResolveComplete(summary(3));
  const state = controller.getState();

  assert.equal(state.phase, "won");
  assert.equal(state.score, 2030);
});

test("enemy attacks can reduce player hp to zero and set phase to lost", () => {
  const controller = createController([wave("loss-test", 999, 1, 120)]);
  controller.startGame();

  const events = controller.handleResolveComplete(summary(3));
  const state = controller.getState();

  assert.equal(state.phase, "lost");
  assert.equal(state.playerHp, 0);
  assert.equal(hasCombatEvent(events, "gameLost"), true);
});

test("yellow skills multiply this turn's score", () => {
  const controller = createController([wave("training", 100, 0, 0)]);
  controller.startGame();

  controller.handleResolveComplete(summary(4, matchGroup(YELLOW, 4)));
  const state = controller.getState();

  assert.equal(state.enemyHp, 86);
  assert.equal(state.score, 180);
  assert.equal(state.lastSkillText, "starChain");
});

test("green skills can heal the player and leave shield for the enemy hit", () => {
  const controller = createController([wave("green-test", 999, 1, 5)]);
  controller.startGame();
  controller.combat.endPlayerTurn();

  controller.handleResolveComplete(summary(5, matchGroup(GREEN, 5)));
  const state = controller.getState();

  assert.equal(state.playerHp, 100);
  assert.equal(state.playerShield, 10);
  assert.equal(state.lastSkillText, "natureBlessing");
});

test("blue skills freeze enemy attack progress for this turn", () => {
  const controller = createController([wave("blue-test", 999, 1, 50)]);
  controller.startGame();

  const events = controller.handleResolveComplete(
    summary(4, matchGroup(BLUE, 4)),
  );
  const state = controller.getState();

  assert.equal(state.playerHp, 100);
  assert.equal(state.enemyAttackCounter, 0);
  assert.equal(hasCombatEvent(events, "playerDamaged"), false);
  assert.equal(state.lastSkillText, "frostFreeze");
});

test("red 4-match executes clearRow as a board effect", () => {
  const controller = createController([wave("red-row-test", 200, 0, 0)]);
  controller.startGame();

  const events = controller.handleResolveComplete(
    summary(4, matchGroup(RED, 4)),
  );
  const request = events.find((event) => event.type === "boardEffectRequested");
  const resolved = events.find((event) => event.type === "boardEffectResolved");

  assert.deepEqual(request, {
    type: "boardEffectRequested",
    request: { type: "clearRow", row: 0 },
  });
  assert.equal(resolved?.type, "boardEffectResolved");
  assert.equal(resolved?.totalCleared >= 8, true);
  assert.equal(controller.board.hasHoles(), false);
  assert.equal(controller.board.detectMatches().length, 0);
});

test("swap animation steps include skill board-effect clears", () => {
  const controller = new GameplayController({
    initialTypes: redSkillSwapTypes,
    rng: fixedRng(0.73),
    waves: [wave("red-animation-test", 200, 0, 0)],
  });
  controller.startGame();

  const result = controller.board.swap({ x: 2, y: 0 }, { x: 2, y: 1 });
  const clearSteps = result.animationSteps.filter(
    (step) => step.kind === "clear",
  );

  assert.equal(result.success, true);
  assert.equal(result.clearEvents.length, 1);
  assert.equal(clearSteps.length > result.clearEvents.length, true);
  assert.equal(
    clearSteps.some((step) => step.clearEvent.pieces.length >= 8),
    true,
  );
});

test("purple 4-match executes clearArea as a board effect", () => {
  const controller = createController([wave("purple-area-test", 200, 0, 0)]);
  controller.startGame();

  const events = controller.handleResolveComplete(
    summary(4, matchGroup(PURPLE, 4, 3)),
  );
  const request = events.find((event) => event.type === "boardEffectRequested");
  const resolved = events.find((event) => event.type === "boardEffectResolved");

  assert.deepEqual(request, {
    type: "boardEffectRequested",
    request: {
      type: "clearArea",
      center: { x: 2, y: 3 },
      radius: 1,
    },
  });
  assert.equal(resolved?.type, "boardEffectResolved");
  assert.equal(resolved?.totalCleared >= 9, true);
  assert.equal(controller.board.hasHoles(), false);
});

test("purple 5-match executes clearRandom count 12 as a board effect", () => {
  const controller = createController([wave("purple-random-test", 300, 0, 0)]);
  controller.startGame();

  const events = controller.handleResolveComplete(
    summary(5, matchGroup(PURPLE, 5, 3)),
  );
  const request = events.find((event) => event.type === "boardEffectRequested");
  const resolved = events.find((event) => event.type === "boardEffectResolved");

  assert.deepEqual(request, {
    type: "boardEffectRequested",
    request: { type: "clearRandom", count: 12 },
  });
  assert.equal(resolved?.type, "boardEffectResolved");
  assert.equal(resolved?.totalCleared >= 12, true);
  assert.equal(controller.board.hasHoles(), false);
});

test("board reshuffle does not change combat, score, or hp state", () => {
  const controller = createController([wave("shuffle-safety", 100, 2, 10)]);
  controller.startGame();
  controller.board = new Board({
    initialTypes: deadTypes,
    rng: fixedRng(0),
  });
  const before = controller.getState();

  const changed = controller.board.ensurePlayableBoard();
  const after = controller.getState();

  assert.equal(changed, true);
  assert.equal(after.score, before.score);
  assert.equal(after.enemyHp, before.enemyHp);
  assert.equal(after.enemyAttackCounter, before.enemyAttackCounter);
  assert.equal(after.playerHp, before.playerHp);
  assert.equal(after.playerShield, before.playerShield);
  assert.equal(controller.board.detectMatches().length, 0);
  assert.equal(controller.board.hasAvailableMove(), true);
});

test("extra board effect clears advance enemy attack at most once", () => {
  const controller = createController([wave("counter-test", 300, 2, 10)]);
  controller.startGame();

  const events = controller.handleResolveComplete(
    summary(4, matchGroup(RED, 4)),
  );
  const counterEvents = events.filter(
    (event) =>
      event.type === "combat" &&
      event.event.type === "enemyAttackCounterChanged",
  );
  const state = controller.getState();

  assert.equal(counterEvents.length, 1);
  assert.equal(state.enemyAttackCounter, 1);
  assert.equal(hasCombatEvent(events, "playerDamaged"), false);
});

test("enemy defeated by board-effect follow-up damage does not counterattack", () => {
  const controller = createController([wave("follow-up-ko", 30, 1, 99)]);
  controller.startGame();

  const events = controller.handleResolveComplete(
    summary(4, matchGroup(RED, 4)),
  );
  const state = controller.getState();

  assert.equal(state.phase, "won");
  assert.equal(hasGameplayEvent(events, "boardEffectResolved"), true);
  assert.equal(hasCombatEvent(events, "enemyDefeated"), true);
  assert.equal(hasCombatEvent(events, "playerDamaged"), false);
});

function createController(waves?: EnemyWave[]): GameplayController {
  const options = {
    initialTypes: playableTypes,
    rng: fixedRng(0.73),
  };

  return new GameplayController(waves ? { ...options, waves } : options);
}

function summary(totalCleared: number, ...groups: MatchGroup[]): ResolveSummary {
  const result: ResolveSummary = {
    totalCleared,
    chainCount: 1,
    wasPlayerMove: true,
  };

  if (groups.length > 0) {
    result.groups = groups;
    result.maxMatchLength = Math.max(...groups.map((group) => group.length));
  }

  return result;
}

function matchGroup(type: PieceType, length: number, y = 0): MatchGroup {
  return {
    type,
    length,
    cells: Array.from({ length }, (_, x) => ({ x, y })),
    orientation: "row",
  };
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

function hasGameplayEvent(
  events: GameplayEvent[],
  type: GameplayEvent["type"],
): boolean {
  return events.some((event) => event.type === type);
}

function hasCombatEvent(events: GameplayEvent[], type: string): boolean {
  return events.some(
    (event) => event.type === "combat" && event.event.type === type,
  );
}

function fixedRng(value: number): () => number {
  return () => value;
}
