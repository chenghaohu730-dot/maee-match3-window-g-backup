import process from "node:process";
import { pathToFileURL } from "node:url";
import { alignVideoFrames } from "./alignFrames.ts";
import { buildVideoSpriteSheets } from "./buildVideoSpriteSheets.ts";
import { cutoutVideoFrames } from "./chromaKeyCutout.ts";
import { extractVideoFrames } from "./extractFrames.ts";
import { selectVideoSpriteActions } from "./videoToSpriteConfig.ts";
import {
  formatVideoSpriteValidationMessage,
  validateVideoSpriteSheets,
} from "./validateVideoSpriteSheets.ts";

export async function runVideoPipeline(rootDir = process.cwd()): Promise<void> {
  const actions = selectVideoSpriteActions();

  console.log(
    `[video:pipeline] actions: ${actions.map((action) => action.action).join(", ")}`,
  );

  await extractVideoFrames(actions, rootDir);
  await cutoutVideoFrames(actions, rootDir);
  await alignVideoFrames(actions, rootDir);
  await buildVideoSpriteSheets(actions, rootDir);

  const validation = await validateVideoSpriteSheets(actions, rootDir);

  for (const message of validation.messages) {
    console.log(formatVideoSpriteValidationMessage(message));
  }

  console.log(
    `[video:pipeline:summary] ${validation.errorCount} error(s), ${validation.warningCount} warning(s)`,
  );

  if (validation.errorCount > 0) {
    process.exitCode = 1;
  }
}

function formatCause(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

async function main(): Promise<void> {
  try {
    await runVideoPipeline();
  } catch (error) {
    console.error(`[video:pipeline:error] ${formatCause(error)}`);
    process.exitCode = 1;
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await main();
}
