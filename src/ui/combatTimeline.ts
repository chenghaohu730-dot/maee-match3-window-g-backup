import type { ClearEvent, Piece } from "../core/board.ts";
import type { CombatEvent } from "../core/combatTypes.ts";
import type { GameplayEvent } from "../core/gameplayTypes.ts";
import {
  getCharacterAnimationConfig,
  getSpriteAnimationDurationMs,
} from "./characterAnimationConfig.ts";
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
type YizaiTurnAction = "attack" | "skill" | "ultimate";

const ACTION_GAP_MS = 40;
const ACTION_START_MS = 100;

const YIZAI_ACTION_PRESENTATION: Record<
  YizaiTurnAction,
  {
    eventType: CombatTimelineEventType;
    hitOffsetMs: number;
    priority: CombatTimelinePriority;
  }
> = {
  attack: {
    eventType: "character.yizai.attack",
    hitOffsetMs: 250,
    priority: "medium",
  },
  skill: {
    eventType: "character.yizai.skill",
    hitOffsetMs: 350,
    priority: "medium",
  },
  ultimate: {
    eventType: "character.yizai.ultimate",
    hitOffsetMs: 420,
    priority: "high",
  },
};

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

  return buildQueuedTurnTimeline(input, getTurnActionQueue(input));
}

export function createEnemyAttackTimeline(
  input: EnemyAttackPresentationInput,
): CombatTimeline {
  const events: CombatTimelineEvent[] = [];

  if (hasCombatEvent(input.events, "enemyDefeated")) {
    return createTimeline("enemyAttack", [], 0, 0, false);
  }

  const enemyAttackMs = getSpriteAnimationDurationMs(
    getCharacterAnimationConfig("enemy", "attack"),
  );
  const yizaiHurtMs = getSpriteAnimationDurationMs(
    getCharacterAnimationConfig("yizai", "hurt"),
  );
  const yizaiHurtAtMs = 240;
  const durationMs = Math.max(
    PRESENTATION_TIMING.ENEMY_ATTACK_MS,
    enemyAttackMs,
    yizaiHurtAtMs + yizaiHurtMs,
  );

  addEvent(events, "character.enemy.attack", 0, enemyAttackMs, "high", true);
  addEvent(events, "particle.basicProjectile", 110, 300, "low", false, {
    source: "enemy",
  });
  addEvent(events, "combat.damageNumber", 180, PRESENTATION_TIMING.DAMAGE_TEXT_MS, "high", false, {
    target: "player",
  });
  addEvent(events, "combat.playerHpTween", 220, PRESENTATION_TIMING.HP_TWEEN_MS, "high", true);
  addEvent(events, "character.yizai.hurt", yizaiHurtAtMs, yizaiHurtMs, "high", false);

  return createTimeline(
    "enemyAttack",
    events,
    durationMs,
    Math.min(
      durationMs,
      PRESENTATION_TIMING.ENEMY_ATTACK_LOCK_MAX_MS,
    ),
    hasCombatEvent(input.events, "gameLost"),
  );
}

export function createWaveTransitionTimeline(
  input: WaveTransitionPresentationInput,
): CombatTimeline {
  const events: CombatTimelineEvent[] = [];
  const enemyDefeatMs = getSpriteAnimationDurationMs(
    getCharacterAnimationConfig("enemy", "defeat"),
  );

  addEvent(events, "character.enemy.defeat", 0, enemyDefeatMs, "high", true);
  addEvent(events, "combat.enemyHpTween", 0, PRESENTATION_TIMING.HP_TWEEN_MS, "high", true, {
    target: "enemy",
    hp: 0,
  });
  addEvent(events, "ui.waveCleared", 300, 200, "medium", false);
  addEvent(events, "wave.start", enemyDefeatMs, 0, "high", true);
  const durationMs = Math.min(
    Math.max(PRESENTATION_TIMING.WAVE_TRANSITION_MS, enemyDefeatMs),
    PRESENTATION_TIMING.WAVE_TRANSITION_MAX_MS,
  );

  return createTimeline(
    "waveTransition",
    events,
    durationMs,
    durationMs,
    hasCombatEvent(input.events, "gameWon") || hasCombatEvent(input.events, "gameLost"),
  );
}

export function createGameEndTimeline(
  input: GameEndPresentationInput,
): CombatTimeline {
  const lost = hasCombatEvent(input.events, "gameLost");
  const won = hasCombatEvent(input.events, "gameWon");
  const events: CombatTimelineEvent[] = [];
  let endAtMs = 0;

  if (won) {
    const yizaiUltimateMs = getSpriteAnimationDurationMs(
      getCharacterAnimationConfig("yizai", "ultimate"),
    );
    const enemyDefeatMs = getSpriteAnimationDurationMs(
      getCharacterAnimationConfig("enemy", "defeat"),
    );

    addEvent(events, "character.yizai.ultimate", 0, yizaiUltimateMs, "high", true);
    addEvent(events, "character.enemy.defeat", 120, enemyDefeatMs, "high", true);
    endAtMs = Math.max(endAtMs, yizaiUltimateMs, 120 + enemyDefeatMs);
  }

  if (lost) {
    const yizaiHurtMs = getSpriteAnimationDurationMs(
      getCharacterAnimationConfig("yizai", "hurt"),
    );

    addEvent(events, "character.yizai.hurt", 0, yizaiHurtMs, "high", true);
    endAtMs = Math.max(endAtMs, yizaiHurtMs);
  }

  addEvent(events, "game.end", won || lost ? endAtMs : 0, 0, "high", true, {
    result: won ? "won" : lost ? "lost" : "unknown",
  });

  return createTimeline("gameEnd", events, endAtMs, null, true);
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

function buildQueuedTurnTimeline(
  input: TurnPresentationInput,
  actions: readonly YizaiTurnAction[],
): CombatTimeline {
  const events: CombatTimelineEvent[] = [];
  const defeated = hasCombatEvent(input.gameplayEvents, "enemyDefeated");
  const waveStarted = hasCombatEvent(input.gameplayEvents, "waveStarted");
  const won = hasCombatEvent(input.gameplayEvents, "gameWon");
  const kind = getTimelineKindForActions(actions);
  const chainExtension = getChainExtension(input.chainCount, 70);
  let actionStart = ACTION_START_MS;
  let firstHitAtMs: number | undefined;
  let finalActionEndMs = 0;

  addEvent(events, "board.swapComplete", 0, 0, "medium", true);
  addEvent(events, "board.clear", 0, PRESENTATION_TIMING.BOARD_CLEAR_MS, "medium", true);

  if (actions.includes("ultimate")) {
    addEvent(events, "board.ultimateFocus", 0, 180, "medium", true);
  }

  for (const action of actions) {
    const timing = getYizaiActionTiming(action);

    addYizaiActionEvents(events, action, actionStart);
    firstHitAtMs ??= actionStart + timing.hitOffsetMs;
    finalActionEndMs = actionStart + timing.durationMs;
    actionStart = finalActionEndMs + ACTION_GAP_MS;
  }

  const damageAtMs = firstHitAtMs ?? PRESENTATION_TIMING.NORMAL_HIT_MS;

  if (hasCombatEvent(input.gameplayEvents, "enemyDamaged")) {
    addEnemyDamageEvents(events, damageAtMs, defeated);
  }

  if (kind === "skill" || kind === "ultimate") {
    addEvent(
      events,
      "board.skillEffect",
      damageAtMs + 90,
      Math.min(220 + chainExtension, kind === "ultimate" ? 500 : 320),
      "medium",
      true,
      kind === "ultimate" ? { level: "ultimate" } : undefined,
    );
  }

  const settleStart = Math.max(300, finalActionEndMs + 20);
  const settleDuration = getSettleDuration(kind, chainExtension);

  addEvent(events, "board.settle", settleStart, settleDuration, "medium", true);
  addTerminalAndWaveEvents(events, {
    defeated,
    waveStarted,
    won,
    lost: false,
    defeatAtMs: damageAtMs + 160,
  });

  return createTimeline(
    kind,
    events,
    getTargetDuration(kind),
    Math.max(settleStart + settleDuration, getTargetDuration(kind)),
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

function addYizaiActionEvents(
  events: CombatTimelineEvent[],
  action: YizaiTurnAction,
  atMs: number,
): void {
  const timing = getYizaiActionTiming(action);

  addEvent(
    events,
    timing.eventType,
    atMs,
    timing.durationMs,
    timing.priority,
    false,
  );

  if (action === "attack") {
    addEvent(events, "particle.basicProjectile", atMs + 20, 360, "low", false, {
      source: "yizai",
    });
    return;
  }

  const isUltimate = action === "ultimate";

  addEvent(
    events,
    "ui.skillText",
    atMs,
    PRESENTATION_TIMING.DAMAGE_TEXT_MS,
    isUltimate ? "high" : "medium",
    false,
    { level: action },
  );
  addEvent(events, "camera.shake", atMs, isUltimate ? 520 : 360, isUltimate ? "high" : "medium", false, {
    intensity: isUltimate ? "large" : "medium",
  });
  addEvent(
    events,
    isUltimate ? "particle.ultimateAura" : "particle.skillProjectile",
    atMs + (isUltimate ? 0 : 80),
    isUltimate ? 900 : 520,
    "low",
    false,
  );
}

function getYizaiActionTiming(action: YizaiTurnAction): {
  eventType: CombatTimelineEventType;
  durationMs: number;
  hitOffsetMs: number;
  priority: CombatTimelinePriority;
} {
  const presentation = YIZAI_ACTION_PRESENTATION[action];
  const config = getCharacterAnimationConfig("yizai", action);

  return {
    ...presentation,
    durationMs: getSpriteAnimationDurationMs(config),
  };
}

function getTurnActionQueue(input: TurnPresentationInput): YizaiTurnAction[] {
  const actions =
    input.clearEvents
      ?.filter((event) => event.pieces.length > 0)
      .map(getActionForClearEvent) ?? [];
  const primaryAction = getActionFromSkillLevel(getSkillTimelineLevel(input));

  if (actions.length === 0) {
    if (primaryAction) {
      return [primaryAction];
    }

    if (
      input.summary.totalCleared > 0 ||
      hasCombatEvent(input.gameplayEvents, "enemyDamaged")
    ) {
      return ["attack"];
    }

    return [];
  }

  if (
    primaryAction &&
    input.clearEvents?.[0]?.pieces.length !== undefined &&
    input.clearEvents[0].pieces.length >= 4 &&
    actionPriority(primaryAction) > actionPriority(actions[0]!)
  ) {
    actions[0] = primaryAction;
  }

  return actions;
}

function getActionForClearEvent(event: ClearEvent): YizaiTurnAction {
  const maxLineLength = getMaxMatchedLineLength(event.pieces);

  if (maxLineLength >= 5) {
    return "ultimate";
  }

  if (maxLineLength >= 4) {
    return "skill";
  }

  return "attack";
}

function getMaxMatchedLineLength(pieces: readonly Piece[]): number {
  const byType = new Map<number, Set<string>>();

  for (const piece of pieces) {
    const coords = byType.get(piece.type) ?? new Set<string>();
    coords.add(`${piece.x},${piece.y}`);
    byType.set(piece.type, coords);
  }

  let maxLength = 0;

  for (const coords of byType.values()) {
    for (const coord of coords) {
      const [xText, yText] = coord.split(",");
      const x = Number(xText);
      const y = Number(yText);

      maxLength = Math.max(
        maxLength,
        countContiguous(coords, x, y, 1, 0),
        countContiguous(coords, x, y, 0, 1),
      );
    }
  }

  return maxLength;
}

function countContiguous(
  coords: ReadonlySet<string>,
  x: number,
  y: number,
  dx: number,
  dy: number,
): number {
  let count = 0;
  let cursorX = x;
  let cursorY = y;

  while (coords.has(`${cursorX},${cursorY}`)) {
    count++;
    cursorX += dx;
    cursorY += dy;
  }

  return count;
}

function getActionFromSkillLevel(
  level: SkillTimelineLevel,
): YizaiTurnAction | undefined {
  if (level === "ultimate") {
    return "ultimate";
  }

  if (level === "skill") {
    return "skill";
  }

  return undefined;
}

function getTimelineKindForActions(
  actions: readonly YizaiTurnAction[],
): CombatTimelineKind {
  if (actions.includes("ultimate")) {
    return "ultimate";
  }

  if (actions.includes("skill")) {
    return "skill";
  }

  return "normal";
}

function getSettleDuration(
  kind: CombatTimelineKind,
  chainExtension: number,
): number {
  if (kind === "ultimate") {
    return Math.min(410 + chainExtension, 520);
  }

  if (kind === "skill") {
    return Math.min(280 + chainExtension, 360);
  }

  return Math.min(220 + chainExtension, 300);
}

function getTargetDuration(kind: CombatTimelineKind): number {
  if (kind === "ultimate") {
    return PRESENTATION_TIMING.ULTIMATE_TURN_MAX_MS;
  }

  if (kind === "skill") {
    return PRESENTATION_TIMING.SKILL_TURN_MAX_MS;
  }

  return PRESENTATION_TIMING.NORMAL_TURN_MAX_MS;
}

function actionPriority(action: YizaiTurnAction): number {
  switch (action) {
    case "ultimate":
      return 3;
    case "skill":
      return 2;
    case "attack":
      return 1;
  }
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
