import type { Match3Skin } from "../skins/skinTypes.ts";
import { getSkinResource, hasImageResource } from "../skins/skinTypes.ts";
import {
  CHARACTER_ANIMATION_CONFIGS,
  CHARACTER_ANCHORS,
  getSpriteAnimationDurationMs,
} from "./characterAnimationConfig.ts";
import {
  collectRuntimeFrameEvents,
  dispatchCharacterRuntimeEvent,
} from "./characterAnimationEvents.ts";
import type {
  CharacterAnchorConfig,
  CharacterAnimationCompleteEvent,
  CharacterAnimationRuntimeEvent,
  CharacterAnimationSource,
  CharacterId,
  SpriteAnimationConfig,
} from "./characterAnimationTypes.ts";

export interface CharacterAnimatorOptions<StateName extends string> {
  characterId: CharacterId;
  configs: Record<StateName, SpriteAnimationConfig<StateName>>;
  anchors?: CharacterAnchorConfig;
  element?: HTMLElement | null;
  skin?: Match3Skin;
  eventTarget?: EventTarget | null;
  onFrameEvent?: (event: CharacterAnimationRuntimeEvent) => void;
  onComplete?: (event: CharacterAnimationCompleteEvent) => void;
}

export interface CharacterAnimationMountOptions {
  eventTarget?: EventTarget | null;
  onFrameEvent?: (event: CharacterAnimationRuntimeEvent) => void;
  onComplete?: (event: CharacterAnimationCompleteEvent) => void;
}

export interface CharacterAnimationMount {
  animators: CharacterAnimator<string>[];
  play: (characterId: CharacterId, state: string) => boolean;
  cleanup: () => void;
}

export class CharacterAnimator<StateName extends string = string> {
  private currentState: StateName | undefined;
  private currentConfig: SpriteAnimationConfig<StateName> | undefined;
  private frameTimerId: number | undefined;
  private readonly emittedFrameEvents = new Set<string>();
  private lastFrame = 1;

  constructor(private readonly options: CharacterAnimatorOptions<StateName>) {}

  get characterId(): CharacterId {
    return this.options.characterId;
  }

  play(state: StateName): boolean {
    return this.playState(state, false);
  }

  stop(): void {
    if (
      this.frameTimerId !== undefined &&
      typeof window !== "undefined" &&
      typeof window.clearTimeout === "function"
    ) {
      window.clearTimeout(this.frameTimerId);
    }

    this.frameTimerId = undefined;
  }

  advanceToFrame(frame: number): CharacterAnimationRuntimeEvent[] {
    if (!this.currentConfig || !this.currentState) {
      return [];
    }

    const clampedFrame = clampFrame(frame, this.currentConfig.frameCount);

    if (this.currentConfig.loop && clampedFrame < this.lastFrame) {
      this.emittedFrameEvents.clear();
    }

    this.lastFrame = clampedFrame;
    this.updateElementFrame(clampedFrame);

    const events = collectRuntimeFrameEvents(
      this.options.characterId,
      this.currentState,
      clampedFrame,
      this.currentConfig,
      this.options.anchors,
      this.options.element,
    ).filter((event) => {
      const id = getRuntimeEventId(event);

      if (this.emittedFrameEvents.has(id)) {
        return false;
      }

      this.emittedFrameEvents.add(id);
      return true;
    });

    for (const event of events) {
      this.options.onFrameEvent?.(event);
      dispatchCharacterRuntimeEvent(this.options.eventTarget, event);
    }

    return events;
  }

  private playState(state: StateName, force: boolean): boolean {
    const config = this.options.configs[state];

    if (!config) {
      return false;
    }

    if (
      !force &&
      this.currentConfig &&
      config.priority < this.currentConfig.priority
    ) {
      return false;
    }

    this.stop();
    this.currentState = state;
    this.currentConfig = config;
    this.lastFrame = 1;
    this.emittedFrameEvents.clear();
    this.applyElementState(state, config);
    this.advanceToFrame(1);
    this.startPlayback();
    return true;
  }

  private startPlayback(): void {
    if (
      !this.currentConfig ||
      typeof window === "undefined" ||
      typeof window.setTimeout !== "function"
    ) {
      return;
    }

    const frameDurationMs = 1000 / Math.max(this.currentConfig.fps, 1);

    const step = (): void => {
      if (!this.currentConfig) {
        return;
      }

      const nextFrame = this.lastFrame + 1;

      if (nextFrame > this.currentConfig.frameCount) {
        if (this.currentConfig.loop) {
          this.advanceToFrame(1);
          this.frameTimerId = window.setTimeout(step, frameDurationMs);
          return;
        }

        this.frameTimerId = undefined;
        this.completeCurrentAnimation();
        return;
      }

      this.advanceToFrame(nextFrame);
      this.frameTimerId = window.setTimeout(step, frameDurationMs);
    };

    this.frameTimerId = window.setTimeout(step, frameDurationMs);
  }

  private completeCurrentAnimation(): void {
    if (!this.currentState || !this.currentConfig) {
      return;
    }

    const completedState = this.currentState;
    const returnTo = this.currentConfig.returnTo;
    const completeEvent: CharacterAnimationCompleteEvent = {
      characterId: this.options.characterId,
      animation: completedState,
    };

    if (returnTo) {
      completeEvent.returnTo = returnTo;
    }

    this.options.onComplete?.(completeEvent);

    if (returnTo && returnTo !== completedState) {
      this.playState(returnTo as StateName, true);
    }
  }

  private applyElementState(
    state: StateName,
    config: SpriteAnimationConfig<StateName>,
  ): void {
    const element = this.options.element;

    if (!element) {
      return;
    }

    const source = resolveCharacterAnimationSource(config, this.options.skin);

    element.dataset.characterId = this.options.characterId;
    element.dataset.animationState = state;
    element.dataset.animationMode = source.mode;
    element.dataset.assetKey = source.key;

    if (source.fallbackKey) {
      element.dataset.fallbackKey = source.fallbackKey;
    } else {
      delete element.dataset.fallbackKey;
    }

    element.dataset.frameCount = String(config.frameCount);
    element.dataset.frameWidth = String(config.frameWidth);
    element.dataset.frameHeight = String(config.frameHeight);
    element.dataset.animationDurationMs = String(
      getSpriteAnimationDurationMs(config),
    );
    element.style.setProperty("--character-frame-count", String(config.frameCount));
    element.style.setProperty("--character-frame-width", `${config.frameWidth}`);
    element.style.setProperty("--character-frame-height", `${config.frameHeight}`);
    updateSlotStateClass(element, this.options.characterId, state);

    if (source.mode === "sheet") {
      element.classList.add("character-sheet");
      element.style.setProperty("--character-sheet-url", `url('${source.path}')`);
      element.style.backgroundImage = `url("${source.path}")`;
      element.style.backgroundRepeat = "no-repeat";
      element.style.backgroundSize = `${config.frameCount * 100}% 100%`;
      return;
    }

    element.classList.remove("character-sheet");

    if (source.mode === "fallbackImage") {
      element.style.setProperty("--asset-url", `url('${source.path}')`);
      element.style.backgroundImage = `url("${source.path}")`;
      element.style.backgroundPosition = "center";
      element.style.backgroundRepeat = "no-repeat";
      element.style.backgroundSize = "contain";
      return;
    }

    element.style.removeProperty("--asset-url");
    element.style.backgroundImage = "";
  }

  private updateElementFrame(frame: number): void {
    const element = this.options.element;

    if (!element || !this.currentConfig) {
      return;
    }

    element.dataset.currentFrame = String(frame);

    if (element.dataset.animationMode !== "sheet") {
      return;
    }

    const position = getBackgroundPositionPercent(
      frame,
      this.currentConfig.frameCount,
    );
    element.style.backgroundPosition = `${position}% center`;
  }
}

export function mountCharacterAnimators(
  root: HTMLElement,
  skin: Match3Skin,
  options: CharacterAnimationMountOptions = {},
): CharacterAnimationMount {
  const animators: CharacterAnimator<string>[] = [];

  root
    .querySelectorAll<HTMLElement>(".character-sprite[data-character-id]")
    .forEach((element) => {
      const characterId = getCharacterIdFromElement(element);
      const state = element.dataset.animationState;

      if (!characterId || !state) {
        return;
      }

      const animatorOptions: CharacterAnimatorOptions<string> = {
        characterId,
        configs: getConfigMap(characterId),
        anchors: CHARACTER_ANCHORS[characterId],
        element,
        skin,
        eventTarget: options.eventTarget ?? root,
      };

      if (options.onFrameEvent) {
        animatorOptions.onFrameEvent = options.onFrameEvent;
      }

      if (options.onComplete) {
        animatorOptions.onComplete = options.onComplete;
      }

      const animator = new CharacterAnimator<string>(animatorOptions);

      animator.play(state);
      animators.push(animator);
    });

  return {
    animators,
    play: (characterId, state) => {
      let played = false;

      for (const animator of animators) {
        if (animator.characterId !== characterId) {
          continue;
        }

        played = animator.play(state) || played;
      }

      return played;
    },
    cleanup: () => {
      for (const animator of animators) {
        animator.stop();
      }
    },
  };
}

export function resolveCharacterAnimationSource(
  config: SpriteAnimationConfig,
  skin?: Match3Skin,
): CharacterAnimationSource {
  if (!skin) {
    return {
      mode: "placeholder",
      key: config.fallbackKey ?? config.key,
      path: "",
    };
  }

  const sheetResource = getSkinResource(skin, config.key);

  if (hasImageResource(sheetResource)) {
    const source: CharacterAnimationSource = {
      mode: "sheet",
      key: config.key,
      path: sheetResource.path,
    };

    if (config.fallbackKey) {
      const fallbackResource = getSkinResource(skin, config.fallbackKey);
      source.fallbackKey = config.fallbackKey;
      source.fallbackPath = fallbackResource.path;
    }

    return source;
  }

  if (config.fallbackKey) {
    const fallbackResource = getSkinResource(skin, config.fallbackKey);

    if (hasImageResource(fallbackResource)) {
      return {
        mode: "fallbackImage",
        key: config.fallbackKey,
        path: fallbackResource.path,
        fallbackKey: config.fallbackKey,
        fallbackPath: fallbackResource.path,
      };
    }
  }

  return {
    mode: "placeholder",
    key: config.fallbackKey ?? config.key,
    path: "",
  };
}

function getConfigMap(
  characterId: CharacterId,
): Record<string, SpriteAnimationConfig<string>> {
  return (
    characterId === "yizai"
      ? CHARACTER_ANIMATION_CONFIGS.yizai
      : CHARACTER_ANIMATION_CONFIGS.enemy
  ) as Record<string, SpriteAnimationConfig<string>>;
}

function getCharacterIdFromElement(element: HTMLElement): CharacterId | null {
  const characterId = element.dataset.characterId;

  if (characterId === "yizai" || characterId === "enemy") {
    return characterId;
  }

  return null;
}

function clampFrame(frame: number, frameCount: number): number {
  return Math.max(1, Math.min(Math.floor(frame), Math.max(1, frameCount)));
}

function getBackgroundPositionPercent(frame: number, frameCount: number): number {
  if (frameCount <= 1) {
    return 0;
  }

  return ((frame - 1) / (frameCount - 1)) * 100;
}

function getRuntimeEventId(event: CharacterAnimationRuntimeEvent): string {
  return [
    event.characterId,
    event.animation,
    event.frame,
    event.type,
    event.key,
    event.anchor ?? "",
  ].join(":");
}

function updateSlotStateClass(
  element: HTMLElement,
  characterId: CharacterId,
  state: string,
): void {
  const slotSelector = characterId === "yizai" ? ".player-slot" : ".enemy-slot";
  const prefix = characterId === "yizai" ? "yizai-state-" : "enemy-state-";
  const slot = element.closest(slotSelector);

  if (!slot) {
    return;
  }

  for (const className of [...slot.classList]) {
    if (className.startsWith(prefix)) {
      slot.classList.remove(className);
    }
  }

  slot.classList.add(`${prefix}${state}`);
}
