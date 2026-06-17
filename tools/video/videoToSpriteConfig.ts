import process from "node:process";

export const VIDEO_ACTIONS = [
  "idle",
  "attack",
  "skill",
  "ultimate",
  "hurt",
] as const;

export type VideoSpriteAction = (typeof VIDEO_ACTIONS)[number];
export type VideoFrameSampleMode = "even" | "times";

export interface ChromaKeySettings {
  keyColor: string;
  tolerance: number;
  edgeFeather: number;
  despill: boolean;
}

export interface FrameAlignmentSettings {
  canvasWidth: number;
  canvasHeight: number;
  baselineY: number;
  padding: number;
  xOffset: number;
  allowRightEffectSpace: boolean;
}

export interface VideoSpriteActionConfig {
  action: VideoSpriteAction;
  name: string;
  inputVideo: string;
  extractedDir: string;
  cutoutDir: string;
  renderDir: string;
  debugDir: string;
  outputSheet: string;
  frameWidth: number;
  frameHeight: number;
  frameCount: number;
  fps: number;
  columns: number;
  rows: number;
  loop: boolean;
  sampleMode: VideoFrameSampleMode;
  sampleTimes: readonly number[];
  sampleStartTime?: number;
  sampleEndTime?: number;
  chromaKey: ChromaKeySettings;
  alignment: FrameAlignmentSettings;
  maxBytes: number;
}

const FRAME_WIDTH = 512;
const FRAME_HEIGHT = 512;
const BASE_DIR = "assets-src/yizai_video";

const DEFAULT_CHROMA_KEY: ChromaKeySettings = {
  keyColor: "#00ff00",
  tolerance: 70,
  edgeFeather: 1.5,
  despill: true,
};

const DEFAULT_ALIGNMENT: FrameAlignmentSettings = {
  canvasWidth: FRAME_WIDTH,
  canvasHeight: FRAME_HEIGHT,
  baselineY: 470,
  padding: 32,
  xOffset: 0,
  allowRightEffectSpace: false,
};

function defineAction(
  action: VideoSpriteAction,
  frameCount: number,
  fps: number,
  columns: number,
  rows: number,
  loop: boolean,
  options: Partial<
    Pick<
      VideoSpriteActionConfig,
      "alignment" | "chromaKey" | "maxBytes" | "sampleStartTime" | "sampleEndTime"
    >
  > = {},
): VideoSpriteActionConfig {
  return {
    action,
    name: `yizai_hero_${action}`,
    inputVideo: `${BASE_DIR}/input/yizai_${action}.mp4`,
    extractedDir: `${BASE_DIR}/extracted/${action}`,
    cutoutDir: `${BASE_DIR}/extracted/${action}_cutout`,
    renderDir: `${BASE_DIR}/renders/${action}`,
    debugDir: `${BASE_DIR}/debug/${action}`,
    outputSheet: `public/assets/fairy/yizai/pro/yizai_hero_${action}_sheet.png`,
    frameWidth: FRAME_WIDTH,
    frameHeight: FRAME_HEIGHT,
    frameCount,
    fps,
    columns,
    rows,
    loop,
    sampleMode: "even",
    sampleTimes: [],
    ...(options.sampleStartTime !== undefined
      ? { sampleStartTime: options.sampleStartTime }
      : {}),
    ...(options.sampleEndTime !== undefined
      ? { sampleEndTime: options.sampleEndTime }
      : {}),
    chromaKey: {
      ...DEFAULT_CHROMA_KEY,
      ...options.chromaKey,
    },
    alignment: {
      ...DEFAULT_ALIGNMENT,
      ...options.alignment,
    },
    maxBytes: options.maxBytes ?? 32 * 1024 * 1024,
  };
}

export const videoSpriteActionConfigs = {
  idle: defineAction("idle", 12, 12, 6, 2, true, {
    maxBytes: 36 * 1024 * 1024,
  }),
  attack: defineAction("attack", 16, 20, 8, 2, false, {
    alignment: {
      ...DEFAULT_ALIGNMENT,
      xOffset: -24,
      allowRightEffectSpace: true,
    },
    maxBytes: 48 * 1024 * 1024,
  }),
  skill: defineAction("skill", 24, 20, 8, 3, false, {
    maxBytes: 72 * 1024 * 1024,
  }),
  ultimate: defineAction("ultimate", 32, 24, 8, 4, false, {
    maxBytes: 96 * 1024 * 1024,
  }),
  hurt: defineAction("hurt", 12, 20, 6, 2, false, {
    maxBytes: 36 * 1024 * 1024,
  }),
} as const satisfies Record<VideoSpriteAction, VideoSpriteActionConfig>;

export const videoSpriteActionList = VIDEO_ACTIONS.map(
  (action) => videoSpriteActionConfigs[action],
);

export function frameFileName(index: number): string {
  return `frame_${String(index + 1).padStart(4, "0")}.png`;
}

export function isVideoSpriteAction(value: string): value is VideoSpriteAction {
  return (VIDEO_ACTIONS as readonly string[]).includes(value);
}

export function readActionFilter(
  argv: readonly string[] = process.argv.slice(2),
  env: NodeJS.ProcessEnv = process.env,
): VideoSpriteAction | undefined {
  let rawAction = env.ACTION ?? env.npm_config_action;

  for (let index = 0; index < argv.length; index++) {
    const arg = argv[index];

    if (arg === "--action") {
      rawAction = argv[index + 1];
      break;
    }

    if (arg?.startsWith("--action=")) {
      rawAction = arg.slice("--action=".length);
      break;
    }
  }

  if (!rawAction) {
    return undefined;
  }

  if (!isVideoSpriteAction(rawAction)) {
    throw new Error(
      `Unknown video action "${rawAction}". Expected one of: ${VIDEO_ACTIONS.join(
        ", ",
      )}`,
    );
  }

  return rawAction;
}

export function selectVideoSpriteActions(
  actionFilter: VideoSpriteAction | undefined = readActionFilter(),
): readonly VideoSpriteActionConfig[] {
  return actionFilter
    ? [videoSpriteActionConfigs[actionFilter]]
    : videoSpriteActionList;
}

export function validateVideoSpriteActionShape(
  config: VideoSpriteActionConfig,
): void {
  for (const [field, value] of Object.entries({
    frameWidth: config.frameWidth,
    frameHeight: config.frameHeight,
    frameCount: config.frameCount,
    fps: config.fps,
    columns: config.columns,
    rows: config.rows,
    baselineY: config.alignment.baselineY,
    padding: config.alignment.padding,
  })) {
    if (!Number.isFinite(value) || value <= 0) {
      throw new Error(`${config.action}: ${field} must be a positive number`);
    }
  }

  if (config.columns * config.rows !== config.frameCount) {
    throw new Error(
      `${config.action}: columns * rows must equal frameCount (${config.columns} * ${config.rows} !== ${config.frameCount})`,
    );
  }

  if (
    config.sampleStartTime !== undefined &&
    (!Number.isFinite(config.sampleStartTime) || config.sampleStartTime < 0)
  ) {
    throw new Error(`${config.action}: sampleStartTime must be >= 0`);
  }

  if (
    config.sampleEndTime !== undefined &&
    (!Number.isFinite(config.sampleEndTime) || config.sampleEndTime <= 0)
  ) {
    throw new Error(`${config.action}: sampleEndTime must be > 0`);
  }

  if (
    config.sampleStartTime !== undefined &&
    config.sampleEndTime !== undefined &&
    config.sampleEndTime <= config.sampleStartTime
  ) {
    throw new Error(
      `${config.action}: sampleEndTime must be greater than sampleStartTime`,
    );
  }

  if (config.alignment.baselineY > config.alignment.canvasHeight) {
    throw new Error(
      `${config.action}: baselineY ${config.alignment.baselineY} exceeds canvas height ${config.alignment.canvasHeight}`,
    );
  }
}
