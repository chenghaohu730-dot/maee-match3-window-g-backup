import type { MatchGroup, PieceType, ResolveSummary } from "./board.ts";
import type { CombatEvent, EnemyWave } from "./combatTypes.ts";
import type {
  BoardEffectRequest,
  CombatEffectRequest,
  SkillLevel,
} from "./skillTypes.ts";

export type GamePhase = "start" | "playing" | "won" | "lost";

export interface GameplayState {
  phase: GamePhase;
  score: number;
  comboMax: number;
  playerHp: number;
  playerMaxHp: number;
  playerShield: number;
  enemyHp: number;
  enemyMaxHp: number;
  enemyId: string;
  enemyName: string;
  wave: number;
  totalWaves: number;
  enemyAttackCounter: number;
  enemyAttackInterval: number;
  lastDamage: number;
  lastComboCount: number;
  lastSkillText?: string;
  lastSkillLevel?: SkillLevel;
  lastVfxKeys: string[];
}

export type GameplayEvent =
  | { type: "scoreGained"; amount: number; totalScore: number }
  | {
      type: "skillTriggered";
      skillId: string;
      level: SkillLevel;
      pieceType: PieceType;
      extraDamage: number;
    }
  | { type: "skillStatusApplied"; request: CombatEffectRequest }
  | { type: "boardEffectRequested"; request: BoardEffectRequest }
  | {
      type: "boardEffectResolved";
      totalCleared: number;
      chainCount: number;
    }
  | { type: "vfx"; key: string }
  | { type: "combat"; event: CombatEvent };

export interface GameplayControllerOptions {
  waves?: EnemyWave[];
  rng?: () => number;
  initialTypes?: (PieceType | null)[][];
}

export type GameplayResolveSummary = ResolveSummary & {
  groups?: MatchGroup[];
};
