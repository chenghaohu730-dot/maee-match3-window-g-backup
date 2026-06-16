import {
  ASSET_MANIFEST,
  REQUIRED_ASSET_KEYS,
  type AssetKey,
} from "../assets/assetManifest.ts";
import type { PieceType } from "../core/board.ts";
import type {
  FallbackKind,
  Match3Skin,
  SkinAnimation,
  SkinAnimationSet,
  SkinResource,
} from "./skinTypes.ts";

type SkinResourceOverride = Partial<Omit<SkinResource, "key">>;

export const PIECE_ASSETS: Record<PieceType, AssetKey> = {
  0: "piece_red_flame",
  1: "piece_blue_frost",
  2: "piece_yellow_star",
  3: "piece_green_nature",
  4: "piece_purple_arcane",
  5: "piece_orange_courage",
};

export const MONSTER_ASSETS: Record<string, AssetKey> = {
  "forest-slime": "monster_slime_idle",
  "pumpkin-fiend": "monster_pumpkin_idle",
  "crow-fiend": "monster_crow_idle",
  "thorn-treant": "monster_tree_idle",
  "wolf-soldier": "monster_wolf_idle",
  "young-black-dragon-king": "boss_dragon_idle",
};

export const VFX_ASSETS: Record<string, AssetKey> = {
  red_skill_slash: "vfx_red_skill_slash",
  blue_skill_freeze: "vfx_blue_skill_freeze",
  yellow_skill_chain: "vfx_yellow_skill_chain",
  green_skill_shield: "vfx_green_skill_shield",
  purple_skill_bomb: "vfx_purple_skill_bomb",
  orange_skill_hammer: "vfx_orange_skill_hammer",
  red_ultimate_spin: "vfx_red_ultimate_spin",
  blue_ultimate_icefall: "vfx_blue_ultimate_icefall",
  yellow_ultimate_meteor: "vfx_yellow_ultimate_meteor",
  green_ultimate_bloom: "vfx_green_ultimate_bloom",
  purple_ultimate_magic_circle: "vfx_purple_ultimate_magic_circle",
  orange_ultimate_judgement: "vfx_orange_ultimate_judgement",
};

export const defaultSkin: Match3Skin = {
  id: "default",
  displayName: "默认占位皮肤",
  resources: createSkinResources("default"),
  pieceAssets: PIECE_ASSETS,
  monsterAssets: MONSTER_ASSETS,
  vfxAssets: VFX_ASSETS,
  animations: createSkinAnimations("default"),
  sceneClasses: {
    start: "skin-default start-hall-fallback",
    universe: "skin-default universe-hall-fallback",
    gameplay: "skin-default gameplay-neutral-fallback",
  },
};

export function createSkinResources(
  themeClass: string,
  overrides: Partial<Record<AssetKey, SkinResourceOverride>> = {},
): Record<AssetKey, SkinResource> {
  const entries = REQUIRED_ASSET_KEYS.map((key) => {
    const override = overrides[key] ?? {};
    const fallbackKind = override.fallbackKind ?? fallbackKindForKey(key);
    const fallbackClass =
      override.fallbackClass ??
      `asset-fallback fallback-${themeClass} fallback-${fallbackKind} fallback-${toKebab(key)}`;

    return [
      key,
      {
        key,
        path: override.path ?? ASSET_MANIFEST[key],
        available: override.available ?? false,
        fallbackKind,
        fallbackClass,
        fallbackLabel: override.fallbackLabel ?? fallbackLabelForKey(key),
      },
    ] as const;
  });

  return Object.fromEntries(entries) as Record<AssetKey, SkinResource>;
}

export function createSkinAnimations(themeClass: string): SkinAnimationSet {
  return {
    yizai: {
      idle: createAnimation(
        "yizai_idle",
        ["yizai_hero_idle"],
        themeClass,
        "亿仔待机",
        true,
      ),
      attack: createAnimation(
        "yizai_attack",
        ["yizai_hero_attack"],
        themeClass,
        "亿仔攻击",
        false,
      ),
      skill: createAnimation(
        "yizai_skill",
        ["yizai_hero_skill"],
        themeClass,
        "亿仔技能",
        false,
      ),
      ultimate: createAnimation(
        "yizai_ultimate",
        ["yizai_hero_ultimate"],
        themeClass,
        "亿仔大招",
        false,
      ),
      hurt: createAnimation(
        "yizai_hurt",
        ["yizai_hero_hurt"],
        themeClass,
        "亿仔受击",
        false,
      ),
    },
    monsters: Object.fromEntries(
      Object.entries(MONSTER_ASSETS).map(([monsterId, assetKey]) => [
        monsterId,
        createAnimation(
          `${monsterId}_idle`,
          [assetKey],
          themeClass,
          fallbackLabelForKey(assetKey),
          true,
        ),
      ]),
    ),
    vfx: Object.fromEntries(
      Object.entries(VFX_ASSETS).map(([vfxId, assetKey]) => [
        vfxId,
        createAnimation(
          vfxId,
          [assetKey],
          themeClass,
          fallbackLabelForKey(assetKey),
          false,
          16,
        ),
      ]),
    ),
  };
}

function createAnimation(
  id: string,
  frames: AssetKey[],
  themeClass: string,
  fallbackLabel: string,
  loop: boolean,
  frameRate = 12,
): SkinAnimation {
  return {
    id,
    frames,
    frameRate,
    loop,
    fallbackClass: `animation-fallback animation-${themeClass} animation-${id}`,
    fallbackLabel,
  };
}

function fallbackKindForKey(key: AssetKey): FallbackKind {
  if (key.startsWith("btn_")) {
    return "button";
  }

  if (key.startsWith("universe_card_")) {
    return "card";
  }

  if (key === "universe_lock_icon") {
    return "icon";
  }

  if (key.startsWith("piece_")) {
    return "piece";
  }

  if (key.startsWith("yizai_")) {
    return "hero";
  }

  if (key.startsWith("monster_") || key.startsWith("boss_")) {
    return "monster";
  }

  if (key.startsWith("vfx_")) {
    return "vfx";
  }

  if (key.includes("panel") || key.includes("modal")) {
    return "panel";
  }

  if (key.includes("grid_cell")) {
    return "cell";
  }

  return "background";
}

function fallbackLabelForKey(key: AssetKey): string {
  const labels: Partial<Record<AssetKey, string>> = {
    home_bg: "宇宙大厅",
    logo_yizai_match3: "亿仔消消战",
    btn_start: "开始游戏",
    btn_rank: "排行榜",
    btn_points: "积分",
    btn_exchange: "兑换",
    btn_settings: "设置",
    panel_common: "通用面板",
    modal_common: "弹窗面板",
    universe_card_fairy: "童话宇宙",
    universe_card_work: "打工宇宙",
    universe_card_window: "门窗宇宙",
    universe_lock_icon: "锁定",
    ft_gameplay_bg: "童话玩法背景",
    ft_battle_stage_bg: "战斗舞台",
    ft_board_frame: "棋盘边框",
    ft_board_bg: "棋盘背景",
    ft_grid_cell: "棋格",
    ft_grid_cell_highlight: "棋格高亮",
    piece_red_flame: "火焰",
    piece_blue_frost: "冰霜",
    piece_yellow_star: "星光",
    piece_green_nature: "自然",
    piece_purple_arcane: "奥术",
    piece_orange_courage: "勇气",
    yizai_hero_idle: "亿仔勇者",
    yizai_hero_attack: "亿仔攻击",
    yizai_hero_skill: "亿仔技能",
    yizai_hero_ultimate: "亿仔大招",
    yizai_hero_hurt: "亿仔受击",
    monster_slime_idle: "森林史莱姆",
    monster_slime_hit: "森林史莱姆受击",
    monster_slime_attack: "森林史莱姆攻击",
    monster_slime_defeat: "森林史莱姆退场",
    monster_pumpkin_idle: "南瓜怪",
    monster_crow_idle: "乌鸦怪",
    monster_tree_idle: "荆棘树精",
    monster_wolf_idle: "狼兵",
    boss_dragon_idle: "黑龙幼王",
    vfx_red_skill_slash: "火焰斩",
    vfx_blue_skill_freeze: "冰霜冻结",
    vfx_yellow_skill_chain: "星光连锁",
    vfx_green_skill_shield: "森林护盾",
    vfx_purple_skill_bomb: "奥术爆破",
    vfx_orange_skill_hammer: "勇气重锤",
    vfx_red_ultimate_spin: "火焰旋风",
    vfx_blue_ultimate_icefall: "冰瀑",
    vfx_yellow_ultimate_meteor: "星陨",
    vfx_green_ultimate_bloom: "生命盛放",
    vfx_purple_ultimate_magic_circle: "魔法阵",
    vfx_orange_ultimate_judgement: "勇气审判",
  };

  return labels[key] ?? key;
}

function toKebab(value: string): string {
  return value.replaceAll("_", "-");
}
