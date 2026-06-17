import assert from "node:assert/strict";
import test from "node:test";
import { resolve, sep } from "node:path";
import type { AssetKey } from "../src/assets/assetManifest.ts";
import type { Piece, PieceType } from "../src/core/board.ts";
import type { GameplayState } from "../src/core/gameplayTypes.ts";
import { fairySkin } from "../src/skins/fairySkin.ts";
import {
  hasImageResource,
  type Match3Skin,
  type SkinResource,
} from "../src/skins/skinTypes.ts";
import { createDefaultProgress } from "../src/ui/progressionStore.ts";
import { renderGameplayScene } from "../src/ui/gameplayView.ts";
import type { EnemyAnimationState } from "../src/ui/characterAnimationTypes.ts";

const FAIRY_MVP_ASSETS = [
  ["piece_red_flame", "/assets/fairy/pieces/piece_red_flame.png"],
  ["piece_blue_frost", "/assets/fairy/pieces/piece_blue_frost.png"],
  ["piece_yellow_star", "/assets/fairy/pieces/piece_yellow_star.png"],
  ["piece_green_nature", "/assets/fairy/pieces/piece_green_nature.png"],
  ["piece_purple_arcane", "/assets/fairy/pieces/piece_purple_arcane.png"],
  ["piece_orange_courage", "/assets/fairy/pieces/piece_orange_courage.png"],
  ["ft_board_frame", "/assets/fairy/board/ft_board_frame.png"],
  ["ft_board_bg", "/assets/fairy/board/ft_board_bg.png"],
  ["ft_grid_cell", "/assets/fairy/board/ft_grid_cell.png"],
  ["ft_grid_cell_highlight", "/assets/fairy/board/ft_grid_cell_highlight.png"],
  ["ft_gameplay_bg", "/assets/fairy/backgrounds/ft_gameplay_bg.png"],
  ["ft_battle_stage_bg", "/assets/fairy/backgrounds/ft_battle_stage_bg.png"],
  ["yizai_hero_idle", "/assets/fairy/yizai/yizai_hero_idle.png"],
  ["yizai_hero_attack", "/assets/fairy/yizai/yizai_hero_attack.png"],
  ["yizai_hero_skill", "/assets/fairy/yizai/yizai_hero_skill.png"],
  ["yizai_hero_ultimate", "/assets/fairy/yizai/yizai_hero_ultimate.png"],
  ["yizai_hero_hurt", "/assets/fairy/yizai/yizai_hero_hurt.png"],
  [
    "yizai_hero_idle_sheet_pro",
    "/assets/fairy/yizai/pro/yizai_hero_idle_sheet.png",
  ],
  [
    "yizai_hero_attack_sheet_pro",
    "/assets/fairy/yizai/pro/yizai_hero_attack_sheet.png",
  ],
  [
    "yizai_hero_skill_sheet_pro",
    "/assets/fairy/yizai/pro/yizai_hero_skill_sheet.png",
  ],
  [
    "yizai_hero_ultimate_sheet_pro",
    "/assets/fairy/yizai/pro/yizai_hero_ultimate_sheet.png",
  ],
  [
    "yizai_hero_hurt_sheet_pro",
    "/assets/fairy/yizai/pro/yizai_hero_hurt_sheet.png",
  ],
  ["yizai_hero_idle_sheet", "/assets/fairy/yizai/yizai_hero_idle_sheet.png"],
  [
    "yizai_hero_attack_sheet",
    "/assets/fairy/yizai/yizai_hero_attack_sheet.png",
  ],
  ["yizai_hero_skill_sheet", "/assets/fairy/yizai/yizai_hero_skill_sheet.png"],
  [
    "yizai_hero_ultimate_sheet",
    "/assets/fairy/yizai/yizai_hero_ultimate_sheet.png",
  ],
  ["yizai_hero_hurt_sheet", "/assets/fairy/yizai/yizai_hero_hurt_sheet.png"],
  ["monster_slime_idle", "/assets/fairy/monsters/monster_slime_idle.png"],
  ["monster_slime_hit", "/assets/fairy/monsters/monster_slime_hit.png"],
  ["monster_slime_attack", "/assets/fairy/monsters/monster_slime_attack.png"],
  ["monster_slime_defeat", "/assets/fairy/monsters/monster_slime_defeat.png"],
  [
    "monster_slime_idle_sheet_pro",
    "/assets/fairy/monsters/pro/monster_slime_idle_sheet.png",
  ],
  [
    "monster_slime_hit_sheet_pro",
    "/assets/fairy/monsters/pro/monster_slime_hit_sheet.png",
  ],
  [
    "monster_slime_attack_sheet_pro",
    "/assets/fairy/monsters/pro/monster_slime_attack_sheet.png",
  ],
  [
    "monster_slime_defeat_sheet_pro",
    "/assets/fairy/monsters/pro/monster_slime_defeat_sheet.png",
  ],
] as const satisfies readonly (readonly [AssetKey, string])[];

const FORMAL_PIECE_KEYS = [
  "piece_red_flame",
  "piece_blue_frost",
  "piece_yellow_star",
  "piece_green_nature",
  "piece_purple_arcane",
  "piece_orange_courage",
] as const satisfies readonly AssetKey[];

const FORMAL_BOARD_KEYS = [
  "ft_board_frame",
  "ft_board_bg",
  "ft_grid_cell",
  "ft_grid_cell_highlight",
] as const satisfies readonly AssetKey[];

const FORMAL_BACKGROUND_KEYS = [
  "ft_gameplay_bg",
  "ft_battle_stage_bg",
] as const satisfies readonly AssetKey[];

const FORMAL_YIZAI_HERO_KEYS = [
  "yizai_hero_idle",
  "yizai_hero_attack",
  "yizai_hero_skill",
  "yizai_hero_ultimate",
  "yizai_hero_hurt",
] as const satisfies readonly AssetKey[];

const PRO_YIZAI_SHEET_KEYS = [
  "yizai_hero_idle_sheet_pro",
  "yizai_hero_attack_sheet_pro",
  "yizai_hero_skill_sheet_pro",
  "yizai_hero_ultimate_sheet_pro",
  "yizai_hero_hurt_sheet_pro",
] as const satisfies readonly AssetKey[];

const LEGACY_YIZAI_SHEET_KEYS = [
  "yizai_hero_idle_sheet",
  "yizai_hero_attack_sheet",
  "yizai_hero_skill_sheet",
  "yizai_hero_ultimate_sheet",
  "yizai_hero_hurt_sheet",
] as const satisfies readonly AssetKey[];

const FORMAL_MONSTER_SLIME_KEYS = [
  "monster_slime_idle",
  "monster_slime_hit",
  "monster_slime_attack",
  "monster_slime_defeat",
] as const satisfies readonly AssetKey[];

const FORMAL_READY_KEYS = [
  ...FORMAL_PIECE_KEYS,
  ...FORMAL_BOARD_KEYS,
  ...FORMAL_BACKGROUND_KEYS,
  ...FORMAL_YIZAI_HERO_KEYS,
  ...PRO_YIZAI_SHEET_KEYS,
  ...LEGACY_YIZAI_SHEET_KEYS,
  ...FORMAL_MONSTER_SLIME_KEYS,
] as const satisfies readonly AssetKey[];

test("fairySkin has paths for every first-batch fairy MVP asset", () => {
  for (const [key, expectedPath] of FAIRY_MVP_ASSETS) {
    const resource = fairySkin.resources[key];

    assert.equal(resource.key, key);
    assert.equal(resource.path, expectedPath);
    assert.equal(resource.path.endsWith(".png"), true);
    assert.equal(resource.fallbackClass.length > 0, true);
    assert.equal(resource.fallbackLabel.length > 0, true);
  }
});

test("first-batch fairy MVP paths resolve inside public assets", () => {
  const publicRoot = resolve(process.cwd(), "public");

  for (const [key] of FAIRY_MVP_ASSETS) {
    const resource = fairySkin.resources[key];
    const publicPath = resolve(
      publicRoot,
      resource.path.slice(1).replaceAll("/", sep),
    );

    assert.equal(publicPath.startsWith(publicRoot), true);
    assert.equal(publicPath.endsWith(".png"), true);
  }
});

test("formal fairy piece images render by default", () => {
  for (const key of FORMAL_PIECE_KEYS) {
    const resource = fairySkin.resources[key];

    assert.equal(resource.available, true);
    assert.equal(hasImageResource(resource), true);
  }

  const html = renderGameplayScene(createGameplayModel(fairySkin));

  assert.equal(
    html.includes("url('/assets/fairy/pieces/piece_red_flame.png')"),
    true,
  );
  assert.equal(
    html.includes("url('/assets/fairy/pieces/piece_orange_courage.png')"),
    true,
  );
});

test("formal fairy board images render by default", () => {
  for (const key of FORMAL_BOARD_KEYS) {
    const resource = fairySkin.resources[key];

    assert.equal(resource.available, true);
    assert.equal(hasImageResource(resource), true);
  }

  const html = renderGameplayScene(createGameplayModel(fairySkin));

  assert.equal(
    html.includes("url('/assets/fairy/board/ft_board_frame.png')"),
    true,
  );
  assert.equal(
    html.includes("url('/assets/fairy/board/ft_board_bg.png')"),
    true,
  );
  assert.equal(
    html.includes("url('/assets/fairy/board/ft_grid_cell.png')"),
    true,
  );
  assert.equal(
    html.includes("url('/assets/fairy/board/ft_grid_cell_highlight.png')"),
    true,
  );
});

test("formal fairy background images render by default", () => {
  for (const key of FORMAL_BACKGROUND_KEYS) {
    const resource = fairySkin.resources[key];

    assert.equal(resource.available, true);
    assert.equal(hasImageResource(resource), true);
  }

  const html = renderGameplayScene(createGameplayModel(fairySkin));

  assert.equal(
    html.includes("url('/assets/fairy/backgrounds/ft_gameplay_bg.png')"),
    true,
  );
  assert.equal(
    html.includes("url('/assets/fairy/backgrounds/ft_battle_stage_bg.png')"),
    true,
  );
});

test("pro yizai keys exist and legacy yizai sheets remain fallback-ready", () => {
  for (const key of FORMAL_YIZAI_HERO_KEYS) {
    const resource = fairySkin.resources[key];

    assert.equal(resource.available, true);
    assert.equal(hasImageResource(resource), true);
  }

  for (const key of PRO_YIZAI_SHEET_KEYS) {
    const resource = fairySkin.resources[key];

    assert.equal(resource.available, true);
    assert.equal(resource.productionTier, "pro");
    assert.equal(hasImageResource(resource), true);
  }

  for (const key of LEGACY_YIZAI_SHEET_KEYS) {
    const resource = fairySkin.resources[key];

    assert.equal(resource.available, true);
    assert.equal(resource.productionTier, "legacy-ai");
    assert.equal(resource.legacyAiSheet, true);
    assert.equal(resource.deprecated, true);
    assert.equal(hasImageResource(resource), true);
  }

  const html = renderGameplayScene({
    ...createGameplayModel(fairySkin),
    state: {
      ...createGameplayState(),
      lastDamage: 0,
    },
  });

  assert.equal(
    html.includes(
      "url('/assets/fairy/yizai/pro/yizai_hero_idle_sheet.png')",
    ),
    true,
  );
  assert.equal(
    html.includes("data-sprite-key=\"yizai_hero_idle_sheet_pro\""),
    true,
  );
  assert.equal(
    html.includes("data-fallback-sheet-key=\"yizai_hero_idle_sheet\""),
    true,
  );
  assert.equal(html.includes("data-frame-count=\"12\""), true);
  assert.equal(html.includes("data-sprite-columns=\"6\""), true);
  assert.equal(html.includes("data-sprite-rows=\"2\""), true);
  assert.equal(html.includes("data-fallback-key=\"yizai_hero_idle\""), true);
});

test("legacy yizai attack fallback path remains available when pro is absent", () => {
  const resource = fairySkin.resources.yizai_hero_attack_sheet;
  const proUnavailableSkin = withUnavailableResources(
    fairySkin,
    PRO_YIZAI_SHEET_KEYS,
  );
  const html = renderGameplayScene({
    ...createGameplayModel(proUnavailableSkin),
    characterAnimations: {
      yizai: "attack",
      enemy: "idle",
    },
  });

  assert.equal(resource.available, true);
  assert.equal(hasImageResource(resource), true);
  assert.equal(html.includes("data-animation-state=\"attack\""), true);
  assert.equal(
    html.includes("data-sprite-key=\"yizai_hero_attack_sheet_pro\""),
    true,
  );
  assert.equal(
    html.includes("data-fallback-sheet-key=\"yizai_hero_attack_sheet\""),
    true,
  );
  assert.equal(html.includes("data-frame-count=\"16\""), true);
  assert.equal(html.includes("data-sprite-columns=\"8\""), true);
  assert.equal(html.includes("data-sprite-rows=\"2\""), true);
  assert.equal(html.includes("data-fallback-key=\"yizai_hero_attack\""), true);
  assert.equal(
    html.includes(
      "url('/assets/fairy/yizai/yizai_hero_attack_sheet.png')",
    ),
    true,
  );
});

test("legacy yizai skill and ultimate fallback paths remain when pro is absent", () => {
  const proUnavailableSkin = withUnavailableResources(
    fairySkin,
    PRO_YIZAI_SHEET_KEYS,
  );
  const skillHtml = renderGameplayScene({
    ...createGameplayModel(proUnavailableSkin),
    characterAnimations: {
      yizai: "skill",
      enemy: "idle",
    },
  });
  const ultimateHtml = renderGameplayScene({
    ...createGameplayModel(proUnavailableSkin),
    characterAnimations: {
      yizai: "ultimate",
      enemy: "idle",
    },
  });

  assert.equal(
    skillHtml.includes("data-sprite-key=\"yizai_hero_skill_sheet_pro\""),
    true,
  );
  assert.equal(
    skillHtml.includes("data-fallback-sheet-key=\"yizai_hero_skill_sheet\""),
    true,
  );
  assert.equal(skillHtml.includes("data-frame-count=\"24\""), true);
  assert.equal(skillHtml.includes("data-sprite-columns=\"8\""), true);
  assert.equal(skillHtml.includes("data-sprite-rows=\"3\""), true);
  assert.equal(skillHtml.includes("data-fallback-key=\"yizai_hero_skill\""), true);
  assert.equal(
    skillHtml.includes("url('/assets/fairy/yizai/yizai_hero_skill_sheet.png')"),
    true,
  );
  assert.equal(
    ultimateHtml.includes("data-sprite-key=\"yizai_hero_ultimate_sheet_pro\""),
    true,
  );
  assert.equal(
    ultimateHtml.includes(
      "data-fallback-sheet-key=\"yizai_hero_ultimate_sheet\"",
    ),
    true,
  );
  assert.equal(ultimateHtml.includes("data-frame-count=\"32\""), true);
  assert.equal(ultimateHtml.includes("data-sprite-columns=\"8\""), true);
  assert.equal(ultimateHtml.includes("data-sprite-rows=\"4\""), true);
  assert.equal(
    ultimateHtml.includes("data-fallback-key=\"yizai_hero_ultimate\""),
    true,
  );
  assert.equal(
    ultimateHtml.includes(
      "url('/assets/fairy/yizai/yizai_hero_ultimate_sheet.png')",
    ),
    true,
  );
});

test("formal forest slime fallback images render for every enemy state", () => {
  const expectedByState = {
    idle: "monster_slime_idle",
    hit: "monster_slime_hit",
    attack: "monster_slime_attack",
    defeat: "monster_slime_defeat",
  } as const satisfies Record<EnemyAnimationState, AssetKey>;

  for (const key of FORMAL_MONSTER_SLIME_KEYS) {
    const resource = fairySkin.resources[key];

    assert.equal(resource.available, true);
    assert.equal(hasImageResource(resource), true);
  }

  for (const [state, key] of Object.entries(expectedByState) as [
    EnemyAnimationState,
    AssetKey,
  ][]) {
    const resource = fairySkin.resources[key];
    const html = renderGameplayScene({
      ...createGameplayModel(fairySkin),
      characterAnimations: {
        yizai: "idle",
        enemy: state,
      },
    });

    assert.equal(html.includes(`data-animation-state="${state}"`), true);
    assert.equal(html.includes(`data-fallback-key="${key}"`), true);
    assert.equal(html.includes(`url('${resource.path}')`), true);
  }
});

test("missing remaining first-batch fairy MVP images stay on fallback", () => {
  for (const [key] of FAIRY_MVP_ASSETS) {
    if (isFormalReadyKey(key)) {
      continue;
    }

    const resource = fairySkin.resources[key];

    assert.equal(resource.available, false);
    assert.equal(hasImageResource(resource), false);
  }

  const html = renderGameplayScene(createGameplayModel(fairySkin));

  assert.equal(html.includes("uses-fallback"), true);
  assert.equal(
    html.includes("url('/assets/fairy/backgrounds/ft_gameplay_bg.png')"),
    true,
  );
  assert.equal(html.includes("MAEE"), true);
  assert.equal(html.includes("data-asset-key=\"ft_gameplay_bg\""), true);
  assert.equal(html.includes("data-asset-key=\"monster_slime_idle\""), true);
});

test("available first-batch fairy MVP images render asset URLs", () => {
  const imageReadySkin = withAvailableResources(fairySkin, [
    "ft_gameplay_bg",
    "ft_battle_stage_bg",
    "ft_board_frame",
    "ft_board_bg",
    "piece_red_flame",
    "piece_blue_frost",
    "piece_yellow_star",
    "piece_green_nature",
    "piece_purple_arcane",
    "piece_orange_courage",
    "yizai_hero_attack_sheet",
    "monster_slime_idle",
  ]);
  const html = renderGameplayScene(createGameplayModel(imageReadySkin));

  assert.equal(html.includes("has-image"), true);
  assert.equal(
    html.includes("url('/assets/fairy/backgrounds/ft_gameplay_bg.png')"),
    true,
  );
  assert.equal(
    html.includes("url('/assets/fairy/pieces/piece_red_flame.png')"),
    true,
  );
  assert.equal(
    html.includes(
      "url('/assets/fairy/yizai/pro/yizai_hero_idle_sheet.png')",
    ),
    true,
  );
  assert.equal(
    html.includes("data-sprite-key=\"yizai_hero_idle_sheet_pro\""),
    true,
  );
  assert.equal(
    html.includes("url('/assets/fairy/monsters/monster_slime_idle.png')"),
    true,
  );
});

function withAvailableResources(
  skin: Match3Skin,
  keys: AssetKey[],
): Match3Skin {
  const resources: Record<AssetKey, SkinResource> = { ...skin.resources };

  for (const key of keys) {
    resources[key] = {
      ...resources[key],
      available: true,
    };
  }

  return {
    ...skin,
    resources,
  };
}

function withUnavailableResources(
  skin: Match3Skin,
  keys: readonly AssetKey[],
): Match3Skin {
  const resources: Record<AssetKey, SkinResource> = { ...skin.resources };

  for (const key of keys) {
    resources[key] = {
      ...resources[key],
      available: false,
    };
  }

  return {
    ...skin,
    resources,
  };
}

function isFormalReadyKey(key: AssetKey): boolean {
  return (FORMAL_READY_KEYS as readonly AssetKey[]).includes(key);
}

function createGameplayModel(skin: Match3Skin) {
  return {
    state: createGameplayState(),
    pieces: createPieces(),
    selected: { x: 0, y: 0 },
    message: "选择两个相邻棋子交换。",
    lastEvents: [],
    progress: createDefaultProgress(),
    soundEnabled: true,
    vibrationEnabled: true,
    skin,
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
    enemyId: "forest_slime",
    enemyName: "森林史莱姆",
    wave: 1,
    totalWaves: 6,
    enemyAttackCounter: 0,
    enemyAttackInterval: 0,
    totalDamageDealt: 34,
    lastDamage: 34,
    lastComboCount: 2,
    lastVfxKeys: [],
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
