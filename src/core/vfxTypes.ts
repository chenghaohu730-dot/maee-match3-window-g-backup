import type { MatchCell } from "./board.ts";

export type VfxEvent =
  | { type: "skillText"; text: string; level: "skill" | "ultimate" }
  | { type: "screenShake"; intensity: "small" | "medium" | "large" }
  | { type: "battleVfx"; key: string }
  | { type: "pieceVfx"; key: string; cells: MatchCell[] }
  | { type: "comboText"; chainCount: number };
