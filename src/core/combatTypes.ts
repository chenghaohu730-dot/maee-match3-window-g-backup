export type { ResolveSummary } from "./board.ts";

export interface EnemyWave {
  id: string;
  name: string;
  hp: number;
  attackInterval: number;
  damage: number;
  endless?: boolean;
  infiniteHp?: boolean;
}

export interface PlayerState {
  maxHp: number;
  hp: number;
  shield: number;
}

export interface EnemyState {
  id: string;
  name: string;
  maxHp: number;
  hp: number;
  attackInterval: number;
  attackCounter: number;
  damage: number;
  endless?: boolean;
  infiniteHp?: boolean;
}

export type CombatStatus = "playing" | "won" | "lost";

export interface ArmorBreakState {
  turns: number;
  multiplier: number;
}

export interface CombatState {
  player: PlayerState;
  enemy: EnemyState | null;
  wave: number;
  waveIndex: number;
  status: CombatStatus;
  freezeTurns: number;
  armorBreak: ArmorBreakState | null;
  totalDamageDealt: number;
}

export type CombatMoveSummary = {
  totalCleared: number;
  chainCount?: number;
  wasPlayerMove?: boolean;
};

export type CombatEvent =
  | { type: "enemyDamaged"; amount: number; enemyHp: number }
  | { type: "enemyAttackCounterChanged"; current: number; max: number }
  | { type: "playerDamaged"; amount: number; playerHp: number }
  | { type: "enemyDefeated"; wave: number; enemyId: string }
  | { type: "waveStarted"; wave: number; enemyId: string }
  | { type: "playerHealed"; amount: number; playerHp: number }
  | { type: "gameWon" }
  | { type: "gameLost" };
