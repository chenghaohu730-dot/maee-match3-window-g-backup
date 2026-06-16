import assert from "node:assert/strict";
import test from "node:test";
import type { CombatEvent } from "../src/core/combatTypes.ts";
import type { GameplayEvent } from "../src/core/gameplayTypes.ts";
import { PresentationDirector } from "../src/ui/presentationDirector.ts";
import type { CombatTimelineEventType } from "../src/ui/combatTimelineTypes.ts";

test("PresentationDirector busy state prevents duplicate playback", async () => {
  const played: CombatTimelineEventType[] = [];
  const director = new PresentationDirector({
    scheduler: { wait: async () => {} },
    onTimelineEvent: (event) => {
      played.push(event.type);
    },
  });
  const input = {
    summary: { totalCleared: 3, chainCount: 1, wasPlayerMove: true },
    gameplayEvents: [combat({ type: "enemyDamaged", amount: 6, enemyHp: 24 })],
    chainCount: 1,
  };

  const first = director.playTurnPresentation(input);
  const second = director.playTurnPresentation(input);

  assert.equal(director.isBusy(), true);
  await Promise.all([first, second]);

  assert.equal(
    played.filter((type) => type === "board.swapComplete").length,
    1,
  );
  assert.equal(director.isBusy(), false);
});

test("cancelLowPriorityEffects skips pending particles but keeps gameWon", async () => {
  const played: CombatTimelineEventType[] = [];
  let director: PresentationDirector;

  director = new PresentationDirector({
    scheduler: { wait: async () => {} },
    onTimelineEvent: (event) => {
      played.push(event.type);

      if (event.type === "board.swapComplete") {
        director.cancelLowPriorityEffects();
      }
    },
  });

  await director.playTurnPresentation({
    summary: { totalCleared: 5, chainCount: 1, wasPlayerMove: true },
    gameplayEvents: [
      skill("ultimate"),
      combat({ type: "enemyDamaged", amount: 35, enemyHp: 0 }),
      combat({ type: "enemyDefeated", wave: 6, enemyId: "boss" }),
      combat({ type: "gameWon" }),
    ],
    chainCount: 1,
  });

  assert.equal(played.includes("particle.ultimateAura"), false);
  assert.equal(played.includes("game.end"), true);
});

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
