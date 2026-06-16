import type { GameplayEvent, GameplayState } from "../core/gameplayTypes.ts";
import type { SkillLevel } from "../core/skillTypes.ts";

export type SkillVfxTone =
  | "red"
  | "blue"
  | "yellow"
  | "green"
  | "purple"
  | "orange"
  | "generic";

export type SkillVfxIntensity = "small" | "medium" | "large";

export interface SkillVfxPresentation {
  key: string;
  label: string;
  level: SkillLevel | "fallback";
  tone: SkillVfxTone;
  cssClass: string;
  durationMs: number;
  combatHint: "player" | "enemy" | "attack" | "board";
}

export interface SkillVfxAnchor {
  row?: number;
  x?: number;
  y?: number;
}

export interface SkillVfxLayerInput {
  state: Pick<
    GameplayState,
    "lastComboCount" | "lastSkillLevel" | "lastSkillText" | "lastVfxKeys"
  >;
  events?: readonly GameplayEvent[];
}

export interface SkillVfxLayerModel {
  presentation: SkillVfxPresentation;
  text: string;
  level: SkillLevel | "fallback";
  classes: string;
  style: string;
  shakeClass: string;
  comboText?: string;
}
