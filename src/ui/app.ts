import type {
  BoardPieceSnapshot,
  ClearEvent,
  MatchGroup,
  MatchCell,
  Piece,
  PieceType,
  ResolveSummary,
  SwapResult,
} from "../core/board.ts";
import type { CombatEvent, EnemyWave } from "../core/combatTypes.ts";
import { GameplayController } from "../core/gameplayController.ts";
import {
  ENDLESS_DEMON_KING_WAVE,
  ENDLESS_CHALLENGE_WAVES,
  FAIRY_TALE_WAVES,
} from "../core/waves.ts";
import {
  preloadForEndless,
  preloadForFairy,
  preloadForStartup,
  preloadForWave,
} from "../assets/resourceLoader.ts";
import { defaultSkin } from "../skins/defaultSkin.ts";
import { fairySkin } from "../skins/fairySkin.ts";
import type { Match3Skin } from "../skins/skinTypes.ts";
import {
  BOARD_ANIMATION_CONFIG,
  getDropDuration,
} from "./animationConfig.ts";
import {
  createBoardAnimationSequence,
  type BoardAnimationSequence,
  type BoardAnimationStepPlan,
} from "./boardAnimationPlan.ts";
import { BoardInteractionLock } from "./boardInteractionLock.ts";
import {
  applyScoreProgress,
  loadPlayerProgress,
  savePlayerProgress,
  type StorageLike,
} from "./progressionStore.ts";
import {
  nextSceneForStartButton,
  selectUniverse,
  type ModalKind,
  type SceneName,
} from "./sceneState.ts";
import {
  renderBoardCells,
  renderGameplayScene,
  renderStartScene,
  renderUniverseScene,
} from "./gameplayView.ts";
import { mountSkillVfxLayer } from "./skillVfxLayer.ts";
import type { SkillVfxLayerInput } from "./skillVfxTypes.ts";
import { getBattleParticleKey } from "./particleConfig.ts";
import {
  mountParticleLayer,
  type ParticleLayerMount,
} from "./particleLayer.ts";
import {
  mountCharacterAnimators,
  type CharacterAnimationMount,
} from "./characterAnimator.ts";
import { PresentationDirector } from "./presentationDirector.ts";
import type {
  CombatTimeline,
  CombatTimelineEvent,
  PresentationPlaybackInput,
  TurnPresentationInput,
} from "./combatTimelineTypes.ts";
import type { GameplayDebugMode } from "./debugMode.ts";
import { PRESENTATION_TIMING } from "./presentationTiming.ts";

type DamageFloatTarget = "enemy" | "player" | "both";

export interface MountGameAppOptions {
  debugMode?: GameplayDebugMode | undefined;
}

export function mountGameApp(
  root: HTMLDivElement,
  options: MountGameAppOptions = {},
): void {
  let controller = new GameplayController({ waves: FAIRY_TALE_WAVES });
  const storage = getLocalStorage();
  const debugMode = options.debugMode;
  let scene: SceneName = "start";
  let modal: ModalKind | null = null;
  let progress = loadPlayerProgress(storage);
  let selected: MatchCell | null = null;
  let message = "点击开始游戏。";
  let lastCommittedScore = 0;
  let soundEnabled = true;
  let vibrationEnabled = true;
  let activeGameplaySkin: Match3Skin = fairySkin;
  let characterAnimationMount: CharacterAnimationMount | null = null;
  let particleLayer: ParticleLayerMount | null = null;
  let activeSkillVfxCleanup: (() => void) | null = null;
  let activeBoardResolvePromise: Promise<void> | null = null;
  let showTurnFeedback = false;
  const boardLock = new BoardInteractionLock();
  const presentationDirector = new PresentationDirector({
    onTimelineStart: () => {
      activeBoardResolvePromise = null;
    },
    onTimelineEvent: (event, timeline, input) =>
      handlePresentationTimelineEvent(event, timeline, input),
    onTimelineComplete: async (_timeline, input) => {
      if (isTurnPresentationInput(input)) {
        await activeBoardResolvePromise;
        activeBoardResolvePromise = null;
      }
    },
    onLowPriorityCancelled: () => {
      particleLayer?.cleanup();
      particleLayer = scene === "gameplay" ? mountParticleLayer(root) : null;
    },
  });

  void preloadForStartup();

  function render(): void {
    activeSkillVfxCleanup?.();
    activeSkillVfxCleanup = null;
    particleLayer?.cleanup();
    particleLayer = null;
    characterAnimationMount?.cleanup();
    characterAnimationMount = null;

    const state = controller.getState();

    if (scene === "start") {
      root.innerHTML = renderStartScene({
        progress,
        modal,
        soundEnabled,
        vibrationEnabled,
        skin: defaultSkin,
      });
    } else if (scene === "universe") {
      root.innerHTML = renderUniverseScene({
        progress,
        modal,
        skin: defaultSkin,
        fairySkin,
      });
    } else {
      root.innerHTML = renderGameplayScene({
        state,
        pieces: controller.board.grid.flatMap((row) => row),
        selected,
        message,
        lastEvents: controller.lastEvents,
        progress,
        soundEnabled,
        vibrationEnabled,
        skin: activeGameplaySkin,
        showTurnFeedback,
        showDamageFeedback: false,
      });
    }

    if (debugMode) {
      appendDebugPanel(root, debugMode);
    }

    bindEvents();

    if (scene === "gameplay") {
      particleLayer = mountParticleLayer(root);
      characterAnimationMount = mountCharacterAnimators(root, activeGameplaySkin, {
        eventTarget: root,
        onFrameEvent: (event) => {
          const vfxKey = getBattleParticleKey(controller.getState().lastVfxKeys);

          particleLayer?.handleCharacterEvent(
            event,
            vfxKey ? { vfxKey } : {},
          );
        },
      });
    }
  }

  function bindEvents(): void {
    root
      .querySelector<HTMLButtonElement>('[data-action="enter-universe"]')
      ?.addEventListener("click", () => {
        scene = nextSceneForStartButton();
        modal = null;
        render();
      });

    root
      .querySelector<HTMLButtonElement>('[data-action="show-leaderboard"]')
      ?.addEventListener("click", () => {
        modal = "leaderboard";
        render();
      });

    root
      .querySelector<HTMLButtonElement>('[data-action="show-points"]')
      ?.addEventListener("click", () => {
        modal = "points";
        render();
      });

    root
      .querySelector<HTMLButtonElement>('[data-action="show-exchange"]')
      ?.addEventListener("click", () => {
        modal = "exchange";
        render();
      });

    root
      .querySelector<HTMLButtonElement>('[data-action="show-settings"]')
      ?.addEventListener("click", () => {
        modal = "settings";
        render();
      });

    root
      .querySelector<HTMLButtonElement>('[data-action="close-modal"]')
      ?.addEventListener("click", () => {
        modal = null;
        render();
      });

    root
      .querySelector<HTMLButtonElement>('[data-action="back-start"]')
      ?.addEventListener("click", () => {
        scene = "start";
        modal = null;
        render();
      });

    root
      .querySelector<HTMLButtonElement>('[data-action="return-universe"]')
      ?.addEventListener("click", () => {
        commitScoreProgress();
        scene = "universe";
        modal = null;
        selected = null;
        showTurnFeedback = false;
        message = "选择一个宇宙开始挑战。";
        render();
      });

    root.querySelectorAll<HTMLButtonElement>("[data-universe-id]").forEach(
      (button) => {
        button.addEventListener("click", () => {
          const universeId = button.dataset.universeId ?? "";
          const result = selectUniverse(progress, universeId);

          scene = result.scene;
          modal = result.modal;

          if (result.scene === "gameplay") {
            activeGameplaySkin = resolveSkinForUniverse(universeId);
            controller = new GameplayController({ waves: FAIRY_TALE_WAVES });
            controller.startGame();
            void preloadForFairy();
            void preloadForWave(controller.getState().enemyId);
            lastCommittedScore = 0;
            selected = null;
            showTurnFeedback = false;
            message = "选择两个相邻棋子交换。";
          }

          render();
        });
      },
    );

    root
      .querySelector<HTMLButtonElement>('[data-action="start-endless"]')
      ?.addEventListener("click", () => {
        commitScoreProgress();
        controller = new GameplayController({ waves: ENDLESS_CHALLENGE_WAVES });
        controller.startGame();
        void preloadForEndless();
        activeGameplaySkin = fairySkin;
        lastCommittedScore = 0;
        selected = null;
        showTurnFeedback = false;
        message = "无尽挑战开始：击败不了魔王，坚持到最后。";
        render();
      });

    root.querySelector<HTMLButtonElement>(".restart-button")?.addEventListener(
      "click",
      () => {
        controller.restartGame();
        lastCommittedScore = 0;
        selected = null;
        showTurnFeedback = false;
        message = "选择两个相邻棋子交换。";
        render();
      },
    );

    root
      .querySelector<HTMLButtonElement>('[data-action="toggle-sound"]')
      ?.addEventListener("click", () => {
        soundEnabled = !soundEnabled;
        modal = "settings";
        render();
      });

    root
      .querySelector<HTMLButtonElement>('[data-action="toggle-vibration"]')
      ?.addEventListener("click", () => {
        vibrationEnabled = !vibrationEnabled;
        modal = "settings";
        render();
      });

    root.querySelectorAll<HTMLButtonElement>(".piece").forEach((button) => {
      button.addEventListener("click", () => {
        void handlePieceClick(button);
      });
    });

    if (debugMode) {
      root.querySelectorAll<HTMLButtonElement>("[data-debug-action]").forEach(
        (button) => {
          button.addEventListener("click", () => {
            const action = button.dataset.debugAction;

            if (action) {
              void handleDebugAction(action);
            }
          });
        },
      );
    }
  }

  async function handleDebugAction(action: string): Promise<void> {
    switch (action) {
      case "wave-1":
      case "wave-2":
      case "wave-3":
      case "wave-4":
      case "wave-5":
      case "wave-6":
        enterDebugFairyWave(Number(action.replace("wave-", "")));
        break;
      case "endless":
        enterDebugEndless();
        break;
      case "match-3":
        await playDebugTurn("normal");
        break;
      case "match-4":
        await playDebugTurn("skill");
        break;
      case "match-5":
        await playDebugTurn("ultimate");
        break;
      case "monster-attack":
        playDebugMonsterAttack();
        break;
      case "yizai-hurt":
        playDebugYizaiHurt();
        break;
      case "monster-defeat":
        playDebugMonsterDefeat();
        break;
      case "result-win":
        openDebugResult("win");
        break;
      case "result-lose":
        openDebugResult("lose");
        break;
      case "result-endless":
        openDebugResult("endless");
        break;
    }
  }

  function enterDebugFairyWave(targetWave: number): void {
    controller = new GameplayController({ waves: FAIRY_TALE_WAVES });
    controller.startGame();
    activeGameplaySkin = fairySkin;
    scene = "gameplay";
    modal = null;
    selected = null;
    showTurnFeedback = false;
    lastCommittedScore = 0;

    const wave = Math.max(1, Math.min(FAIRY_TALE_WAVES.length, targetWave));
    for (let index = 1; index < wave; index++) {
      const state = controller.getState();
      const damage = Number.isFinite(state.enemyMaxHp)
        ? state.enemyMaxHp
        : 999999;

      controller.combat.applyDirectDamage(damage);
    }

    const state = controller.getState();
    message = `调试：第 ${state.wave} 波 ${state.enemyName || state.enemyId}。`;
    void preloadForFairy();
    void preloadForWave(state.enemyId);
    render();
  }

  function enterDebugEndless(): void {
    controller = new GameplayController({ waves: ENDLESS_CHALLENGE_WAVES });
    controller.startGame();
    activeGameplaySkin = fairySkin;
    scene = "gameplay";
    modal = null;
    selected = null;
    showTurnFeedback = false;
    lastCommittedScore = 0;
    message = "调试：无尽挑战魔王。";
    void preloadForEndless();
    render();
  }

  async function playDebugTurn(kind: "normal" | "skill" | "ultimate"): Promise<void> {
    ensureDebugGameplay();
    const length = kind === "ultimate" ? 5 : kind === "skill" ? 4 : 3;
    const summary = createDebugResolveSummary(length);
    const clearEvent = createDebugClearEvent(length);
    const preTurnState = controller.getState();
    const gameplayEvents = controller.handleResolveComplete(summary);

    showTurnFeedback = true;
    message =
      kind === "ultimate"
        ? "调试：5 消大招演出。"
        : kind === "skill"
          ? "调试：4 消技能演出。"
          : "调试：普通 3 消演出。";
    render();

    await presentationDirector.playTurnPresentation({
      summary,
      gameplayEvents,
      clearEvents: [clearEvent],
      chainCount: 1,
      preState: preTurnState,
      state: controller.getState(),
    });

    showTurnFeedback = false;
    render();
  }

  function playDebugMonsterAttack(): void {
    ensureDebugGameplay();
    const state = controller.getState();
    const damageEvent: CombatEvent = {
      type: "playerDamaged",
      amount: Math.max(1, FAIRY_TALE_WAVES[Math.max(0, state.wave - 1)]?.damage ?? 8),
      playerHp: Math.max(0, state.playerHp - 8),
    };

    message = "调试：怪物攻击。";
    void presentationDirector.playEnemyAttack({
      events: [damageEvent],
      state,
    });
  }

  function playDebugYizaiHurt(): void {
    ensureDebugGameplay();
    message = "调试：亿仔受击。";
    characterAnimationMount?.play("yizai", "hurt");
    particleLayer?.handleBattleVfxKey("enemy_attack_hit");
  }

  function playDebugMonsterDefeat(): void {
    ensureDebugGameplay();
    message = "调试：怪物死亡。";
    characterAnimationMount?.play("enemy", "defeat");
    showTimelineNotice("Wave Cleared");
  }

  function openDebugResult(kind: "win" | "lose" | "endless"): void {
    const wave =
      kind === "win"
        ? createDebugWave("debug_result_slime", "调试史莱姆", 6, 0, 0)
        : kind === "endless"
          ? createDebugEndlessLossWave()
          : createDebugWave("debug_loss_enemy", "调试怪物", 999, 1, 120);

    controller = new GameplayController({ waves: [wave] });
    controller.startGame();
    controller.handleResolveComplete(createDebugResolveSummary(3));
    activeGameplaySkin = fairySkin;
    scene = "gameplay";
    modal = null;
    selected = null;
    showTurnFeedback = false;
    lastCommittedScore = 0;
    message =
      kind === "win"
        ? "调试：普通胜利结算。"
        : kind === "endless"
          ? "调试：无尽挑战结算。"
          : "调试：普通失败结算。";
    render();
  }

  function ensureDebugGameplay(): void {
    if (scene !== "gameplay" || controller.getState().phase !== "playing") {
      enterDebugFairyWave(1);
    }
  }

  async function handlePresentationTimelineEvent(
    event: CombatTimelineEvent,
    _timeline: CombatTimeline,
    input: PresentationPlaybackInput,
  ): Promise<void> {
    if (!isTurnPresentationInput(input)) {
      handleNonTurnTimelineEvent(event);
      return;
    }

    switch (event.type) {
      case "board.swapComplete":
        activeBoardResolvePromise = input.boardSwap
          ? playSuccessfulSwapAnimation(
              root,
              input.boardSwap.from,
              input.boardSwap.to,
              input.boardSwap.sequence,
              activeGameplaySkin,
            )
          : Promise.resolve();
        break;
      case "character.yizai.attack":
        characterAnimationMount?.play("yizai", "attack");
        break;
      case "character.yizai.skill":
        characterAnimationMount?.play("yizai", "skill");
        break;
      case "character.yizai.ultimate":
        characterAnimationMount?.play("yizai", "ultimate");
        break;
      case "character.yizai.hurt":
        characterAnimationMount?.play("yizai", "hurt");
        break;
      case "character.enemy.hit":
        characterAnimationMount?.play("enemy", "hit");
        break;
      case "character.enemy.attack":
        characterAnimationMount?.play("enemy", "attack");
        break;
      case "character.enemy.defeat":
        characterAnimationMount?.play("enemy", "defeat");
        break;
      case "particle.basicProjectile":
        particleLayer?.handleBattleVfxKey(
          event.data?.source === "enemy" ? "enemy_attack_hit" : "yizai_basic_hit",
        );
        break;
      case "particle.skillProjectile":
      case "particle.ultimateAura":
        emitCurrentBattleParticles(input);
        break;
      case "ui.skillText":
        startCurrentSkillVfx(input);
        break;
      case "camera.shake":
        applyTimelineShake(event);
        break;
      case "combat.damageNumber":
        renderTimelineDamage(input.gameplayEvents, event);
        break;
      case "combat.enemyHpTween":
      case "combat.playerHpTween":
        renderTimelineHp(event);
        break;
      case "ui.waveCleared":
        showTimelineNotice("Wave Cleared");
        break;
      case "ui.reshuffleNotice":
        showTimelineNotice("棋盘重排");
        break;
      case "wave.start":
      case "game.end":
        render();
        break;
      case "board.settle":
        await activeBoardResolvePromise;
        render();
        break;
      case "board.clear":
      case "board.skillEffect":
      case "board.ultimateFocus":
      case "combat.attackCounter":
        break;
    }
  }

  function handleNonTurnTimelineEvent(event: CombatTimelineEvent): void {
    switch (event.type) {
      case "character.enemy.attack":
        characterAnimationMount?.play("enemy", "attack");
        break;
      case "character.yizai.hurt":
        characterAnimationMount?.play("yizai", "hurt");
        break;
      case "character.enemy.defeat":
        characterAnimationMount?.play("enemy", "defeat");
        break;
      case "ui.waveCleared":
        showTimelineNotice("Wave Cleared");
        break;
      case "ui.reshuffleNotice":
        showTimelineNotice("棋盘重排");
        break;
      default:
        break;
    }
  }

  async function handlePieceClick(button: HTMLButtonElement): Promise<void> {
    if (
      !boardLock.canUseBoard(
        controller.getState().phase,
        modal !== null,
        presentationDirector.isBusy(),
      )
    ) {
      return;
    }

    const x = Number(button.dataset.x);
    const y = Number(button.dataset.y);
    const piece = controller.board.getPiece(x, y);

    if (!piece) {
      return;
    }

    if (selected?.x === x && selected.y === y) {
      selected = null;
      showTurnFeedback = false;
      message = "已取消选择。";
      render();
      return;
    }

    if (!selected) {
      selected = { x, y };
      showTurnFeedback = false;
      message = `已选择 ${x + 1},${y + 1}。`;
      render();
      return;
    }

    const from = selected;
    const to = { x, y };

    if (!boardLock.beginAnimation()) {
      return;
    }

    selected = null;

    try {
      const preTurnState = controller.getState();
      const result = controller.board.swap(from, to);

      message = formatSwapMessage(result, controller);

      if (!result.success) {
        if (result.reason === "no-match" && areAdjacent(from, to)) {
          await playInvalidSwapAnimation(root, from, to);
        }
        return;
      }

      commitScoreProgress();
      const turnState = controller.getState();
      const sequence = createBoardAnimationSequence(result.animationSteps, {
        chainCount: turnState.lastComboCount || result.clearEvents.length,
      });
      showTurnFeedback = true;
      await presentationDirector.playTurnPresentation({
        summary: {
          totalCleared: result.clearEvents.reduce(
            (sum, event) => sum + event.pieces.length,
            0,
          ),
          chainCount: result.clearEvents.length,
          wasPlayerMove: true,
          boardWasReshuffled: controller.lastEvents.some(
            (event) => event.type === "boardShuffled",
          ),
        },
        gameplayEvents: controller.lastEvents,
        clearEvents: result.clearEvents,
        chainCount: result.clearEvents.length,
        preState: preTurnState,
        state: turnState,
        boardSwap: { from, to, sequence },
      });
    } finally {
      boardLock.endAnimation();
      showTurnFeedback = false;
      render();
    }
  }

  function commitScoreProgress(): void {
    const currentScore = controller.getState().score;
    const scoreDelta = Math.max(0, currentScore - lastCommittedScore);

    if (scoreDelta === 0 && currentScore <= progress.highestScore) {
      return;
    }

    progress = applyScoreProgress(progress, scoreDelta, currentScore);
    lastCommittedScore = currentScore;
    savePlayerProgress(progress, storage);
  }

  function emitCurrentBattleParticles(input: TurnPresentationInput): void {
    const battleParticleKey = getBattleParticleKey(
      input.state?.lastVfxKeys ?? controller.getState().lastVfxKeys,
    );

    if (battleParticleKey) {
      particleLayer?.handleBattleVfxKey(battleParticleKey);
    }
  }

  function startCurrentSkillVfx(input: TurnPresentationInput): void {
    activeSkillVfxCleanup?.();
    activeSkillVfxCleanup = startSkillVfxAnimation(
      root,
      {
        state: input.state ?? controller.getState(),
        events: input.gameplayEvents,
      },
      particleLayer,
    );
  }

  function applyTimelineShake(event: CombatTimelineEvent): void {
    const intensity = event.data?.intensity === "large" ? "large" : "medium";
    const className = intensity === "large" ? "shake-large" : "shake-medium";
    const durationMs = intensity === "large" ? 520 : 360;
    const targets = [
      root.querySelector<HTMLElement>(".battle-zone"),
      root.querySelector<HTMLElement>(".board-stage"),
    ].filter((target): target is HTMLElement => target !== null);

    for (const target of targets) {
      target.classList.add(className);
      window.setTimeout(() => target.classList.remove(className), durationMs);
    }
  }

  function renderTimelineHp(event?: CombatTimelineEvent): void {
    const state = controller.getState();
    const target = getDamageFloatTarget(event);

    if (target !== "player") {
      const enemyHp = getNumericEventData(event, "hp");
      const enemyMaxHp = getNumericEventData(event, "maxHp");

      updateHpPanel(
        "enemy",
        enemyHp ?? state.enemyHp,
        enemyMaxHp ?? state.enemyMaxHp,
      );
    }

    if (target !== "enemy") {
      const playerHp = getNumericEventData(event, "hp");
      const playerMaxHp = getNumericEventData(event, "maxHp");

      updateHpPanel(
        "player",
        playerHp ?? state.playerHp,
        playerMaxHp ?? state.playerMaxHp,
      );
    }
  }

  function updateHpPanel(
    variant: "player" | "enemy",
    current: number,
    max: number,
  ): void {
    const panel = root.querySelector<HTMLElement>(`.${variant}-hp-panel`);
    const label = panel?.querySelector<HTMLElement>(".hp-label span:last-child");
    const fill = panel?.querySelector<HTMLElement>(".hp-fill");

    if (!panel || !fill) {
      return;
    }

    if (label) {
      label.textContent = `${formatNumber(current)}/${formatNumber(max)}`;
    }

    const percent = !Number.isFinite(max)
      ? 100
      : max <= 0
        ? 0
        : Math.max(0, Math.min(100, (current / max) * 100));

    fill.style.setProperty("width", `${percent}%`);
    fill.style.setProperty(
      "--hp-tween-ms",
      `${PRESENTATION_TIMING.HP_TWEEN_MS}ms`,
    );
  }

  function renderTimelineDamage(
    events: readonly TurnPresentationInput["gameplayEvents"][number][],
    event?: CombatTimelineEvent,
  ): void {
    const layer = root.querySelector<HTMLElement>(".damage-float-layer");

    if (!layer) {
      return;
    }

    const target = getDamageFloatTarget(event);
    const enemyDamage =
      getNumericEventData(event, "amount") ?? controller.getState().lastDamage;
    const playerDamage = getLatestPlayerDamage(events);
    const parts: HTMLElement[] = [];

    if (target !== "player" && enemyDamage > 0) {
      parts.push(
        createDamageFloat("enemy-damage", `-${formatNumber(enemyDamage)}`),
      );
    }

    if (target !== "enemy" && playerDamage > 0) {
      parts.push(
        createDamageFloat("player-damage", `-${formatNumber(playerDamage)}`),
      );
    }

    layer.replaceChildren(...parts);
  }

  function showTimelineNotice(text: string): void {
    const stage = root.querySelector<HTMLElement>(".battle-stage");

    if (!stage) {
      return;
    }

    const notice = document.createElement("div");
    notice.className = "timeline-notice";
    notice.textContent = text;
    stage.append(notice);
    window.setTimeout(() => notice.remove(), 620);
  }

  render();
}

function isTurnPresentationInput(
  input: PresentationPlaybackInput,
): input is TurnPresentationInput {
  return "summary" in input && "gameplayEvents" in input;
}

function getDamageFloatTarget(
  event: CombatTimelineEvent | undefined,
): DamageFloatTarget {
  const target = event?.data?.target;

  return target === "enemy" || target === "player" ? target : "both";
}

function getNumericEventData(
  event: CombatTimelineEvent | undefined,
  key: string,
): number | undefined {
  const value = event?.data?.[key];

  return typeof value === "number" && Number.isFinite(value)
    ? value
    : undefined;
}

function startSkillVfxAnimation(
  root: HTMLDivElement,
  input: SkillVfxLayerInput,
  particleLayer: ParticleLayerMount | null,
): (() => void) | null {
  const mounted = mountSkillVfxLayer(root, input);
  const battleParticleKey = getBattleParticleKey(input.state.lastVfxKeys);
  const particleResult = battleParticleKey
    ? particleLayer?.handleBattleVfxKey(battleParticleKey)
    : null;

  if (!mounted && !particleResult) {
    return null;
  }

  const particleDurationMs =
    particleResult?.created.reduce(
      (max, particle) => Math.max(max, particle.durationMs),
      0,
    ) ?? 0;
  const durationMs = Math.min(
    Math.max(mounted?.durationMs ?? 0, particleDurationMs),
    PRESENTATION_TIMING.ULTIMATE_TURN_MAX_MS,
  );
  let cleaned = false;
  const timer = window.setTimeout(cleanup, durationMs);

  function cleanup(): void {
    if (cleaned) {
      return;
    }

    cleaned = true;
    window.clearTimeout(timer);
    mounted?.cleanup();
  }

  return cleanup;
}

function createDamageFloat(className: string, text: string): HTMLElement {
  const element = document.createElement("span");

  element.className = `damage-float ${className}`;
  element.textContent = text;
  element.style.setProperty(
    "--damage-text-ms",
    `${PRESENTATION_TIMING.DAMAGE_TEXT_MS}ms`,
  );
  return element;
}

function getLatestPlayerDamage(
  events: readonly TurnPresentationInput["gameplayEvents"][number][],
): number {
  for (let index = events.length - 1; index >= 0; index--) {
    const event = events[index];

    if (event?.type === "combat" && event.event.type === "playerDamaged") {
      return event.event.amount;
    }
  }

  return 0;
}

function formatNumber(value: number): string {
  if (!Number.isFinite(value)) {
    return "∞";
  }

  return Number.isInteger(value)
    ? String(value)
    : value.toFixed(1).replace(/\.0$/, "");
}

function appendDebugPanel(root: HTMLDivElement, mode: GameplayDebugMode): void {
  const panel = document.createElement("aside");
  panel.className = "debug-state-lab";
  panel.dataset.debugMode = mode;
  panel.innerHTML = `
    <div class="debug-state-lab-header">
      <strong>${mode === "battle-lab" ? "Battle Lab" : "State Lab"}</strong>
      <span>U1</span>
    </div>
    <div class="debug-state-lab-grid">
      ${debugButton("wave-1", "第1波")}
      ${debugButton("wave-2", "第2波")}
      ${debugButton("wave-3", "第3波")}
      ${debugButton("wave-4", "第4波")}
      ${debugButton("wave-5", "第5波")}
      ${debugButton("wave-6", "第6波")}
      ${debugButton("endless", "无尽魔王")}
      ${debugButton("match-3", "3消")}
      ${debugButton("match-4", "4消")}
      ${debugButton("match-5", "5消")}
      ${debugButton("monster-attack", "怪物攻击")}
      ${debugButton("yizai-hurt", "亿仔受击")}
      ${debugButton("monster-defeat", "怪物死亡")}
      ${debugButton("result-win", "胜利结算")}
      ${debugButton("result-lose", "失败结算")}
      ${debugButton("result-endless", "无尽结算")}
    </div>
  `;
  root.append(panel);
}

function debugButton(action: string, label: string): string {
  return `<button type="button" data-debug-action="${action}">${label}</button>`;
}

function createDebugResolveSummary(length: 3 | 4 | 5): ResolveSummary {
  const group = createDebugMatchGroup(length);
  return {
    totalCleared: length,
    chainCount: 1,
    wasPlayerMove: true,
    groups: [group],
    maxMatchLength: length,
  };
}

function createDebugClearEvent(length: 3 | 4 | 5): ClearEvent {
  const group = createDebugMatchGroup(length);

  return {
    pieces: group.cells.map((cell, index) => ({
      id: `debug-piece-${length}-${index}`,
      type: group.type,
      x: cell.x,
      y: cell.y,
      isMatched: true,
    })),
    damage: length * 2,
    chain: 1,
  };
}

function createDebugMatchGroup(length: 3 | 4 | 5): MatchGroup {
  return {
    type: 0 satisfies PieceType,
    length,
    cells: Array.from({ length }, (_, x) => ({ x, y: 0 })),
    orientation: "row",
  };
}

function createDebugWave(
  id: string,
  name: string,
  hp: number,
  attackInterval: number,
  damage: number,
): EnemyWave {
  return {
    id,
    name,
    hp,
    attackInterval,
    damage,
  };
}

function createDebugEndlessLossWave(): EnemyWave {
  return {
    ...ENDLESS_DEMON_KING_WAVE,
    attackInterval: 1,
    damage: 120,
  };
}

async function playSuccessfulSwapAnimation(
  root: HTMLDivElement,
  from: MatchCell,
  to: MatchCell,
  sequence: BoardAnimationSequence,
  skin: Match3Skin,
): Promise<void> {
  await animateSwapTo(root, from, to, BOARD_ANIMATION_CONFIG.validSwapMs);

  for (let index = 0; index < sequence.steps.length; index++) {
    const step = sequence.steps[index]!;

    showComboText(root, step.comboText);

    if (step.removedPieces.length > 0) {
      await animateClearingPieces(root, step.removedPieces);
    }

    renderBoardSnapshot(root, step.afterSnapshot, skin);
    await playBoardSettlementAnimation(root, step);

    if (index < sequence.steps.length - 1) {
      await delay(BOARD_ANIMATION_CONFIG.chainGapMs);
    }
  }
}

async function playInvalidSwapAnimation(
  root: HTMLDivElement,
  from: MatchCell,
  to: MatchCell,
): Promise<void> {
  const pieces = await animateSwapTo(
    root,
    from,
    to,
    BOARD_ANIMATION_CONFIG.invalidSwapOutMs,
  );

  await delay(BOARD_ANIMATION_CONFIG.invalidSwapHoldMs);

  if (!pieces) {
    await delay(BOARD_ANIMATION_CONFIG.invalidSwapBackMs);
    return;
  }

  for (const piece of pieces) {
    piece.style.transition = createTransformTransition(
      BOARD_ANIMATION_CONFIG.invalidSwapBackMs,
    );
    piece.style.transform = "translate3d(0, 0, 0)";
  }

  await delay(BOARD_ANIMATION_CONFIG.invalidSwapBackMs);
}

async function animateSwapTo(
  root: HTMLDivElement,
  from: MatchCell,
  to: MatchCell,
  durationMs: number,
): Promise<[HTMLButtonElement, HTMLButtonElement] | null> {
  const firstPiece = findPieceAt(root, from);
  const secondPiece = findPieceAt(root, to);

  if (!firstPiece || !secondPiece) {
    await delay(durationMs);
    return null;
  }

  const metrics = getBoardMetrics(root);
  const dx = (to.x - from.x) * metrics.stepX;
  const dy = (to.y - from.y) * metrics.stepY;

  for (const piece of [firstPiece, secondPiece]) {
    piece.classList.add("swapping");
    piece.style.transition = "none";
    piece.style.willChange = "transform";
    piece.style.transform = "translate3d(0, 0, 0)";
  }

  await nextFrame();

  firstPiece.style.transition = createTransformTransition(durationMs);
  secondPiece.style.transition = createTransformTransition(durationMs);
  firstPiece.style.transform = `translate3d(${dx}px, ${dy}px, 0)`;
  secondPiece.style.transform = `translate3d(${-dx}px, ${-dy}px, 0)`;

  await delay(durationMs);
  return [firstPiece, secondPiece];
}

async function animateClearingPieces(
  root: HTMLDivElement,
  removedPieceIds: readonly string[],
): Promise<void> {
  const pieces = removedPieceIds
    .map((id) => findPieceById(root, id))
    .filter((piece): piece is HTMLButtonElement => piece !== null);

  if (pieces.length === 0) {
    await delay(BOARD_ANIMATION_CONFIG.clearMs);
    return;
  }

  const baseTransforms = new Map<HTMLButtonElement, string>();

  for (const piece of pieces) {
    const baseTransform = piece.style.transform || "translate3d(0, 0, 0)";
    baseTransforms.set(piece, baseTransform);
    piece.classList.add("clearing");
    piece.style.transition = "none";
    piece.style.willChange = "transform, opacity, filter";
    piece.style.opacity = "1";
    piece.style.transform = baseTransform;
  }

  await nextFrame();

  for (const piece of pieces) {
    const baseTransform = baseTransforms.get(piece) ?? "translate3d(0, 0, 0)";
    piece.style.transition = [
      createTransformTransition(BOARD_ANIMATION_CONFIG.clearMs),
      `opacity ${BOARD_ANIMATION_CONFIG.clearMs}ms ease`,
      `filter ${BOARD_ANIMATION_CONFIG.clearMs}ms ease`,
    ].join(", ");
    piece.style.transform = `${baseTransform} scale(0.34)`;
    piece.style.opacity = "0";
    piece.style.filter = "brightness(1.65) saturate(1.35)";
  }

  await delay(BOARD_ANIMATION_CONFIG.clearMs);
}

async function playBoardSettlementAnimation(
  root: HTMLDivElement,
  plan: BoardAnimationStepPlan,
): Promise<void> {
  const metrics = getBoardMetrics(root);
  const animations: {
    element: HTMLButtonElement;
    durationMs: number;
    transform: string;
    className: "dropping" | "spawning";
  }[] = [];

  for (const piece of plan.movedPieces) {
    const element = findPieceById(root, piece.id);
    if (!element) {
      continue;
    }

    const dx = (piece.fromCol - piece.toCol) * metrics.stepX;
    const dy = (piece.fromRow - piece.toRow) * metrics.stepY;
    animations.push({
      element,
      durationMs: getDropDuration(piece.toRow - piece.fromRow),
      transform: `translate3d(${dx}px, ${dy}px, 0)`,
      className: "dropping",
    });
  }

  for (const piece of plan.spawnedPieces) {
    const element = findPieceById(root, piece.id);
    if (!element) {
      continue;
    }

    const dy = (piece.spawnFromRow - piece.toRow) * metrics.stepY;
    animations.push({
      element,
      durationMs: BOARD_ANIMATION_CONFIG.spawnMs,
      transform: `translate3d(0, ${dy}px, 0)`,
      className: "spawning",
    });
  }

  if (animations.length === 0) {
    return;
  }

  let maxDuration = 0;

  for (const animation of animations) {
    maxDuration = Math.max(maxDuration, animation.durationMs);
    animation.element.classList.add(animation.className);
    animation.element.style.transition = "none";
    animation.element.style.willChange = "transform, opacity";
    animation.element.style.transform = animation.transform;
    animation.element.style.opacity = animation.className === "spawning" ? "0" : "1";
  }

  await nextFrame();

  for (const animation of animations) {
    animation.element.style.transition = [
      createTransformTransition(animation.durationMs),
      "opacity 120ms ease",
    ].join(", ");
    animation.element.style.transform = "translate3d(0, 0, 0)";
    animation.element.style.opacity = "1";
  }

  await delay(maxDuration + BOARD_ANIMATION_CONFIG.settleBufferMs);
}

function showComboText(root: HTMLDivElement, comboText: string | undefined): void {
  if (!comboText) {
    return;
  }

  const stage = root.querySelector<HTMLElement>(".board-stage");
  if (!stage) {
    return;
  }

  const combo = document.createElement("div");
  combo.className = "combo-pop board-animation-combo";
  combo.textContent = comboText;
  stage.append(combo);
}

function renderBoardSnapshot(
  root: HTMLDivElement,
  snapshot: readonly BoardPieceSnapshot[],
  skin: Match3Skin,
): void {
  const board = root.querySelector<HTMLElement>(".board");

  if (!board) {
    return;
  }

  board.innerHTML = renderBoardCells(snapshotToPieces(snapshot), null, skin);
}

function snapshotToPieces(
  snapshot: readonly BoardPieceSnapshot[],
): (Piece | null)[] {
  const pieces = Array<Piece | null>(64).fill(null);

  for (const snapshotPiece of snapshot) {
    const index = snapshotPiece.row * 8 + snapshotPiece.col;

    if (index < 0 || index >= pieces.length) {
      continue;
    }

    pieces[index] = {
      id: snapshotPiece.id,
      type: snapshotPiece.type,
      x: snapshotPiece.col,
      y: snapshotPiece.row,
      isMatched: false,
    };
  }

  return pieces;
}

function areAdjacent(a: MatchCell, b: MatchCell): boolean {
  return Math.abs(a.x - b.x) + Math.abs(a.y - b.y) === 1;
}

function getBoardMetrics(root: HTMLDivElement): { stepX: number; stepY: number } {
  const board = root.querySelector<HTMLElement>(".board");
  const firstCell = findCellAt(root, { x: 0, y: 0 });
  const rightCell = findCellAt(root, { x: 1, y: 0 });
  const downCell = findCellAt(root, { x: 0, y: 1 });

  if (!board || !firstCell) {
    return { stepX: 1, stepY: 1 };
  }

  const boardRect = board.getBoundingClientRect();
  const firstRect = firstCell.getBoundingClientRect();
  const rightRect = rightCell?.getBoundingClientRect();
  const downRect = downCell?.getBoundingClientRect();

  return {
    stepX: rightRect ? rightRect.left - firstRect.left : boardRect.width / 8,
    stepY: downRect ? downRect.top - firstRect.top : boardRect.height / 8,
  };
}

function findPieceAt(
  root: HTMLDivElement,
  coord: MatchCell,
): HTMLButtonElement | null {
  return root.querySelector<HTMLButtonElement>(
    `.piece[data-x="${coord.x}"][data-y="${coord.y}"]`,
  );
}

function findCellAt(
  root: HTMLDivElement,
  coord: MatchCell,
): HTMLElement | null {
  return root.querySelector<HTMLElement>(
    `.board-cell[data-cell-x="${coord.x}"][data-cell-y="${coord.y}"]`,
  );
}

function findPieceById(
  root: HTMLDivElement,
  id: string,
): HTMLButtonElement | null {
  for (const piece of root.querySelectorAll<HTMLButtonElement>(".piece")) {
    if (piece.dataset.pieceId === id) {
      return piece;
    }
  }

  return null;
}

function createTransformTransition(durationMs: number): string {
  return `transform ${durationMs}ms cubic-bezier(0.2, 0.85, 0.2, 1.08)`;
}

function nextFrame(): Promise<void> {
  return new Promise((resolve) => {
    window.requestAnimationFrame(() => resolve());
  });
}

function delay(durationMs: number): Promise<void> {
  return new Promise((resolve) => {
    window.setTimeout(resolve, durationMs);
  });
}

function resolveSkinForUniverse(universeId: string): Match3Skin {
  return universeId === "fairy-tale" ? fairySkin : defaultSkin;
}

function getLocalStorage(): StorageLike | undefined {
  try {
    return window.localStorage;
  } catch {
    return undefined;
  }
}

function formatSwapMessage(
  result: SwapResult,
  controller: GameplayController,
): string {
  if (!result.success) {
    return `交换无效：${result.reason ?? "unknown"}。`;
  }

  const state = controller.getState();
  const skill = state.lastSkillText ? ` 技能 ${state.lastSkillText}。` : "";
  const damage = state.lastDamage;

  if (state.phase === "won") {
    return `本次消除 ${damage} 伤害。胜利！`;
  }

  if (state.phase === "lost") {
    return `本次消除 ${damage} 伤害。失败。`;
  }

  return `本次消除 ${damage} 伤害。${skill}`;
}
