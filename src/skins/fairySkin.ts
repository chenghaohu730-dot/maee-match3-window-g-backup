import type { AssetKey } from "../assets/assetManifest.ts";
import type { Match3Skin, SkinResource } from "./skinTypes.ts";
import {
  MONSTER_ASSETS,
  PIECE_ASSETS,
  VFX_ASSETS,
  createSkinAnimations,
  createSkinResources,
} from "./defaultSkin.ts";

const fairyOverrides: Partial<
  Record<AssetKey, Partial<Omit<SkinResource, "key">>>
> = {
  home_bg: {
    fallbackClass:
      "asset-fallback fallback-fairy fallback-background fallback-home-bg",
    fallbackLabel: "宇宙大厅",
  },
  universe_card_fairy: {
    fallbackClass:
      "asset-fallback fallback-fairy fallback-card fairy-card-unlocked",
    fallbackLabel: "童话宇宙",
  },
  universe_card_work: {
    fallbackClass:
      "asset-fallback fallback-fairy fallback-card locked-card-work",
    fallbackLabel: "打工宇宙",
  },
  universe_card_window: {
    fallbackClass:
      "asset-fallback fallback-fairy fallback-card locked-card-window",
    fallbackLabel: "门窗宇宙",
  },
  ft_gameplay_bg: {
    fallbackClass:
      "asset-fallback fallback-fairy fallback-background fairy-gameplay-bg",
    fallbackLabel: "童话玩法背景",
  },
  ft_battle_stage_bg: {
    fallbackClass:
      "asset-fallback fallback-fairy fallback-background fairy-battle-stage",
    fallbackLabel: "童话战斗舞台",
  },
  ft_board_frame: {
    available: true,
    fallbackClass:
      "asset-fallback fallback-fairy fallback-panel fairy-board-frame",
    fallbackLabel: "童话棋盘框",
  },
  ft_board_bg: {
    available: true,
    fallbackClass: "asset-fallback fallback-fairy fallback-panel fairy-board-bg",
    fallbackLabel: "童话棋盘底",
  },
  ft_grid_cell: {
    available: true,
    fallbackClass: "asset-fallback fallback-fairy fallback-cell fairy-grid-cell",
    fallbackLabel: "童话棋格",
  },
  ft_grid_cell_highlight: {
    available: true,
    fallbackClass:
      "asset-fallback fallback-fairy fallback-cell fairy-grid-cell-highlight",
    fallbackLabel: "童话棋格高亮",
  },
  piece_red_flame: {
    available: true,
    fallbackClass: "asset-fallback fallback-fairy fallback-piece piece-red-flame",
    fallbackLabel: "火焰",
  },
  piece_blue_frost: {
    available: true,
    fallbackClass:
      "asset-fallback fallback-fairy fallback-piece piece-blue-frost",
    fallbackLabel: "冰霜",
  },
  piece_yellow_star: {
    available: true,
    fallbackClass:
      "asset-fallback fallback-fairy fallback-piece piece-yellow-star",
    fallbackLabel: "星光",
  },
  piece_green_nature: {
    available: true,
    fallbackClass:
      "asset-fallback fallback-fairy fallback-piece piece-green-nature",
    fallbackLabel: "自然",
  },
  piece_purple_arcane: {
    available: true,
    fallbackClass:
      "asset-fallback fallback-fairy fallback-piece piece-purple-arcane",
    fallbackLabel: "奥术",
  },
  piece_orange_courage: {
    available: true,
    fallbackClass:
      "asset-fallback fallback-fairy fallback-piece piece-orange-courage",
    fallbackLabel: "勇气",
  },
  yizai_hero_idle: {
    fallbackClass: "asset-fallback fallback-fairy fallback-hero yizai-hero-idle",
    fallbackLabel: "亿仔勇者",
  },
  monster_slime_idle: {
    fallbackClass:
      "asset-fallback fallback-fairy fallback-monster monster-slime-card",
    fallbackLabel: "森林史莱姆",
  },
  monster_slime_hit: {
    fallbackClass:
      "asset-fallback fallback-fairy fallback-monster monster-slime-card",
    fallbackLabel: "森林史莱姆受击",
  },
  monster_slime_attack: {
    fallbackClass:
      "asset-fallback fallback-fairy fallback-monster monster-slime-card",
    fallbackLabel: "森林史莱姆攻击",
  },
  monster_slime_defeat: {
    fallbackClass:
      "asset-fallback fallback-fairy fallback-monster monster-slime-card",
    fallbackLabel: "森林史莱姆退场",
  },
  monster_pumpkin_idle: {
    fallbackClass:
      "asset-fallback fallback-fairy fallback-monster monster-pumpkin-card",
    fallbackLabel: "南瓜怪",
  },
  monster_crow_idle: {
    fallbackClass:
      "asset-fallback fallback-fairy fallback-monster monster-crow-card",
    fallbackLabel: "乌鸦怪",
  },
  monster_tree_idle: {
    fallbackClass:
      "asset-fallback fallback-fairy fallback-monster monster-tree-card",
    fallbackLabel: "荆棘树精",
  },
  monster_wolf_idle: {
    fallbackClass:
      "asset-fallback fallback-fairy fallback-monster monster-wolf-card",
    fallbackLabel: "狼兵",
  },
  boss_dragon_idle: {
    fallbackClass:
      "asset-fallback fallback-fairy fallback-monster boss-dragon-card",
    fallbackLabel: "黑龙幼王",
  },
};

export const fairySkin: Match3Skin = {
  id: "fairy",
  displayName: "童话宇宙皮肤",
  resources: createSkinResources("fairy", fairyOverrides),
  pieceAssets: PIECE_ASSETS,
  monsterAssets: MONSTER_ASSETS,
  vfxAssets: VFX_ASSETS,
  animations: createSkinAnimations("fairy"),
  sceneClasses: {
    start: "skin-fairy start-hall-fallback",
    universe: "skin-fairy universe-hall-fallback",
    gameplay: "skin-fairy fairy-gameplay-fallback",
  },
};
