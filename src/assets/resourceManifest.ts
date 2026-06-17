import {
  ASSET_MANIFEST,
  REQUIRED_ASSET_KEYS,
  type AssetKey,
} from "./assetManifest.ts";

export type ResourceLayer =
  | "common"
  | "fairy-base"
  | "fairy-waves"
  | "yizai-pro"
  | "endless"
  | "vfx";

export type PreloadPolicy =
  | "startup"
  | "before-fairy"
  | "before-wave"
  | "before-endless"
  | "on-demand";

export type ResourceDelivery = "keep-local" | "subpackage" | "remote" | "lazy-load";

export type ResourceType =
  | "image"
  | "spritesheet"
  | "vfx"
  | "ui"
  | "background";

export interface GameResourceEntry {
  id: AssetKey;
  layer: ResourceLayer;
  type: ResourceType;
  localUrl: string;
  remoteUrl?: string;
  version: string;
  sizeBudgetKB?: number;
  preloadPolicy: PreloadPolicy;
  fallbackId?: AssetKey;
  requiredForStart?: boolean;
  delivery: ResourceDelivery;
  waveIds?: readonly string[];
}

interface ResourceInput {
  layer: ResourceLayer;
  type: ResourceType;
  preloadPolicy: PreloadPolicy;
  delivery?: ResourceDelivery;
  remoteUrl?: string;
  sizeBudgetKB?: number;
  fallbackId?: AssetKey;
  requiredForStart?: boolean;
  waveIds?: readonly string[];
}

export const LOCAL_RESOURCE_VERSION = "local-2026-06-17";
export const REMOTE_RESOURCE_BASE_URL =
  "https://cdn.example.invalid/maee-match3/local-2026-06-17";

export const LAYER_BUDGETS_KB: Partial<Record<ResourceLayer, number>> = {
  common: 1024,
  "fairy-base": 4096,
};

const COMMON_UI_KEYS = [
  "home_bg",
  "logo_yizai_match3",
  "btn_start",
  "btn_rank",
  "btn_points",
  "btn_exchange",
  "btn_settings",
  "panel_common",
  "modal_common",
  "universe_card_fairy",
  "universe_card_work",
  "universe_card_window",
  "universe_lock_icon",
] as const satisfies readonly AssetKey[];

const FAIRY_BACKGROUND_KEYS = [
  "ft_gameplay_bg",
  "ft_battle_stage_bg",
] as const satisfies readonly AssetKey[];

const FAIRY_BOARD_KEYS = [
  "ft_board_frame",
  "ft_board_bg",
  "ft_grid_cell",
  "ft_grid_cell_highlight",
] as const satisfies readonly AssetKey[];

const FAIRY_PIECE_KEYS = [
  "piece_red_flame",
  "piece_blue_frost",
  "piece_yellow_star",
  "piece_green_nature",
  "piece_purple_arcane",
  "piece_orange_courage",
] as const satisfies readonly AssetKey[];

const YIZAI_STATIC_KEYS = [
  "yizai_hero_idle",
  "yizai_hero_attack",
  "yizai_hero_skill",
  "yizai_hero_ultimate",
  "yizai_hero_hurt",
] as const satisfies readonly AssetKey[];

const YIZAI_LEGACY_SHEET_FALLBACKS = {
  yizai_hero_idle_sheet: "yizai_hero_idle",
  yizai_hero_attack_sheet: "yizai_hero_attack",
  yizai_hero_skill_sheet: "yizai_hero_skill",
  yizai_hero_ultimate_sheet: "yizai_hero_ultimate",
  yizai_hero_hurt_sheet: "yizai_hero_hurt",
} as const satisfies Partial<Record<AssetKey, AssetKey>>;

const YIZAI_PRO_SHEET_FALLBACKS = {
  yizai_hero_idle_sheet_pro: "yizai_hero_idle_sheet",
  yizai_hero_attack_sheet_pro: "yizai_hero_attack_sheet",
  yizai_hero_skill_sheet_pro: "yizai_hero_skill_sheet",
  yizai_hero_ultimate_sheet_pro: "yizai_hero_ultimate_sheet",
  yizai_hero_hurt_sheet_pro: "yizai_hero_hurt_sheet",
} as const satisfies Partial<Record<AssetKey, AssetKey>>;

const FAIRY_BASE_MONSTER_FALLBACKS = {
  monster_slime_idle: undefined,
  monster_slime_hit: "monster_slime_idle",
  monster_slime_attack: "monster_slime_idle",
  monster_slime_defeat: "monster_slime_idle",
} as const satisfies Partial<Record<AssetKey, AssetKey | undefined>>;

const FAIRY_BASE_MONSTER_SHEET_FALLBACKS = {
  monster_slime_idle_sheet_pro: "monster_slime_idle",
  monster_slime_hit_sheet_pro: "monster_slime_hit",
  monster_slime_attack_sheet_pro: "monster_slime_attack",
  monster_slime_defeat_sheet_pro: "monster_slime_defeat",
  monster_slime_idle_sheet: "monster_slime_idle",
  monster_slime_hit_sheet: "monster_slime_hit",
  monster_slime_attack_sheet: "monster_slime_attack",
  monster_slime_defeat_sheet: "monster_slime_defeat",
} as const satisfies Partial<Record<AssetKey, AssetKey>>;

const FAIRY_WAVE_MONSTERS = [
  {
    waveId: "pumpkin_imp",
    keys: {
      idle: "monster_pumpkin_idle",
      hit: "monster_pumpkin_hit",
      attack: "monster_pumpkin_attack",
      defeat: "monster_pumpkin_defeat",
    },
  },
  {
    waveId: "fairy_crow",
    keys: {
      idle: "monster_crow_idle",
      hit: "monster_crow_hit",
      attack: "monster_crow_attack",
      defeat: "monster_crow_defeat",
    },
  },
  {
    waveId: "tree_spirit",
    keys: {
      idle: "monster_tree_idle",
      hit: "monster_tree_hit",
      attack: "monster_tree_attack",
      defeat: "monster_tree_defeat",
    },
  },
  {
    waveId: "forest_wolf",
    keys: {
      idle: "monster_wolf_idle",
      hit: "monster_wolf_hit",
      attack: "monster_wolf_attack",
      defeat: "monster_wolf_defeat",
    },
  },
  {
    waveId: "fairy_dragon_boss",
    keys: {
      idle: "boss_dragon_idle",
      hit: "boss_dragon_hit",
      attack: "boss_dragon_attack",
      defeat: "boss_dragon_defeat",
    },
  },
] as const satisfies readonly {
  waveId: string;
  keys: Record<"idle" | "hit" | "attack" | "defeat", AssetKey>;
}[];

const ENDLESS_MONSTER_KEYS = {
  idle: "boss_demon_king_idle",
  hit: "boss_demon_king_hit",
  attack: "boss_demon_king_attack",
  defeat: "boss_demon_king_defeat",
} as const satisfies Record<"idle" | "hit" | "attack" | "defeat", AssetKey>;

const FAIRY_UI_KEYS = [
  "ui_hp_bar_bg",
  "ui_hp_bar_player_fill",
  "ui_hp_bar_enemy_fill",
  "ui_shield_bar_fill",
  "ui_attack_pip_on",
  "ui_attack_pip_off",
] as const satisfies readonly AssetKey[];

const VFX_KEYS = [
  "vfx_red_skill_slash",
  "vfx_blue_skill_freeze",
  "vfx_yellow_skill_chain",
  "vfx_green_skill_shield",
  "vfx_purple_skill_bomb",
  "vfx_orange_skill_hammer",
  "vfx_red_ultimate_spin",
  "vfx_blue_ultimate_icefall",
  "vfx_yellow_ultimate_meteor",
  "vfx_green_ultimate_bloom",
  "vfx_purple_ultimate_magic_circle",
  "vfx_orange_ultimate_judgement",
] as const satisfies readonly AssetKey[];

export const RESOURCE_MANIFEST: readonly GameResourceEntry[] = [
  ...COMMON_UI_KEYS.map((id) =>
    resource(id, {
      layer: "common",
      type: id.startsWith("btn_") || id.includes("panel") || id.includes("modal")
        ? "ui"
        : "image",
      preloadPolicy: "startup",
      delivery: "keep-local",
      sizeBudgetKB: 128,
      requiredForStart: id !== "universe_card_work" && id !== "universe_card_window",
    }),
  ),
  ...FAIRY_BACKGROUND_KEYS.map((id) =>
    resource(id, {
      layer: "fairy-base",
      type: "background",
      preloadPolicy: "before-fairy",
      delivery: "subpackage",
      sizeBudgetKB: id === "ft_gameplay_bg" ? 1024 : 512,
    }),
  ),
  ...FAIRY_BOARD_KEYS.map((id) =>
    resource(id, {
      layer: "fairy-base",
      type: id.includes("grid_cell") ? "ui" : "image",
      preloadPolicy: "before-fairy",
      delivery: "subpackage",
      sizeBudgetKB: id === "ft_board_bg" || id === "ft_board_frame" ? 384 : 128,
    }),
  ),
  ...FAIRY_PIECE_KEYS.map((id) =>
    resource(id, {
      layer: "fairy-base",
      type: "image",
      preloadPolicy: "before-fairy",
      delivery: "subpackage",
      sizeBudgetKB: 96,
    }),
  ),
  ...YIZAI_STATIC_KEYS.map((id) =>
    resource(id, {
      layer: "fairy-base",
      type: "image",
      preloadPolicy: id === "yizai_hero_idle" || id === "yizai_hero_attack"
        ? "before-fairy"
        : "on-demand",
      delivery: "subpackage",
      sizeBudgetKB: 256,
    }),
  ),
  ...Object.entries(YIZAI_LEGACY_SHEET_FALLBACKS).map(([id, fallbackId]) =>
    resource(id as AssetKey, {
      layer: "fairy-base",
      type: "spritesheet",
      preloadPolicy: "on-demand",
      delivery: "lazy-load",
      sizeBudgetKB: 768,
      fallbackId,
    }),
  ),
  ...Object.entries(YIZAI_PRO_SHEET_FALLBACKS).map(([id, fallbackId]) =>
    resource(id as AssetKey, {
      layer: "yizai-pro",
      type: "spritesheet",
      preloadPolicy: "on-demand",
      delivery: "remote",
      remoteUrl: `${REMOTE_RESOURCE_BASE_URL}${ASSET_MANIFEST[id as AssetKey]}`,
      sizeBudgetKB: 1024,
      fallbackId,
    }),
  ),
  ...Object.entries(FAIRY_BASE_MONSTER_FALLBACKS).map(([id, fallbackId]) => {
    const input: ResourceInput = {
      layer: "fairy-base",
      type: "image",
      preloadPolicy: "before-fairy",
      delivery: "subpackage",
      sizeBudgetKB: 256,
      waveIds: ["forest_slime"],
    };

    if (fallbackId) {
      input.fallbackId = fallbackId;
    }

    return resource(id as AssetKey, input);
  }),
  ...Object.entries(FAIRY_BASE_MONSTER_SHEET_FALLBACKS).map(([id, fallbackId]) =>
    resource(id as AssetKey, {
      layer: "fairy-base",
      type: "spritesheet",
      preloadPolicy: "on-demand",
      delivery: "lazy-load",
      sizeBudgetKB: 512,
      fallbackId,
      waveIds: ["forest_slime"],
    }),
  ),
  ...FAIRY_WAVE_MONSTERS.flatMap(({ waveId, keys }) =>
    (["idle", "hit", "attack", "defeat"] as const).map((state) =>
      resource(keys[state], {
        layer: "fairy-waves",
        type: "image",
        preloadPolicy: "before-wave",
        delivery: "subpackage",
        sizeBudgetKB: state === "idle" ? 256 : 320,
        fallbackId:
          state === "idle" ? "monster_slime_idle" : keys.idle,
        waveIds: [waveId],
      }),
    ),
  ),
  ...(["idle", "hit", "attack", "defeat"] as const).map((state) =>
    resource(ENDLESS_MONSTER_KEYS[state], {
      layer: "endless",
      type: "image",
      preloadPolicy: "before-endless",
      delivery: "remote",
      remoteUrl: `${REMOTE_RESOURCE_BASE_URL}${ASSET_MANIFEST[ENDLESS_MONSTER_KEYS[state]]}`,
      sizeBudgetKB: 320,
      fallbackId:
        state === "idle" ? "boss_dragon_idle" : ENDLESS_MONSTER_KEYS.idle,
      waveIds: ["endless_demon_king"],
    }),
  ),
  ...FAIRY_UI_KEYS.map((id) =>
    resource(id, {
      layer: "fairy-base",
      type: "ui",
      preloadPolicy: "before-fairy",
      delivery: "keep-local",
      sizeBudgetKB: 64,
    }),
  ),
  ...VFX_KEYS.map((id) =>
    resource(id, {
      layer: "vfx",
      type: "vfx",
      preloadPolicy: "on-demand",
      delivery: "lazy-load",
      sizeBudgetKB: 256,
    }),
  ),
];

export const RESOURCE_BY_ID = Object.freeze(
  Object.fromEntries(RESOURCE_MANIFEST.map((entry) => [entry.id, entry])),
) as Readonly<Record<AssetKey, GameResourceEntry>>;

export const RESOURCE_IDS = Object.freeze(
  RESOURCE_MANIFEST.map((entry) => entry.id),
) as readonly AssetKey[];

assertManifestCoversAssetManifest();

function resource(id: AssetKey, input: ResourceInput): GameResourceEntry {
  const entry: GameResourceEntry = {
    id,
    layer: input.layer,
    type: input.type,
    localUrl: ASSET_MANIFEST[id],
    version: LOCAL_RESOURCE_VERSION,
    preloadPolicy: input.preloadPolicy,
    delivery: input.delivery ?? defaultDeliveryForLayer(input.layer),
  };

  if (input.remoteUrl) {
    entry.remoteUrl = input.remoteUrl;
  }

  if (input.sizeBudgetKB !== undefined) {
    entry.sizeBudgetKB = input.sizeBudgetKB;
  }

  if (input.fallbackId) {
    entry.fallbackId = input.fallbackId;
  }

  if (input.requiredForStart !== undefined) {
    entry.requiredForStart = input.requiredForStart;
  }

  if (input.waveIds) {
    entry.waveIds = input.waveIds;
  }

  return entry;
}

function defaultDeliveryForLayer(layer: ResourceLayer): ResourceDelivery {
  switch (layer) {
    case "common":
      return "keep-local";
    case "fairy-base":
    case "fairy-waves":
      return "subpackage";
    case "yizai-pro":
    case "endless":
      return "remote";
    case "vfx":
      return "lazy-load";
  }
}

function assertManifestCoversAssetManifest(): void {
  if (RESOURCE_MANIFEST.length !== REQUIRED_ASSET_KEYS.length) {
    throw new Error(
      `Resource manifest has ${RESOURCE_MANIFEST.length} entries, expected ${REQUIRED_ASSET_KEYS.length}.`,
    );
  }

  const ids = new Set(RESOURCE_MANIFEST.map((entry) => entry.id));
  const missing = REQUIRED_ASSET_KEYS.filter((key) => !ids.has(key));

  if (missing.length > 0) {
    throw new Error(`Resource manifest is missing: ${missing.join(", ")}`);
  }
}
