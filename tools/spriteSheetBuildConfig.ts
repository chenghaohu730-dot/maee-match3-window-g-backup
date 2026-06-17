export interface SpriteSheetJob {
  name: string;
  inputDir: string;
  output: string;
  frameWidth: number;
  frameHeight: number;
  frameCount: number;
  columns: number;
  rows: number;
  allowMissingOutput: boolean;
  maxBytes: number;
}

export const spriteSheetJobs = [
  {
    name: "yizai_hero_idle_sheet",
    inputDir: "assets-src/yizai_3d/renders/idle",
    output: "public/assets/fairy/yizai/pro/yizai_hero_idle_sheet.png",
    frameWidth: 512,
    frameHeight: 512,
    frameCount: 4,
    columns: 4,
    rows: 1,
    allowMissingOutput: true,
    maxBytes: 12 * 1024 * 1024,
  },
  {
    name: "yizai_hero_attack_sheet",
    inputDir: "assets-src/yizai_3d/renders/attack",
    output: "public/assets/fairy/yizai/pro/yizai_hero_attack_sheet.png",
    frameWidth: 512,
    frameHeight: 512,
    frameCount: 6,
    columns: 6,
    rows: 1,
    allowMissingOutput: true,
    maxBytes: 14 * 1024 * 1024,
  },
  {
    name: "yizai_hero_skill_sheet",
    inputDir: "assets-src/yizai_3d/renders/skill",
    output: "public/assets/fairy/yizai/pro/yizai_hero_skill_sheet.png",
    frameWidth: 512,
    frameHeight: 512,
    frameCount: 8,
    columns: 8,
    rows: 1,
    allowMissingOutput: true,
    maxBytes: 18 * 1024 * 1024,
  },
  {
    name: "yizai_hero_ultimate_sheet",
    inputDir: "assets-src/yizai_3d/renders/ultimate",
    output: "public/assets/fairy/yizai/pro/yizai_hero_ultimate_sheet.png",
    frameWidth: 512,
    frameHeight: 512,
    frameCount: 10,
    columns: 10,
    rows: 1,
    allowMissingOutput: true,
    maxBytes: 22 * 1024 * 1024,
  },
  {
    name: "yizai_hero_hurt_sheet",
    inputDir: "assets-src/yizai_3d/renders/hurt",
    output: "public/assets/fairy/yizai/pro/yizai_hero_hurt_sheet.png",
    frameWidth: 512,
    frameHeight: 512,
    frameCount: 4,
    columns: 4,
    rows: 1,
    allowMissingOutput: true,
    maxBytes: 12 * 1024 * 1024,
  },
  {
    name: "monster_slime_idle_sheet",
    inputDir: "assets-src/slime_3d/renders/idle",
    output: "public/assets/fairy/monsters/pro/monster_slime_idle_sheet.png",
    frameWidth: 512,
    frameHeight: 512,
    frameCount: 4,
    columns: 4,
    rows: 1,
    allowMissingOutput: true,
    maxBytes: 12 * 1024 * 1024,
  },
  {
    name: "monster_slime_hit_sheet",
    inputDir: "assets-src/slime_3d/renders/hit",
    output: "public/assets/fairy/monsters/pro/monster_slime_hit_sheet.png",
    frameWidth: 512,
    frameHeight: 512,
    frameCount: 4,
    columns: 4,
    rows: 1,
    allowMissingOutput: true,
    maxBytes: 12 * 1024 * 1024,
  },
  {
    name: "monster_slime_attack_sheet",
    inputDir: "assets-src/slime_3d/renders/attack",
    output: "public/assets/fairy/monsters/pro/monster_slime_attack_sheet.png",
    frameWidth: 512,
    frameHeight: 512,
    frameCount: 6,
    columns: 6,
    rows: 1,
    allowMissingOutput: true,
    maxBytes: 14 * 1024 * 1024,
  },
  {
    name: "monster_slime_defeat_sheet",
    inputDir: "assets-src/slime_3d/renders/defeat",
    output: "public/assets/fairy/monsters/pro/monster_slime_defeat_sheet.png",
    frameWidth: 512,
    frameHeight: 512,
    frameCount: 6,
    columns: 6,
    rows: 1,
    allowMissingOutput: true,
    maxBytes: 14 * 1024 * 1024,
  },
] as const satisfies readonly SpriteSheetJob[];
