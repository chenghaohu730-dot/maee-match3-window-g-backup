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
  edgeFadePx?: number;
  subjectScale?: FrameSubjectScaleSettings;
}

export interface FrameSubjectBoundsSettings {
  left: number;
  top: number;
  right: number;
  bottom: number;
}

export interface FrameSubjectScaleSettings {
  fixedSubjectHeight: number;
  subjectBounds: FrameSubjectBoundsSettings;
  protectedBounds: FrameSubjectBoundsSettings;
  protectedPadding: number;
  alphaThreshold?: number;
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
const YIZAI_VIDEO_SAMPLE_START_TIME = 0;
const YIZAI_VIDEO_SAMPLE_END_TIME = 4;

const DEFAULT_CHROMA_KEY: ChromaKeySettings = {
  keyColor: "#00ff00",
  tolerance: 90,
  edgeFeather: 0.8,
  despill: true,
};

const DEFAULT_ALIGNMENT: FrameAlignmentSettings = {
  canvasWidth: FRAME_WIDTH,
  canvasHeight: FRAME_HEIGHT,
  baselineY: 493,
  padding: 32,
  xOffset: 0,
  allowRightEffectSpace: false,
};

const DEFAULT_SUBJECT_BOUNDS: FrameSubjectBoundsSettings = {
  left: 0.28,
  top: 0.18,
  right: 0.66,
  bottom: 0.98,
};

const FULL_FRAME_BOUNDS: FrameSubjectBoundsSettings = {
  left: 0,
  top: 0,
  right: 1,
  bottom: 1,
};

const FIXED_SUBJECT_HEIGHT = 300;

function defineAction(
  action: VideoSpriteAction,
  frameCount: number,
  fps: number,
  columns: number,
  rows: number,
  loop: boolean,
  options: Partial<
    Pick<VideoSpriteActionConfig, "maxBytes" | "sampleStartTime" | "sampleEndTime">
  > = {},
  visualOptions: {
    alignment?: Partial<FrameAlignmentSettings>;
    chromaKey?: Partial<ChromaKeySettings>;
  } = {},
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
      ...visualOptions.chromaKey,
    },
    alignment: mergeAlignment(visualOptions.alignment),
    maxBytes: options.maxBytes ?? 32 * 1024 * 1024,
  };
}

function mergeAlignment(
  alignment: Partial<FrameAlignmentSettings> | undefined,
): FrameAlignmentSettings {
  const subjectScale = alignment?.subjectScale;

  return {
    ...DEFAULT_ALIGNMENT,
    ...alignment,
    ...(subjectScale
      ? {
          subjectScale: {
            ...subjectScale,
            subjectBounds: {
              ...subjectScale.subjectBounds,
            },
            protectedBounds: {
              ...subjectScale.protectedBounds,
            },
          },
        }
      : {}),
  };
}

function fixedSubjectScale(
  protectedBounds: FrameSubjectBoundsSettings = FULL_FRAME_BOUNDS,
): FrameSubjectScaleSettings {
  return {
    fixedSubjectHeight: FIXED_SUBJECT_HEIGHT,
    subjectBounds: DEFAULT_SUBJECT_BOUNDS,
    protectedBounds,
    protectedPadding: 0,
    alphaThreshold: 8,
  };
}

export const videoSpriteActionConfigs = {
  idle: defineAction(
    "idle",
    12,
    12,
    6,
    2,
    true,
    {
      sampleStartTime: YIZAI_VIDEO_SAMPLE_START_TIME,
      sampleEndTime: YIZAI_VIDEO_SAMPLE_END_TIME,
      maxBytes: 36 * 1024 * 1024,
    },
    {
      alignment: {
        subjectScale: fixedSubjectScale(),
      },
    },
  ),
  attack: defineAction("attack", 16, 20, 8, 2, false, {
    sampleStartTime: YIZAI_VIDEO_SAMPLE_START_TIME,
    sampleEndTime: YIZAI_VIDEO_SAMPLE_END_TIME,
    maxBytes: 48 * 1024 * 1024,
  }, {
    alignment: {
      xOffset: -12,
      allowRightEffectSpace: true,
      subjectScale: fixedSubjectScale({
        left: 0.113,
        top: 0.04,
        right: 0.861,
        bottom: 0.98,
      }),
    },
  }),
  skill: defineAction("skill", 24, 20, 8, 3, false, {
    sampleStartTime: YIZAI_VIDEO_SAMPLE_START_TIME,
    sampleEndTime: YIZAI_VIDEO_SAMPLE_END_TIME,
    maxBytes: 72 * 1024 * 1024,
  }, {
    alignment: {
      edgeFadePx: 8,
      xOffset: -8,
      baselineY: 503,
      subjectScale: fixedSubjectScale({
        left: 0.2,
        top: 0.04,
        right: 0.84,
        bottom: 0.98,
      }),
    },
  }),
  ultimate: defineAction("ultimate", 32, 24, 8, 4, false, {
    sampleStartTime: YIZAI_VIDEO_SAMPLE_START_TIME,
    sampleEndTime: YIZAI_VIDEO_SAMPLE_END_TIME,
    maxBytes: 96 * 1024 * 1024,
  }, {
    alignment: {
      edgeFadePx: 8,
      xOffset: -6,
      baselineY: 505,
      subjectScale: fixedSubjectScale({
        left: 0.17,
        top: 0,
        right: 0.82,
        bottom: 0.98,
      }),
    },
  }),
  hurt: defineAction("hurt", 12, 20, 6, 2, false, {
    sampleStartTime: YIZAI_VIDEO_SAMPLE_START_TIME,
    sampleEndTime: YIZAI_VIDEO_SAMPLE_END_TIME,
    maxBytes: 36 * 1024 * 1024,
  }, {
    alignment: {
      xOffset: -20,
      subjectScale: fixedSubjectScale(),
    },
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

  if (
    config.alignment.edgeFadePx !== undefined &&
    (!Number.isFinite(config.alignment.edgeFadePx) ||
      config.alignment.edgeFadePx < 0)
  ) {
    throw new Error(`${config.action}: edgeFadePx must be >= 0`);
  }

  const subjectScale = config.alignment.subjectScale;

  if (subjectScale) {
    if (
      !Number.isFinite(subjectScale.fixedSubjectHeight) ||
      subjectScale.fixedSubjectHeight <= 0
    ) {
      throw new Error(
        `${config.action}: fixedSubjectHeight must be a positive number`,
      );
    }

    if (
      !Number.isFinite(subjectScale.protectedPadding) ||
      subjectScale.protectedPadding < 0
    ) {
      throw new Error(
        `${config.action}: protectedPadding must be a non-negative number`,
      );
    }

    if (
      subjectScale.alphaThreshold !== undefined &&
      (!Number.isFinite(subjectScale.alphaThreshold) ||
        subjectScale.alphaThreshold < 0)
    ) {
      throw new Error(
        `${config.action}: alphaThreshold must be a non-negative number`,
      );
    }

    validateFrameBounds(
      config.action,
      "subjectBounds",
      subjectScale.subjectBounds,
    );
    validateFrameBounds(
      config.action,
      "protectedBounds",
      subjectScale.protectedBounds,
    );
  }
}

function validateFrameBounds(
  action: string,
  field: string,
  bounds: FrameSubjectBoundsSettings,
): void {
  for (const [name, value] of Object.entries(bounds)) {
    if (!Number.isFinite(value) || value < 0 || value > 1) {
      throw new Error(`${action}: ${field}.${name} must be between 0 and 1`);
    }
  }

  if (bounds.right <= bounds.left) {
    throw new Error(`${action}: ${field}.right must be greater than left`);
  }

  if (bounds.bottom <= bounds.top) {
    throw new Error(`${action}: ${field}.bottom must be greater than top`);
  }
}
