import { access, mkdir, readdir, unlink } from "node:fs/promises";
import { resolve } from "node:path";
import process from "node:process";
import { pathToFileURL } from "node:url";
import sharp from "sharp";
import {
  frameFileName,
  selectVideoSpriteActions,
  validateVideoSpriteActionShape,
  type ChromaKeySettings,
  type VideoSpriteActionConfig,
} from "./videoToSpriteConfig.ts";

export interface ChromaKeyCutoutResult {
  action: string;
  outputDir: string;
  frameCount: number;
  skipped: boolean;
}

interface RgbColor {
  r: number;
  g: number;
  b: number;
}

export async function cutoutVideoFrames(
  actions: readonly VideoSpriteActionConfig[] = selectVideoSpriteActions(),
  rootDir = process.cwd(),
): Promise<ChromaKeyCutoutResult[]> {
  const results: ChromaKeyCutoutResult[] = [];

  for (const action of actions) {
    results.push(await cutoutActionFrames(action, rootDir));
  }

  return results;
}

export async function cutoutActionFrames(
  action: VideoSpriteActionConfig,
  rootDir = process.cwd(),
): Promise<ChromaKeyCutoutResult> {
  validateVideoSpriteActionShape(action);

  const inputDir = resolve(rootDir, action.extractedDir);
  const outputDir = resolve(rootDir, action.cutoutDir);
  const debugDir = resolve(rootDir, action.debugDir);
  const frameNames = await readFrameNames(inputDir, action.frameCount, action.action);

  if (frameNames.length === 0) {
    console.warn(
      `[video:cutout:warning] ${action.action}: no extracted frames in ${inputDir}; skipping`,
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

  for (let index = 0; index < frameNames.length; index++) {
    const inputPath = resolve(inputDir, frameNames[index] ?? frameFileName(index));
    const outputPath = resolve(outputDir, frameFileName(index));
    const debugPath = resolve(
      debugDir,
      `${action.action}_${frameFileName(index).replace(".png", "_cutout_debug.png")}`,
    );

    await writeCutoutFrame(inputPath, outputPath, debugPath, action.chromaKey);
  }

  return {
    action: action.action,
    outputDir,
    frameCount: frameNames.length,
    skipped: false,
  };
}

export async function writeCutoutFrame(
  inputPath: string,
  outputPath: string,
  debugPath: string,
  settings: ChromaKeySettings,
): Promise<void> {
  const keyColor = parseHexColor(settings.keyColor);
  const { data, info } = await sharp(inputPath)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  if (info.channels !== 4) {
    throw new Error(`${inputPath}: expected RGBA input after alpha normalization`);
  }

  applyChromaKey(data, keyColor, settings);

  await sharp(data, {
    raw: {
      width: info.width,
      height: info.height,
      channels: 4,
    },
  })
    .png({ compressionLevel: 9, adaptiveFiltering: true, force: true })
    .toFile(outputPath);

  await writeDebugComparison(inputPath, outputPath, debugPath, info.width, info.height);
}

export function applyChromaKey(
  data: Buffer,
  keyColor: RgbColor,
  settings: ChromaKeySettings,
): void {
  const tolerance = Math.max(settings.tolerance, 1);
  const featherRange = Math.max(1, tolerance * Math.max(settings.edgeFeather, 0.01));
  const transparentDistance = tolerance;
  const opaqueDistance = tolerance + featherRange;

  for (let offset = 0; offset < data.length; offset += 4) {
    const r = data[offset] ?? 0;
    const g = data[offset + 1] ?? 0;
    const b = data[offset + 2] ?? 0;
    const alpha = data[offset + 3] ?? 255;
    const distance = colorDistance(r, g, b, keyColor);

    let keepAlpha = 1;

    if (distance <= transparentDistance) {
      keepAlpha = 0;
    } else if (distance < opaqueDistance) {
      keepAlpha = smoothstep(
        (distance - transparentDistance) / (opaqueDistance - transparentDistance),
      );
    }

    const nextAlpha = Math.round(alpha * keepAlpha);

    if (settings.despill && nextAlpha > 0) {
      const strongestNonGreen = Math.max(r, b);
      const greenExcess = Math.max(0, g - strongestNonGreen);
      const edgeInfluence = 1 - Math.min(distance / opaqueDistance, 1);
      data[offset + 1] = clampByte(
        Math.round(g - greenExcess * (0.9 + edgeInfluence * 0.1)),
      );
    }

    if (nextAlpha === 0) {
      data[offset] = 0;
      data[offset + 1] = 0;
      data[offset + 2] = 0;
    }

    data[offset + 3] = clampByte(nextAlpha);
  }
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
      `${action}: found ${fileNames.length} extracted frame(s), expected ${frameCount}`,
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

async function writeDebugComparison(
  originalPath: string,
  cutoutPath: string,
  debugPath: string,
  width: number,
  height: number,
): Promise<void> {
  const original = await sharp(originalPath).ensureAlpha().png().toBuffer();
  const checker = await sharp(Buffer.from(checkerboardSvg(width, height))).png().toBuffer();
  const cutoutPreview = await sharp(checker)
    .composite([{ input: cutoutPath, left: 0, top: 0 }])
    .png()
    .toBuffer();

  await sharp({
    create: {
      width: width * 2,
      height,
      channels: 4,
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    },
  })
    .composite([
      { input: original, left: 0, top: 0 },
      { input: cutoutPreview, left: width, top: 0 },
    ])
    .png({ compressionLevel: 9, adaptiveFiltering: true, force: true })
    .toFile(debugPath);
}

function checkerboardSvg(width: number, height: number): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}"><defs><pattern id="c" width="32" height="32" patternUnits="userSpaceOnUse"><rect width="32" height="32" fill="#d9d9d9"/><rect width="16" height="16" fill="#f7f7f7"/><rect x="16" y="16" width="16" height="16" fill="#f7f7f7"/></pattern></defs><rect width="100%" height="100%" fill="url(#c)"/></svg>`;
}

function parseHexColor(hexColor: string): RgbColor {
  const match = /^#?([0-9a-f]{6})$/i.exec(hexColor);

  if (!match) {
    throw new Error(`Invalid keyColor "${hexColor}". Use a 6-digit hex color.`);
  }

  const value = Number.parseInt(match[1] ?? "00ff00", 16);

  return {
    r: (value >> 16) & 255,
    g: (value >> 8) & 255,
    b: value & 255,
  };
}

function colorDistance(r: number, g: number, b: number, keyColor: RgbColor): number {
  const dr = r - keyColor.r;
  const dg = g - keyColor.g;
  const db = b - keyColor.b;

  return Math.sqrt(dr * dr + dg * dg + db * db);
}

function smoothstep(value: number): number {
  const x = Math.max(0, Math.min(1, value));
  return x * x * (3 - 2 * x);
}

function clampByte(value: number): number {
  return Math.max(0, Math.min(255, value));
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

function formatCause(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

async function main(): Promise<void> {
  try {
    const results = await cutoutVideoFrames();

    for (const result of results) {
      const status = result.skipped ? "skipped" : `${result.frameCount} frame(s)`;
      console.log(
        `[video:cutout] ${result.action}: ${status} -> ${result.outputDir}`,
      );
    }
  } catch (error) {
    console.error(`[video:cutout:error] ${formatCause(error)}`);
    process.exitCode = 1;
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await main();
}
