import assert from "node:assert/strict";
import test from "node:test";
import type {
  MatchGroup,
  PieceType,
  ResolveSummary,
} from "../src/core/board.ts";
import { GameplayController } from "../src/core/gameplayController.ts";
import type { GameplayEvent, GameplayState } from "../src/core/gameplayTypes.ts";
import { SkillSystem } from "../src/core/skills.ts";
import type { SkillResolveResult } from "../src/core/skillTypes.ts";
import type { VfxEvent } from "../src/core/vfxTypes.ts";
import type { EnemyWave } from "../src/core/combatTypes.ts";
import {
  buildSkillVfxLayerModel,
  getBattleVfxPresentation,
  getScreenShakeClass,
  getSkillVfxDurationMs,
  renderSkillVfxLayer,
} from "../src/ui/skillVfxLayer.ts";

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

test("battle vfx keys map to their required CSS classes", () => {
  const expected = {
    red_skill_slash: ["red-skill-slash", "火焰横扫", "skill"],
    blue_skill_freeze: ["blue-skill-freeze", "寒霜冻结", "skill"],
    yellow_skill_chain: ["yellow-skill-chain", "星辉连闪", "skill"],
    green_skill_shield: ["green-skill-shield", "森林护盾", "skill"],
    purple_skill_bomb: ["purple-skill-bomb", "秘法爆弹", "skill"],
    orange_skill_hammer: ["orange-skill-hammer", "勇者重锤", "skill"],
    red_ultimate_spin: ["red-ultimate-spin", "火焰旋风", "ultimate"],
    blue_ultimate_icefall: ["blue-ultimate-icefall", "冰锥坠落", "ultimate"],
    yellow_ultimate_meteor: ["yellow-ultimate-meteor", "星愿流星雨", "ultimate"],
    green_ultimate_bloom: ["green-ultimate-bloom", "自然祝福", "ultimate"],
    purple_ultimate_magic_circle: [
      "purple-ultimate-magic-circle",
      "月蚀法阵",
      "ultimate",
    ],
    orange_ultimate_judgement: [
      "orange-ultimate-judgement",
      "破甲审判",
      "ultimate",
    ],
  } as const;

  for (const [key, [cssClass, label, level]] of Object.entries(expected)) {
    const presentation = getBattleVfxPresentation(key);

    assert.equal(presentation.cssClass, cssClass);
    assert.equal(presentation.label, label);
    assert.equal(presentation.level, level);
  }
});

test("unknown vfx keys use the generic fallback instead of failing", () => {
  const presentation = getBattleVfxPresentation("future_unknown_vfx");
  const html = renderSkillVfxLayer({
    state: {
      lastComboCount: 1,
      lastSkillLevel: "skill",
      lastSkillText: "futureSkill",
      lastVfxKeys: ["screenShake:medium", "future_unknown_vfx"],
    },
  });

  assert.equal(presentation.cssClass, "generic-vfx-flash");
  assert.equal(presentation.level, "fallback");
  assert.equal(html.includes("generic-vfx-flash"), true);
  assert.equal(html.includes("技能闪光"), true);
});

test("battle-scoped skill vfx omits board-only rectangular layers", () => {
  const input = {
    state: {
      lastComboCount: 1,
      lastSkillLevel: "skill",
      lastSkillText: "forestShield",
      lastVfxKeys: ["screenShake:medium", "green_skill_shield"],
    },
  } satisfies Parameters<typeof renderSkillVfxLayer>[0];
  const boardHtml = renderSkillVfxLayer(input);
  const battleHtml = renderSkillVfxLayer(input, "battle");

  assert.equal(boardHtml.includes("skill-vfx-board-glow"), true);
  assert.equal(boardHtml.includes("skill-vfx-row-sweep"), true);
  assert.equal(battleHtml.includes("green-skill-shield"), true);
  assert.equal(battleHtml.includes("skill-vfx-ring"), true);
  assert.equal(battleHtml.includes("skill-vfx-beam"), true);
  assert.equal(battleHtml.includes("森林护盾"), true);
  assert.equal(battleHtml.includes("skill-vfx-board-glow"), false);
  assert.equal(battleHtml.includes("skill-vfx-row-sweep"), false);
});

test("4-match skill vfx produces skill-level visual metadata", () => {
  const result = buildSkillPlan(matchSummary(matchGroup(RED, 4)));
  const model = buildSkillVfxLayerModel({
    state: stateFromSkillResult(result, 2),
    events: eventsFromResult(result),
  });

  assert.equal(model?.presentation.cssClass, "red-skill-slash");
  assert.equal(model?.level, "skill");
  assert.equal(model?.text, "火焰横扫");
  assert.equal(model?.comboText, "2 COMBO");
  assert.equal(model?.presentation.durationMs >= 600, true);
  assert.equal(model?.presentation.durationMs <= 800, true);
});

test("5-match skill vfx produces ultimate-level visual metadata", () => {
  const result = buildSkillPlan(matchSummary(matchGroup(PURPLE, 5, 3)));
  const model = buildSkillVfxLayerModel({
    state: stateFromSkillResult(result, 4),
    events: eventsFromResult(result),
  });

  assert.equal(model?.presentation.cssClass, "purple-ultimate-magic-circle");
  assert.equal(model?.level, "ultimate");
  assert.equal(model?.text, "月蚀法阵");
  assert.equal(model?.comboText, "AMAZING");
  assert.equal(model?.presentation.durationMs >= 900, true);
  assert.equal(model?.presentation.durationMs <= 1200, true);
});

test("screen shake intensity maps small, medium, and large classes", () => {
  assert.equal(getScreenShakeClass("small"), "shake-small");
  assert.equal(getScreenShakeClass("medium"), "shake-medium");
  assert.equal(getScreenShakeClass("large"), "shake-large");
  assert.equal(getScreenShakeClass(undefined), "");
});

test("skill vfx rendering does not mutate board, combat, or skill results", () => {
  const controller = new GameplayController({
    initialTypes: playableTypes,
    rng: fixedRng(0.73),
    waves: [wave("training", 300, 0, 0)],
  });
  controller.startGame();
  const events = controller.handleResolveComplete(
    matchSummary(matchGroup(PURPLE, 5, 3)),
  );
  const beforeState = controller.getState();
  const beforeSnapshot = controller.board.getSnapshot();

  const html = renderSkillVfxLayer({
    state: beforeState,
    events,
  });
  const durationMs = getSkillVfxDurationMs({
    state: beforeState,
    events,
  });

  assert.equal(html.includes("purple-ultimate-magic-circle"), true);
  assert.equal(durationMs <= 1200, true);
  assert.deepEqual(controller.getState(), beforeState);
  assert.deepEqual(controller.board.getSnapshot(), beforeSnapshot);
  assert.equal(controller.board.grid.flat().length, 64);
  assert.equal(controller.board.hasHoles(), false);
});

function buildSkillPlan(summary: ResolveSummary): SkillResolveResult {
  return new SkillSystem().buildSkillPlan(summary);
}

function stateFromSkillResult(
  result: SkillResolveResult,
  lastComboCount: number,
): Pick<
  GameplayState,
  "lastComboCount" | "lastSkillLevel" | "lastSkillText" | "lastVfxKeys"
> {
  const state = {
    lastComboCount,
    lastVfxKeys: result.vfxEvents.map(vfxKey),
  };

  if (result.skillId && result.level) {
    return {
      ...state,
      lastSkillText: result.skillId,
      lastSkillLevel: result.level,
    };
  }

  return state;
}

function eventsFromResult(result: SkillResolveResult): GameplayEvent[] {
  const events: GameplayEvent[] = [];

  if (
    result.triggered &&
    result.skillId &&
    result.level &&
    result.pieceType !== undefined
  ) {
    events.push({
      type: "skillTriggered",
      skillId: result.skillId,
      level: result.level,
      pieceType: result.pieceType,
      extraDamage: result.extraDamage,
    });
  }

  for (const event of result.vfxEvents) {
    events.push({ type: "vfx", key: vfxKey(event) });
  }

  for (const request of result.boardEffectRequests) {
    events.push({ type: "boardEffectRequested", request });
  }

  return events;
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

function matchGroup(type: PieceType, length: number, y = 0): MatchGroup {
  return {
    type,
    length,
    cells: Array.from({ length }, (_, x) => ({ x, y })),
    orientation: "row",
  };
}

function vfxKey(event: VfxEvent): string {
  switch (event.type) {
    case "battleVfx":
      return event.key;
    case "pieceVfx":
      return event.key;
    case "screenShake":
      return `screenShake:${event.intensity}`;
    case "skillText":
      return `skillText:${event.text}`;
    case "comboText":
      return `combo:${event.chainCount}`;
  }
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
