import assert from "node:assert/strict";
import test from "node:test";
import {
  Board,
  type ClearEvent,
  type PieceType,
  type ResolveSummary,
} from "../src/core/board.ts";

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

test("creates a full 8x8 board without starting matches", () => {
  const board = new Board({ rng: fixedRng(0.18) });

  assert.equal(board.grid.length, 8);
  assert.equal(board.grid.every((row) => row.length === 8), true);
  assert.equal(board.hasHoles(), false);
  assert.equal(board.detectMatches().length, 0);
});

test("rejects non-adjacent swaps", () => {
  const board = new Board({ initialTypes: stableTypes });
  const before = board.toTypes();

  const result = board.swap({ x: 0, y: 0 }, { x: 2, y: 0 });

  assert.equal(result.success, false);
  assert.equal(result.reason, "not-adjacent");
  assert.deepEqual(board.toTypes(), before);
});

test("rolls back adjacent swaps that do not create matches", () => {
  const board = new Board({ initialTypes: stableTypes });
  const before = board.toTypes();

  const result = board.swap({ x: 0, y: 0 }, { x: 1, y: 0 });

  assert.equal(result.success, false);
  assert.equal(result.reason, "no-match");
  assert.deepEqual(board.toTypes(), before);
});

test("swaps, clears, applies gravity, refills, and emits damage", () => {
  const types: PieceType[][] = [
    [0, 1, 0, 0, 4, 5, 0, 1],
    [1, 2, 3, 4, 5, 0, 1, 2],
    [2, 3, 4, 5, 0, 1, 2, 3],
    [3, 4, 5, 0, 1, 2, 3, 4],
    [4, 5, 0, 1, 2, 3, 4, 5],
    [5, 0, 1, 2, 3, 4, 5, 0],
    [0, 1, 2, 3, 4, 5, 0, 1],
    [1, 2, 3, 4, 5, 0, 1, 2],
  ];
  const events: ClearEvent[] = [];
  const board = new Board({
    initialTypes: types,
    rng: fixedRng(0.73),
    onClear: (event) => events.push(event),
  });

  const result = board.swap({ x: 0, y: 0 }, { x: 1, y: 0 });

  assert.equal(result.success, true);
  assert.equal(result.clearEvents[0]?.pieces.length, 3);
  assert.equal(result.totalDamage, 6);
  assert.equal(events[0]?.damage, 6);
  assert.equal(board.hasHoles(), false);
  assert.equal(board.detectMatches().length, 0);
});

test("emits a resolve summary after a successful player move", () => {
  const types: PieceType[][] = [
    [0, 1, 0, 0, 4, 5, 0, 1],
    [1, 2, 3, 4, 5, 0, 1, 2],
    [2, 3, 4, 5, 0, 1, 2, 3],
    [3, 4, 5, 0, 1, 2, 3, 4],
    [4, 5, 0, 1, 2, 3, 4, 5],
    [5, 0, 1, 2, 3, 4, 5, 0],
    [0, 1, 2, 3, 4, 5, 0, 1],
    [1, 2, 3, 4, 5, 0, 1, 2],
  ];
  const summaries: ResolveSummary[] = [];
  const board = new Board({
    initialTypes: types,
    rng: fixedRng(0.73),
    onResolveComplete: (summary) => summaries.push(summary),
  });

  const result = board.swap({ x: 0, y: 0 }, { x: 1, y: 0 });

  assert.equal(result.success, true);
  assert.deepEqual(summaries[0], {
    totalCleared: result.clearEvents.reduce((sum, event) => sum + event.pieces.length, 0),
    chainCount: result.clearEvents.length,
    wasPlayerMove: true,
  });
});

test("adds special match groups to resolve summary for 4-matches", () => {
  const types: PieceType[][] = [
    [0, 0, 1, 0, 4, 5, 0, 1],
    [1, 2, 0, 4, 5, 0, 1, 2],
    [2, 3, 4, 5, 0, 1, 2, 3],
    [3, 4, 5, 0, 1, 2, 3, 4],
    [4, 5, 0, 1, 2, 3, 4, 5],
    [5, 0, 1, 2, 3, 4, 5, 0],
    [0, 1, 2, 3, 4, 5, 0, 1],
    [1, 2, 3, 4, 5, 0, 1, 2],
  ];
  const summaries: ResolveSummary[] = [];
  const board = new Board({
    initialTypes: types,
    rng: fixedRng(0.73),
    onResolveComplete: (summary) => summaries.push(summary),
  });

  const result = board.swap({ x: 2, y: 0 }, { x: 2, y: 1 });
  const group = summaries[0]?.groups?.[0];

  assert.equal(result.success, true);
  assert.equal(group?.type, 0);
  assert.equal(group?.length, 4);
  assert.equal(group?.orientation, "row");
  assert.deepEqual(group?.cells, [
    { x: 0, y: 0 },
    { x: 1, y: 0 },
    { x: 2, y: 0 },
    { x: 3, y: 0 },
  ]);
  assert.equal(summaries[0]?.maxMatchLength, 4);
});

test("clearRow board effect clears a full row and refills", () => {
  const events: ClearEvent[] = [];
  const board = new Board({
    initialTypes: stableTypes,
    rng: fixedRng(0.73),
    onClear: (event) => events.push(event),
  });

  const summary = board.applyBoardEffects([{ type: "clearRow", row: 0 }]);

  assert.equal(events[0]?.pieces.length, 8);
  assert.deepEqual(coordsOf(events[0]?.pieces ?? []), [
    "0,0",
    "1,0",
    "2,0",
    "3,0",
    "4,0",
    "5,0",
    "6,0",
    "7,0",
  ]);
  assert.equal(summary.totalCleared >= 8, true);
  assert.equal(summary.chainCount >= 1, true);
  assert.equal(board.hasHoles(), false);
  assert.equal(board.detectMatches().length, 0);
  assert.equal(board.hasAvailableMove(), true);
});

test("clearArea board effect clears a 3x3 area for radius 1", () => {
  const events: ClearEvent[] = [];
  const board = new Board({
    initialTypes: stableTypes,
    rng: fixedRng(0.41),
    onClear: (event) => events.push(event),
  });

  const summary = board.applyBoardEffects([
    { type: "clearArea", center: { x: 3, y: 3 }, radius: 1 },
  ]);

  assert.equal(events[0]?.pieces.length, 9);
  assert.deepEqual(coordsOf(events[0]?.pieces ?? []), [
    "2,2",
    "2,3",
    "2,4",
    "3,2",
    "3,3",
    "3,4",
    "4,2",
    "4,3",
    "4,4",
  ]);
  assert.equal(summary.totalCleared >= 9, true);
  assert.equal(board.hasHoles(), false);
  assert.equal(board.detectMatches().length, 0);
  assert.equal(board.hasAvailableMove(), true);
});

test("clearRandom board effect clears the requested count and refills", () => {
  const events: ClearEvent[] = [];
  const board = new Board({
    initialTypes: stableTypes,
    rng: fixedRng(0.18),
    onClear: (event) => events.push(event),
  });

  const summary = board.applyBoardEffects([{ type: "clearRandom", count: 8 }]);

  assert.equal(events[0]?.pieces.length, 8);
  assert.equal(new Set(coordsOf(events[0]?.pieces ?? [])).size, 8);
  assert.equal(summary.totalCleared >= 8, true);
  assert.equal(board.hasHoles(), false);
  assert.equal(board.detectMatches().length, 0);
  assert.equal(board.hasAvailableMove(), true);
});

test("resolves chain reactions until the board is stable", () => {
  const types: PieceType[][] = [
    [0, 1, 2, 3, 4, 5, 0, 1],
    [1, 2, 3, 4, 5, 0, 1, 2],
    [2, 3, 4, 5, 0, 1, 2, 3],
    [3, 4, 5, 0, 1, 2, 3, 4],
    [2, 5, 0, 1, 2, 3, 4, 5],
    [2, 0, 1, 2, 3, 4, 5, 0],
    [3, 3, 3, 0, 4, 5, 0, 1],
    [2, 2, 4, 1, 5, 0, 1, 2],
  ];
  const board = new Board({ initialTypes: types, rng: fixedRng(0.41) });

  const events = board.resolve();

  assert.ok(events.length >= 2);
  assert.equal(events[0]?.pieces.length, 3);
  assert.equal(events[0]?.damage, 6);
  assert.equal(events[1]?.chain, 2);
  assert.equal(board.hasHoles(), false);
  assert.equal(board.detectMatches().length, 0);
});

function fixedRng(value: number): () => number {
  return () => value;
}

function coordsOf(pieces: ClearEvent["pieces"]): string[] {
  return pieces
    .map((piece) => `${piece.x},${piece.y}`)
    .sort((a, b) => a.localeCompare(b));
}
