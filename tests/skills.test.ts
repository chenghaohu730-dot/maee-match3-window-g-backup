import assert from "node:assert/strict";
import test from "node:test";
import {
  type MatchGroup,
  type PieceType,
  type ResolveSummary,
} from "../src/core/board.ts";
import { CombatSystem } from "../src/core/combat.ts";
import type { EnemyWave } from "../src/core/combatTypes.ts";
import { SkillSystem } from "../src/core/skills.ts";
import type { SkillResolveResult } from "../src/core/skillTypes.ts";

const RED: PieceType = 0;
const BLUE: PieceType = 1;
const YELLOW: PieceType = 2;
const GREEN: PieceType = 3;
const PURPLE: PieceType = 4;
const ORANGE: PieceType = 5;

test("does not trigger a skill for a 3-match summary", () => {
  const result = resolve(matchSummary(matchGroup(RED, 3)));

  assert.equal(result.triggered, false);
  assert.equal(result.extraDamage, 0);
  assert.equal(result.scoreMultiplier, 1);
  assert.deepEqual(result.vfxEvents, []);
  assert.deepEqual(result.boardEffectRequests, []);
});

test("triggers red flameSlash on a 4-match", () => {
  const result = resolve(matchSummary(matchGroup(RED, 4, 2)));

  assert.equal(result.triggered, true);
  assert.equal(result.skillId, "flameSlash");
  assert.equal(result.level, "skill");
  assert.equal(result.extraDamage, 10);
  assert.equal(hasBattleVfx(result, "red_skill_slash"), true);
  assert.deepEqual(result.boardEffectRequests[0], { type: "clearRow", row: 2 });
});

test("triggers red flameSpin on a 5-match", () => {
  const result = resolve(matchSummary(matchGroup(RED, 5)));

  assert.equal(result.skillId, "flameSpin");
  assert.equal(result.level, "ultimate");
  assert.equal(result.extraDamage, 25);
  assert.equal(hasBattleVfx(result, "red_ultimate_spin"), true);
  assert.deepEqual(result.boardEffectRequests[0], { type: "clearRandom", count: 8 });
});

test("blue 4-match freezes the enemy for 1 turn", () => {
  const combat = createCombat();
  const result = resolve(matchSummary(matchGroup(BLUE, 4)), combat);

  assert.equal(result.skillId, "frostFreeze");
  assert.equal(result.extraDamage, 6);
  assert.equal(hasBattleVfx(result, "blue_skill_freeze"), true);
  assert.equal(combat.getState().freezeTurns, 1);
});

test("blue 5-match freezes the enemy for 2 turns", () => {
  const combat = createCombat();
  const result = resolve(matchSummary(matchGroup(BLUE, 5)), combat);

  assert.equal(result.skillId, "icefall");
  assert.equal(result.extraDamage, 18);
  assert.equal(combat.getState().freezeTurns, 2);
  assert.deepEqual(result.boardEffectRequests[0], { type: "clearRandom", count: 6 });
});

test("yellow 4-match applies a 1.5 score multiplier", () => {
  const result = resolve(matchSummary(matchGroup(YELLOW, 4)));

  assert.equal(result.skillId, "starChain");
  assert.equal(result.scoreMultiplier, 1.5);
  assert.equal(result.extraDamage, 6);
});

test("yellow 5-match applies a 2.0 score multiplier", () => {
  const result = resolve(matchSummary(matchGroup(YELLOW, 5)));

  assert.equal(result.skillId, "meteorShower");
  assert.equal(result.scoreMultiplier, 2);
  assert.equal(result.extraDamage, 18);
});

test("green 4-match adds shield", () => {
  const combat = createCombat();
  const result = resolve(matchSummary(matchGroup(GREEN, 4)), combat);

  assert.equal(result.skillId, "forestShield");
  assert.equal(result.extraDamage, 4);
  assert.equal(combat.getState().player.shield, 10);
});

test("green 5-match heals and adds shield", () => {
  const combat = new CombatSystem([wave("heal-test", 999, 1, 30)]);
  combat.applyPlayerMoveResult({ totalCleared: 3 });

  const result = resolve(matchSummary(matchGroup(GREEN, 5)), combat);
  const state = combat.getState();

  assert.equal(result.skillId, "natureBlessing");
  assert.equal(result.extraDamage, 10);
  assert.equal(state.player.hp, 90);
  assert.equal(state.player.shield, 15);
});

test("purple 4-match returns a clearArea request", () => {
  const result = resolve(matchSummary(matchGroup(PURPLE, 4)));

  assert.equal(result.skillId, "arcaneBomb");
  assert.deepEqual(result.boardEffectRequests[0], {
    type: "clearArea",
    center: { x: 2, y: 0 },
    radius: 1,
  });
});

test("purple 5-match returns a clearRandom count 12 request", () => {
  const result = resolve(matchSummary(matchGroup(PURPLE, 5)));

  assert.equal(result.skillId, "moonCircle");
  assert.deepEqual(result.boardEffectRequests[0], {
    type: "clearRandom",
    count: 12,
  });
});

test("orange 4-match deals 20 extra damage", () => {
  const result = resolve(matchSummary(matchGroup(ORANGE, 4)));

  assert.equal(result.skillId, "heroHammer");
  assert.equal(result.extraDamage, 20);
});

test("orange 5-match applies armor break", () => {
  const combat = createCombat(500);
  const result = resolve(matchSummary(matchGroup(ORANGE, 5)), combat);

  assert.equal(result.skillId, "armorBreakJudgement");
  assert.equal(result.extraDamage, 30);
  assert.deepEqual(combat.getState().armorBreak, {
    turns: 2,
    multiplier: 1.3,
  });
});

test("multiple groups trigger only the longest group", () => {
  const result = resolve(
    matchSummary(matchGroup(RED, 4), matchGroup(BLUE, 5)),
  );

  assert.equal(result.pieceType, BLUE);
  assert.equal(result.skillId, "icefall");
  assert.equal(result.level, "ultimate");
});

function resolve(
  summary: ResolveSummary,
  combat: CombatSystem = createCombat(),
): SkillResolveResult {
  return new SkillSystem().resolveSkills(summary, combat);
}

function matchSummary(...groups: MatchGroup[]): ResolveSummary {
  return {
    totalCleared: groups.reduce((sum, group) => sum + group.length, 0),
    chainCount: 1,
    wasPlayerMove: true,
    groups,
    maxMatchLength: Math.max(...groups.map((group) => group.length)),
  };
}

function matchGroup(type: PieceType, length: number, y = 0): MatchGroup {
  return {
    type,
    length,
    cells: Array.from({ length }, (_, x) => ({ x, y })),
    orientation: "row",
  };
}

function createCombat(hp = 200): CombatSystem {
  return new CombatSystem([wave("training", hp, 0, 0)]);
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

function hasBattleVfx(result: SkillResolveResult, key: string): boolean {
  return result.vfxEvents.some(
    (event) => event.type === "battleVfx" && event.key === key,
  );
}
