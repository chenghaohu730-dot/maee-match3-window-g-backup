import type {
  BoardPieceSnapshot,
  MatchCell,
  SwapResult,
} from "../core/board.ts";
import { GameplayController } from "../core/gameplayController.ts";
import { defaultSkin } from "../skins/defaultSkin.ts";
import { fairySkin } from "../skins/fairySkin.ts";
import type { Match3Skin } from "../skins/skinTypes.ts";
import {
  BOARD_ANIMATION_CONFIG,
  getDropDuration,
} from "./animationConfig.ts";
import {
  createBoardAnimationPlan,
  type BoardAnimationPlan,
} from "./boardAnimationPlan.ts";
import { BoardInteractionLock } from "./boardInteractionLock.ts";
import {
  applyScoreProgress,
  loadPlayerProgress,
  savePlayerProgress,
  type PlayerProgress,
  type StorageLike,
} from "./progressionStore.ts";
import {
  nextSceneForStartButton,
  selectUniverse,
  type ModalKind,
  type SceneName,
} from "./sceneState.ts";
import {
  renderGameplayScene,
  renderStartScene,
  renderUniverseScene,
} from "./gameplayView.ts";
import { mountSkillVfxLayer } from "./skillVfxLayer.ts";
import type { SkillVfxLayerInput } from "./skillVfxTypes.ts";
import {
  mountCharacterAnimators,
  type CharacterAnimationMount,
} from "./characterAnimator.ts";

export function mountGameApp(root: HTMLDivElement): void {
  const controller = new GameplayController();
  const storage = getLocalStorage();
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
  const boardLock = new BoardInteractionLock();

  function render(): void {
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
      });
    }

    bindEvents();

    if (scene === "gameplay") {
      characterAnimationMount = mountCharacterAnimators(root, activeGameplaySkin, {
        eventTarget: root,
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
            controller.startGame();
            lastCommittedScore = 0;
            selected = null;
            message = "选择两个相邻棋子交换。";
          }

          render();
        });
      },
    );

    root.querySelector<HTMLButtonElement>(".restart-button")?.addEventListener(
      "click",
      () => {
        controller.restartGame();
        lastCommittedScore = 0;
        selected = null;
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
  }

  async function handlePieceClick(button: HTMLButtonElement): Promise<void> {
    if (!boardLock.canUseBoard(controller.getState().phase, modal !== null)) {
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
      message = "已取消选择。";
      render();
      return;
    }

    if (!selected) {
      selected = { x, y };
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
      const beforeSnapshot = controller.board.getSnapshot();
      const result = controller.board.swap(from, to);
      const afterSnapshot = controller.board.getSnapshot();
      const visualStartSnapshot = result.success
        ? createPostSwapSnapshot(beforeSnapshot, from, to)
        : beforeSnapshot;
      const plan = createBoardAnimationPlan(visualStartSnapshot, afterSnapshot, {
        clearEvents: result.clearEvents,
        chainCount: result.clearEvents.length,
      });

      message = formatSwapMessage(result, controller);

      if (!result.success) {
        if (result.reason === "no-match" && areAdjacent(from, to)) {
          await playInvalidSwapAnimation(root, from, to);
        }
        return;
      }

      commitScoreProgress();
      await playSuccessfulSwapAnimation(root, from, to, plan);
      await playSkillVfxAnimation(root, {
        state: controller.getState(),
        events: controller.lastEvents,
      });
      render();
      await playBoardSettlementAnimation(root, plan);
    } finally {
      boardLock.endAnimation();
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

  render();
}

async function playSkillVfxAnimation(
  root: HTMLDivElement,
  input: SkillVfxLayerInput,
): Promise<void> {
  const mounted = mountSkillVfxLayer(root, input);

  if (!mounted) {
    return;
  }

  try {
    await delay(Math.min(mounted.durationMs, 1200));
  } finally {
    mounted.cleanup();
  }
}

async function playSuccessfulSwapAnimation(
  root: HTMLDivElement,
  from: MatchCell,
  to: MatchCell,
  plan: BoardAnimationPlan,
): Promise<void> {
  await animateSwapTo(root, from, to, BOARD_ANIMATION_CONFIG.validSwapMs);
  showComboText(root, plan.comboText);
  await animateClearingPieces(root, plan.removedPieces);

  if (plan.chainCount > 1) {
    await delay(BOARD_ANIMATION_CONFIG.chainGapMs);
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
  plan: BoardAnimationPlan,
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

function createPostSwapSnapshot(
  snapshot: readonly BoardPieceSnapshot[],
  from: MatchCell,
  to: MatchCell,
): BoardPieceSnapshot[] {
  return snapshot.map((piece) => {
    if (piece.col === from.x && piece.row === from.y) {
      return { ...piece, row: to.y, col: to.x };
    }

    if (piece.col === to.x && piece.row === to.y) {
      return { ...piece, row: from.y, col: from.x };
    }

    return piece;
  });
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
