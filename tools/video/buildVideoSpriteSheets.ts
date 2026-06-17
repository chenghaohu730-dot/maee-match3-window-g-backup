import { access, mkdir, readdir, stat } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import process from "node:process";
import { pathToFileURL } from "node:url";
import sharp from "sharp";
import {
  frameFileName,
  selectVideoSpriteActions,
  validateVideoSpriteActionShape,
  type VideoSpriteActionConfig,
} from "./videoToSpriteConfig.ts";

export interface BuildVideoSpriteSheetResult {
  action: string;
  output: string;
  width: number;
  height: number;
  frameCount: number;
  columns: number;
  rows: number;
  skipped: boolean;
}

export async function buildVideoSpriteSheets(
  actions: readonly VideoSpriteActionConfig[] = selectVideoSpriteActions(),
  rootDir = process.cwd(),
): Promise<BuildVideoSpriteSheetResult[]> {
  const results: BuildVideoSpriteSheetResult[] = [];

  for (const action of actions) {
    results.push(await buildVideoSpriteSheet(action, rootDir));
  }

  return results;
}

export async function buildVideoSpriteSheet(
  action: VideoSpriteActionConfig,
  rootDir = process.cwd(),
): Promise<BuildVideoSpriteSheetResult> {
  validateVideoSpriteActionShape(action);

  const inputDir = resolve(rootDir, action.renderDir);
  const output = resolve(rootDir, action.outputSheet);
  const frameNames = await readFrameNames(inputDir, action.frameCount, action.action);

  if (frameNames.length === 0) {
    console.warn(
      `[video:build-sheets:warning] ${action.action}: no aligned render frames in ${inputDir}; skipping`,
    );
    return {
      action: action.action,
      output,
      width: action.columns * action.frameWidth,
      height: action.rows * action.frameHeight,
      frameCount: 0,
      columns: action.columns,
      rows: action.rows,
      skipped: true,
    };
  }

  await Promise.all(
    frameNames.map(async (frameName) => {
      const framePath = resolve(inputDir, frameName);
      const metadata = await sharp(framePath).metadata();

      if (
        metadata.width !== action.frameWidth ||
        metadata.height !== action.frameHeight
      ) {
        throw new Error(
          `${action.action}: ${framePath} is ${metadata.width ?? 0}x${
            metadata.height ?? 0
          }, expected ${action.frameWidth}x${action.frameHeight}`,
        );
      }

      if (metadata.format !== "png") {
        throw new Error(`${action.action}: ${framePath} must be a PNG file`);
      }
    }),
  );

  await mkdir(dirname(output), { recursive: true });

  const width = action.columns * action.frameWidth;
  const height = action.rows * action.frameHeight;
  const composite = frameNames.map((frameName, index) => ({
    input: resolve(inputDir, frameName),
    left: (index % action.columns) * action.frameWidth,
    top: Math.floor(index / action.columns) * action.frameHeight,
  }));

  await sharp({
    create: {
      width,
      height,
      channels: 4,
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    },
  })
    .composite(composite)
    .png({ compressionLevel: 9, adaptiveFiltering: true, force: true })
    .toFile(output);

  const outputStat = await stat(output);

  if (outputStat.size > action.maxBytes) {
    console.warn(
      `[video:build-sheets:warning] ${action.action}: ${outputStat.size} bytes exceeds ${action.maxBytes} bytes`,
    );
  }

  return {
    action: action.action,
    output,
    width,
    height,
    frameCount: action.frameCount,
    columns: action.columns,
    rows: action.rows,
    skipped: false,
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
      `${action}: found ${fileNames.length} render frame(s), expected ${frameCount}`,
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
    const results = await buildVideoSpriteSheets();

    for (const result of results) {
      const status = result.skipped
        ? "skipped"
        : `${result.width}x${result.height}, ${result.columns}x${result.rows}, ${result.frameCount} frame(s)`;
      console.log(
        `[video:build-sheets] ${result.action}: ${status} -> ${result.output}`,
      );
    }
  } catch (error) {
    console.error(`[video:build-sheets:error] ${formatCause(error)}`);
    process.exitCode = 1;
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await main();
}
