import {
  Board,
  type BoardOptions,
  type ResolveSummary,
} from "./board.ts";
import { CombatSystem } from "./combat.ts";
import type { CombatEvent, EnemyWave } from "./combatTypes.ts";
import { SkillSystem } from "./skills.ts";
import type { SkillLevel, SkillResolveResult } from "./skillTypes.ts";
import type { VfxEvent } from "./vfxTypes.ts";
import { FAIRY_TALE_WAVES } from "./waves.ts";
import type {
  GamePhase,
  GameplayControllerOptions,
  GameplayEvent,
  GameplayState,
} from "./gameplayTypes.ts";

export class GameplayController {
  board: Board;
  combat: CombatSystem;
  skills: SkillSystem;

  score = 0;
  comboMax = 0;
  lastDamage = 0;
  lastComboCount = 0;
  lastEvents: GameplayEvent[] = [];

  private phase: GamePhase = "start";
  private lastSkillText: string | undefined;
  private lastSkillLevel: SkillLevel | undefined;
  private lastVfxKeys: string[] = [];
  private readonly rng: (() => number) | undefined;
  private readonly initialTypes: GameplayControllerOptions["initialTypes"];
  private readonly totalWaves: number;

  constructor(options: GameplayControllerOptions = {}) {
    const waves = options.waves ?? FAIRY_TALE_WAVES;

    this.rng = options.rng;
    this.initialTypes = options.initialTypes;
    this.totalWaves = waves.length;
    this.combat = new CombatSystem(waves);
    this.skills = new SkillSystem();
    this.board = this.createBoard();
  }

  startGame(): void {
    this.phase = "playing";
    this.score = 0;
    this.comboMax = 0;
    this.lastDamage = 0;
    this.lastComboCount = 0;
    this.lastEvents = [];
    this.lastSkillText = undefined;
    this.lastSkillLevel = undefined;
    this.lastVfxKeys = [];
    this.combat.reset();
    this.board = this.createBoard();
  }

  restartGame(): void {
    this.startGame();
  }

  handleResolveComplete(summary: ResolveSummary): GameplayEvent[] {
    if (this.phase !== "playing" || summary.wasPlayerMove === false) {
      this.lastEvents = [];
      return this.lastEvents;
    }

    const events: GameplayEvent[] = [];
    const totalCleared = sanitizeAmount(summary.totalCleared);
    const skillResult = this.skills.buildSkillPlan(summary);
    const baseDamage = totalCleared * 2;
    const totalDamage = baseDamage + skillResult.extraDamage;
    const allCombatEvents: CombatEvent[] = [];
    let combinedSummary = summary;

    this.recordSkillEvents(skillResult, events);

    const directCombatEvents =
      totalDamage > 0 ? this.combat.applyDirectDamage(totalDamage) : [];
    appendCombatEvents(events, directCombatEvents);
    allCombatEvents.push(...directCombatEvents);

    const defeatedByBaseDamage = hasCombatEvent(
      directCombatEvents,
      "enemyDefeated",
    );
    let defeatedEnemy = defeatedByBaseDamage;

    if (skillResult.boardEffectRequests.length > 0) {
      const effectSummary = this.board.applyBoardEffects(
        skillResult.boardEffectRequests,
      );
      combinedSummary = combineSummaries(summary, effectSummary);
      events.push({
        type: "boardEffectResolved",
        totalCleared: effectSummary.totalCleared,
        chainCount: effectSummary.chainCount,
      });

      const effectDamage = effectSummary.totalCleared * 2;
      if (
        effectDamage > 0 &&
        !defeatedByBaseDamage &&
        this.combat.getState().status === "playing"
      ) {
        const effectCombatEvents = this.combat.applyDirectDamage(effectDamage);
        appendCombatEvents(events, effectCombatEvents);
        allCombatEvents.push(...effectCombatEvents);
        defeatedEnemy = hasCombatEvent(effectCombatEvents, "enemyDefeated");
      }
    }

    const endTurnCombatEvents: CombatEvent[] = [];

    if (!defeatedEnemy && this.combat.getState().status === "playing") {
      this.skills.applySkillCombatEffects(skillResult, this.combat);
      for (const request of skillResult.combatEffectRequests) {
        events.push({ type: "skillStatusApplied", request });
      }

      endTurnCombatEvents.push(...this.combat.endPlayerTurn());
      appendCombatEvents(events, endTurnCombatEvents);
      allCombatEvents.push(...endTurnCombatEvents);
    }

    this.lastDamage = sumEnemyDamage(allCombatEvents);
    this.lastComboCount = sanitizeAmount(combinedSummary.chainCount);
    this.comboMax = Math.max(this.comboMax, this.lastComboCount);

    const scoreGain = calculateScoreGain(
      combinedSummary,
      skillResult,
      allCombatEvents,
    );
    this.score += scoreGain;
    events.push({
      type: "scoreGained",
      amount: scoreGain,
      totalScore: this.score,
    });

    const combatStatus = this.combat.getState().status;
    if (combatStatus === "won" || combatStatus === "lost") {
      this.phase = combatStatus;
    }

    this.lastEvents = events;
    return events;
  }

  getState(): GameplayState {
    const combatState = this.combat.getState();
    const enemy = combatState.enemy;
    const state: GameplayState = {
      phase: this.phase,
      score: this.score,
      comboMax: this.comboMax,
      playerHp: combatState.player.hp,
      playerMaxHp: combatState.player.maxHp,
      playerShield: combatState.player.shield,
      enemyHp: enemy?.hp ?? 0,
      enemyMaxHp: enemy?.maxHp ?? 0,
      enemyId: enemy?.id ?? "",
      enemyName: enemy?.name ?? "",
      wave: combatState.wave,
      totalWaves: this.totalWaves,
      enemyAttackCounter: enemy?.attackCounter ?? 0,
      enemyAttackInterval: enemy?.attackInterval ?? 0,
      lastDamage: this.lastDamage,
      lastComboCount: this.lastComboCount,
      lastVfxKeys: [...this.lastVfxKeys],
    };

    if (this.lastSkillText) {
      state.lastSkillText = this.lastSkillText;
    }

    if (this.lastSkillLevel) {
      state.lastSkillLevel = this.lastSkillLevel;
    }

    return state;
  }

  private createBoard(): Board {
    const options: BoardOptions = {
      onResolveComplete: (summary) => {
        this.handleResolveComplete(summary);
      },
    };

    if (this.rng) {
      options.rng = this.rng;
    }

    if (this.initialTypes) {
      options.initialTypes = this.initialTypes;
    }

    return new Board(options);
  }

  private recordSkillEvents(
    skillResult: SkillResolveResult,
    events: GameplayEvent[],
  ): void {
    this.lastVfxKeys = skillResult.vfxEvents.map(getVfxKey);

    if (!skillResult.triggered) {
      this.lastSkillText = undefined;
      this.lastSkillLevel = undefined;
      return;
    }

    if (
      skillResult.skillId &&
      skillResult.level &&
      skillResult.pieceType !== undefined
    ) {
      this.lastSkillText = skillResult.skillId;
      this.lastSkillLevel = skillResult.level;
      events.push({
        type: "skillTriggered",
        skillId: skillResult.skillId,
        level: skillResult.level,
        pieceType: skillResult.pieceType,
        extraDamage: skillResult.extraDamage,
      });
    }

    for (const vfxEvent of skillResult.vfxEvents) {
      events.push({ type: "vfx", key: getVfxKey(vfxEvent) });
    }

    for (const request of skillResult.boardEffectRequests) {
      events.push({ type: "boardEffectRequested", request });
    }
  }
}

function appendCombatEvents(
  gameplayEvents: GameplayEvent[],
  combatEvents: CombatEvent[],
): void {
  for (const event of combatEvents) {
    gameplayEvents.push({ type: "combat", event });
  }
}

function hasCombatEvent(
  combatEvents: CombatEvent[],
  type: CombatEvent["type"],
): boolean {
  return combatEvents.some((event) => event.type === type);
}

function combineSummaries(
  baseSummary: ResolveSummary,
  effectSummary: ResolveSummary,
): ResolveSummary {
  const combined: ResolveSummary = {
    totalCleared:
      sanitizeAmount(baseSummary.totalCleared) +
      sanitizeAmount(effectSummary.totalCleared),
    chainCount:
      sanitizeAmount(baseSummary.chainCount) +
      sanitizeAmount(effectSummary.chainCount),
    wasPlayerMove: baseSummary.wasPlayerMove,
  };

  if (baseSummary.groups) {
    combined.groups = baseSummary.groups;
  }

  if (baseSummary.maxMatchLength !== undefined) {
    combined.maxMatchLength = baseSummary.maxMatchLength;
  }

  return combined;
}

function sumEnemyDamage(combatEvents: CombatEvent[]): number {
  const total = combatEvents.reduce(
    (sum, event) => sum + (event.type === "enemyDamaged" ? event.amount : 0),
    0,
  );
  return Math.round(total * 1000) / 1000;
}

function calculateScoreGain(
  summary: ResolveSummary,
  skillResult: SkillResolveResult,
  combatEvents: CombatEvent[],
): number {
  const clearScore = sanitizeAmount(summary.totalCleared) * 10;
  const skillBonus = skillResult.triggered
    ? skillResult.level === "ultimate"
      ? 200
      : 80
    : 0;
  const chainMultiplier = getChainMultiplier(summary.chainCount);
  const moveScore =
    (clearScore + skillBonus) * chainMultiplier * skillResult.scoreMultiplier;
  const defeatedEnemy = combatEvents.some((event) => event.type === "enemyDefeated");
  const defeatedBoss = combatEvents.some((event) => event.type === "gameWon");
  const defeatScore = defeatedEnemy ? (defeatedBoss ? 2000 : 300) : 0;

  return Math.round(moveScore + defeatScore);
}

function getChainMultiplier(chainCount = 0): number {
  if (chainCount >= 4) {
    return 2;
  }

  if (chainCount === 3) {
    return 1.5;
  }

  if (chainCount === 2) {
    return 1.2;
  }

  return 1;
}

function getVfxKey(event: VfxEvent): string {
  switch (event.type) {
    case "battleVfx":
      return event.key;
    case "pieceVfx":
      return event.key;
    case "screenShake":
      return `screenShake:${event.intensity}`;
    case "skillText":
      return `skillText:${event.text}`;
    case "comboText":
      return `combo:${event.chainCount}`;
  }
}

function sanitizeAmount(amount: number | undefined): number {
  return Number.isFinite(amount) ? Math.max(amount ?? 0, 0) : 0;
}
