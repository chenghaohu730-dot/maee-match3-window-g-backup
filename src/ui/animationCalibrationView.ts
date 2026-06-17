import { fairySkin } from "../skins/fairySkin.ts";
import type { AssetKey } from "../assets/assetManifest.ts";
import type { Match3Skin } from "../skins/skinTypes.ts";
import {
  getCharacterAnimationConfig,
  getCharacterAnchors,
  getSpriteAnimationDurationMs,
  YIZAI_ATTACK_ALIGNMENT,
  YIZAI_ANIMATION_CONFIG,
} from "./characterAnimationConfig.ts";
import { CharacterAnimator } from "./characterAnimator.ts";
import type {
  SpriteAnimationConfig,
  YizaiAnimationState,
} from "./characterAnimationTypes.ts";

const YIZAI_STATES: YizaiAnimationState[] = [
  "attack",
  "idle",
  "hurt",
  "skill",
  "ultimate",
];

const STATIC_CALIBRATION_FRAMES: Record<YizaiAnimationState, number> = {
  attack: 8,
  idle: 6,
  hurt: 6,
  skill: 12,
  ultimate: 16,
};

export function mountAnimationCalibration(root: HTMLDivElement): void {
  let selectedState: YizaiAnimationState = "attack";
  let animator: CharacterAnimator<YizaiAnimationState> | null = null;
  const calibrationSkin = createCacheBustedCalibrationSkin();

  function render(): void {
    animator?.stop();
    root.innerHTML = renderCalibration(selectedState, calibrationSkin);
    const sprite = root.querySelector<HTMLElement>(
      ".animation-calibration-sprite",
    );

    animator = new CharacterAnimator<YizaiAnimationState>({
      characterId: "yizai",
      configs: createCalibrationConfigs(),
      anchors: getCharacterAnchors("yizai"),
      element: sprite,
      skin: calibrationSkin,
      eventTarget: root,
      onComplete: (event) => {
        if (
          event.characterId !== "yizai" ||
          event.animation !== selectedState ||
          selectedState === "idle"
        ) {
          return;
        }

        window.setTimeout(() => {
          animator?.play(selectedState);
        }, 180);
      },
    });
    animator.play(selectedState);

    root.querySelectorAll<HTMLButtonElement>("[data-calibration-state]").forEach(
      (button) => {
        button.addEventListener("click", () => {
          const state = button.dataset.calibrationState as
            | YizaiAnimationState
            | undefined;

          if (!state || state === selectedState) {
            animator?.play(selectedState);
            return;
          }

          selectedState = state;
          render();
        });
      },
    );
  }

  render();
}

function createCacheBustedCalibrationSkin(): Match3Skin {
  const version = String(Date.now());
  const proSheetKeys = [
    "yizai_hero_idle_sheet_pro",
    "yizai_hero_attack_sheet_pro",
    "yizai_hero_skill_sheet_pro",
    "yizai_hero_ultimate_sheet_pro",
    "yizai_hero_hurt_sheet_pro",
  ] as const satisfies readonly AssetKey[];
  const resources: Match3Skin["resources"] = { ...fairySkin.resources };

  for (const key of proSheetKeys) {
    const resource = resources[key];
    resources[key] = {
      ...resource,
      path: `${resource.path}?calibration=${version}`,
    };
  }

  return {
    ...fairySkin,
    resources,
  };
}

function createCalibrationConfigs(): Record<
  YizaiAnimationState,
  SpriteAnimationConfig<YizaiAnimationState>
> {
  const configs = {} as Record<
    YizaiAnimationState,
    SpriteAnimationConfig<YizaiAnimationState>
  >;

  for (const state of YIZAI_STATES) {
    const config = {
      ...(YIZAI_ANIMATION_CONFIG[state] as SpriteAnimationConfig<YizaiAnimationState>),
    };

    delete config.returnTo;
    configs[state] = config;
  }

  return configs;
}

function renderCalibration(
  selectedState: YizaiAnimationState,
  calibrationSkin: Match3Skin,
): string {
  const config = getCharacterAnimationConfig("yizai", selectedState);
  const durationMs = getSpriteAnimationDurationMs(config);
  const staticFrame = Math.min(
    STATIC_CALIBRATION_FRAMES[selectedState],
    config.frameCount,
  );
  const sheetPath = calibrationSkin.resources[config.key].path;
  const columns = config.columns ?? config.frameCount;
  const rows = config.rows ?? 1;
  const staticFrameStyle = [
    `background-image: url("${sheetPath}")`,
    "background-repeat: no-repeat",
    `background-size: ${columns * 100}% ${rows * 100}%`,
    `background-position: ${getBackgroundPositionPercent(staticFrame, columns, rows)}`,
  ].join(";");

  return `
    <section class="animation-calibration">
      <header class="animation-calibration-toolbar">
        <strong>亿仔序列帧校准</strong>
        <nav class="animation-calibration-tabs" aria-label="animation states">
          ${YIZAI_STATES.map((state) => renderStateButton(state, selectedState)).join("")}
        </nav>
      </header>
      <main class="animation-calibration-main">
        <section class="animation-calibration-stage" aria-label="animation preview">
          <div class="animation-calibration-preview-grid">
            <article class="animation-calibration-preview">
              <span>animated</span>
              <div class="animation-calibration-frame">
                <div class="animation-calibration-grid"></div>
                <div class="animation-calibration-feet-line"></div>
                <div
                  class="maee-placeholder character-sprite animation-calibration-sprite"
                  data-character-id="yizai"
                  data-animation-state="${selectedState}"
                >
                  <div class="maee-art-fallback">
                    <div class="maee-headband">MAEE</div>
                    <div class="maee-brow left"></div>
                    <div class="maee-brow right"></div>
                    <div class="maee-muzzle">
                      <div class="maee-nose"></div>
                    </div>
                    <strong>亿仔勇者</strong>
                  </div>
                </div>
              </div>
            </article>
            <article class="animation-calibration-preview">
              <span>fixed frame ${staticFrame}</span>
              <div class="animation-calibration-frame">
                <div class="animation-calibration-grid"></div>
                <div class="animation-calibration-feet-line"></div>
                <div
                  class="animation-calibration-static-sprite"
                  style='${staticFrameStyle}'
                  data-animation-state="${selectedState}"
                  data-static-frame="${staticFrame}"
                ></div>
              </div>
            </article>
          </div>
        </section>
        <aside class="animation-calibration-readout">
          <span>state ${selectedState}</span>
          <span>frames ${config.frameCount}</span>
          <span>fps ${config.fps}</span>
          <span>fixed frame ${staticFrame}</span>
          <span>duration ${durationMs}ms</span>
          <span>feet ${YIZAI_ATTACK_ALIGNMENT.targetY}px</span>
        </aside>
      </main>
    </section>
  `;
}

function getBackgroundPositionPercent(
  frame: number,
  columns: number,
  rows: number,
): string {
  const clampedColumns = Math.max(1, columns);
  const clampedRows = Math.max(1, rows);
  const frameIndex = Math.max(0, frame - 1);
  const column = frameIndex % clampedColumns;
  const row = Math.floor(frameIndex / clampedColumns);
  const x = clampedColumns <= 1 ? 0 : (column / (clampedColumns - 1)) * 100;
  const y = clampedRows <= 1 ? 0 : (row / (clampedRows - 1)) * 100;

  return `${x}% ${y}%`;
}

function renderStateButton(
  state: YizaiAnimationState,
  selectedState: YizaiAnimationState,
): string {
  return `
    <button
      class="animation-calibration-tab ${state === selectedState ? "active" : ""}"
      type="button"
      data-calibration-state="${state}"
    >
      ${state}
    </button>
  `;
}
