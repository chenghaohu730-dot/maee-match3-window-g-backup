import { access, mkdir, readdir, unlink, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import process from "node:process";
import { pathToFileURL } from "node:url";
import sharp from "sharp";
import {
  frameFileName,
  selectVideoSpriteActions,
  validateVideoSpriteActionShape,
  type FrameAlignmentSettings,
  type VideoSpriteActionConfig,
} from "./videoToSpriteConfig.ts";

export interface AlignFramesResult {
  action: string;
  outputDir: string;
  frameCount: number;
  skipped: boolean;
}

interface AlphaBBox {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
  width: number;
  height: number;
}

interface PlacementPlan {
  cropLeft: number;
  cropTop: number;
  cropWidth: number;
  cropHeight: number;
  scale: number;
  scaledWidth: number;
  scaledHeight: number;
  left: number;
  top: number;
}

export async function alignVideoFrames(
  actions: readonly VideoSpriteActionConfig[] = selectVideoSpriteActions(),
  rootDir = process.cwd(),
): Promise<AlignFramesResult[]> {
  const results: AlignFramesResult[] = [];

  for (const action of actions) {
    results.push(await alignActionFrames(action, rootDir));
  }

  return results;
}

export async function alignActionFrames(
  action: VideoSpriteActionConfig,
  rootDir = process.cwd(),
): Promise<AlignFramesResult> {
  validateVideoSpriteActionShape(action);

  const inputDir = resolve(rootDir, action.cutoutDir);
  const outputDir = resolve(rootDir, action.renderDir);
  const debugDir = resolve(rootDir, action.debugDir);
  const frameNames = await readFrameNames(inputDir, action.frameCount, action.action);

  if (frameNames.length === 0) {
    console.warn(
      `[video:align:warning] ${action.action}: no cutout frames in ${inputDir}; skipping`,
    );
    return {
      action: action.action,
      outputDir,
      frameCount: 0,
      skipped: true,
    };
  }

  await mkdir(outputDir, { recursive: true });
  await mkdir(debugDir, { recursive: true });
  await removePngFiles(outputDir);

  const framePaths = frameNames.map((frameName) => resolve(inputDir, frameName));
  const frameBBoxes = await Promise.all(framePaths.map(readAlphaBBox));
  const presentBBoxes = frameBBoxes.filter((bbox): bbox is AlphaBBox => bbox !== null);

  if (presentBBoxes.length === 0) {
    throw new Error(`${action.action}: all cutout frames are fully transparent`);
  }

  const unionBBox = unionAlphaBBoxes(presentBBoxes);
  const plan = buildPlacementPlan(unionBBox, action.alignment);

  for (let index = 0; index < framePaths.length; index++) {
    await writeAlignedFrame(
      framePaths[index] ?? "",
      resolve(outputDir, frameFileName(index)),
      plan,
      action.alignment,
    );
  }

  await writeFile(
    resolve(debugDir, `${action.action}_align_bboxes.json`),
    `${JSON.stringify(
      {
        action: action.action,
        alignment: action.alignment,
        unionBBox,
        placement: plan,
        frames: frameNames.map((frameName, index) => ({
          frame: frameName,
          bbox: frameBBoxes[index],
        })),
      },
      null,
      2,
    )}\n`,
    "utf8",
  );

  return {
    action: action.action,
    outputDir,
    frameCount: frameNames.length,
    skipped: false,
  };
}

export async function readAlphaBBox(
  inputPath: string,
  alphaThreshold = 8,
): Promise<AlphaBBox | null> {
  const { data, info } = await sharp(inputPath)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  if (info.channels !== 4) {
    throw new Error(`${inputPath}: expected RGBA input after alpha normalization`);
  }

  let minX = info.width;
  let minY = info.height;
  let maxX = -1;
  let maxY = -1;

  for (let y = 0; y < info.height; y++) {
    for (let x = 0; x < info.width; x++) {
      const alpha = data[(y * info.width + x) * 4 + 3] ?? 0;

      if (alpha <= alphaThreshold) {
        continue;
      }

      minX = Math.min(minX, x);
      minY = Math.min(minY, y);
      maxX = Math.max(maxX, x);
      maxY = Math.max(maxY, y);
    }
  }

  if (maxX < minX || maxY < minY) {
    return null;
  }

  return {
    minX,
    minY,
    maxX,
    maxY,
    width: maxX - minX + 1,
    height: maxY - minY + 1,
  };
}

export function buildPlacementPlan(
  unionBBox: AlphaBBox,
  alignment: FrameAlignmentSettings,
): PlacementPlan {
  const cropLeft = unionBBox.minX - alignment.padding;
  const cropTop = unionBBox.minY - alignment.padding;
  const cropWidth = unionBBox.width + alignment.padding * 2;
  const cropHeight = unionBBox.height + alignment.padding * 2;
  const maxWidth = alignment.allowRightEffectSpace
    ? alignment.canvasWidth - alignment.padding
    : alignment.canvasWidth - alignment.padding * 2;
  const maxHeight = alignment.baselineY - alignment.padding;
  const scale = Math.min(maxWidth / cropWidth, maxHeight / cropHeight);
  const scaledWidth = Math.max(1, Math.round(cropWidth * scale));
  const scaledHeight = Math.max(1, Math.round(cropHeight * scale));
  const unclampedLeft = Math.round(
    (alignment.canvasWidth - scaledWidth) / 2 + alignment.xOffset,
  );
  const left = clamp(unclampedLeft, 0, alignment.canvasWidth - scaledWidth);
  const top = clamp(
    Math.round(alignment.baselineY - scaledHeight),
    0,
    alignment.canvasHeight - scaledHeight,
  );

  return {
    cropLeft,
    cropTop,
    cropWidth,
    cropHeight,
    scale,
    scaledWidth,
    scaledHeight,
    left,
    top,
  };
}

async function writeAlignedFrame(
  inputPath: string,
  outputPath: string,
  plan: PlacementPlan,
  alignment: FrameAlignmentSettings,
): Promise<void> {
  const cropped = await sharp({
    create: {
      width: plan.cropWidth,
      height: plan.cropHeight,
      channels: 4,
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    },
  })
    .composite([
      {
        input: inputPath,
        left: -plan.cropLeft,
        top: -plan.cropTop,
      },
    ])
    .resize(plan.scaledWidth, plan.scaledHeight, {
      fit: "fill",
      kernel: "lanczos3",
    })
    .png()
    .toBuffer();

  await sharp({
    create: {
      width: alignment.canvasWidth,
      height: alignment.canvasHeight,
      channels: 4,
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    },
  })
    .composite([{ input: cropped, left: plan.left, top: plan.top }])
    .png({ compressionLevel: 9, adaptiveFiltering: true, force: true })
    .toFile(outputPath);
}

function unionAlphaBBoxes(bboxes: readonly AlphaBBox[]): AlphaBBox {
  const minX = Math.min(...bboxes.map((bbox) => bbox.minX));
  const minY = Math.min(...bboxes.map((bbox) => bbox.minY));
  const maxX = Math.max(...bboxes.map((bbox) => bbox.maxX));
  const maxY = Math.max(...bboxes.map((bbox) => bbox.maxY));

  return {
    minX,
    minY,
    maxX,
    maxY,
    width: maxX - minX + 1,
    height: maxY - minY + 1,
  };
}

async function readFrameNames(
  inputDir: string,
  frameCount: number,
  action: string,
): Promise<string[]> {
  if (!(await exists(inputDir))) {
    return [];
  }

  const fileNames = (await readdir(inputDir))
    .filter((fileName) => fileName.toLowerCase().endsWith(".png"))
    .sort((a, b) => a.localeCompare(b));

  if (fileNames.length === 0) {
    return [];
  }

  if (fileNames.length !== frameCount) {
    throw new Error(
      `${action}: found ${fileNames.length} cutout frame(s), expected ${frameCount}`,
    );
  }

  for (let index = 0; index < frameCount; index++) {
    const expected = frameFileName(index);

    if (fileNames[index] !== expected) {
      throw new Error(
        `${action}: expected ${expected} at position ${index + 1}, found ${
          fileNames[index] ?? "nothing"
        }`,
      );
    }
  }

  return fileNames;
}

async function removePngFiles(dir: string): Promise<void> {
  let fileNames: string[];

  try {
    fileNames = await readdir(dir);
  } catch {
    return;
  }

  await Promise.all(
    fileNames
      .filter((fileName) => fileName.toLowerCase().endsWith(".png"))
      .map((fileName) => unlink(resolve(dir, fileName))),
  );
}

async function exists(path: string): Promise<boolean> {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function formatCause(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

async function main(): Promise<void> {
  try {
    const results = await alignVideoFrames();

    for (const result of results) {
      const status = result.skipped ? "skipped" : `${result.frameCount} frame(s)`;
      console.log(
        `[video:align] ${result.action}: ${status} -> ${result.outputDir}`,
      );
    }
  } catch (error) {
    console.error(`[video:align:error] ${formatCause(error)}`);
    process.exitCode = 1;
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await main();
}
