import type { AssetKey } from "../assets/assetManifest.ts";
import type { Match3Skin, SkinResource } from "./skinTypes.ts";
import {
  MONSTER_ASSETS,
  MONSTER_STATE_ASSETS,
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
    available: true,
    fallbackClass:
      "asset-fallback fallback-fairy fallback-background fairy-gameplay-bg",
    fallbackLabel: "童话玩法背景",
  },
  ft_battle_stage_bg: {
    available: true,
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
    available: true,
    fallbackClass: "asset-fallback fallback-fairy fallback-hero yizai-hero-idle",
    fallbackLabel: "亿仔勇者",
  },
  yizai_hero_attack: {
    available: true,
    fallbackClass:
      "asset-fallback fallback-fairy fallback-hero yizai-hero-attack",
    fallbackLabel: "亿仔攻击",
  },
  yizai_hero_skill: {
    available: true,
    fallbackClass:
      "asset-fallback fallback-fairy fallback-hero yizai-hero-skill",
    fallbackLabel: "亿仔技能",
  },
  yizai_hero_ultimate: {
    available: true,
    fallbackClass:
      "asset-fallback fallback-fairy fallback-hero yizai-hero-ultimate",
    fallbackLabel: "亿仔大招",
  },
  yizai_hero_hurt: {
    available: true,
    fallbackClass: "asset-fallback fallback-fairy fallback-hero yizai-hero-hurt",
    fallbackLabel: "亿仔受击",
  },
  yizai_hero_idle_sheet_pro: {
    available: true,
    productionTier: "pro",
    fallbackClass:
      "asset-fallback fallback-fairy fallback-hero yizai-hero-idle-sheet-pro",
    fallbackLabel: "亿仔待机生产版序列帧",
  },
  yizai_hero_attack_sheet_pro: {
    available: true,
    productionTier: "pro",
    fallbackClass:
      "asset-fallback fallback-fairy fallback-hero yizai-hero-attack-sheet-pro",
    fallbackLabel: "亿仔攻击生产版序列帧",
  },
  yizai_hero_skill_sheet_pro: {
    available: true,
    productionTier: "pro",
    fallbackClass:
      "asset-fallback fallback-fairy fallback-hero yizai-hero-skill-sheet-pro",
    fallbackLabel: "亿仔技能生产版序列帧",
  },
  yizai_hero_ultimate_sheet_pro: {
    available: true,
    productionTier: "pro",
    fallbackClass:
      "asset-fallback fallback-fairy fallback-hero yizai-hero-ultimate-sheet-pro",
    fallbackLabel: "亿仔大招生产版序列帧",
  },
  yizai_hero_hurt_sheet_pro: {
    available: true,
    productionTier: "pro",
    fallbackClass:
      "asset-fallback fallback-fairy fallback-hero yizai-hero-hurt-sheet-pro",
    fallbackLabel: "亿仔受击生产版序列帧",
  },
  yizai_hero_idle_sheet: {
    available: true,
    productionTier: "legacy-ai",
    legacyAiSheet: true,
    deprecated: true,
    fallbackClass:
      "asset-fallback fallback-fairy fallback-hero yizai-hero-idle-sheet",
    fallbackLabel: "亿仔待机序列帧",
  },
  yizai_hero_attack_sheet: {
    available: true,
    productionTier: "legacy-ai",
    legacyAiSheet: true,
    deprecated: true,
    fallbackClass:
      "asset-fallback fallback-fairy fallback-hero yizai-hero-attack-sheet",
    fallbackLabel: "亿仔攻击序列帧",
  },
  yizai_hero_skill_sheet: {
    available: true,
    productionTier: "legacy-ai",
    legacyAiSheet: true,
    deprecated: true,
    fallbackClass:
      "asset-fallback fallback-fairy fallback-hero yizai-hero-skill-sheet",
    fallbackLabel: "亿仔技能序列帧",
  },
  yizai_hero_ultimate_sheet: {
    available: true,
    productionTier: "legacy-ai",
    legacyAiSheet: true,
    deprecated: true,
    fallbackClass:
      "asset-fallback fallback-fairy fallback-hero yizai-hero-ultimate-sheet",
    fallbackLabel: "亿仔大招序列帧",
  },
  yizai_hero_hurt_sheet: {
    available: true,
    productionTier: "legacy-ai",
    legacyAiSheet: true,
    deprecated: true,
    fallbackClass:
      "asset-fallback fallback-fairy fallback-hero yizai-hero-hurt-sheet",
    fallbackLabel: "亿仔受击序列帧",
  },
  monster_slime_idle: {
    available: true,
    fallbackClass:
      "asset-fallback fallback-fairy fallback-monster monster-slime-card",
    fallbackLabel: "森林史莱姆",
  },
  monster_slime_hit: {
    available: true,
    fallbackClass:
      "asset-fallback fallback-fairy fallback-monster monster-slime-card",
    fallbackLabel: "森林史莱姆受击",
  },
  monster_slime_attack: {
    available: true,
    fallbackClass:
      "asset-fallback fallback-fairy fallback-monster monster-slime-card",
    fallbackLabel: "森林史莱姆攻击",
  },
  monster_slime_defeat: {
    available: true,
    fallbackClass:
      "asset-fallback fallback-fairy fallback-monster monster-slime-card",
    fallbackLabel: "森林史莱姆退场",
  },
  monster_slime_idle_sheet_pro: {
    available: false,
    productionTier: "pro",
    fallbackClass:
      "asset-fallback fallback-fairy fallback-monster monster-slime-sheet-pro",
    fallbackLabel: "森林史莱姆待机生产版序列帧",
  },
  monster_slime_hit_sheet_pro: {
    available: false,
    productionTier: "pro",
    fallbackClass:
      "asset-fallback fallback-fairy fallback-monster monster-slime-sheet-pro",
    fallbackLabel: "森林史莱姆受击生产版序列帧",
  },
  monster_slime_attack_sheet_pro: {
    available: false,
    productionTier: "pro",
    fallbackClass:
      "asset-fallback fallback-fairy fallback-monster monster-slime-sheet-pro",
    fallbackLabel: "森林史莱姆攻击生产版序列帧",
  },
  monster_slime_defeat_sheet_pro: {
    available: false,
    productionTier: "pro",
    fallbackClass:
      "asset-fallback fallback-fairy fallback-monster monster-slime-sheet-pro",
    fallbackLabel: "森林史莱姆退场生产版序列帧",
  },
  monster_slime_idle_sheet: {
    fallbackClass:
      "asset-fallback fallback-fairy fallback-monster monster-slime-sheet",
    fallbackLabel: "森林史莱姆待机序列帧",
  },
  monster_slime_hit_sheet: {
    fallbackClass:
      "asset-fallback fallback-fairy fallback-monster monster-slime-sheet",
    fallbackLabel: "森林史莱姆受击序列帧",
  },
  monster_slime_attack_sheet: {
    fallbackClass:
      "asset-fallback fallback-fairy fallback-monster monster-slime-sheet",
    fallbackLabel: "森林史莱姆攻击序列帧",
  },
  monster_slime_defeat_sheet: {
    fallbackClass:
      "asset-fallback fallback-fairy fallback-monster monster-slime-sheet",
    fallbackLabel: "森林史莱姆退场序列帧",
  },
  monster_pumpkin_idle: {
    fallbackClass:
      "asset-fallback fallback-fairy fallback-monster monster-pumpkin-card",
    fallbackLabel: "南瓜小妖",
  },
  monster_pumpkin_hit: {
    fallbackClass:
      "asset-fallback fallback-fairy fallback-monster monster-pumpkin-card",
    fallbackLabel: "南瓜小妖受击",
  },
  monster_pumpkin_attack: {
    fallbackClass:
      "asset-fallback fallback-fairy fallback-monster monster-pumpkin-card",
    fallbackLabel: "南瓜小妖攻击",
  },
  monster_pumpkin_defeat: {
    fallbackClass:
      "asset-fallback fallback-fairy fallback-monster monster-pumpkin-card",
    fallbackLabel: "南瓜小妖退场",
  },
  monster_crow_idle: {
    fallbackClass:
      "asset-fallback fallback-fairy fallback-monster monster-crow-card",
    fallbackLabel: "童话乌鸦",
  },
  monster_crow_hit: {
    fallbackClass:
      "asset-fallback fallback-fairy fallback-monster monster-crow-card",
    fallbackLabel: "童话乌鸦受击",
  },
  monster_crow_attack: {
    fallbackClass:
      "asset-fallback fallback-fairy fallback-monster monster-crow-card",
    fallbackLabel: "童话乌鸦攻击",
  },
  monster_crow_defeat: {
    fallbackClass:
      "asset-fallback fallback-fairy fallback-monster monster-crow-card",
    fallbackLabel: "童话乌鸦退场",
  },
  monster_tree_idle: {
    fallbackClass:
      "asset-fallback fallback-fairy fallback-monster monster-tree-card",
    fallbackLabel: "森林树精",
  },
  monster_tree_hit: {
    fallbackClass:
      "asset-fallback fallback-fairy fallback-monster monster-tree-card",
    fallbackLabel: "森林树精受击",
  },
  monster_tree_attack: {
    fallbackClass:
      "asset-fallback fallback-fairy fallback-monster monster-tree-card",
    fallbackLabel: "森林树精攻击",
  },
  monster_tree_defeat: {
    fallbackClass:
      "asset-fallback fallback-fairy fallback-monster monster-tree-card",
    fallbackLabel: "森林树精退场",
  },
  monster_wolf_idle: {
    fallbackClass:
      "asset-fallback fallback-fairy fallback-monster monster-wolf-card",
    fallbackLabel: "森林狼",
  },
  monster_wolf_hit: {
    fallbackClass:
      "asset-fallback fallback-fairy fallback-monster monster-wolf-card",
    fallbackLabel: "森林狼受击",
  },
  monster_wolf_attack: {
    fallbackClass:
      "asset-fallback fallback-fairy fallback-monster monster-wolf-card",
    fallbackLabel: "森林狼攻击",
  },
  monster_wolf_defeat: {
    fallbackClass:
      "asset-fallback fallback-fairy fallback-monster monster-wolf-card",
    fallbackLabel: "森林狼退场",
  },
  boss_dragon_idle: {
    fallbackClass:
      "asset-fallback fallback-fairy fallback-monster boss-dragon-card",
    fallbackLabel: "童话龙王",
  },
  boss_dragon_hit: {
    fallbackClass:
      "asset-fallback fallback-fairy fallback-monster boss-dragon-card",
    fallbackLabel: "童话龙王受击",
  },
  boss_dragon_attack: {
    fallbackClass:
      "asset-fallback fallback-fairy fallback-monster boss-dragon-card",
    fallbackLabel: "童话龙王攻击",
  },
  boss_dragon_defeat: {
    fallbackClass:
      "asset-fallback fallback-fairy fallback-monster boss-dragon-card",
    fallbackLabel: "童话龙王退场",
  },
  boss_demon_king_idle: {
    fallbackClass:
      "asset-fallback fallback-fairy fallback-monster boss-demon-king-card",
    fallbackLabel: "魔王",
  },
  boss_demon_king_hit: {
    fallbackClass:
      "asset-fallback fallback-fairy fallback-monster boss-demon-king-card",
    fallbackLabel: "魔王受击",
  },
  boss_demon_king_attack: {
    fallbackClass:
      "asset-fallback fallback-fairy fallback-monster boss-demon-king-card",
    fallbackLabel: "魔王攻击",
  },
  boss_demon_king_defeat: {
    fallbackClass:
      "asset-fallback fallback-fairy fallback-monster boss-demon-king-card",
    fallbackLabel: "魔王退场",
  },
  ui_hp_bar_bg: {
    fallbackClass: "asset-fallback fallback-fairy fallback-panel ui-hp-bar-bg",
    fallbackLabel: "血条底",
  },
  ui_hp_bar_player_fill: {
    fallbackClass:
      "asset-fallback fallback-fairy fallback-panel ui-hp-bar-player-fill",
    fallbackLabel: "玩家血条",
  },
  ui_hp_bar_enemy_fill: {
    fallbackClass:
      "asset-fallback fallback-fairy fallback-panel ui-hp-bar-enemy-fill",
    fallbackLabel: "怪物血条",
  },
  ui_shield_bar_fill: {
    fallbackClass:
      "asset-fallback fallback-fairy fallback-panel ui-shield-bar-fill",
    fallbackLabel: "护盾条",
  },
  ui_attack_pip_on: {
    fallbackClass:
      "asset-fallback fallback-fairy fallback-icon ui-attack-pip-on",
    fallbackLabel: "攻击点亮",
  },
  ui_attack_pip_off: {
    fallbackClass:
      "asset-fallback fallback-fairy fallback-icon ui-attack-pip-off",
    fallbackLabel: "攻击点未亮",
  },
};

export const fairySkin: Match3Skin = {
  id: "fairy",
  displayName: "童话宇宙皮肤",
  resources: createSkinResources("fairy", fairyOverrides),
  pieceAssets: PIECE_ASSETS,
  monsterAssets: MONSTER_ASSETS,
  monsterStateAssets: MONSTER_STATE_ASSETS,
  vfxAssets: VFX_ASSETS,
  animations: createSkinAnimations("fairy"),
  sceneClasses: {
    start: "skin-fairy start-hall-fallback",
    universe: "skin-fairy universe-hall-fallback",
    gameplay: "skin-fairy fairy-gameplay-fallback",
  },
};
