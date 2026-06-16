import assert from "node:assert/strict";
import test from "node:test";
import type { AssetKey } from "../src/assets/assetManifest.ts";
import { fairySkin } from "../src/skins/fairySkin.ts";
import type { Match3Skin, SkinResource } from "../src/skins/skinTypes.ts";
import {
  getCharacterAnchor,
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

test("missing fallback image still resolves to a placeholder without throwing", () => {
  const config: SpriteAnimationConfig = {
    key: "yizai_hero_attack_sheet",
    frameWidth: 512,
    frameHeight: 512,
    frameCount: 6,
    fps: 12,
    loop: false,
    priority: 10,
  };
  const source = resolveCharacterAnimationSource(config, fairySkin);

  assert.equal(source.mode, "placeholder");
  assert.equal(source.key, "yizai_hero_attack_sheet");
  assert.equal(source.path, "");
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
