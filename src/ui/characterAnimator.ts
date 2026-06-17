import type { Match3Skin } from "../skins/skinTypes.ts";
import type { AssetKey } from "../assets/assetManifest.ts";
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
  SpriteAnimationFallbackSheetConfig,
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

interface SpritePlaybackSpec {
  frameCount: number;
  columns: number;
  rows: number;
  fps: number;
}

export class CharacterAnimator<StateName extends string = string> {
  private currentState: StateName | undefined;
  private currentConfig: SpriteAnimationConfig<StateName> | undefined;
  private currentPlayback: SpritePlaybackSpec | undefined;
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

    const playback = this.currentPlayback ?? resolvePlaybackSpec(this.currentConfig);
    const clampedFrame = clampFrame(frame, playback.frameCount);

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
    const source = resolveCharacterAnimationSource(config, this.options.skin);
    this.currentPlayback = resolvePlaybackSpec(config, source);
    this.applyElementState(state, config, source, this.currentPlayback);
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

    const frameDurationMs =
      1000 / Math.max(this.currentPlayback?.fps ?? this.currentConfig.fps, 1);

    const step = (): void => {
      if (!this.currentConfig) {
        return;
      }

      const nextFrame = this.lastFrame + 1;

      if (
        nextFrame >
        (this.currentPlayback?.frameCount ?? this.currentConfig.frameCount)
      ) {
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
    source: CharacterAnimationSource,
    playback: SpritePlaybackSpec,
  ): void {
    const element = this.options.element;

    if (!element) {
      return;
    }

    element.dataset.characterId = this.options.characterId;
    element.dataset.animationState = state;
    element.dataset.animationMode = source.mode;
    element.dataset.assetKey = source.key;

    if (config.fallbackSheetKey) {
      element.dataset.fallbackSheetKey = config.fallbackSheetKey;
    } else {
      delete element.dataset.fallbackSheetKey;
    }

    if (source.fallbackKey) {
      element.dataset.fallbackKey = source.fallbackKey;
    } else {
      delete element.dataset.fallbackKey;
    }

    element.dataset.frameCount = String(playback.frameCount);
    element.dataset.frameWidth = String(config.frameWidth);
    element.dataset.frameHeight = String(config.frameHeight);
    element.dataset.spriteColumns = String(playback.columns);
    element.dataset.spriteRows = String(playback.rows);
    element.dataset.staticOnly = config.staticOnly ? "true" : "false";
    element.dataset.animationDurationMs = String(
      getSpriteAnimationDurationMs({
        frameCount: playback.frameCount,
        fps: playback.fps,
      }),
    );
    element.style.setProperty("--character-frame-count", String(playback.frameCount));
    element.style.setProperty("--character-sheet-columns", String(playback.columns));
    element.style.setProperty("--character-sheet-rows", String(playback.rows));
    element.style.setProperty("--character-frame-width", `${config.frameWidth}`);
    element.style.setProperty("--character-frame-height", `${config.frameHeight}`);
    updateSlotStateClass(element, this.options.characterId, state);

    if (source.mode === "sheet") {
      element.classList.add("character-sheet");
      element.style.setProperty("--character-sheet-url", `url('${source.path}')`);
      element.style.backgroundImage = `url("${source.path}")`;
      element.style.backgroundRepeat = "no-repeat";
      element.style.backgroundSize = `${playback.columns * 100}% ${
        playback.rows * 100
      }%`;
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

    const playback = this.currentPlayback ?? resolvePlaybackSpec(this.currentConfig);
    element.style.backgroundPosition = getBackgroundPositionPercent(
      frame,
      playback.columns,
      playback.rows,
    );
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
        configs: getConfigMap(characterId, element),
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
      key: config.fallbackKey ?? config.fallbackSheetKey ?? config.key,
      path: "",
    };
  }

  const sheetResource = getSkinResource(skin, config.key);

  if (config.staticOnly) {
    if (hasImageResource(sheetResource)) {
      const source: CharacterAnimationSource = {
        mode: "fallbackImage",
        key: config.key,
        path: sheetResource.path,
      };

      if (config.fallbackKey) {
        source.fallbackKey = config.fallbackKey;
        source.fallbackPath = getSkinResource(skin, config.fallbackKey).path;
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

  if (hasImageResource(sheetResource)) {
    return createSheetSource(config.key, sheetResource.path, config, skin);
  }

  if (config.fallbackSheetKey) {
    const fallbackSheetResource = getSkinResource(skin, config.fallbackSheetKey);

    if (hasImageResource(fallbackSheetResource)) {
      return createSheetSource(
        config.fallbackSheetKey,
        fallbackSheetResource.path,
        config,
        skin,
        config.fallbackSheet,
      );
    }
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
    key: config.fallbackKey ?? config.fallbackSheetKey ?? config.key,
    path: "",
  };
}

function createSheetSource(
  key: SpriteAnimationConfig["key"],
  path: string,
  config: SpriteAnimationConfig,
  skin: Match3Skin,
  sheet?: SpriteAnimationFallbackSheetConfig,
): CharacterAnimationSource {
  const source: CharacterAnimationSource = {
    mode: "sheet",
    key,
    path,
    sheet: sheet ?? resolveDefaultSheetConfig(config),
  };

  if (config.fallbackSheetKey) {
    const fallbackSheetResource = getSkinResource(skin, config.fallbackSheetKey);
    source.fallbackSheetKey = config.fallbackSheetKey;
    source.fallbackSheetPath = fallbackSheetResource.path;
  }

  if (config.fallbackKey) {
    const fallbackResource = getSkinResource(skin, config.fallbackKey);
    source.fallbackKey = config.fallbackKey;
    source.fallbackPath = fallbackResource.path;
  }

  return source;
}

function getConfigMap(
  characterId: CharacterId,
  element?: HTMLElement,
): Record<string, SpriteAnimationConfig<string>> {
  if (characterId === "yizai") {
    return CHARACTER_ANIMATION_CONFIGS.yizai as Record<
      string,
      SpriteAnimationConfig<string>
    >;
  }

  return createEnemyConfigMap(element) as Record<
    string,
    SpriteAnimationConfig<string>
  >;
}

function createEnemyConfigMap(
  element: HTMLElement | undefined,
): typeof CHARACTER_ANIMATION_CONFIGS.enemy {
  if (!element) {
    return CHARACTER_ANIMATION_CONFIGS.enemy;
  }

  return {
    idle: createEnemyStateConfig(element, "idle"),
    hit: createEnemyStateConfig(element, "hit"),
    attack: createEnemyStateConfig(element, "attack"),
    defeat: createEnemyStateConfig(element, "defeat"),
  };
}

function createEnemyStateConfig(
  element: HTMLElement,
  state: keyof typeof CHARACTER_ANIMATION_CONFIGS.enemy,
): (typeof CHARACTER_ANIMATION_CONFIGS.enemy)[typeof state] {
  const base = CHARACTER_ANIMATION_CONFIGS.enemy[state];
  const assetKey = getEnemyStateAssetKey(element, state);

  if (!assetKey) {
    return base;
  }

  const { fallbackSheetKey: _fallbackSheetKey, ...baseWithoutSheet } = base;

  return {
    ...baseWithoutSheet,
    key: assetKey,
    fallbackKey: base.fallbackKey ?? base.key,
    staticOnly: true,
  };
}

function getEnemyStateAssetKey(
  element: HTMLElement,
  state: keyof typeof CHARACTER_ANIMATION_CONFIGS.enemy,
): AssetKey | undefined {
  switch (state) {
    case "idle":
      return element.dataset.enemyAssetIdle as AssetKey | undefined;
    case "hit":
      return element.dataset.enemyAssetHit as AssetKey | undefined;
    case "attack":
      return element.dataset.enemyAssetAttack as AssetKey | undefined;
    case "defeat":
      return element.dataset.enemyAssetDefeat as AssetKey | undefined;
  }
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

function resolvePlaybackSpec(
  config: SpriteAnimationConfig,
  source?: CharacterAnimationSource,
): SpritePlaybackSpec {
  const sheet = source?.sheet ?? resolveDefaultSheetConfig(config);

  return {
    frameCount: sheet.frameCount,
    columns: sheet.columns,
    rows: sheet.rows,
    fps: sheet.fps ?? config.fps,
  };
}

function resolveDefaultSheetConfig(
  config: SpriteAnimationConfig,
): SpriteAnimationFallbackSheetConfig {
  return {
    frameCount: config.frameCount,
    columns: config.columns ?? config.frameCount,
    rows: config.rows ?? 1,
    fps: config.fps,
  };
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
