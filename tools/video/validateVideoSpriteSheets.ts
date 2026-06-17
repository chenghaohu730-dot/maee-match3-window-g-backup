import { access, stat } from "node:fs/promises";
import { resolve } from "node:path";
import process from "node:process";
import { pathToFileURL } from "node:url";
import sharp from "sharp";
import {
  selectVideoSpriteActions,
  validateVideoSpriteActionShape,
  type VideoSpriteActionConfig,
} from "./videoToSpriteConfig.ts";

export type VideoSpriteValidationLevel = "warning" | "error";

export interface VideoSpriteValidationMessage {
  level: VideoSpriteValidationLevel;
  action: string;
  message: string;
}

export interface VideoSpriteValidationResult {
  messages: VideoSpriteValidationMessage[];
  warningCount: number;
  errorCount: number;
}

export async function validateVideoSpriteSheets(
  actions: readonly VideoSpriteActionConfig[] = selectVideoSpriteActions(),
  rootDir = process.cwd(),
): Promise<VideoSpriteValidationResult> {
  const messages: VideoSpriteValidationMessage[] = [];

  for (const action of actions) {
    messages.push(...(await validateVideoSpriteSheet(action, rootDir)));
  }

  return {
    messages,
    warningCount: messages.filter((message) => message.level === "warning")
      .length,
    errorCount: messages.filter((message) => message.level === "error").length,
  };
}

export async function validateVideoSpriteSheet(
  action: VideoSpriteActionConfig,
  rootDir = process.cwd(),
): Promise<VideoSpriteValidationMessage[]> {
  validateVideoSpriteActionShape(action);

  const output = resolve(rootDir, action.outputSheet);
  const messages: VideoSpriteValidationMessage[] = [];

  if (!(await exists(output))) {
    messages.push({
      level: "warning",
      action: action.action,
      message: `missing sprite sheet: ${output}`,
    });
    return messages;
  }

  const metadata = await sharp(output).metadata();
  const fileStat = await stat(output);
  const expectedWidth = action.columns * action.frameWidth;
  const expectedHeight = action.rows * action.frameHeight;

  if (metadata.format !== "png") {
    messages.push({
      level: "error",
      action: action.action,
      message: `format is ${metadata.format ?? "unknown"}, expected png`,
    });
  }

  if (metadata.width !== expectedWidth || metadata.height !== expectedHeight) {
    messages.push({
      level: "error",
      action: action.action,
      message: `size is ${metadata.width ?? 0}x${
        metadata.height ?? 0
      }, expected ${expectedWidth}x${expectedHeight}`,
    });
  }

  if (metadata.width && metadata.width % action.frameWidth !== 0) {
    messages.push({
      level: "error",
      action: action.action,
      message: `width ${metadata.width} cannot be divided by frameWidth ${action.frameWidth}`,
    });
  }

  if (metadata.height && metadata.height % action.frameHeight !== 0) {
    messages.push({
      level: "error",
      action: action.action,
      message: `height ${metadata.height} cannot be divided by frameHeight ${action.frameHeight}`,
    });
  }

  const actualFrameCount =
    metadata.width && metadata.height
      ? (metadata.width / action.frameWidth) * (metadata.height / action.frameHeight)
      : 0;

  if (actualFrameCount !== action.frameCount) {
    messages.push({
      level: "error",
      action: action.action,
      message: `sheet grid has ${actualFrameCount} frame(s), expected ${action.frameCount}`,
    });
  }

  if (metadata.width === expectedWidth && metadata.height === expectedHeight) {
    const actualColumns = metadata.width / action.frameWidth;
    const actualRows = metadata.height / action.frameHeight;

    if (actualColumns !== action.columns || actualRows !== action.rows) {
      messages.push({
        level: "error",
        action: action.action,
        message: `sheet grid is ${actualColumns}x${actualRows}, expected ${action.columns}x${action.rows}`,
      });
    }
  }

  if (!metadata.hasAlpha) {
    messages.push({
      level: "error",
      action: action.action,
      message: "PNG must include an alpha channel",
    });
  }

  if (fileStat.size > action.maxBytes) {
    messages.push({
      level: "warning",
      action: action.action,
      message: `file size ${fileStat.size} bytes exceeds ${action.maxBytes} bytes`,
    });
  }

  return messages;
}

export function formatVideoSpriteValidationMessage(
  message: VideoSpriteValidationMessage,
): string {
  return `[${message.level}] ${message.action}: ${message.message}`;
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
    const result = await validateVideoSpriteSheets();

    for (const message of result.messages) {
      console.log(formatVideoSpriteValidationMessage(message));
    }

    console.log(
      `[video:validate:summary] ${result.errorCount} error(s), ${result.warningCount} warning(s)`,
    );

    if (result.errorCount > 0) {
      process.exitCode = 1;
    }
  } catch (error) {
    console.error(`[video:validate:error] ${formatCause(error)}`);
    process.exitCode = 1;
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await main();
}
