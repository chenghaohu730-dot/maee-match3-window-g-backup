import assert from "node:assert/strict";
import test from "node:test";
import {
  REQUIRED_ASSET_KEYS,
  type AssetKey,
} from "../src/assets/assetManifest.ts";
import type { Piece, PieceType } from "../src/core/board.ts";
import type { GameplayEvent, GameplayState } from "../src/core/gameplayTypes.ts";
import { defaultSkin } from "../src/skins/defaultSkin.ts";
import { fairySkin } from "../src/skins/fairySkin.ts";
import { createDefaultProgress } from "../src/ui/progressionStore.ts";
import { renderGameplayScene, renderUniverseScene } from "../src/ui/gameplayView.ts";

const BATTLE_UI_ASSET_KEYS = [
  "ft_battle_stage_bg",
  "ui_hp_bar_bg",
  "ui_hp_bar_player_fill",
  "ui_hp_bar_enemy_fill",
  "ui_shield_bar_fill",
  "ui_attack_pip_on",
  "ui_attack_pip_off",
] as const satisfies readonly AssetKey[];

test("defaultSkin provides fallback resources for every manifest key", () => {
  for (const key of REQUIRED_ASSET_KEYS) {
    const resource = defaultSkin.resources[key];

    assert.equal(resource.key, key);
    assert.equal(resource.available, false);
    assert.equal(resource.path.length > 0, true);
    assert.equal(resource.fallbackClass.length > 0, true);
    assert.equal(resource.fallbackLabel.length > 0, true);
  }
});

test("fairySkin covers all required resources, pieces, monsters, and vfx", () => {
  assert.deepEqual(
    Object.keys(fairySkin.resources).sort(),
    [...REQUIRED_ASSET_KEYS].sort(),
  );

  assertAssetKeys(Object.values(fairySkin.pieceAssets));
  assertAssetKeys(Object.values(fairySkin.monsterAssets));
  assertAssetKeys(Object.values(fairySkin.vfxAssets));
  assert.equal(fairySkin.animations.yizai.idle.frames[0], "yizai_hero_idle");
  assert.equal(fairySkin.animations.yizai.idle.loop, true);
  assert.equal(fairySkin.animations.yizai.ultimate.loop, false);
  assert.equal(
    fairySkin.animations.monsters["forest-slime"]?.frames[0],
    "monster_slime_idle",
  );
  assert.equal(
    fairySkin.animations.vfx.red_ultimate_spin?.frames[0],
    "vfx_red_ultimate_spin",
  );
});

test("gameplay rendering stays on fallback when images are unavailable", () => {
  const unavailableFairySkin = withUnavailableResources(fairySkin);
  const html = renderGameplayScene({
    state: createGameplayState(),
    pieces: createPieces(),
    selected: { x: 0, y: 0 },
    message: "选择两个相邻棋子交换。",
    lastEvents: [],
    progress: createDefaultProgress(),
    soundEnabled: true,
    vibrationEnabled: true,
    skin: unavailableFairySkin,
  });

  assert.equal(html.includes("data-asset-key=\"ft_gameplay_bg\""), true);
  assert.equal(html.includes("data-asset-key=\"piece_red_flame\""), true);
  assert.equal(html.includes("MAEE"), true);
  assert.equal(html.includes("亿仔勇者"), true);
  assert.equal(html.includes("data-animation-id=\"yizai_skill\""), true);
  assert.equal(html.includes("data-frame-rate=\"12\""), true);
  assert.equal(html.includes("url("), false);
});

test("battle stage resource slots render with fallback-safe UI keys", () => {
  const html = renderGameplayScene({
    state: {
      ...createGameplayState(),
      enemyAttackCounter: 2,
      enemyAttackInterval: 4,
    },
    pieces: createPieces(),
    selected: null,
    message: "选择两个相邻棋子交换。",
    lastEvents: [],
    progress: createDefaultProgress(),
    soundEnabled: true,
    vibrationEnabled: true,
    skin: withUnavailableResources(fairySkin),
  });

  for (const key of BATTLE_UI_ASSET_KEYS) {
    assert.equal(fairySkin.resources[key].key, key);
    assert.equal(html.includes(`data-asset-key="${key}"`), true);
  }

  assert.equal(html.includes("battle-stage"), true);
  assert.equal(html.includes("battle-bg"), true);
  assert.equal(html.includes("battle-character-layer"), true);
  assert.equal(html.includes("battle-vfx-layer"), true);
  assert.equal(html.includes("battle-hud-layer"), true);
  assert.equal(html.includes("player-slot"), true);
  assert.equal(html.includes("enemy-slot"), true);
  assert.equal(html.includes("player-hp-panel"), true);
  assert.equal(html.includes("enemy-hp-panel"), true);
  assert.equal(html.includes("enemy-attack-pips"), true);
  assert.equal(html.includes("damage-float-layer"), true);
  assert.equal(html.includes("url("), false);
});

test("attack pips follow enemy attack counter and interval", () => {
  const html = renderGameplayScene({
    state: {
      ...createGameplayState(),
      enemyAttackCounter: 2,
      enemyAttackInterval: 4,
    },
    pieces: createPieces(),
    selected: null,
    message: "选择两个相邻棋子交换。",
    lastEvents: [],
    progress: createDefaultProgress(),
    soundEnabled: true,
    vibrationEnabled: true,
    skin: fairySkin,
  });

  assert.equal(countOccurrences(html, "attack-pip on"), 2);
  assert.equal(countOccurrences(html, "attack-pip off"), 2);
  assert.equal(html.includes("2/4"), true);
});

test("enemy ids map to readable monster names and combat state classes", () => {
  const events: GameplayEvent[] = [
    {
      type: "combat",
      event: { type: "enemyDamaged", amount: 12, enemyHp: 33 },
    },
  ];
  const html = renderGameplayScene({
    state: {
      ...createGameplayState(),
      enemyId: "pumpkin-fiend",
      enemyName: "",
      enemyHp: 33,
      enemyMaxHp: 45,
      lastDamage: 12,
      lastVfxKeys: ["red_skill_slash"],
    },
    pieces: createPieces(),
    selected: null,
    message: "选择两个相邻棋子交换。",
    lastEvents: events,
    progress: createDefaultProgress(),
    soundEnabled: true,
    vibrationEnabled: true,
    skin: fairySkin,
  });

  assert.equal(html.includes("南瓜怪"), true);
  assert.equal(html.includes("enemy-state-hit"), true);
  assert.equal(html.includes("yizai-state-skill"), true);
  assert.equal(html.includes("火焰横扫"), true);
});

test("board reshuffle event renders the short gameplay feedback", () => {
  const html = renderGameplayScene({
    state: createGameplayState(),
    pieces: createPieces(),
    selected: null,
    message: "选择两个相邻棋子交换。",
    lastEvents: [{ type: "boardShuffled" }],
    progress: createDefaultProgress(),
    soundEnabled: true,
    vibrationEnabled: true,
    skin: fairySkin,
  });

  assert.equal(html.includes("shuffle-pop"), true);
  assert.equal(html.includes("棋盘重排"), true);
});

test("locked universe cards still render as locked fallback entries", () => {
  const html = renderUniverseScene({
    progress: createDefaultProgress(),
    modal: null,
    skin: defaultSkin,
    fairySkin,
  });

  assert.equal(html.includes("data-universe-id=\"fairy-tale\""), true);
  assert.equal(html.includes("data-universe-id=\"work\""), true);
  assert.equal(html.includes("data-universe-id=\"doors-windows\""), true);
  assert.equal(html.includes("role=\"dialog\""), false);
  assert.equal(html.includes("universe_lock_icon"), true);
});

function assertAssetKeys(keys: AssetKey[]): void {
  const required = new Set(REQUIRED_ASSET_KEYS);

  for (const key of keys) {
    assert.equal(required.has(key), true);
  }
}

function withUnavailableResources(skin: typeof fairySkin): typeof fairySkin {
  return {
    ...skin,
    resources: Object.fromEntries(
      Object.entries(skin.resources).map(([key, resource]) => [
        key,
        { ...resource, available: false },
      ]),
    ) as typeof skin.resources,
  };
}

function createGameplayState(): GameplayState {
  return {
    phase: "playing",
    score: 120,
    comboMax: 2,
    playerHp: 90,
    playerMaxHp: 100,
    playerShield: 10,
    enemyHp: 24,
    enemyMaxHp: 30,
    enemyId: "forest-slime",
    enemyName: "森林史莱姆",
    wave: 1,
    totalWaves: 6,
    enemyAttackCounter: 0,
    enemyAttackInterval: 0,
    lastDamage: 34,
    lastComboCount: 2,
    lastSkillText: "flameSlash",
    lastSkillLevel: "skill",
    lastVfxKeys: ["screenShake:medium", "red_skill_slash"],
  };
}

function createPieces(): Piece[] {
  return Array.from({ length: 64 }, (_, index) => ({
    id: `p${index}`,
    type: (index % 6) as PieceType,
    x: index % 8,
    y: Math.floor(index / 8),
    isMatched: false,
  }));
}

function countOccurrences(value: string, pattern: string): number {
  return value.split(pattern).length - 1;
}
