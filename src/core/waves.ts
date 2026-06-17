import type { EnemyWave } from "./combatTypes.ts";

export const FAIRY_DRAGON_BOSS_WAVE: EnemyWave = {
  id: "fairy_dragon_boss",
  name: "童话龙王",
  hp: 300,
  attackInterval: 3,
  damage: 18,
};

export const FAIRY_TALE_WAVES: EnemyWave[] = [
  {
    id: "forest_slime",
    name: "森林史莱姆",
    hp: 60,
    attackInterval: 0,
    damage: 0,
  },
  {
    id: "pumpkin_imp",
    name: "南瓜小妖",
    hp: 90,
    attackInterval: 5,
    damage: 6,
  },
  {
    id: "fairy_crow",
    name: "童话乌鸦",
    hp: 120,
    attackInterval: 4,
    damage: 8,
  },
  {
    id: "tree_spirit",
    name: "森林树精",
    hp: 160,
    attackInterval: 4,
    damage: 10,
  },
  {
    id: "forest_wolf",
    name: "森林狼",
    hp: 200,
    attackInterval: 3,
    damage: 12,
  },
  FAIRY_DRAGON_BOSS_WAVE,
];

export const ENDLESS_DEMON_KING_WAVE: EnemyWave = {
  id: "endless_demon_king",
  name: "魔王",
  hp: Number.POSITIVE_INFINITY,
  attackInterval: FAIRY_DRAGON_BOSS_WAVE.attackInterval,
  damage: FAIRY_DRAGON_BOSS_WAVE.damage,
  endless: true,
  infiniteHp: true,
};

export const ENDLESS_CHALLENGE_WAVES: EnemyWave[] = [
  ENDLESS_DEMON_KING_WAVE,
];
