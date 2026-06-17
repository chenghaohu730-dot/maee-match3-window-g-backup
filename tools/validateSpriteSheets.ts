import { access, stat } from "node:fs/promises";
import { resolve } from "node:path";
import process from "node:process";
import { pathToFileURL } from "node:url";
import sharp from "sharp";
import {
  spriteSheetJobs,
  type SpriteSheetJob,
} from "./spriteSheetBuildConfig.ts";

export type SpriteSheetValidationLevel = "warning" | "error";

export interface SpriteSheetValidationMessage {
  level: SpriteSheetValidationLevel;
  jobName: string;
  message: string;
}

export interface SpriteSheetValidationResult {
  messages: SpriteSheetValidationMessage[];
  warningCount: number;
  errorCount: number;
}

export async function validateSpriteSheets(
  jobs: readonly SpriteSheetJob[] = spriteSheetJobs,
  rootDir = process.cwd(),
): Promise<SpriteSheetValidationResult> {
  const messages: SpriteSheetValidationMessage[] = [];

  for (const job of jobs) {
    messages.push(...(await validateSpriteSheetJob(job, rootDir)));
  }

  return {
    messages,
    warningCount: messages.filter((message) => message.level === "warning")
      .length,
    errorCount: messages.filter((message) => message.level === "error").length,
  };
}

export async function validateSpriteSheetJob(
  job: SpriteSheetJob,
  rootDir = process.cwd(),
): Promise<SpriteSheetValidationMessage[]> {
  const output = resolve(rootDir, job.output);
  const messages: SpriteSheetValidationMessage[] = [];

  try {
    await access(output);
  } catch {
    messages.push({
      level: job.allowMissingOutput ? "warning" : "error",
      jobName: job.name,
      message: `missing sprite sheet: ${output}`,
    });
    return messages;
  }

  const metadata = await sharp(output).metadata();
  const fileStat = await stat(output);
  const expectedWidth = job.columns * job.frameWidth;
  const expectedHeight = job.rows * job.frameHeight;
  const gridFrameCount = job.columns * job.rows;

  if (metadata.width !== expectedWidth || metadata.height !== expectedHeight) {
    messages.push({
      level: "error",
      jobName: job.name,
      message: `size is ${metadata.width ?? 0}x${
        metadata.height ?? 0
      }, expected ${expectedWidth}x${expectedHeight}`,
    });
  }

  if (metadata.width && metadata.width % job.frameWidth !== 0) {
    messages.push({
      level: "error",
      jobName: job.name,
      message: `width ${metadata.width} cannot be divided by frameWidth ${job.frameWidth}`,
    });
  }

  if (metadata.height && metadata.height % job.frameHeight !== 0) {
    messages.push({
      level: "error",
      jobName: job.name,
      message: `height ${metadata.height} cannot be divided by frameHeight ${job.frameHeight}`,
    });
  }

  if (gridFrameCount !== job.frameCount) {
    messages.push({
      level: "error",
      jobName: job.name,
      message: `columns * rows is ${gridFrameCount}, expected frameCount ${job.frameCount}`,
    });
  }

  if (!metadata.hasAlpha) {
    messages.push({
      level: "error",
      jobName: job.name,
      message: "PNG must include an alpha channel",
    });
  }

  if (fileStat.size > job.maxBytes) {
    messages.push({
      level: "warning",
      jobName: job.name,
      message: `file size ${fileStat.size} bytes exceeds ${job.maxBytes} bytes`,
    });
  }

  return messages;
}

export function formatValidationMessage(
  message: SpriteSheetValidationMessage,
): string {
  return `[${message.level}] ${message.jobName}: ${message.message}`;
}

async function main(): Promise<void> {
  const result = await validateSpriteSheets();

  for (const message of result.messages) {
    console.log(formatValidationMessage(message));
  }

  console.log(
    `[sheet:summary] ${result.errorCount} error(s), ${result.warningCount} warning(s)`,
  );

  if (result.errorCount > 0) {
    process.exitCode = 1;
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await main();
}
