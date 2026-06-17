import { execFile } from "node:child_process";
import { access, mkdir, readdir, unlink } from "node:fs/promises";
import { extname, resolve } from "node:path";
import process from "node:process";
import { pathToFileURL } from "node:url";
import { promisify } from "node:util";
import {
  frameFileName,
  selectVideoSpriteActions,
  validateVideoSpriteActionShape,
  type VideoSpriteActionConfig,
} from "./videoToSpriteConfig.ts";

const execFileAsync = promisify(execFile);
const SUPPORTED_VIDEO_EXTENSIONS = new Set([".mp4", ".mov", ".webm"]);

export interface ExtractFramesResult {
  action: string;
  outputDir: string;
  frameCount: number;
  skipped: boolean;
}

export async function extractVideoFrames(
  actions: readonly VideoSpriteActionConfig[] = selectVideoSpriteActions(),
  rootDir = process.cwd(),
): Promise<ExtractFramesResult[]> {
  const results: ExtractFramesResult[] = [];

  for (const action of actions) {
    results.push(await extractActionFrames(action, rootDir));
  }

  return results;
}

export async function extractActionFrames(
  action: VideoSpriteActionConfig,
  rootDir = process.cwd(),
): Promise<ExtractFramesResult> {
  validateVideoSpriteActionShape(action);

  const inputVideo = resolve(rootDir, action.inputVideo);
  const outputDir = resolve(rootDir, action.extractedDir);

  if (!(await exists(inputVideo))) {
    console.warn(
      `[video:extract:warning] ${action.action}: missing input video ${inputVideo}; skipping`,
    );
    return {
      action: action.action,
      outputDir,
      frameCount: 0,
      skipped: true,
    };
  }

  const extension = extname(inputVideo).toLowerCase();

  if (!SUPPORTED_VIDEO_EXTENSIONS.has(extension)) {
    throw new Error(
      `${action.action}: unsupported video extension "${extension}". Use mp4, mov, or webm.`,
    );
  }

  const sampleTimes =
    action.sampleMode === "times" || action.sampleTimes.length > 0
      ? validateManualSampleTimes(action)
      : await buildEvenSampleTimes(action, inputVideo);

  await mkdir(outputDir, { recursive: true });
  await removePngFiles(outputDir);

  for (let index = 0; index < sampleTimes.length; index++) {
    const outputPath = resolve(outputDir, frameFileName(index));
    await extractSingleFrame(inputVideo, sampleTimes[index] ?? 0, outputPath);
  }

  return {
    action: action.action,
    outputDir,
    frameCount: sampleTimes.length,
    skipped: false,
  };
}

async function buildEvenSampleTimes(
  action: VideoSpriteActionConfig,
  inputVideo: string,
): Promise<number[]> {
  const duration = await probeVideoDurationSeconds(inputVideo);
  const start = action.sampleStartTime ?? 0;
  const end = Math.min(action.sampleEndTime ?? duration, duration);
  const span = end - start;

  if (!Number.isFinite(span) || span <= 0) {
    throw new Error(
      `${action.action}: video duration or sample range is invalid (${duration}s)`,
    );
  }

  return Array.from({ length: action.frameCount }, (_, index) => {
    const sample = start + ((index + 0.5) * span) / action.frameCount;
    return Math.max(0, Math.min(sample, Math.max(duration - 0.001, 0)));
  });
}

function validateManualSampleTimes(action: VideoSpriteActionConfig): number[] {
  if (action.sampleTimes.length !== action.frameCount) {
    throw new Error(
      `${action.action}: sampleTimes has ${action.sampleTimes.length} item(s), expected ${action.frameCount}`,
    );
  }

  return action.sampleTimes.map((sampleTime, index) => {
    if (!Number.isFinite(sampleTime) || sampleTime < 0) {
      throw new Error(
        `${action.action}: sampleTimes[${index}] must be a non-negative second value`,
      );
    }

    return sampleTime;
  });
}

async function probeVideoDurationSeconds(inputVideo: string): Promise<number> {
  const ffprobe = process.env.FFPROBE_PATH ?? "ffprobe";

  try {
    const { stdout } = await execFileAsync(ffprobe, [
      "-v",
      "error",
      "-show_entries",
      "format=duration",
      "-of",
      "default=noprint_wrappers=1:nokey=1",
      inputVideo,
    ]);
    const duration = Number.parseFloat(stdout.trim());

    if (!Number.isFinite(duration) || duration <= 0) {
      throw new Error(`invalid duration "${stdout.trim()}"`);
    }

    return duration;
  } catch (error) {
    throw new Error(
      `Cannot read video duration with ffprobe. Install ffmpeg or set FFPROBE_PATH. ${formatCause(
        error,
      )}`,
    );
  }
}

async function extractSingleFrame(
  inputVideo: string,
  sampleTime: number,
  outputPath: string,
): Promise<void> {
  const ffmpeg = process.env.FFMPEG_PATH ?? "ffmpeg";

  try {
    await execFileAsync(ffmpeg, [
      "-hide_banner",
      "-loglevel",
      "error",
      "-y",
      "-i",
      inputVideo,
      "-ss",
      sampleTime.toFixed(3),
      "-frames:v",
      "1",
      "-vf",
      "scale=iw:ih:flags=lanczos,format=rgba",
      outputPath,
    ]);
  } catch (error) {
    throw new Error(
      `Cannot extract frame at ${sampleTime.toFixed(
        3,
      )}s with ffmpeg. Install ffmpeg or set FFMPEG_PATH. ${formatCause(error)}`,
    );
  }
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
    const results = await extractVideoFrames();

    for (const result of results) {
      const status = result.skipped ? "skipped" : `${result.frameCount} frame(s)`;
      console.log(
        `[video:extract] ${result.action}: ${status} -> ${result.outputDir}`,
      );
    }
  } catch (error) {
    console.error(`[video:extract:error] ${formatCause(error)}`);
    process.exitCode = 1;
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await main();
}
