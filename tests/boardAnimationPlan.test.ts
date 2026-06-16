import assert from "node:assert/strict";
import test from "node:test";
import type { BoardPieceSnapshot, PieceType } from "../src/core/board.ts";
import { Board } from "../src/core/board.ts";
import { GameplayController } from "../src/core/gameplayController.ts";
import type { EnemyWave } from "../src/core/combatTypes.ts";
import { BoardInteractionLock } from "../src/ui/boardInteractionLock.ts";
import { createBoardAnimationPlan } from "../src/ui/boardAnimationPlan.ts";

const stableTypes: PieceType[][] = [
  [0, 1, 2, 3, 4, 5, 0, 1],
  [1, 2, 3, 4, 5, 0, 1, 2],
  [2, 3, 4, 5, 0, 1, 2, 3],
  [3, 4, 5, 0, 1, 2, 3, 4],
  [4, 5, 0, 1, 2, 3, 4, 5],
  [5, 0, 1, 2, 3, 4, 5, 0],
  [0, 1, 2, 3, 4, 5, 0, 1],
  [1, 2, 3, 4, 5, 0, 1, 2],
];

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

test("createBoardAnimationPlan identifies moved pieces", () => {
  const before = snapshots([
    ["a", 0, 0],
    ["b", 0, 1],
  ]);
  const after = snapshots([
    ["a", 1, 0],
    ["b", 0, 1],
  ]);

  const plan = createBoardAnimationPlan(before, after);

  assert.deepEqual(plan.movedPieces, [
    { id: "a", fromRow: 0, fromCol: 0, toRow: 1, toCol: 0 },
  ]);
});

test("createBoardAnimationPlan identifies spawned pieces", () => {
  const before = snapshots([["a", 2, 0]]);
  const after = snapshots([
    ["c", 0, 0],
    ["d", 1, 0],
    ["a", 2, 0],
  ]);

  const plan = createBoardAnimationPlan(before, after);

  assert.deepEqual(plan.spawnedPieces, [
    { id: "c", toRow: 0, toCol: 0, spawnFromRow: -1 },
    { id: "d", toRow: 1, toCol: 0, spawnFromRow: -2 },
  ]);
});

test("createBoardAnimationPlan identifies removed pieces", () => {
  const before = snapshots([
    ["a", 0, 0],
    ["b", 0, 1],
    ["c", 0, 2],
  ]);
  const after = snapshots([["a", 0, 0]]);

  const plan = createBoardAnimationPlan(before, after, {
    clearEvents: [{ pieces: [{ id: "b" }, { id: "c" }] }],
  });

  assert.deepEqual(plan.removedPieces, ["b", "c"]);
});

test("invalid swap does not trigger resolve or combat progress", () => {
  let resolveCount = 0;
  const board = new Board({
    initialTypes: stableTypes,
    onResolveComplete: () => {
      resolveCount++;
    },
  });
  const result = board.swap({ x: 0, y: 0 }, { x: 1, y: 0 });

  assert.equal(result.success, false);
  assert.equal(result.reason, "no-match");
  assert.equal(resolveCount, 0);

  const controller = new GameplayController({
    initialTypes: playableTypes,
    rng: fixedRng(0.73),
    waves: [wave("counter-test", 100, 1, 10)],
  });
  controller.startGame();
  const before = controller.getState();
  const controllerResult = controller.board.swap({ x: 0, y: 0 }, { x: 1, y: 0 });
  const after = controller.getState();

  assert.equal(controllerResult.success, false);
  assert.equal(after.score, before.score);
  assert.equal(after.enemyHp, before.enemyHp);
  assert.equal(after.enemyAttackCounter, before.enemyAttackCounter);
});

test("board interaction lock blocks repeated animation starts", () => {
  const lock = new BoardInteractionLock();

  assert.equal(lock.canUseBoard("playing", false), true);
  assert.equal(lock.beginAnimation(), true);
  assert.equal(lock.isAnimating, true);
  assert.equal(lock.beginAnimation(), false);
  assert.equal(lock.canUseBoard("playing", false), false);

  lock.endAnimation();

  assert.equal(lock.isAnimating, false);
  assert.equal(lock.canUseBoard("playing", false), true);
  assert.equal(lock.canUseBoard("won", false), false);
  assert.equal(lock.canUseBoard("playing", true), false);
});

function snapshots(
  pieces: readonly (readonly [string, number, number])[],
): BoardPieceSnapshot[] {
  return pieces.map(([id, row, col], index) => ({
    id,
    row,
    col,
    type: (index % 6) as PieceType,
  }));
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
