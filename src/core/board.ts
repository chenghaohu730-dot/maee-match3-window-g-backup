import type { BoardEffectRequest } from "./skillTypes.ts";

export type PieceType = 0 | 1 | 2 | 3 | 4 | 5;

export interface Piece {
  id: string;
  type: PieceType;
  x: number;
  y: number;
  isMatched: boolean;
}

export interface BoardPieceSnapshot {
  id: string;
  type: PieceType;
  row: number;
  col: number;
}

export interface ClearEvent {
  pieces: Piece[];
  damage: number;
  chain: number;
}

export interface MatchCell {
  x: number;
  y: number;
}

export interface MatchGroup {
  type: PieceType;
  length: number;
  cells: MatchCell[];
  orientation: "row" | "col" | "mixed";
}

export interface SwapResult {
  success: boolean;
  clearEvents: ClearEvent[];
  totalDamage: number;
  reason?: "not-adjacent" | "out-of-bounds" | "empty-cell" | "no-match";
}

export interface ResolveSummary {
  totalCleared: number;
  chainCount: number;
  wasPlayerMove: boolean;
  groups?: MatchGroup[];
  maxMatchLength?: number;
}

export interface BoardOptions {
  rng?: () => number;
  onClear?: (event: ClearEvent) => void;
  onResolveComplete?: (summary: ResolveSummary) => void;
  initialTypes?: (PieceType | null)[][];
}

type Coord = MatchCell;

type LineOrientation = Extract<MatchGroup["orientation"], "row" | "col">;

type SwapFailureReason = NonNullable<SwapResult["reason"]>;

const PIECE_TYPES: PieceType[] = [0, 1, 2, 3, 4, 5];
const GUARANTEED_PLAYABLE_TYPES: PieceType[][] = [
  [0, 1, 0, 2, 3, 4, 5, 1],
  [2, 0, 3, 4, 5, 0, 1, 2],
  [2, 3, 4, 5, 0, 1, 2, 3],
  [3, 4, 5, 0, 1, 2, 3, 4],
  [4, 5, 0, 1, 2, 3, 4, 5],
  [5, 0, 1, 2, 3, 4, 5, 0],
  [0, 1, 2, 3, 4, 5, 0, 1],
  [1, 2, 3, 4, 5, 0, 1, 2],
];

export class Board {
  readonly width = 8;
  readonly height = 8;
  grid: (Piece | null)[][] = [];

  private readonly rng: () => number;
  private readonly onClear: ((event: ClearEvent) => void) | undefined;
  private readonly onResolveComplete: ((summary: ResolveSummary) => void) | undefined;
  private nextId = 1;

  constructor(options: BoardOptions = {}) {
    this.rng = options.rng ?? Math.random;
    this.onClear = options.onClear;
    this.onResolveComplete = options.onResolveComplete;

    if (options.initialTypes) {
      this.grid = this.createGridFromTypes(options.initialTypes);
    } else {
      this.grid = this.createInitialGrid();
    }
  }

  swap(a: Coord, b: Coord): SwapResult {
    if (!this.isInBounds(a) || !this.isInBounds(b)) {
      return this.failedSwap("out-of-bounds");
    }

    if (!this.isAdjacent(a, b)) {
      return this.failedSwap("not-adjacent");
    }

    if (!this.getPiece(a.x, a.y) || !this.getPiece(b.x, b.y)) {
      return this.failedSwap("empty-cell");
    }

    this.exchange(a, b);

    if (!this.hasMatch()) {
      this.exchange(a, b);
      return this.failedSwap("no-match");
    }

    const clearEvents = this.resolve(true);
    return {
      success: true,
      clearEvents,
      totalDamage: clearEvents.reduce((sum, event) => sum + event.damage, 0),
    };
  }

  resolve(wasPlayerMove = false): ClearEvent[] {
    const result = this.resolveMatches(wasPlayerMove);
    this.onResolveComplete?.(result.summary);
    return result.clearEvents;
  }

  applyBoardEffects(requests: BoardEffectRequest[]): ResolveSummary {
    const effectCells = this.collectBoardEffectCells(requests);
    const effectPieces = this.clearCells(effectCells);

    const clearEvents: ClearEvent[] = [];

    if (effectPieces.length === 0) {
      this.ensurePlayableBoard();
      return this.createResolveSummary(clearEvents, false, []);
    }

    const effectEvent: ClearEvent = {
      pieces: effectPieces,
      damage: effectPieces.length * 2,
      chain: 1,
    };
    clearEvents.push(effectEvent);
    this.onClear?.(effectEvent);

    this.applyGravity();
    this.refill();

    const cascadeResult = this.resolveMatches(false, 2);
    clearEvents.push(...cascadeResult.clearEvents);
    this.ensurePlayableBoard();

    return this.createResolveSummary(
      clearEvents,
      false,
      cascadeResult.specialGroups,
    );
  }

  hasAvailableMove(): boolean {
    if (this.hasMatch()) {
      this.resetMatchFlags();
      return true;
    }

    for (let y = 0; y < this.height; y++) {
      for (let x = 0; x < this.width; x++) {
        const right = { x: x + 1, y };
        const down = { x, y: y + 1 };

        if (this.isInBounds(right) && this.swapWouldMatch({ x, y }, right)) {
          return true;
        }

        if (this.isInBounds(down) && this.swapWouldMatch({ x, y }, down)) {
          return true;
        }
      }
    }

    return false;
  }

  private resolveMatches(
    wasPlayerMove: boolean,
    startChain = 1,
  ): {
    clearEvents: ClearEvent[];
    summary: ResolveSummary;
    specialGroups: MatchGroup[];
  } {
    const clearEvents: ClearEvent[] = [];
    const specialGroups: MatchGroup[] = [];

    for (let index = 0; index < 64; index++) {
      const detection = this.detectMatchesWithGroups();
      const matches = detection.pieces;
      if (matches.length === 0) {
        return {
          clearEvents,
          summary: this.createResolveSummary(
            clearEvents,
            wasPlayerMove,
            specialGroups,
          ),
          specialGroups,
        };
      }

      specialGroups.push(
        ...detection.groups
          .filter((group) => group.length >= 4)
          .map(cloneMatchGroup),
      );

      const event: ClearEvent = {
        pieces: matches.map(clonePiece),
        damage: matches.length * 2,
        chain: startChain + index,
      };

      clearEvents.push(event);
      this.onClear?.(event);
      this.clearMatched();
      this.applyGravity();
      this.refill();
    }

    throw new Error("Board resolve exceeded 64 chains.");
  }

  detectMatches(): Piece[] {
    return this.detectMatchesWithGroups().pieces;
  }

  private detectMatchesWithGroups(): { pieces: Piece[]; groups: MatchGroup[] } {
    this.resetMatchFlags();
    const matched = new Map<string, Piece>();
    const groups = this.detectMatchGroups();

    for (const group of groups) {
      for (const cell of group.cells) {
        const matchPiece = this.getPiece(cell.x, cell.y);
        if (matchPiece) {
          matchPiece.isMatched = true;
          matched.set(matchPiece.id, matchPiece);
        }
      }
    }

    return {
      pieces: Array.from(matched.values()),
      groups,
    };
  }

  private detectMatchGroups(): MatchGroup[] {
    const groups: MatchGroup[] = [];

    for (let y = 0; y < this.height; y++) {
      this.scanLine(
        Array.from({ length: this.width }, (_, x) => ({ x, y })),
        groups,
        "row",
      );
    }

    for (let x = 0; x < this.width; x++) {
      this.scanLine(
        Array.from({ length: this.height }, (_, y) => ({ x, y })),
        groups,
        "col",
      );
    }

    return mergeOverlappingMatchGroups(groups);
  }

  hasMatch(): boolean {
    return this.detectMatches().length > 0;
  }

  clearMatched(): Piece[] {
    const cleared: Piece[] = [];

    for (let y = 0; y < this.height; y++) {
      for (let x = 0; x < this.width; x++) {
        const piece = this.grid[y]?.[x] ?? null;
        if (piece?.isMatched) {
          cleared.push(clonePiece(piece));
          this.grid[y]![x] = null;
        }
      }
    }

    return cleared;
  }

  applyGravity(): void {
    for (let x = 0; x < this.width; x++) {
      let emptyRow = this.height - 1;

      for (let y = this.height - 1; y >= 0; y--) {
        const piece = this.grid[y]?.[x] ?? null;
        if (!piece) {
          continue;
        }

        if (emptyRow !== y) {
          this.grid[emptyRow]![x] = piece;
          this.grid[y]![x] = null;
        }

        piece.x = x;
        piece.y = emptyRow;
        piece.isMatched = false;
        emptyRow--;
      }

      for (let y = emptyRow; y >= 0; y--) {
        this.grid[y]![x] = null;
      }
    }
  }

  refill(): Piece[] {
    const created: Piece[] = [];

    for (let y = 0; y < this.height; y++) {
      for (let x = 0; x < this.width; x++) {
        if (this.grid[y]?.[x]) {
          continue;
        }

        const piece = this.createRandomPiece(x, y, true);
        this.grid[y]![x] = piece;
        created.push(clonePiece(piece));
      }
    }

    return created;
  }

  getPiece(x: number, y: number): Piece | null {
    if (!this.isInBounds({ x, y })) {
      return null;
    }

    return this.grid[y]?.[x] ?? null;
  }

  getSnapshot(): BoardPieceSnapshot[] {
    const snapshot: BoardPieceSnapshot[] = [];

    for (let y = 0; y < this.height; y++) {
      for (let x = 0; x < this.width; x++) {
        const piece = this.grid[y]?.[x] ?? null;
        if (!piece) {
          continue;
        }

        snapshot.push({
          id: piece.id,
          type: piece.type,
          row: y,
          col: x,
        });
      }
    }

    return snapshot;
  }

  toTypes(): (PieceType | null)[][] {
    return this.grid.map((row) => row.map((piece) => piece?.type ?? null));
  }

  hasHoles(): boolean {
    return this.grid.some((row) => row.some((piece) => piece === null));
  }

  private collectBoardEffectCells(
    requests: BoardEffectRequest[],
  ): MatchCell[] {
    const selected = new Map<string, MatchCell>();

    for (const request of requests) {
      switch (request.type) {
        case "clearRow":
          this.collectRowCells(request.row, selected);
          break;
        case "clearArea":
          this.collectAreaCells(request.center, request.radius, selected);
          break;
        case "clearRandom":
          this.collectRandomCells(request.count, selected);
          break;
      }
    }

    return Array.from(selected.values());
  }

  private collectRowCells(row: number, selected: Map<string, MatchCell>): void {
    const safeRow = Math.floor(row);
    if (safeRow < 0 || safeRow >= this.height) {
      return;
    }

    for (let x = 0; x < this.width; x++) {
      this.addEffectCell({ x, y: safeRow }, selected);
    }
  }

  private collectAreaCells(
    center: MatchCell,
    radius: number,
    selected: Map<string, MatchCell>,
  ): void {
    const safeRadius = Math.max(0, Math.floor(radius));
    const centerX = Math.floor(center.x);
    const centerY = Math.floor(center.y);

    for (let y = centerY - safeRadius; y <= centerY + safeRadius; y++) {
      for (let x = centerX - safeRadius; x <= centerX + safeRadius; x++) {
        this.addEffectCell({ x, y }, selected);
      }
    }
  }

  private collectRandomCells(
    count: number,
    selected: Map<string, MatchCell>,
  ): void {
    const safeCount = Math.max(0, Math.floor(count));
    if (safeCount === 0) {
      return;
    }

    const candidates = this.getOccupiedCells().filter(
      (cell) => !selected.has(cellKey(cell)),
    );

    for (let index = 0; index < safeCount && candidates.length > 0; index++) {
      const candidateIndex = Math.floor(this.rng() * candidates.length);
      const [cell] = candidates.splice(candidateIndex, 1);
      if (cell) {
        this.addEffectCell(cell, selected);
      }
    }
  }

  private addEffectCell(
    cell: MatchCell,
    selected: Map<string, MatchCell>,
  ): void {
    if (!this.isInBounds(cell) || !this.getPiece(cell.x, cell.y)) {
      return;
    }

    selected.set(cellKey(cell), { x: cell.x, y: cell.y });
  }

  private clearCells(cells: MatchCell[]): Piece[] {
    const cleared: Piece[] = [];

    for (const cell of cells) {
      const piece = this.getPiece(cell.x, cell.y);
      if (!piece) {
        continue;
      }

      cleared.push(clonePiece(piece));
      this.grid[cell.y]![cell.x] = null;
    }

    return cleared;
  }

  private getOccupiedCells(): MatchCell[] {
    const cells: MatchCell[] = [];

    for (let y = 0; y < this.height; y++) {
      for (let x = 0; x < this.width; x++) {
        if (this.getPiece(x, y)) {
          cells.push({ x, y });
        }
      }
    }

    return cells;
  }

  private createResolveSummary(
    clearEvents: ClearEvent[],
    wasPlayerMove: boolean,
    specialGroups: MatchGroup[],
  ): ResolveSummary {
    const summary: ResolveSummary = {
      totalCleared: clearEvents.reduce(
        (sum, event) => sum + event.pieces.length,
        0,
      ),
      chainCount: clearEvents.length,
      wasPlayerMove,
    };

    if (specialGroups.length > 0) {
      summary.groups = specialGroups.map(cloneMatchGroup);
      summary.maxMatchLength = Math.max(
        ...specialGroups.map((group) => group.length),
      );
    }

    return summary;
  }

  private ensurePlayableBoard(): void {
    if (this.hasAvailableMove()) {
      return;
    }

    for (let attempt = 0; attempt < 32; attempt++) {
      this.grid = this.createInitialGrid();
      if (!this.hasMatch() && this.hasAvailableMove()) {
        return;
      }
    }

    this.grid = this.createGridFromTypes(GUARANTEED_PLAYABLE_TYPES);
  }

  private createInitialGrid(): (Piece | null)[][] {
    this.grid = Array.from({ length: this.height }, () =>
      Array<Piece | null>(this.width).fill(null),
    );

    for (let y = 0; y < this.height; y++) {
      for (let x = 0; x < this.width; x++) {
        this.grid[y]![x] = this.createRandomPiece(x, y, true);
      }
    }

    return this.grid;
  }

  private createGridFromTypes(types: (PieceType | null)[][]): (Piece | null)[][] {
    if (types.length !== this.height || types.some((row) => row.length !== this.width)) {
      throw new Error("Initial board must be 8x8.");
    }

    return types.map((row, y) =>
      row.map((type, x) => (type === null ? null : this.createPiece(x, y, type))),
    );
  }

  private scanLine(
    coords: Coord[],
    groups: MatchGroup[],
    orientation: LineOrientation,
  ): void {
    let start = 0;
    let lastType: PieceType | null = null;
    let count = 0;

    for (let index = 0; index <= coords.length; index++) {
      const coord = coords[index];
      const piece = coord ? this.getPiece(coord.x, coord.y) : null;
      const type = piece?.type ?? null;

      if (type !== null && type === lastType) {
        count++;
        continue;
      }

      if (lastType !== null && count >= 3) {
        const cells = coords
          .slice(start, start + count)
          .map((cell) => ({ x: cell.x, y: cell.y }));

        groups.push({
          type: lastType,
          length: cells.length,
          cells,
          orientation,
        });
      }

      start = index;
      lastType = type;
      count = type === null ? 0 : 1;
    }
  }

  private createRandomPiece(x: number, y: number, avoidImmediateMatch: boolean): Piece {
    const type = avoidImmediateMatch
      ? this.pickTypeWithoutImmediateMatch(x, y)
      : this.randomType();

    return this.createPiece(x, y, type);
  }

  private createPiece(x: number, y: number, type: PieceType): Piece {
    return {
      id: `p${this.nextId++}`,
      type,
      x,
      y,
      isMatched: false,
    };
  }

  private pickTypeWithoutImmediateMatch(x: number, y: number): PieceType {
    const shuffled = [...PIECE_TYPES].sort(() => this.rng() - 0.5);
    const safeType = shuffled.find((type) => !this.wouldCreateMatch(x, y, type));
    return safeType ?? this.randomType();
  }

  private wouldCreateMatch(x: number, y: number, type: PieceType): boolean {
    const horizontal =
      1 +
      this.countSameType(x, y, -1, 0, type) +
      this.countSameType(x, y, 1, 0, type);
    const vertical =
      1 +
      this.countSameType(x, y, 0, -1, type) +
      this.countSameType(x, y, 0, 1, type);

    return horizontal >= 3 || vertical >= 3;
  }

  private countSameType(
    startX: number,
    startY: number,
    offsetX: number,
    offsetY: number,
    type: PieceType,
  ): number {
    let count = 0;
    let x = startX + offsetX;
    let y = startY + offsetY;

    while (this.isInBounds({ x, y }) && this.getPiece(x, y)?.type === type) {
      count++;
      x += offsetX;
      y += offsetY;
    }

    return count;
  }

  private randomType(): PieceType {
    return PIECE_TYPES[Math.floor(this.rng() * PIECE_TYPES.length)] ?? 0;
  }

  private exchange(a: Coord, b: Coord): void {
    const pieceA = this.getPiece(a.x, a.y);
    const pieceB = this.getPiece(b.x, b.y);

    this.grid[a.y]![a.x] = pieceB;
    this.grid[b.y]![b.x] = pieceA;

    if (pieceA) {
      pieceA.x = b.x;
      pieceA.y = b.y;
      pieceA.isMatched = false;
    }

    if (pieceB) {
      pieceB.x = a.x;
      pieceB.y = a.y;
      pieceB.isMatched = false;
    }
  }

  private isAdjacent(a: Coord, b: Coord): boolean {
    return Math.abs(a.x - b.x) + Math.abs(a.y - b.y) === 1;
  }

  private swapWouldMatch(a: Coord, b: Coord): boolean {
    if (!this.getPiece(a.x, a.y) || !this.getPiece(b.x, b.y)) {
      return false;
    }

    this.exchange(a, b);
    const wouldMatch = this.detectMatches().length > 0;
    this.exchange(a, b);
    this.resetMatchFlags();
    return wouldMatch;
  }

  private isInBounds(coord: Coord): boolean {
    return (
      coord.x >= 0 &&
      coord.x < this.width &&
      coord.y >= 0 &&
      coord.y < this.height
    );
  }

  private resetMatchFlags(): void {
    for (const row of this.grid) {
      for (const piece of row) {
        if (piece) {
          piece.isMatched = false;
        }
      }
    }
  }

  private failedSwap(reason: SwapFailureReason): SwapResult {
    return {
      success: false,
      clearEvents: [],
      totalDamage: 0,
      reason,
    };
  }
}

function clonePiece(piece: Piece): Piece {
  return {
    id: piece.id,
    type: piece.type,
    x: piece.x,
    y: piece.y,
    isMatched: piece.isMatched,
  };
}

function cloneMatchGroup(group: MatchGroup): MatchGroup {
  return {
    type: group.type,
    length: group.length,
    cells: group.cells.map((cell) => ({ x: cell.x, y: cell.y })),
    orientation: group.orientation,
  };
}

function mergeOverlappingMatchGroups(groups: MatchGroup[]): MatchGroup[] {
  const merged: MatchGroup[] = [];

  for (const group of groups) {
    let current = cloneMatchGroup(group);
    let firstMergedIndex: number | null = null;

    for (let index = 0; index < merged.length; ) {
      const existing = merged[index]!;
      if (existing.type === current.type && groupsOverlap(existing, current)) {
        current = mergeMatchGroups(existing, current);
        firstMergedIndex ??= index;
        merged.splice(index, 1);
        continue;
      }

      index++;
    }

    if (firstMergedIndex === null) {
      merged.push(current);
    } else {
      merged.splice(firstMergedIndex, 0, current);
    }
  }

  return merged;
}

function groupsOverlap(a: MatchGroup, b: MatchGroup): boolean {
  return a.cells.some((aCell) =>
    b.cells.some((bCell) => aCell.x === bCell.x && aCell.y === bCell.y),
  );
}

function mergeMatchGroups(a: MatchGroup, b: MatchGroup): MatchGroup {
  const cells: MatchCell[] = [];
  const seen = new Set<string>();

  for (const cell of [...a.cells, ...b.cells]) {
    const key = `${cell.x},${cell.y}`;
    if (seen.has(key)) {
      continue;
    }

    seen.add(key);
    cells.push({ x: cell.x, y: cell.y });
  }

  return {
    type: a.type,
    length: cells.length,
    cells,
    orientation: a.orientation === b.orientation ? a.orientation : "mixed",
  };
}

function cellKey(cell: MatchCell): string {
  return `${cell.x},${cell.y}`;
}
