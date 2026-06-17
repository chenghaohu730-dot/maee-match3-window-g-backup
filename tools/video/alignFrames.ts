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
  type FrameSubjectBoundsSettings,
  type FrameSubjectScaleSettings,
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
  const frameBBoxes = await Promise.all(
    framePaths.map((framePath) => readAlphaBBox(framePath)),
  );
  const presentBBoxes = frameBBoxes.filter((bbox): bbox is AlphaBBox => bbox !== null);

  if (presentBBoxes.length === 0) {
    throw new Error(`${action.action}: all cutout frames are fully transparent`);
  }

  const unionBBox = unionAlphaBBoxes(presentBBoxes);
  const subjectScale = action.alignment.subjectScale;
  const subjectFrameBBoxes = subjectScale
    ? await Promise.all(
        framePaths.map((framePath) =>
          readAlphaBBox(
            framePath,
            subjectScale.alphaThreshold ?? 8,
            subjectScale.subjectBounds,
          ),
        ),
      )
    : frameBBoxes;
  const protectedFrameBBoxes = subjectScale
    ? await Promise.all(
        framePaths.map((framePath) =>
          readAlphaBBox(
            framePath,
            subjectScale.alphaThreshold ?? 8,
            subjectScale.protectedBounds,
          ),
        ),
      )
    : subjectFrameBBoxes;
  const presentSubjectBBoxes = subjectFrameBBoxes.filter(
    (bbox): bbox is AlphaBBox => bbox !== null,
  );
  const presentProtectedBBoxes = protectedFrameBBoxes.filter(
    (bbox): bbox is AlphaBBox => bbox !== null,
  );
  const subjectBBox =
    presentSubjectBBoxes.length > 0
      ? unionAlphaBBoxes(presentSubjectBBoxes)
      : unionBBox;
  const protectedBBox =
    presentProtectedBBoxes.length > 0
      ? unionAlphaBBoxes(presentProtectedBBoxes)
      : subjectBBox;
  const plan = buildPlacementPlan(
    unionBBox,
    action.alignment,
    subjectBBox,
    protectedBBox,
  );

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
        subjectBBox,
        protectedBBox,
        placement: plan,
        frames: frameNames.map((frameName, index) => ({
          frame: frameName,
          bbox: frameBBoxes[index],
          subjectBBox: subjectFrameBBoxes[index],
          protectedBBox: protectedFrameBBoxes[index],
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
  bounds?: FrameSubjectBoundsSettings,
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
  const scanBounds = resolveScanBounds(bounds, info.width, info.height);

  for (let y = scanBounds.minY; y <= scanBounds.maxY; y++) {
    for (let x = scanBounds.minX; x <= scanBounds.maxX; x++) {
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
  effectBBox: AlphaBBox,
  alignment: FrameAlignmentSettings,
  subjectBBox: AlphaBBox = effectBBox,
  protectedBBox: AlphaBBox = subjectBBox,
): PlacementPlan {
  if (alignment.subjectScale) {
    return buildFixedSubjectPlacementPlan(
      effectBBox,
      subjectBBox,
      protectedBBox,
      alignment,
      alignment.subjectScale,
    );
  }

  const cropLeft = effectBBox.minX - alignment.padding;
  const cropTop = effectBBox.minY - alignment.padding;
  const cropWidth = effectBBox.width + alignment.padding * 2;
  const cropHeight = effectBBox.height + alignment.padding * 2;
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

function buildFixedSubjectPlacementPlan(
  _effectBBox: AlphaBBox,
  subjectBBox: AlphaBBox,
  protectedBBox: AlphaBBox,
  alignment: FrameAlignmentSettings,
  subjectScale: FrameSubjectScaleSettings,
): PlacementPlan {
  const desiredScale = subjectScale.fixedSubjectHeight / subjectBBox.height;
  const cropWidth = Math.max(1, Math.round(alignment.canvasWidth / desiredScale));
  const cropHeight = Math.max(1, Math.round(alignment.canvasHeight / desiredScale));
  const scaleX = alignment.canvasWidth / cropWidth;
  const scaleY = alignment.canvasHeight / cropHeight;
  const subjectCenterX = (subjectBBox.minX + subjectBBox.maxX + 1) / 2;
  const subjectBottomY = subjectBBox.maxY + 1;
  const targetCenterX = alignment.canvasWidth / 2 + alignment.xOffset;
  const protectedPaddingX = subjectScale.protectedPadding / scaleX;

  let cropLeft = Math.round(subjectCenterX - targetCenterX / scaleX);
  cropLeft = alignCropStartToInclude(
    cropLeft,
    cropWidth,
    protectedBBox.minX,
    protectedBBox.maxX + 1,
    protectedPaddingX,
  );

  const cropTop = Math.round(subjectBottomY - alignment.baselineY / scaleY);

  return {
    cropLeft,
    cropTop,
    cropWidth,
    cropHeight,
    scale: scaleY,
    scaledWidth: alignment.canvasWidth,
    scaledHeight: alignment.canvasHeight,
    left: 0,
    top: 0,
  };
}

function alignCropStartToInclude(
  cropStart: number,
  cropSize: number,
  protectedMin: number,
  protectedMax: number,
  padding: number,
): number {
  const desiredMin = protectedMin - padding;
  const desiredMax = protectedMax + padding;

  if (desiredMax - desiredMin > cropSize) {
    return Math.round((desiredMin + desiredMax - cropSize) / 2);
  }

  let nextCropStart = cropStart;

  if (nextCropStart > desiredMin) {
    nextCropStart = desiredMin;
  }

  if (nextCropStart + cropSize < desiredMax) {
    nextCropStart = desiredMax - cropSize;
  }

  return Math.round(nextCropStart);
}

async function writeAlignedFrame(
  inputPath: string,
  outputPath: string,
  plan: PlacementPlan,
  alignment: FrameAlignmentSettings,
): Promise<void> {
  const cropped = await createCropBuffer(inputPath, plan);

  const scaled = await sharp(cropped)
    .resize(plan.scaledWidth, plan.scaledHeight, {
      fit: "fill",
      kernel: "lanczos3",
    })
    .png()
    .toBuffer();

  let outputBuffer = await sharp({
    create: {
      width: alignment.canvasWidth,
      height: alignment.canvasHeight,
      channels: 4,
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    },
  })
    .composite([{ input: scaled, left: plan.left, top: plan.top }])
    .png({ compressionLevel: 9, adaptiveFiltering: true, force: true })
    .toBuffer();

  outputBuffer = await applyFrameEdgeFade(outputBuffer, alignment.edgeFadePx ?? 0);

  await sharp(outputBuffer)
    .png({ compressionLevel: 9, adaptiveFiltering: true, force: true })
    .toFile(outputPath);
}

export async function applyFrameEdgeFade(
  input: Buffer,
  fadePx: number,
): Promise<Buffer> {
  const safeFadePx = Math.max(0, Math.floor(fadePx));

  if (safeFadePx <= 0) {
    return input;
  }

  const { data, info } = await sharp(input)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  if (info.channels !== 4) {
    throw new Error("Expected RGBA input after alpha normalization");
  }

  const fadeWidth = Math.min(
    safeFadePx,
    Math.floor(info.width / 2),
    Math.floor(info.height / 2),
  );

  if (fadeWidth <= 0) {
    return input;
  }

  for (let y = 0; y < info.height; y++) {
    for (let x = 0; x < info.width; x++) {
      const edgeDistance = Math.min(x, y, info.width - 1 - x, info.height - 1 - y);

      if (edgeDistance >= fadeWidth) {
        continue;
      }

      const alphaOffset = (y * info.width + x) * 4 + 3;
      const alpha = data[alphaOffset] ?? 0;
      data[alphaOffset] = Math.round(alpha * (edgeDistance / fadeWidth));
    }
  }

  return sharp(data, {
    raw: {
      width: info.width,
      height: info.height,
      channels: 4,
    },
  })
    .png({ compressionLevel: 9, adaptiveFiltering: true, force: true })
    .toBuffer();
}

async function createCropBuffer(
  inputPath: string,
  plan: PlacementPlan,
): Promise<Buffer> {
  const metadata = await sharp(inputPath).metadata();
  const sourceWidth = metadata.width ?? 0;
  const sourceHeight = metadata.height ?? 0;

  if (sourceWidth <= 0 || sourceHeight <= 0) {
    throw new Error(`${inputPath}: image dimensions are unavailable`);
  }

  const sourceLeft = clamp(plan.cropLeft, 0, sourceWidth);
  const sourceTop = clamp(plan.cropTop, 0, sourceHeight);
  const sourceRight = clamp(plan.cropLeft + plan.cropWidth, 0, sourceWidth);
  const sourceBottom = clamp(plan.cropTop + plan.cropHeight, 0, sourceHeight);
  const sourceCropWidth = sourceRight - sourceLeft;
  const sourceCropHeight = sourceBottom - sourceTop;
  const cropBase = sharp({
    create: {
      width: plan.cropWidth,
      height: plan.cropHeight,
      channels: 4,
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    },
  });

  if (sourceCropWidth <= 0 || sourceCropHeight <= 0) {
    return cropBase.png().toBuffer();
  }

  const sourceCrop = await sharp(inputPath)
    .extract({
      left: sourceLeft,
      top: sourceTop,
      width: sourceCropWidth,
      height: sourceCropHeight,
    })
    .png()
    .toBuffer();

  return cropBase
    .composite([
      {
        input: sourceCrop,
        left: sourceLeft - plan.cropLeft,
        top: sourceTop - plan.cropTop,
      },
    ])
    .png({ compressionLevel: 9, adaptiveFiltering: true, force: true })
    .toBuffer();
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

function resolveScanBounds(
  bounds: FrameSubjectBoundsSettings | undefined,
  width: number,
  height: number,
): { minX: number; minY: number; maxX: number; maxY: number } {
  if (!bounds) {
    return {
      minX: 0,
      minY: 0,
      maxX: width - 1,
      maxY: height - 1,
    };
  }

  return {
    minX: clamp(Math.floor(bounds.left * width), 0, width - 1),
    minY: clamp(Math.floor(bounds.top * height), 0, height - 1),
    maxX: clamp(Math.ceil(bounds.right * width) - 1, 0, width - 1),
    maxY: clamp(Math.ceil(bounds.bottom * height) - 1, 0, height - 1),
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
