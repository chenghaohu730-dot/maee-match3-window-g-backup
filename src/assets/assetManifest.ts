export const ASSET_MANIFEST = {
  home_bg: "/assets/common/home_bg.png",
  logo_yizai_match3: "/assets/common/logo_yizai_match3.png",
  btn_start: "/assets/common/btn_start.png",
  btn_rank: "/assets/common/btn_rank.png",
  btn_points: "/assets/common/btn_points.png",
  btn_exchange: "/assets/common/btn_exchange.png",
  btn_settings: "/assets/common/btn_settings.png",
  panel_common: "/assets/common/panel_common.png",
  modal_common: "/assets/common/modal_common.png",

  universe_card_fairy: "/assets/universe/universe_card_fairy.png",
  universe_card_work: "/assets/universe/universe_card_work.png",
  universe_card_window: "/assets/universe/universe_card_window.png",
  universe_lock_icon: "/assets/universe/universe_lock_icon.png",

  ft_gameplay_bg: "/assets/fairy/backgrounds/ft_gameplay_bg.png",
  ft_battle_stage_bg: "/assets/fairy/backgrounds/ft_battle_stage_bg.png",
  ft_board_frame: "/assets/fairy/board/ft_board_frame.png",
  ft_board_bg: "/assets/fairy/board/ft_board_bg.png",
  ft_grid_cell: "/assets/fairy/board/ft_grid_cell.png",
  ft_grid_cell_highlight: "/assets/fairy/board/ft_grid_cell_highlight.png",

  piece_red_flame: "/assets/fairy/pieces/piece_red_flame.png",
  piece_blue_frost: "/assets/fairy/pieces/piece_blue_frost.png",
  piece_yellow_star: "/assets/fairy/pieces/piece_yellow_star.png",
  piece_green_nature: "/assets/fairy/pieces/piece_green_nature.png",
  piece_purple_arcane: "/assets/fairy/pieces/piece_purple_arcane.png",
  piece_orange_courage: "/assets/fairy/pieces/piece_orange_courage.png",

  yizai_hero_idle: "/assets/fairy/yizai/yizai_hero_idle.png",
  yizai_hero_attack: "/assets/fairy/yizai/yizai_hero_attack.png",
  yizai_hero_skill: "/assets/fairy/yizai/yizai_hero_skill.png",
  yizai_hero_ultimate: "/assets/fairy/yizai/yizai_hero_ultimate.png",
  yizai_hero_hurt: "/assets/fairy/yizai/yizai_hero_hurt.png",

  monster_slime_idle: "/assets/fairy/monsters/monster_slime_idle.png",
  monster_slime_hit: "/assets/fairy/monsters/monster_slime_hit.png",
  monster_slime_attack: "/assets/fairy/monsters/monster_slime_attack.png",
  monster_slime_defeat: "/assets/fairy/monsters/monster_slime_defeat.png",
  monster_pumpkin_idle: "/assets/fairy/monsters/monster_pumpkin_idle.png",
  monster_crow_idle: "/assets/fairy/monsters/monster_crow_idle.png",
  monster_tree_idle: "/assets/fairy/monsters/monster_tree_idle.png",
  monster_wolf_idle: "/assets/fairy/monsters/monster_wolf_idle.png",
  boss_dragon_idle: "/assets/fairy/monsters/boss_dragon_idle.png",

  vfx_red_skill_slash: "/assets/fairy/vfx/vfx_red_skill_slash.png",
  vfx_blue_skill_freeze: "/assets/fairy/vfx/vfx_blue_skill_freeze.png",
  vfx_yellow_skill_chain: "/assets/fairy/vfx/vfx_yellow_skill_chain.png",
  vfx_green_skill_shield: "/assets/fairy/vfx/vfx_green_skill_shield.png",
  vfx_purple_skill_bomb: "/assets/fairy/vfx/vfx_purple_skill_bomb.png",
  vfx_orange_skill_hammer: "/assets/fairy/vfx/vfx_orange_skill_hammer.png",
  vfx_red_ultimate_spin: "/assets/fairy/vfx/vfx_red_ultimate_spin.png",
  vfx_blue_ultimate_icefall: "/assets/fairy/vfx/vfx_blue_ultimate_icefall.png",
  vfx_yellow_ultimate_meteor: "/assets/fairy/vfx/vfx_yellow_ultimate_meteor.png",
  vfx_green_ultimate_bloom: "/assets/fairy/vfx/vfx_green_ultimate_bloom.png",
  vfx_purple_ultimate_magic_circle:
    "/assets/fairy/vfx/vfx_purple_ultimate_magic_circle.png",
  vfx_orange_ultimate_judgement:
    "/assets/fairy/vfx/vfx_orange_ultimate_judgement.png",
} as const;

export type AssetKey = keyof typeof ASSET_MANIFEST;

export const REQUIRED_ASSET_KEYS = Object.freeze(
  Object.keys(ASSET_MANIFEST) as AssetKey[],
);
