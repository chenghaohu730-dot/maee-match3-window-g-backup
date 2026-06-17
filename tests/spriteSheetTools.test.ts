import assert from "node:assert/strict";
import { mkdir, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import sharp from "sharp";
import { buildSpriteSheetJob } from "../tools/buildSpriteSheets.ts";
import type { SpriteSheetJob } from "../tools/spriteSheetBuildConfig.ts";
import { validateSpriteSheetJob } from "../tools/validateSpriteSheets.ts";

test("buildSpriteSheetJob builds a configured sheet output path", async () => {
  await withTempRoot(async (root) => {
    const inputDir = join(root, "renders", "attack");
    const output = join(root, "out", "attack_sheet.png");
    await mkdir(inputDir, { recursive: true });
    await writeFrame(join(inputDir, "frame_0001.png"), [255, 0, 0, 180]);
    await writeFrame(join(inputDir, "frame_0002.png"), [0, 255, 0, 180]);

    const result = await buildSpriteSheetJob(
      job({
        inputDir,
        output,
        frameCount: 2,
        columns: 2,
        rows: 1,
      }),
      root,
    );
    const metadata = await sharp(result.output).metadata();

    assert.equal(metadata.width, 16);
    assert.equal(metadata.height, 8);
    assert.equal(metadata.hasAlpha, true);
  });
});

test("buildSpriteSheetJob supports grid sheets", async () => {
  await withTempRoot(async (root) => {
    const inputDir = join(root, "renders", "ultimate");
    const output = join(root, "out", "ultimate_sheet.png");
    await mkdir(inputDir, { recursive: true });

    for (let index = 1; index <= 4; index++) {
      await writeFrame(
        join(inputDir, `frame_${String(index).padStart(4, "0")}.png`),
        [index * 30, 0, 255, 200],
      );
    }

    const result = await buildSpriteSheetJob(
      job({
        inputDir,
        output,
        frameCount: 4,
        columns: 2,
        rows: 2,
      }),
      root,
    );
    const metadata = await sharp(result.output).metadata();

    assert.equal(metadata.width, 16);
    assert.equal(metadata.height, 16);
    assert.equal(result.frameCount, 4);
  });
});

test("validateSpriteSheetJob warns for missing optional pro sheets", async () => {
  await withTempRoot(async (root) => {
    const messages = await validateSpriteSheetJob(
      job({
        inputDir: join(root, "renders", "idle"),
        output: join(root, "missing", "idle_sheet.png"),
        frameCount: 4,
        columns: 4,
        rows: 1,
        allowMissingOutput: true,
      }),
      root,
    );

    assert.equal(messages.length, 1);
    assert.equal(messages[0]?.level, "warning");
    assert.match(messages[0]?.message ?? "", /missing sprite sheet/);
  });
});

test("validateSpriteSheetJob errors for incorrect sheet dimensions", async () => {
  await withTempRoot(async (root) => {
    const output = join(root, "out", "bad_sheet.png");
    await mkdir(join(root, "out"), { recursive: true });
    await sharp({
      create: {
        width: 9,
        height: 8,
        channels: 4,
        background: { r: 0, g: 0, b: 0, alpha: 0 },
      },
    })
      .png()
      .toFile(output);

    const messages = await validateSpriteSheetJob(
      job({
        inputDir: join(root, "renders", "idle"),
        output,
        frameCount: 2,
        columns: 2,
        rows: 1,
      }),
      root,
    );

    assert.equal(messages.some((message) => message.level === "error"), true);
    assert.equal(
      messages.some((message) => message.message.includes("expected 16x8")),
      true,
    );
  });
});

function job(overrides: Partial<SpriteSheetJob>): SpriteSheetJob {
  return {
    name: "test_sheet",
    inputDir: "renders",
    output: "out/sheet.png",
    frameWidth: 8,
    frameHeight: 8,
    frameCount: 1,
    columns: 1,
    rows: 1,
    allowMissingOutput: true,
    maxBytes: 1024 * 1024,
    ...overrides,
  };
}

async function writeFrame(
  path: string,
  rgba: [number, number, number, number],
): Promise<void> {
  await sharp({
    create: {
      width: 8,
      height: 8,
      channels: 4,
      background: {
        r: rgba[0],
        g: rgba[1],
        b: rgba[2],
        alpha: rgba[3] / 255,
      },
    },
  })
    .png()
    .toFile(path);
}

async function withTempRoot(callback: (root: string) => Promise<void>): Promise<void> {
  const root = await mkdtemp(join(tmpdir(), "maee-sheets-"));

  try {
    await callback(root);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
}
