import type { MatchCell, SwapResult } from "../core/board.ts";
import { GameplayController } from "../core/gameplayController.ts";
import { defaultSkin } from "../skins/defaultSkin.ts";
import { fairySkin } from "../skins/fairySkin.ts";
import type { Match3Skin } from "../skins/skinTypes.ts";
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

  function render(): void {
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
        handlePieceClick(button);
      });
    });
  }

  function handlePieceClick(button: HTMLButtonElement): void {
    if (controller.getState().phase !== "playing") {
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

    const result = controller.board.swap(selected, { x, y });
    selected = null;
    message = formatSwapMessage(result, controller);
    commitScoreProgress();
    render();
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
