import type { MatchCell, PieceType } from "./board.ts";
import type { CombatEvent } from "./combatTypes.ts";
import type { VfxEvent } from "./vfxTypes.ts";

export type SkillLevel = "skill" | "ultimate";

export type BoardEffectRequest =
  | { type: "clearRow"; row: number }
  | { type: "clearArea"; center: MatchCell; radius: number }
  | { type: "clearRandom"; count: number };

export type CombatEffectRequest =
  | { type: "freezeEnemy"; turns: number }
  | { type: "addShield"; amount: number }
  | { type: "healPlayer"; amount: number }
  | { type: "applyArmorBreak"; turns: number; multiplier: number };

export interface SkillResolveResult {
  triggered: boolean;
  skillId?: string;
  pieceType?: PieceType;
  level?: SkillLevel;
  extraDamage: number;
  scoreMultiplier: number;
  vfxEvents: VfxEvent[];
  boardEffectRequests: BoardEffectRequest[];
  combatEffectRequests: CombatEffectRequest[];
  combatEvents: CombatEvent[];
}
