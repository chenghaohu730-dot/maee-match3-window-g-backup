import assert from "node:assert/strict";
import test from "node:test";
import {
  REQUIRED_ASSET_KEYS,
  type AssetKey,
} from "../src/assets/assetManifest.ts";
import {
  RESOURCE_BY_ID,
  RESOURCE_IDS,
  RESOURCE_MANIFEST,
} from "../src/assets/resourceManifest.ts";
import {
  getResourceStatus,
  getResourceUrl,
  loadLayer,
  loadResource,
  preloadForWave,
  resetResourceLoaderForTests,
  setResourceLoadAdapterForTests,
} from "../src/assets/resourceLoader.ts";

const PIECE_KEYS = [
  "piece_red_flame",
  "piece_blue_frost",
  "piece_yellow_star",
  "piece_green_nature",
  "piece_purple_arcane",
  "piece_orange_courage",
] as const satisfies readonly AssetKey[];

const BOARD_KEYS = [
  "ft_board_frame",
  "ft_board_bg",
  "ft_grid_cell",
  "ft_grid_cell_highlight",
] as const satisfies readonly AssetKey[];

test.afterEach(() => {
  resetResourceLoaderForTests();
});

test("resource manifest covers every existing asset key", () => {
  assert.deepEqual([...RESOURCE_IDS].sort(), [...REQUIRED_ASSET_KEYS].sort());

  for (const key of [...PIECE_KEYS, ...BOARD_KEYS]) {
    const entry = RESOURCE_BY_ID[key];

    assert.equal(entry.id, key);
    assert.equal(entry.localUrl.startsWith("/assets/"), true);
    assert.equal(entry.layer, "fairy-base");
    assert.equal(entry.preloadPolicy, "before-fairy");
  }
});

test("yizai pro sheets are remote on-demand resources with legacy fallbacks", () => {
  const proEntries = RESOURCE_MANIFEST.filter(
    (entry) => entry.layer === "yizai-pro",
  );

  assert.equal(proEntries.length, 5);
  for (const entry of proEntries) {
    assert.equal(entry.delivery, "remote");
    assert.equal(entry.preloadPolicy, "on-demand");
    assert.equal(entry.remoteUrl?.startsWith("https://"), true);
    assert.equal(entry.fallbackId?.endsWith("_sheet"), true);
  }
});

test("monster resources carry fallback ids for non-idle states", () => {
  assert.equal(RESOURCE_BY_ID.monster_pumpkin_hit.fallbackId, "monster_pumpkin_idle");
  assert.equal(RESOURCE_BY_ID.monster_crow_attack.fallbackId, "monster_crow_idle");
  assert.equal(RESOURCE_BY_ID.monster_tree_defeat.fallbackId, "monster_tree_idle");
  assert.equal(RESOURCE_BY_ID.boss_dragon_idle.fallbackId, "monster_slime_idle");
  assert.equal(RESOURCE_BY_ID.boss_demon_king_hit.fallbackId, "boss_demon_king_idle");
});

test("loadResource returns the local URL in the current web build", async () => {
  const url = await loadResource("piece_red_flame");

  assert.equal(url, "/assets/fairy/pieces/piece_red_flame.png");
  assert.equal(getResourceUrl("piece_red_flame"), url);
  assert.equal(getResourceStatus("piece_red_flame"), "loaded");
});

test("loadLayer can preload fairy-base resources", async () => {
  const summary = await loadLayer("fairy-base");

  assert.equal(summary.total > 0, true);
  assert.equal(summary.loaded, summary.total);
  assert.equal(summary.failed, 0);
  assert.equal(
    summary.resources.some((resource) => resource.id === "ft_board_bg"),
    true,
  );
});

test("preloadForWave only pulls the requested wave resources", async () => {
  const summary = await preloadForWave("pumpkin_imp");

  assert.equal(summary.total, 4);
  assert.deepEqual(
    summary.resources.map((resource) => resource.id).sort(),
    [
      "monster_pumpkin_attack",
      "monster_pumpkin_defeat",
      "monster_pumpkin_hit",
      "monster_pumpkin_idle",
    ],
  );
});

test("failed yizai pro load falls back without throwing", async () => {
  const restoreWarnings = muteWarnings();
  setResourceLoadAdapterForTests(async (url) => {
    if (url.includes("/pro/")) {
      throw new Error("simulated pro sheet failure");
    }
  });

  try {
    const url = await loadResource("yizai_hero_attack_sheet_pro");

    assert.equal(url, "/assets/fairy/yizai/yizai_hero_attack_sheet.png");
    assert.equal(getResourceStatus("yizai_hero_attack_sheet_pro"), "failed");
    assert.equal(getResourceStatus("yizai_hero_attack_sheet"), "loaded");
  } finally {
    restoreWarnings();
  }
});

test("missing UI assets resolve to CSS fallback instead of throwing", async () => {
  const restoreWarnings = muteWarnings();
  setResourceLoadAdapterForTests(async () => {
    throw new Error("simulated ui miss");
  });

  try {
    const url = await loadResource("ui_hp_bar_bg");

    assert.equal(url, "");
    assert.equal(getResourceStatus("ui_hp_bar_bg"), "failed");
  } finally {
    restoreWarnings();
  }
});

function muteWarnings(): () => void {
  const originalWarn = console.warn;
  console.warn = () => undefined;
  return () => {
    console.warn = originalWarn;
  };
}
