import type {
  BoardPieceSnapshot,
  ResolveAnimationStep,
} from "../core/board.ts";

export interface BoardAnimationResolveContext {
  chainCount?: number;
  clearEvents?: readonly {
    pieces: readonly { id: string }[];
  }[];
}

export interface MovedPieceAnimation {
  id: string;
  fromRow: number;
  fromCol: number;
  toRow: number;
  toCol: number;
}

export interface SpawnedPieceAnimation {
  id: string;
  toRow: number;
  toCol: number;
  spawnFromRow: number;
}

export interface BoardAnimationPlan {
  removedPieces: string[];
  movedPieces: MovedPieceAnimation[];
  spawnedPieces: SpawnedPieceAnimation[];
  chainCount: number;
  comboText?: string;
}

export interface BoardAnimationStepPlan extends BoardAnimationPlan {
  kind: ResolveAnimationStep["kind"];
  beforeSnapshot: BoardPieceSnapshot[];
  afterSnapshot: BoardPieceSnapshot[];
  chainIndex: number;
}

export interface BoardAnimationSequence {
  steps: BoardAnimationStepPlan[];
  chainCount: number;
  comboText?: string;
}

export function createBoardAnimationSequence(
  resolveSteps: readonly ResolveAnimationStep[],
  resolveContext: BoardAnimationResolveContext = {},
): BoardAnimationSequence {
  let clearStepCount = 0;
  const steps = resolveSteps.map((step) => {
    const hasClears = step.clearEvent.pieces.length > 0;
    if (hasClears) {
      clearStepCount++;
    }

    const chainIndex = hasClears ? clearStepCount : 0;
    const plan = createBoardAnimationPlan(
      step.beforeSnapshot,
      step.afterSnapshot,
      {
        clearEvents: hasClears ? [step.clearEvent] : [],
        chainCount: chainIndex,
      },
    );

    return {
      ...plan,
      kind: step.kind,
      beforeSnapshot: cloneSnapshot(step.beforeSnapshot),
      afterSnapshot: cloneSnapshot(step.afterSnapshot),
      chainIndex,
    };
  });
  const chainCount = resolveContext.chainCount ?? clearStepCount;
  const comboText = getComboText(chainCount);
  const sequence: BoardAnimationSequence = {
    steps,
    chainCount,
  };

  if (comboText) {
    sequence.comboText = comboText;
  }

  return sequence;
}

export function createBoardAnimationPlan(
  beforeSnapshot: readonly BoardPieceSnapshot[],
  afterSnapshot: readonly BoardPieceSnapshot[],
  resolveContext: BoardAnimationResolveContext = {},
): BoardAnimationPlan {
  const beforeById = mapSnapshotById(beforeSnapshot);
  const afterById = mapSnapshotById(afterSnapshot);
  const removedIds = new Set<string>();

  for (const piece of beforeSnapshot) {
    if (!afterById.has(piece.id)) {
      removedIds.add(piece.id);
    }
  }

  for (const event of resolveContext.clearEvents ?? []) {
    for (const piece of event.pieces) {
      if (beforeById.has(piece.id) && !afterById.has(piece.id)) {
        removedIds.add(piece.id);
      }
    }
  }

  const movedPieces = afterSnapshot
    .map((afterPiece) => {
      const beforePiece = beforeById.get(afterPiece.id);
      if (!beforePiece) {
        return null;
      }

      if (
        beforePiece.row === afterPiece.row &&
        beforePiece.col === afterPiece.col
      ) {
        return null;
      }

      return {
        id: afterPiece.id,
        fromRow: beforePiece.row,
        fromCol: beforePiece.col,
        toRow: afterPiece.row,
        toCol: afterPiece.col,
      };
    })
    .filter((piece): piece is MovedPieceAnimation => piece !== null);

  const spawnCountsByCol = new Map<number, number>();
  const spawnedPieces = afterSnapshot
    .filter((piece) => !beforeById.has(piece.id))
    .sort((a, b) => a.col - b.col || a.row - b.row)
    .map((piece) => {
      const previousCount = spawnCountsByCol.get(piece.col) ?? 0;
      spawnCountsByCol.set(piece.col, previousCount + 1);

      return {
        id: piece.id,
        toRow: piece.row,
        toCol: piece.col,
        spawnFromRow: -1 - previousCount,
      };
    });

  const chainCount =
    resolveContext.chainCount ??
    Math.max(0, resolveContext.clearEvents?.length ?? 0);
  const comboText = getComboText(chainCount);
  const plan: BoardAnimationPlan = {
    removedPieces: Array.from(removedIds).sort(),
    movedPieces,
    spawnedPieces,
    chainCount,
  };

  if (comboText) {
    plan.comboText = comboText;
  }

  return plan;
}

export function getComboText(chainCount: number): string | undefined {
  if (chainCount >= 4) {
    return "AMAZING";
  }

  if (chainCount >= 2) {
    return `${chainCount} COMBO`;
  }

  return undefined;
}

function mapSnapshotById(
  snapshot: readonly BoardPieceSnapshot[],
): Map<string, BoardPieceSnapshot> {
  return new Map(snapshot.map((piece) => [piece.id, piece]));
}

function cloneSnapshot(
  snapshot: readonly BoardPieceSnapshot[],
): BoardPieceSnapshot[] {
  return snapshot.map((piece) => ({
    id: piece.id,
    type: piece.type,
    row: piece.row,
    col: piece.col,
  }));
}
