import { fairySkin } from "../skins/fairySkin.ts";
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

export function mountAnimationCalibration(root: HTMLDivElement): void {
  let selectedState: YizaiAnimationState = "attack";
  let animator: CharacterAnimator<YizaiAnimationState> | null = null;

  function render(): void {
    animator?.stop();
    root.innerHTML = renderCalibration(selectedState);
    const sprite = root.querySelector<HTMLElement>(
      ".animation-calibration-sprite",
    );

    animator = new CharacterAnimator<YizaiAnimationState>({
      characterId: "yizai",
      configs: createCalibrationConfigs(),
      anchors: getCharacterAnchors("yizai"),
      element: sprite,
      skin: fairySkin,
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

function renderCalibration(selectedState: YizaiAnimationState): string {
  const config = getCharacterAnimationConfig("yizai", selectedState);
  const durationMs = getSpriteAnimationDurationMs(config);

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
        </section>
        <aside class="animation-calibration-readout">
          <span>state ${selectedState}</span>
          <span>frames ${config.frameCount}</span>
          <span>fps ${config.fps}</span>
          <span>duration ${durationMs}ms</span>
          <span>feet ${YIZAI_ATTACK_ALIGNMENT.targetY}px</span>
        </aside>
      </main>
    </section>
  `;
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
