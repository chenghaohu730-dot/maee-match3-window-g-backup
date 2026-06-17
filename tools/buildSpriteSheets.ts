import { mkdir, readdir } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import process from "node:process";
import { pathToFileURL } from "node:url";
import sharp from "sharp";
import {
  spriteSheetJobs,
  type SpriteSheetJob,
} from "./spriteSheetBuildConfig.ts";

export interface BuildSpriteSheetResult {
  name: string;
  output: string;
  width: number;
  height: number;
  frameCount: number;
}

export async function buildSpriteSheets(
  jobs: readonly SpriteSheetJob[] = spriteSheetJobs,
  rootDir = process.cwd(),
): Promise<BuildSpriteSheetResult[]> {
  const results: BuildSpriteSheetResult[] = [];

  for (const job of jobs) {
    results.push(await buildSpriteSheetJob(job, rootDir));
  }

  return results;
}

export async function buildSpriteSheetJob(
  job: SpriteSheetJob,
  rootDir = process.cwd(),
): Promise<BuildSpriteSheetResult> {
  validateJobShape(job);

  const inputDir = resolve(rootDir, job.inputDir);
  const output = resolve(rootDir, job.output);
  const frameNames = await readOrderedFrameNames(inputDir, job.frameCount);
  const framePaths = frameNames.map((name) => resolve(inputDir, name));

  await Promise.all(
    framePaths.map(async (framePath) => {
      const metadata = await sharp(framePath).metadata();

      if (metadata.width !== job.frameWidth || metadata.height !== job.frameHeight) {
        throw new Error(
          `${job.name}: ${framePath} is ${metadata.width ?? 0}x${
            metadata.height ?? 0
          }, expected ${job.frameWidth}x${job.frameHeight}`,
        );
      }
    }),
  );

  await mkdir(dirname(output), { recursive: true });

  const width = job.columns * job.frameWidth;
  const height = job.rows * job.frameHeight;
  const composite = framePaths.map((input, index) => ({
    input,
    left: (index % job.columns) * job.frameWidth,
    top: Math.floor(index / job.columns) * job.frameHeight,
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

  return {
    name: job.name,
    output,
    width,
    height,
    frameCount: job.frameCount,
  };
}

async function readOrderedFrameNames(
  inputDir: string,
  frameCount: number,
): Promise<string[]> {
  let fileNames: string[];

  try {
    fileNames = (await readdir(inputDir))
      .filter((name) => name.toLowerCase().endsWith(".png"))
      .sort((a, b) => a.localeCompare(b));
  } catch (error) {
    throw new Error(
      `Cannot read render frame directory ${inputDir}: ${formatCause(error)}`,
    );
  }

  const expected = Array.from(
    { length: frameCount },
    (_, index) => `frame_${String(index + 1).padStart(4, "0")}.png`,
  );

  if (fileNames.length !== frameCount) {
    throw new Error(
      `${inputDir}: found ${fileNames.length} PNG frame(s), expected ${frameCount}`,
    );
  }

  for (let index = 0; index < expected.length; index++) {
    if (fileNames[index] !== expected[index]) {
      throw new Error(
        `${inputDir}: expected ${expected[index]} at position ${
          index + 1
        }, found ${fileNames[index] ?? "nothing"}`,
      );
    }
  }

  return fileNames;
}

function validateJobShape(job: SpriteSheetJob): void {
  for (const [field, value] of Object.entries({
    frameWidth: job.frameWidth,
    frameHeight: job.frameHeight,
    frameCount: job.frameCount,
    columns: job.columns,
    rows: job.rows,
  })) {
    if (!Number.isInteger(value) || value <= 0) {
      throw new Error(`${job.name}: ${field} must be a positive integer`);
    }
  }

  if (job.columns * job.rows !== job.frameCount) {
    throw new Error(
      `${job.name}: columns * rows must equal frameCount (${job.columns} * ${job.rows} !== ${job.frameCount})`,
    );
  }
}

function formatCause(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

async function main(): Promise<void> {
  try {
    const results = await buildSpriteSheets();

    for (const result of results) {
      console.log(
        `[sheet] ${result.name}: ${result.width}x${result.height}, ${result.frameCount} frames -> ${result.output}`,
      );
    }
  } catch (error) {
    console.error(`[sheet:error] ${formatCause(error)}`);
    process.exitCode = 1;
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await main();
}
