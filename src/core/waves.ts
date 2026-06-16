import type { EnemyWave } from "./combatTypes.ts";

const HARDEST_ATTACK_INTERVAL = 3;
const HARDEST_DAMAGE = 18;

export const FAIRY_TALE_WAVES: EnemyWave[] = [
  {
    id: "forest-slime",
    name: "森林史莱姆",
    hp: 60,
    attackInterval: 0,
    damage: 0,
  },
  {
    id: "pumpkin-fiend",
    name: "南瓜怪",
    hp: 90,
    attackInterval: 5,
    damage: 6,
  },
  {
    id: "crow-fiend",
    name: "乌鸦怪",
    hp: 120,
    attackInterval: 4,
    damage: 8,
  },
  {
    id: "thorn-treant",
    name: "荆棘树精",
    hp: 160,
    attackInterval: 4,
    damage: 10,
  },
  {
    id: "wolf-soldier",
    name: "狼兵",
    hp: 200,
    attackInterval: 3,
    damage: 12,
  },
  {
    id: "young-black-dragon-king",
    name: "黑龙幼王",
    hp: 300,
    attackInterval: HARDEST_ATTACK_INTERVAL,
    damage: HARDEST_DAMAGE,
  },
  {
    id: "endless-challenge",
    name: "无尽挑战",
    hp: Number.POSITIVE_INFINITY,
    attackInterval: HARDEST_ATTACK_INTERVAL,
    damage: HARDEST_DAMAGE,
    endless: true,
  },
];
