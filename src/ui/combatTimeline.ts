import type { CombatEvent } from "../core/combatTypes.ts";
import type { GameplayEvent } from "../core/gameplayTypes.ts";
import { PRESENTATION_TIMING } from "./presentationTiming.ts";
import type {
  CombatTimeline,
  CombatTimelineEvent,
  CombatTimelineEventType,
  CombatTimelineKind,
  CombatTimelinePriority,
  EnemyAttackPresentationInput,
  GameEndPresentationInput,
  ReshufflePresentationInput,
  TurnPresentationInput,
  WaveTransitionPresentationInput,
} from "./combatTimelineTypes.ts";

type SkillTimelineLevel = "skill" | "ultimate" | undefined;

export function createTurnTimeline(
  input: TurnPresentationInput,
): CombatTimeline {
  if (isPureReshuffle(input)) {
    return createReshuffleTimeline({
      events: input.gameplayEvents,
      summary: input.summary,
    });
  }

  if (hasCombatEvent(input.gameplayEvents, "gameLost")) {
    return createGameEndTimeline({ events: input.gameplayEvents });
  }

  const level = getSkillTimelineLevel(input);

  if (level === "ultimate") {
    return buildUltimateTimeline(input);
  }

  if (level === "skill") {
    return buildSkillTimeline(input);
  }

  return buildNormalTimeline(input);
}

export function createEnemyAttackTimeline(
  input: EnemyAttackPresentationInput,
): CombatTimeline {
  const events: CombatTimelineEvent[] = [];

  if (hasCombatEvent(input.events, "enemyDefeated")) {
    return createTimeline("enemyAttack", [], 0, 0, false);
  }

  addEvent(events, "character.enemy.attack", 0, PRESENTATION_TIMING.ENEMY_ATTACK_MS, "high", true);
  addEvent(events, "particle.basicProjectile", 110, 300, "low", false, {
    source: "enemy",
  });
  addEvent(events, "combat.damageNumber", 180, PRESENTATION_TIMING.DAMAGE_TEXT_MS, "high", false, {
    target: "player",
  });
  addEvent(events, "combat.playerHpTween", 220, PRESENTATION_TIMING.HP_TWEEN_MS, "high", true);
  addEvent(events, "character.yizai.hurt", 240, 260, "high", false);

  return createTimeline(
    "enemyAttack",
    events,
    PRESENTATION_TIMING.ENEMY_ATTACK_MS,
    Math.min(
      PRESENTATION_TIMING.ENEMY_ATTACK_MS,
      PRESENTATION_TIMING.ENEMY_ATTACK_LOCK_MAX_MS,
    ),
    hasCombatEvent(input.events, "gameLost"),
  );
}

export function createWaveTransitionTimeline(
  input: WaveTransitionPresentationInput,
): CombatTimeline {
  const events: CombatTimelineEvent[] = [];

  addEvent(events, "character.enemy.defeat", 0, 500, "high", true);
  addEvent(events, "combat.enemyHpTween", 0, PRESENTATION_TIMING.HP_TWEEN_MS, "high", true, {
    target: "enemy",
    hp: 0,
  });
  addEvent(events, "ui.waveCleared", 300, 200, "medium", false);
  addEvent(events, "wave.start", PRESENTATION_TIMING.WAVE_TRANSITION_MS, 0, "high", true);

  return createTimeline(
    "waveTransition",
    events,
    Math.min(
      PRESENTATION_TIMING.WAVE_TRANSITION_MS,
      PRESENTATION_TIMING.WAVE_TRANSITION_MAX_MS,
    ),
    Math.min(
      PRESENTATION_TIMING.WAVE_TRANSITION_MS,
      PRESENTATION_TIMING.WAVE_TRANSITION_MAX_MS,
    ),
    hasCombatEvent(input.events, "gameWon") || hasCombatEvent(input.events, "gameLost"),
  );
}

export function createGameEndTimeline(
  input: GameEndPresentationInput,
): CombatTimeline {
  const lost = hasCombatEvent(input.events, "gameLost");
  const won = hasCombatEvent(input.events, "gameWon");
  const events: CombatTimelineEvent[] = [];

  if (won) {
    addEvent(events, "character.yizai.ultimate", 0, 650, "high", true);
    addEvent(events, "character.enemy.defeat", 120, 500, "high", true);
  }

  if (lost) {
    addEvent(events, "character.yizai.hurt", 0, 420, "high", true);
  }

  addEvent(events, "game.end", won || lost ? 420 : 0, 0, "high", true, {
    result: won ? "won" : lost ? "lost" : "unknown",
  });

  return createTimeline("gameEnd", events, 420, null, true);
}

export function createReshuffleTimeline(
  input: ReshufflePresentationInput = {},
): CombatTimeline {
  const events: CombatTimelineEvent[] = [];
  const hasReshuffle =
    input.summary?.boardWasReshuffled === true ||
    input.events?.some((event) => event.type === "boardShuffled") === true;

  if (hasReshuffle) {
    addEvent(
      events,
      "ui.reshuffleNotice",
      0,
      PRESENTATION_TIMING.RESHUFFLE_NOTICE_MS,
      "medium",
      true,
    );
    addEvent(
      events,
      "board.settle",
      120,
      360,
      "medium",
      true,
      { reshuffle: true },
    );
  }

  return createTimeline(
    "reshuffle",
    events,
    PRESENTATION_TIMING.RESHUFFLE_NOTICE_MS,
    PRESENTATION_TIMING.RESHUFFLE_NOTICE_MS,
    false,
  );
}

export function getCombatEvents(
  events: readonly (GameplayEvent | CombatEvent)[],
): CombatEvent[] {
  const result: CombatEvent[] = [];

  for (const event of events) {
    if ("event" in event && event.type === "combat") {
      result.push(event.event);
      continue;
    }

    if (isCombatEvent(event)) {
      result.push(event);
    }
  }

  return result;
}

function buildNormalTimeline(input: TurnPresentationInput): CombatTimeline {
  const events: CombatTimelineEvent[] = [];
  const defeated = hasCombatEvent(input.gameplayEvents, "enemyDefeated");
  const waveStarted = hasCombatEvent(input.gameplayEvents, "waveStarted");
  const won = hasCombatEvent(input.gameplayEvents, "gameWon");
  const chainExtension = getChainExtension(input.chainCount, 70);
  const settleStart = 300;
  const settleDuration = Math.min(220 + chainExtension, 300);

  addEvent(events, "board.swapComplete", 0, 0, "medium", true);
  addEvent(events, "board.clear", 0, PRESENTATION_TIMING.BOARD_CLEAR_MS, "medium", true);
  addEvent(events, "character.yizai.attack", 120, 260, "medium", false);
  addEvent(events, "particle.basicProjectile", 120, 360, "low", false, {
    source: "yizai",
  });
  addEnemyDamageEvents(events, PRESENTATION_TIMING.NORMAL_HIT_MS, defeated);
  addEvent(events, "board.settle", settleStart, settleDuration, "medium", true);
  addTerminalAndWaveEvents(events, {
    defeated,
    waveStarted,
    won,
    lost: false,
    defeatAtMs: 300,
  });

  return createTimeline(
    "normal",
    events,
    PRESENTATION_TIMING.NORMAL_TURN_MAX_MS,
    Math.min(settleStart + settleDuration, PRESENTATION_TIMING.NORMAL_TURN_MAX_MS),
    won,
  );
}

function buildSkillTimeline(input: TurnPresentationInput): CombatTimeline {
  const events: CombatTimelineEvent[] = [];
  const defeated = hasCombatEvent(input.gameplayEvents, "enemyDefeated");
  const waveStarted = hasCombatEvent(input.gameplayEvents, "waveStarted");
  const won = hasCombatEvent(input.gameplayEvents, "gameWon");
  const chainExtension = Math.min(getChainExtension(input.chainCount, 70), 100);

  addEvent(events, "board.swapComplete", 0, 0, "medium", true);
  addEvent(events, "board.clear", 0, PRESENTATION_TIMING.BOARD_CLEAR_MS, "medium", true);
  addEvent(events, "ui.skillText", 100, PRESENTATION_TIMING.DAMAGE_TEXT_MS, "medium", false, {
    level: "skill",
  });
  addEvent(events, "character.yizai.skill", 100, 540, "medium", false);
  addEvent(events, "camera.shake", 100, 360, "medium", false, {
    intensity: "medium",
  });
  addEvent(events, "particle.skillProjectile", 180, 520, "low", false);
  addEnemyDamageEvents(events, PRESENTATION_TIMING.SKILL_HIT_MS, defeated);
  addEvent(events, "board.skillEffect", 400, Math.min(220 + chainExtension, 320), "medium", true);
  addEvent(events, "board.settle", 520, Math.min(280 + chainExtension, 360), "medium", true);
  addTerminalAndWaveEvents(events, {
    defeated,
    waveStarted,
    won,
    lost: false,
    defeatAtMs: 420,
  });

  return createTimeline(
    "skill",
    events,
    PRESENTATION_TIMING.SKILL_TURN_MAX_MS,
    PRESENTATION_TIMING.SKILL_TURN_MAX_MS,
    won,
  );
}

function buildUltimateTimeline(input: TurnPresentationInput): CombatTimeline {
  const events: CombatTimelineEvent[] = [];
  const defeated = hasCombatEvent(input.gameplayEvents, "enemyDefeated");
  const waveStarted = hasCombatEvent(input.gameplayEvents, "waveStarted");
  const won = hasCombatEvent(input.gameplayEvents, "gameWon");
  const chainExtension = Math.min(getChainExtension(input.chainCount, 75), 150);

  addEvent(events, "board.swapComplete", 0, 0, "medium", true);
  addEvent(events, "board.ultimateFocus", 0, 180, "medium", true);
  addEvent(events, "ui.skillText", 120, PRESENTATION_TIMING.DAMAGE_TEXT_MS, "high", false, {
    level: "ultimate",
  });
  addEvent(events, "character.yizai.ultimate", 120, 720, "high", false);
  addEvent(events, "camera.shake", 120, 520, "high", false, {
    intensity: "large",
  });
  addEvent(events, "particle.ultimateAura", 120, 900, "low", false);
  addEnemyDamageEvents(events, PRESENTATION_TIMING.ULTIMATE_HIT_MS, defeated);
  addEvent(events, "board.skillEffect", 500, Math.min(360 + chainExtension, 500), "medium", true, {
    level: "ultimate",
  });
  addEvent(events, "board.settle", 640, Math.min(410 + chainExtension, 520), "medium", true);
  addTerminalAndWaveEvents(events, {
    defeated,
    waveStarted,
    won,
    lost: false,
    defeatAtMs: 430,
  });

  return createTimeline(
    "ultimate",
    events,
    PRESENTATION_TIMING.ULTIMATE_TURN_MAX_MS,
    PRESENTATION_TIMING.ULTIMATE_TURN_MAX_MS,
    won,
  );
}

function addEnemyDamageEvents(
  events: CombatTimelineEvent[],
  hitAtMs: number,
  defeated: boolean,
): void {
  addEvent(events, "character.enemy.hit", hitAtMs, defeated ? 180 : 260, "medium", false);
  addEvent(events, "combat.damageNumber", hitAtMs, PRESENTATION_TIMING.DAMAGE_TEXT_MS, "medium", false, {
    target: "enemy",
  });
  addEvent(events, "combat.enemyHpTween", hitAtMs + 20, PRESENTATION_TIMING.HP_TWEEN_MS, defeated ? "high" : "medium", true);
}

function addTerminalAndWaveEvents(
  events: CombatTimelineEvent[],
  input: {
    defeated: boolean;
    waveStarted: boolean;
    won: boolean;
    lost: boolean;
    defeatAtMs: number;
  },
): void {
  if (input.defeated) {
    addEvent(events, "character.enemy.defeat", input.defeatAtMs, 500, "high", true);
    addEvent(events, "ui.waveCleared", input.defeatAtMs + 300, 240, "medium", false);
  }

  if (input.waveStarted && !input.won && !input.lost) {
    addEvent(
      events,
      "wave.start",
      Math.min(input.defeatAtMs + PRESENTATION_TIMING.WAVE_TRANSITION_MS, PRESENTATION_TIMING.WAVE_TRANSITION_MAX_MS),
      0,
      "high",
      true,
    );
  }

  if (input.won || input.lost) {
    addEvent(events, "game.end", input.defeatAtMs + 420, 0, "high", true, {
      result: input.won ? "won" : "lost",
    });
  }
}

function createTimeline(
  kind: CombatTimelineKind,
  events: CombatTimelineEvent[],
  targetDurationMs: number,
  inputUnlockAtMs: number | null,
  blocksInputAfterEnd: boolean,
): CombatTimeline {
  const sorted = [...events].sort((a, b) => a.atMs - b.atMs || priorityOrder(b.priority) - priorityOrder(a.priority));
  const maxBlockingEnd = sorted.reduce(
    (max, event) =>
      event.blocksInput ? Math.max(max, event.atMs + event.durationMs) : max,
    0,
  );
  const durationMs = Math.max(targetDurationMs, maxBlockingEnd);

  return {
    kind,
    events: sorted,
    durationMs,
    inputUnlockAtMs,
    blocksInputAfterEnd,
  };
}

function addEvent(
  events: CombatTimelineEvent[],
  type: CombatTimelineEventType,
  atMs: number,
  durationMs: number,
  priority: CombatTimelinePriority,
  blocksInput: boolean,
  data?: Record<string, string | number | boolean>,
): void {
  const event: CombatTimelineEvent = {
    id: `${type}:${events.length}`,
    type,
    atMs,
    durationMs,
    priority,
    blocksInput,
  };

  if (data) {
    event.data = data;
  }

  events.push(event);
}

function getSkillTimelineLevel(input: TurnPresentationInput): SkillTimelineLevel {
  if (input.skillResult?.level) {
    return input.skillResult.level;
  }

  for (const event of input.gameplayEvents) {
    if (event.type === "skillTriggered") {
      return event.level;
    }
  }

  return undefined;
}

function getChainExtension(chainCount: number, perChainMs: number): number {
  return Math.max(0, Math.min(3, Math.floor(chainCount) - 1)) * perChainMs;
}

function isPureReshuffle(input: TurnPresentationInput): boolean {
  const onlyReshuffle =
    input.gameplayEvents.length > 0 &&
    input.gameplayEvents.every((event) => event.type === "boardShuffled");

  return (
    input.summary.boardWasReshuffled === true &&
    input.summary.totalCleared <= 0 &&
    !hasCombatEvent(input.gameplayEvents, "enemyDamaged") &&
    onlyReshuffle
  );
}

function hasCombatEvent(
  events: readonly (GameplayEvent | CombatEvent)[],
  type: CombatEvent["type"],
): boolean {
  return getCombatEvents(events).some((event) => event.type === type);
}

function isCombatEvent(event: GameplayEvent | CombatEvent): event is CombatEvent {
  switch (event.type) {
    case "enemyDamaged":
    case "enemyAttackCounterChanged":
    case "playerDamaged":
    case "enemyDefeated":
    case "waveStarted":
    case "playerHealed":
    case "gameWon":
    case "gameLost":
      return true;
    default:
      return false;
  }
}

function priorityOrder(priority: CombatTimelinePriority): number {
  switch (priority) {
    case "high":
      return 3;
    case "medium":
      return 2;
    case "low":
      return 1;
  }
}
