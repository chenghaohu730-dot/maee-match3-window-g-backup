import type { MatchCell, ResolveSummary } from "../core/board.ts";
import type { CombatEvent } from "../core/combatTypes.ts";
import type { GameplayEvent, GameplayState } from "../core/gameplayTypes.ts";
import type { SkillResolveResult } from "../core/skillTypes.ts";
import type { VfxEvent } from "../core/vfxTypes.ts";
import type { BoardAnimationPlan } from "./boardAnimationPlan.ts";
import type { CharacterAnimationRuntimeEvent } from "./characterAnimationTypes.ts";

export type CombatTimelineKind =
  | "normal"
  | "skill"
  | "ultimate"
  | "enemyAttack"
  | "waveTransition"
  | "reshuffle"
  | "gameEnd";

export type CombatTimelinePriority = "high" | "medium" | "low";

export type CombatTimelineEventType =
  | "board.swapComplete"
  | "board.clear"
  | "board.skillEffect"
  | "board.ultimateFocus"
  | "board.settle"
  | "character.yizai.attack"
  | "character.yizai.skill"
  | "character.yizai.ultimate"
  | "character.yizai.hurt"
  | "character.enemy.hit"
  | "character.enemy.attack"
  | "character.enemy.defeat"
  | "particle.basicProjectile"
  | "particle.skillProjectile"
  | "particle.ultimateAura"
  | "combat.damageNumber"
  | "combat.enemyHpTween"
  | "combat.playerHpTween"
  | "combat.attackCounter"
  | "camera.shake"
  | "ui.skillText"
  | "ui.waveCleared"
  | "ui.reshuffleNotice"
  | "wave.start"
  | "game.end";

export interface CombatTimelineEvent {
  id: string;
  type: CombatTimelineEventType;
  atMs: number;
  durationMs: number;
  priority: CombatTimelinePriority;
  blocksInput: boolean;
  data?: Record<string, string | number | boolean>;
}

export interface CombatTimeline {
  kind: CombatTimelineKind;
  events: CombatTimelineEvent[];
  durationMs: number;
  inputUnlockAtMs: number | null;
  blocksInputAfterEnd: boolean;
}

export interface BoardSwapPresentation {
  from: MatchCell;
  to: MatchCell;
  plan: BoardAnimationPlan;
}

export interface TurnPresentationInput {
  summary: ResolveSummary;
  gameplayEvents: readonly GameplayEvent[];
  skillResult?: SkillResolveResult;
  vfxEvents?: readonly VfxEvent[];
  characterEvents?: readonly CharacterAnimationRuntimeEvent[];
  chainCount: number;
  state?: GameplayState;
  boardSwap?: BoardSwapPresentation;
}

export interface EnemyAttackPresentationInput {
  events: readonly (GameplayEvent | CombatEvent)[];
  state?: GameplayState;
}

export interface WaveTransitionPresentationInput {
  events: readonly (GameplayEvent | CombatEvent)[];
  state?: GameplayState;
}

export interface GameEndPresentationInput {
  events: readonly (GameplayEvent | CombatEvent)[];
  state?: GameplayState;
}

export interface ReshufflePresentationInput {
  events?: readonly GameplayEvent[];
  summary?: ResolveSummary;
}

export type PresentationPlaybackInput =
  | TurnPresentationInput
  | EnemyAttackPresentationInput
  | WaveTransitionPresentationInput
  | GameEndPresentationInput
  | ReshufflePresentationInput;
