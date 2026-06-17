import assert from "node:assert/strict";
import test from "node:test";
import type { AssetKey } from "../src/assets/assetManifest.ts";
import { fairySkin } from "../src/skins/fairySkin.ts";
import type { Match3Skin, SkinResource } from "../src/skins/skinTypes.ts";
import {
  getCharacterAnchor,
  getSpriteAnimationDurationMs,
  YIZAI_ATTACK_ALIGNMENT,
  YIZAI_ANCHORS,
  YIZAI_ANIMATION_CONFIG,
} from "../src/ui/characterAnimationConfig.ts";
import type {
  CharacterAnimationRuntimeEvent,
  SpriteAnimationConfig,
} from "../src/ui/characterAnimationTypes.ts";
import {
  CharacterAnimator,
  resolveCharacterAnimationSource,
} from "../src/ui/characterAnimator.ts";

test("missing sprite sheet uses the static fallback key when available", () => {
  const skin = withAvailableResources(fairySkin, ["yizai_hero_attack"]);
  const source = resolveCharacterAnimationSource(
    YIZAI_ANIMATION_CONFIG.attack,
    skin,
  );

  assert.equal(source.mode, "fallbackImage");
  assert.equal(source.key, "yizai_hero_attack");
  assert.equal(source.path, "/assets/fairy/yizai/yizai_hero_attack.png");
});

test("missing pro sheet uses the legacy sprite sheet before static fallback", () => {
  const skin = withAvailableResources(fairySkin, [
    "yizai_hero_attack_sheet",
    "yizai_hero_attack",
  ]);
  const source = resolveCharacterAnimationSource(
    YIZAI_ANIMATION_CONFIG.attack,
    skin,
  );

  assert.equal(source.mode, "sheet");
  assert.equal(source.key, "yizai_hero_attack_sheet");
  assert.equal(source.path, "/assets/fairy/yizai/yizai_hero_attack_sheet.png");
  assert.equal(source.fallbackSheetKey, "yizai_hero_attack_sheet");
  assert.equal(source.fallbackKey, "yizai_hero_attack");
});

test("missing fallback image still resolves to a placeholder without throwing", () => {
  const skin = withAvailableResources(fairySkin, []);
  const config: SpriteAnimationConfig = {
    key: "yizai_hero_attack_sheet_pro",
    fallbackSheetKey: "yizai_hero_attack_sheet",
    fallbackKey: "yizai_hero_attack",
    frameWidth: 512,
    frameHeight: 512,
    frameCount: 6,
    fps: 12,
    loop: false,
    priority: 10,
  };
  const source = resolveCharacterAnimationSource(config, skin);

  assert.equal(source.mode, "placeholder");
  assert.equal(source.key, "yizai_hero_attack");
  assert.equal(source.path, "");
});

test("available pro attack sprite sheet resolves before every fallback", () => {
  const skin = withAvailableResources(fairySkin, [
    "yizai_hero_attack_sheet_pro",
    "yizai_hero_attack_sheet",
    "yizai_hero_attack",
  ]);
  const source = resolveCharacterAnimationSource(
    YIZAI_ANIMATION_CONFIG.attack,
    skin,
  );

  assert.equal(source.mode, "sheet");
  assert.equal(source.key, "yizai_hero_attack_sheet_pro");
  assert.equal(
    source.path,
    "/assets/fairy/yizai/pro/yizai_hero_attack_sheet.png",
  );
  assert.equal(source.fallbackSheetKey, "yizai_hero_attack_sheet");
  assert.equal(source.fallbackKey, "yizai_hero_attack");
  assert.equal(source.fallbackPath, "/assets/fairy/yizai/yizai_hero_attack.png");
});

test("sprite sheet image updates when animation state changes", () => {
  const skin = withAvailableResources(fairySkin, [
    "yizai_hero_idle_sheet",
    "yizai_hero_idle",
    "yizai_hero_attack_sheet",
    "yizai_hero_attack",
  ]);
  const element = createFakeCharacterElement();
  const animator = new CharacterAnimator({
    characterId: "yizai",
    configs: {
      idle: YIZAI_ANIMATION_CONFIG.idle as SpriteAnimationConfig<string>,
      attack: YIZAI_ANIMATION_CONFIG.attack as SpriteAnimationConfig<string>,
    },
    element,
    skin,
  });

  assert.equal(animator.play("idle"), true);
  assert.equal(element.dataset.assetKey, "yizai_hero_idle_sheet");
  assert.equal(element.dataset.fallbackSheetKey, "yizai_hero_idle_sheet");
  assert.equal(element.dataset.fallbackKey, "yizai_hero_idle");
  assert.equal(element.style.backgroundSize, "400% 100%");
  assert.equal(
    element.style.backgroundImage,
    'url("/assets/fairy/yizai/yizai_hero_idle_sheet.png")',
  );

  assert.equal(animator.play("attack"), true);
  assert.equal(element.dataset.assetKey, "yizai_hero_attack_sheet");
  assert.equal(element.dataset.fallbackSheetKey, "yizai_hero_attack_sheet");
  assert.equal(element.dataset.fallbackKey, "yizai_hero_attack");
  assert.equal(element.style.backgroundSize, "600% 100%");
  assert.equal(
    element.style.backgroundImage,
    'url("/assets/fairy/yizai/yizai_hero_attack_sheet.png")',
  );
});

test("horizontal sprite sheets advance by frame count", () => {
  const skin = withAvailableResources(fairySkin, ["yizai_hero_skill_sheet"]);
  const element = createFakeCharacterElement();
  const animator = new CharacterAnimator({
    characterId: "yizai",
    configs: {
      skill: YIZAI_ANIMATION_CONFIG.skill as SpriteAnimationConfig<string>,
    },
    element,
    skin,
  });

  assert.equal(animator.play("skill"), true);
  assert.equal(element.style.backgroundSize, "800% 100%");
  assert.equal(element.style.backgroundPosition, "0% 0%");

  animator.advanceToFrame(5);

  assert.equal(element.style.backgroundPosition, "57.14285714285714% 0%");
});

test("multi-row pro sprite sheets advance by columns and rows", () => {
  const skin = withAvailableResources(fairySkin, ["yizai_hero_attack_sheet_pro"]);
  const element = createFakeCharacterElement();
  const animator = new CharacterAnimator({
    characterId: "yizai",
    configs: {
      attack: YIZAI_ANIMATION_CONFIG.attack as SpriteAnimationConfig<string>,
    },
    element,
    skin,
  });

  assert.equal(animator.play("attack"), true);
  assert.equal(element.dataset.frameCount, "16");
  assert.equal(element.dataset.spriteColumns, "8");
  assert.equal(element.dataset.spriteRows, "2");
  assert.equal(element.style.backgroundSize, "800% 200%");
  assert.equal(element.style.backgroundPosition, "0% 0%");

  animator.advanceToFrame(9);

  assert.equal(element.style.backgroundPosition, "0% 100%");
});

test("frameEvents emit at their configured frame with anchor metadata", () => {
  const events: CharacterAnimationRuntimeEvent[] = [];
  const animator = new CharacterAnimator({
    characterId: "yizai",
    configs: {
      skill: YIZAI_ANIMATION_CONFIG.skill as SpriteAnimationConfig<string>,
    },
    anchors: YIZAI_ANCHORS,
    onFrameEvent: (event) => events.push(event),
  });

  assert.equal(animator.play("skill"), true);
  animator.advanceToFrame(2);
  animator.advanceToFrame(5);

  assert.equal(events.length, 2);
  assert.deepEqual(events.map((event) => event.type), [
    "spawnParticle",
    "emitProjectile",
  ]);
  assert.equal(events[0]?.key, "skill_charge");
  assert.equal(events[0]?.anchor, "handRight");
  assert.deepEqual(events[0]?.anchorPosition, { x: 0.68, y: 0.52 });
});

test("anchor config exposes relative coordinates", () => {
  assert.deepEqual(getCharacterAnchor("yizai", "swordTip"), {
    x: 0.28,
    y: 0.32,
  });
  assert.equal(getCharacterAnchor("enemy", "enemyHitPoint")?.x, 0.5);
});

test("yizai sheets use attack as the feet alignment baseline", () => {
  assert.deepEqual(YIZAI_ATTACK_ALIGNMENT, {
    baseline: "attack",
    anchor: "feet",
    targetX: 256,
    targetY: 493,
    tolerancePx: 3,
  });

  for (const state of ["idle", "attack", "skill", "ultimate", "hurt"] as const) {
    assert.deepEqual(
      YIZAI_ANIMATION_CONFIG[state].alignment,
      YIZAI_ATTACK_ALIGNMENT,
    );
  }
});

test("yizai animation config carries pro and legacy fallback sheet keys", () => {
  assert.equal(
    YIZAI_ANIMATION_CONFIG.attack.key,
    "yizai_hero_attack_sheet_pro",
  );
  assert.equal(
    YIZAI_ANIMATION_CONFIG.attack.fallbackSheetKey,
    "yizai_hero_attack_sheet",
  );
  assert.equal(YIZAI_ANIMATION_CONFIG.attack.fallbackKey, "yizai_hero_attack");
});

test("yizai animation config uses higher-frame pro sheet specs", () => {
  assert.deepEqual(
    Object.fromEntries(
      Object.entries(YIZAI_ANIMATION_CONFIG).map(([state, config]) => [
        state,
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

test("animation duration is derived from frame count and fps", () => {
  assert.equal(getSpriteAnimationDurationMs(YIZAI_ANIMATION_CONFIG.idle), 1000);
  assert.equal(getSpriteAnimationDurationMs(YIZAI_ANIMATION_CONFIG.attack), 800);
  assert.equal(getSpriteAnimationDurationMs(YIZAI_ANIMATION_CONFIG.skill), 1200);
  assert.equal(getSpriteAnimationDurationMs(YIZAI_ANIMATION_CONFIG.ultimate), 1334);
  assert.equal(getSpriteAnimationDurationMs(YIZAI_ANIMATION_CONFIG.hurt), 600);
});

function withAvailableResources(
  skin: Match3Skin,
  availableKeys: AssetKey[],
): Match3Skin {
  const available = new Set<AssetKey>(availableKeys);
  const resources = Object.fromEntries(
    Object.entries(skin.resources).map(([key, resource]) => [
      key,
      {
        ...resource,
        available: available.has(key as AssetKey),
      },
    ]),
  ) as Record<AssetKey, SkinResource>;

  return {
    ...skin,
    resources,
  };
}

function createFakeCharacterElement(): HTMLElement {
  const dataset: Record<string, string> = {};
  const classes = new Set<string>();
  const styleValues = new Map<string, string>();
  const style = {
    backgroundImage: "",
    backgroundPosition: "",
    backgroundRepeat: "",
    backgroundSize: "",
    removeProperty: (name: string) => {
      styleValues.delete(name);
    },
    setProperty: (name: string, value: string) => {
      styleValues.set(name, value);
    },
  };

  return {
    dataset,
    style,
    classList: {
      add: (...names: string[]) => {
        for (const name of names) {
          classes.add(name);
        }
      },
      remove: (...names: string[]) => {
        for (const name of names) {
          classes.delete(name);
        }
      },
    },
    closest: () => null,
  } as unknown as HTMLElement;
}
