import type {
  MatchCell,
  MatchGroup,
  PieceType,
  ResolveSummary,
} from "./board.ts";
import type { CombatSystem } from "./combat.ts";
import type {
  BoardEffectRequest,
  CombatEffectRequest,
  SkillLevel,
  SkillResolveResult,
} from "./skillTypes.ts";
import type { VfxEvent } from "./vfxTypes.ts";

type BoardEffectFactory = (group: MatchGroup) => BoardEffectRequest[];
type CombatEffectFactory = (group: MatchGroup) => CombatEffectRequest[];

interface SkillDefinition {
  id: string;
  extraDamage: number;
  scoreMultiplier: number;
  vfxKey: string;
  combatEffects?: CombatEffectFactory;
  boardEffects?: BoardEffectFactory;
}

type SkillSet = Record<SkillLevel, SkillDefinition>;

const SKILL_RULES: Record<PieceType, SkillSet> = {
  0: {
    skill: {
      id: "flameSlash",
      extraDamage: 10,
      scoreMultiplier: 1,
      vfxKey: "red_skill_slash",
      boardEffects: (group) => [{ type: "clearRow", row: firstCell(group).y }],
    },
    ultimate: {
      id: "flameSpin",
      extraDamage: 25,
      scoreMultiplier: 1,
      vfxKey: "red_ultimate_spin",
      boardEffects: () => [{ type: "clearRandom", count: 8 }],
    },
  },
  1: {
    skill: {
      id: "frostFreeze",
      extraDamage: 6,
      scoreMultiplier: 1,
      vfxKey: "blue_skill_freeze",
      combatEffects: () => [{ type: "freezeEnemy", turns: 1 }],
    },
    ultimate: {
      id: "icefall",
      extraDamage: 18,
      scoreMultiplier: 1,
      vfxKey: "blue_ultimate_icefall",
      combatEffects: () => [{ type: "freezeEnemy", turns: 2 }],
      boardEffects: () => [{ type: "clearRandom", count: 6 }],
    },
  },
  2: {
    skill: {
      id: "starChain",
      extraDamage: 6,
      scoreMultiplier: 1.5,
      vfxKey: "yellow_skill_chain",
    },
    ultimate: {
      id: "meteorShower",
      extraDamage: 18,
      scoreMultiplier: 2,
      vfxKey: "yellow_ultimate_meteor",
    },
  },
  3: {
    skill: {
      id: "forestShield",
      extraDamage: 4,
      scoreMultiplier: 1,
      vfxKey: "green_skill_shield",
      combatEffects: () => [{ type: "addShield", amount: 10 }],
    },
    ultimate: {
      id: "natureBlessing",
      extraDamage: 10,
      scoreMultiplier: 1,
      vfxKey: "green_ultimate_bloom",
      combatEffects: () => [
        { type: "healPlayer", amount: 20 },
        { type: "addShield", amount: 15 },
      ],
    },
  },
  4: {
    skill: {
      id: "arcaneBomb",
      extraDamage: 8,
      scoreMultiplier: 1,
      vfxKey: "purple_skill_bomb",
      boardEffects: (group) => [
        { type: "clearArea", center: middleCell(group), radius: 1 },
      ],
    },
    ultimate: {
      id: "moonCircle",
      extraDamage: 22,
      scoreMultiplier: 1,
      vfxKey: "purple_ultimate_magic_circle",
      boardEffects: () => [{ type: "clearRandom", count: 12 }],
    },
  },
  5: {
    skill: {
      id: "heroHammer",
      extraDamage: 20,
      scoreMultiplier: 1,
      vfxKey: "orange_skill_hammer",
    },
    ultimate: {
      id: "armorBreakJudgement",
      extraDamage: 30,
      scoreMultiplier: 1,
      vfxKey: "orange_ultimate_judgement",
      combatEffects: () => [
        { type: "applyArmorBreak", turns: 2, multiplier: 1.3 },
      ],
    },
  },
};

export class SkillSystem {
  buildSkillPlan(summary: ResolveSummary): SkillResolveResult {
    if (summary.wasPlayerMove === false) {
      return createEmptyResult();
    }

    const group = selectTriggerGroup(summary.groups ?? []);
    if (!group) {
      return createEmptyResult();
    }

    const level: SkillLevel = group.length >= 5 ? "ultimate" : "skill";
    const rule = SKILL_RULES[group.type][level];

    return {
      triggered: true,
      skillId: rule.id,
      pieceType: group.type,
      level,
      extraDamage: rule.extraDamage,
      scoreMultiplier: rule.scoreMultiplier,
      vfxEvents: createVfxEvents(rule, level),
      boardEffectRequests: rule.boardEffects?.(group) ?? [],
      combatEffectRequests: rule.combatEffects?.(group) ?? [],
      combatEvents: [],
    };
  }

  resolveSkills(summary: ResolveSummary, combat: CombatSystem): SkillResolveResult {
    const plan = this.buildSkillPlan(summary);
    this.applySkillCombatEffects(plan, combat);

    const combatEvents =
      plan.extraDamage > 0 ? combat.applyDirectDamage(plan.extraDamage) : [];

    return {
      ...plan,
      combatEvents,
    };
  }

  applySkillCombatEffects(
    result: SkillResolveResult,
    combat: CombatSystem,
  ): void {
    for (const request of result.combatEffectRequests) {
      switch (request.type) {
        case "freezeEnemy":
          combat.freezeEnemy(request.turns);
          break;
        case "addShield":
          combat.addShield(request.amount);
          break;
        case "healPlayer":
          combat.healPlayer(request.amount);
          break;
        case "applyArmorBreak":
          combat.applyArmorBreak(request.turns, request.multiplier);
          break;
      }
    }
  }
}

function selectTriggerGroup(groups: readonly MatchGroup[]): MatchGroup | null {
  let selected: MatchGroup | null = null;

  for (const group of groups) {
    if (group.length < 4) {
      continue;
    }

    if (!selected || group.length > selected.length) {
      selected = group;
    }
  }

  return selected;
}

function createEmptyResult(): SkillResolveResult {
  return {
    triggered: false,
    extraDamage: 0,
    scoreMultiplier: 1,
    vfxEvents: [],
    boardEffectRequests: [],
    combatEffectRequests: [],
    combatEvents: [],
  };
}

function createVfxEvents(
  rule: SkillDefinition,
  level: SkillLevel,
): VfxEvent[] {
  return [
    {
      type: "screenShake",
      intensity: level === "skill" ? "medium" : "large",
    },
    {
      type: "skillText",
      text: rule.id,
      level,
    },
    {
      type: "battleVfx",
      key: rule.vfxKey,
    },
  ];
}

function firstCell(group: MatchGroup): MatchCell {
  return cloneCell(group.cells[0] ?? { x: 0, y: 0 });
}

function middleCell(group: MatchGroup): MatchCell {
  const middleIndex = Math.floor(group.cells.length / 2);
  return cloneCell(group.cells[middleIndex] ?? firstCell(group));
}

function cloneCell(cell: MatchCell): MatchCell {
  return { x: cell.x, y: cell.y };
}
