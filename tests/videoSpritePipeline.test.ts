import assert from "node:assert/strict";
import { mkdir, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import sharp from "sharp";
import {
  alignActionFrames,
  applyFrameEdgeFade,
  buildPlacementPlan,
  readAlphaBBox,
} from "../tools/video/alignFrames.ts";
import { buildVideoSpriteSheet } from "../tools/video/buildVideoSpriteSheets.ts";
import { applyChromaKey } from "../tools/video/chromaKeyCutout.ts";
import { validateVideoSpriteSheet } from "../tools/video/validateVideoSpriteSheets.ts";
import {
  validateVideoSpriteActionShape,
  videoSpriteActionConfigs,
  type VideoSpriteActionConfig,
} from "../tools/video/videoToSpriteConfig.ts";

test("video sprite config uses the higher frame-count yizai action specs", () => {
  assert.deepEqual(
    Object.fromEntries(
      Object.entries(videoSpriteActionConfigs).map(([action, config]) => [
        action,
        {
          frameCount: config.frameCount,
          fps: config.fps,
          columns: config.columns,
          rows: config.rows,
          loop: config.loop,
        },
      ]),
    ),
    {
      idle: { frameCount: 12, fps: 12, columns: 6, rows: 2, loop: true },
      attack: { frameCount: 16, fps: 20, columns: 8, rows: 2, loop: false },
      skill: { frameCount: 24, fps: 20, columns: 8, rows: 3, loop: false },
      ultimate: { frameCount: 32, fps: 24, columns: 8, rows: 4, loop: false },
      hurt: { frameCount: 12, fps: 20, columns: 6, rows: 2, loop: false },
    },
  );
});

test("video sprite config produces effect-priority sheet dimensions", () => {
  assert.deepEqual(
    Object.fromEntries(
      Object.entries(videoSpriteActionConfigs).map(([action, config]) => [
        action,
        {
          width: config.columns * config.frameWidth,
          height: config.rows * config.frameHeight,
        },
      ]),
    ),
    {
      idle: { width: 3072, height: 1024 },
      attack: { width: 4096, height: 1024 },
      skill: { width: 4096, height: 1536 },
      ultimate: { width: 4096, height: 2048 },
      hurt: { width: 3072, height: 1024 },
    },
  );
});

test("video sprite config enables fixed subject scaling for pro yizai sheets", () => {
  for (const config of Object.values(videoSpriteActionConfigs)) {
    assert.equal(config.alignment.subjectScale?.fixedSubjectHeight, 300);
    assert.deepEqual(config.alignment.subjectScale?.subjectBounds, {
      left: 0.28,
      top: 0.18,
      right: 0.66,
      bottom: 0.98,
    });
  }
});

test("video sprite config fades skill and ultimate frame edges", () => {
  assert.equal(videoSpriteActionConfigs.skill.alignment.edgeFadePx, 8);
  assert.equal(videoSpriteActionConfigs.ultimate.alignment.edgeFadePx, 8);
  assert.equal(videoSpriteActionConfigs.attack.alignment.edgeFadePx, undefined);
});

test("video sprite config validates manual sample ranges", () => {
  assert.doesNotThrow(() =>
    validateVideoSpriteActionShape(
      testAction({
        sampleStartTime: 0.2,
        sampleEndTime: 1.4,
      }),
    ),
  );

  assert.throws(
    () =>
      validateVideoSpriteActionShape(
        testAction({
          sampleStartTime: 1.4,
          sampleEndTime: 0.2,
        }),
      ),
    /sampleEndTime must be greater/,
  );
});

test("applyChromaKey removes green while preserving white subject pixels", () => {
  const data = Buffer.from([
    0, 255, 0, 255,
    255, 255, 255, 255,
  ]);

  applyChromaKey(data, { r: 0, g: 255, b: 0 }, {
    keyColor: "#00ff00",
    tolerance: 70,
    edgeFeather: 1.5,
    despill: true,
  });

  assert.equal(data[3], 0);
  assert.equal(data[7], 255);
  assert.equal(data[4], 255);
  assert.equal(data[5], 255);
  assert.equal(data[6], 255);
});

test("applyFrameEdgeFade clears the outer alpha edge while keeping center pixels", async () => {
  const input = await sharp({
    create: {
      width: 8,
      height: 8,
      channels: 4,
      background: { r: 255, g: 255, b: 255, alpha: 1 },
    },
  })
    .png()
    .toBuffer();

  const faded = await applyFrameEdgeFade(input, 2);
  const { data, info } = await sharp(faded)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const alphaAt = (x: number, y: number): number =>
    data[(y * info.width + x) * 4 + 3] ?? 0;

  assert.equal(alphaAt(0, 0), 0);
  assert.equal(alphaAt(1, 4) > 0, true);
  assert.equal(alphaAt(4, 4), 255);
});

test("readAlphaBBox finds the visible subject bounds", async () => {
  await withTempRoot(async (root) => {
    const frame = join(root, "subject.png");
    await sharp({
      create: {
        width: 8,
        height: 8,
        channels: 4,
        background: { r: 0, g: 0, b: 0, alpha: 0 },
      },
    })
      .composite([
        {
          input: {
            create: {
              width: 3,
              height: 2,
              channels: 4,
              background: { r: 255, g: 0, b: 0, alpha: 1 },
            },
          },
          left: 2,
          top: 4,
        },
      ])
      .png()
      .toFile(frame);

    const bbox = await readAlphaBBox(frame);

    assert.deepEqual(bbox, {
      minX: 2,
      minY: 4,
      maxX: 4,
      maxY: 5,
      width: 3,
      height: 2,
    });
  });
});

test("buildPlacementPlan keeps aligned frames inside the target canvas", () => {
  const plan = buildPlacementPlan(
    { minX: 20, minY: 10, maxX: 119, maxY: 209, width: 100, height: 200 },
    {
      canvasWidth: 512,
      canvasHeight: 512,
      baselineY: 493,
      padding: 32,
      xOffset: -24,
      allowRightEffectSpace: true,
    },
  );

  assert.equal(plan.top + plan.scaledHeight <= 512, true);
  assert.equal(plan.left >= 0, true);
  assert.equal(plan.left + plan.scaledWidth <= 512, true);
});

test("buildPlacementPlan scales from subject bounds instead of oversized effects", () => {
  const effectBBox = {
    minX: 0,
    minY: 0,
    maxX: 999,
    maxY: 799,
    width: 1000,
    height: 800,
  };
  const subjectBBox = {
    minX: 450,
    minY: 300,
    maxX: 549,
    maxY: 699,
    width: 100,
    height: 400,
  };
  const plan = buildPlacementPlan(
    effectBBox,
    {
      canvasWidth: 512,
      canvasHeight: 512,
      baselineY: 493,
      padding: 0,
      xOffset: 0,
      allowRightEffectSpace: false,
      subjectScale: {
        fixedSubjectHeight: 300,
        subjectBounds: { left: 0.3, top: 0.2, right: 0.7, bottom: 0.95 },
        protectedBounds: { left: 0.3, top: 0.2, right: 0.7, bottom: 0.95 },
        protectedPadding: 0,
      },
    },
    subjectBBox,
    subjectBBox,
  );

  assert.equal(plan.scaledWidth, 512);
  assert.equal(plan.scaledHeight, 512);
  assert.equal(plan.cropWidth < effectBBox.width, true);
  assert.equal(Math.abs(subjectBBox.height * plan.scale - 300) < 1, true);
  assert.equal(
    Math.abs((subjectBBox.maxY + 1 - plan.cropTop) * plan.scale - 493) < 1,
    true,
  );
});

test("alignActionFrames crops oversized source frames before compositing", async () => {
  await withTempRoot(async (root) => {
    const cutoutDir = join(root, "cutout");
    const renderDir = join(root, "render");
    await mkdir(cutoutDir, { recursive: true });

    await sharp({
      create: {
        width: 16,
        height: 16,
        channels: 4,
        background: { r: 0, g: 0, b: 0, alpha: 0 },
      },
    })
      .composite([
        {
          input: {
            create: {
              width: 2,
              height: 2,
              channels: 4,
              background: { r: 255, g: 255, b: 255, alpha: 1 },
            },
          },
          left: 7,
          top: 10,
        },
      ])
      .png()
      .toFile(join(cutoutDir, "frame_0001.png"));

    const action = testAction({
      cutoutDir,
      renderDir,
      debugDir: join(root, "debug"),
      frameWidth: 8,
      frameHeight: 8,
      frameCount: 1,
      columns: 1,
      rows: 1,
      alignment: {
        canvasWidth: 8,
        canvasHeight: 8,
        baselineY: 7,
        padding: 1,
        xOffset: 0,
        allowRightEffectSpace: false,
      },
    });

    const result = await alignActionFrames(action, root);
    const metadata = await sharp(join(renderDir, "frame_0001.png")).metadata();

    assert.equal(result.frameCount, 1);
    assert.equal(metadata.width, 8);
    assert.equal(metadata.height, 8);
  });
});

test("video sprite sheet build and validate use action-specific grid settings", async () => {
  await withTempRoot(async (root) => {
    const renderDir = join(root, "renders", "skill");
    const outputSheet = join(root, "out", "yizai_hero_skill_sheet.png");
    await mkdir(renderDir, { recursive: true });

    for (let index = 0; index < 4; index++) {
      await sharp({
        create: {
          width: 8,
          height: 8,
          channels: 4,
          background: {
            r: index * 30,
            g: 100,
            b: 180,
            alpha: 0.9,
          },
        },
      })
        .png()
        .toFile(join(renderDir, `frame_${String(index + 1).padStart(4, "0")}.png`));
    }

    const action = testAction({
      renderDir,
      outputSheet,
      frameWidth: 8,
      frameHeight: 8,
      frameCount: 4,
      columns: 2,
      rows: 2,
    });

    const result = await buildVideoSpriteSheet(action, root);
    const messages = await validateVideoSpriteSheet(action, root);

    assert.equal(result.width, 16);
    assert.equal(result.height, 16);
    assert.equal(messages.length, 0);
  });
});

test("video sprite validation warns without blocking missing pro sheets", async () => {
  await withTempRoot(async (root) => {
    const messages = await validateVideoSpriteSheet(
      testAction({ outputSheet: join(root, "missing.png") }),
      root,
    );

    assert.equal(messages.length, 1);
    assert.equal(messages[0]?.level, "warning");
  });
});

function testAction(
  overrides: Partial<VideoSpriteActionConfig> = {},
): VideoSpriteActionConfig {
  return {
    action: "attack",
    name: "yizai_hero_attack",
    inputVideo: "input/yizai_attack.mp4",
    extractedDir: "extracted/attack",
    cutoutDir: "extracted/attack_cutout",
    renderDir: "renders/attack",
    debugDir: "debug/attack",
    outputSheet: "out/yizai_hero_attack_sheet.png",
    frameWidth: 8,
    frameHeight: 8,
    frameCount: 1,
    fps: 12,
    columns: 1,
    rows: 1,
    loop: false,
    sampleMode: "even",
    sampleTimes: [],
    chromaKey: {
      keyColor: "#00ff00",
      tolerance: 70,
      edgeFeather: 1.5,
      despill: true,
    },
    alignment: {
      canvasWidth: 8,
      canvasHeight: 8,
      baselineY: 7,
      padding: 1,
      xOffset: 0,
      allowRightEffectSpace: false,
    },
    maxBytes: 1024 * 1024,
    ...overrides,
  };
}

async function withTempRoot(callback: (root: string) => Promise<void>): Promise<void> {
  const root = await mkdtemp(join(tmpdir(), "maee-video-sheets-"));

  try {
    await callback(root);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
}
