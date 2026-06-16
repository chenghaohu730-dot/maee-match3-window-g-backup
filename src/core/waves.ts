import type { EnemyWave } from "./combatTypes.ts";

export const FAIRY_TALE_WAVES: EnemyWave[] = [
  {
    id: "forest-slime",
    name: "森林史莱姆",
    hp: 30,
    attackInterval: 0,
    damage: 0,
  },
  {
    id: "pumpkin-fiend",
    name: "南瓜怪",
    hp: 45,
    attackInterval: 5,
    damage: 6,
  },
  {
    id: "crow-fiend",
    name: "乌鸦怪",
    hp: 60,
    attackInterval: 4,
    damage: 8,
  },
  {
    id: "thorn-treant",
    name: "荆棘树精",
    hp: 80,
    attackInterval: 4,
    damage: 10,
  },
  {
    id: "wolf-soldier",
    name: "狼兵",
    hp: 100,
    attackInterval: 3,
    damage: 12,
  },
  {
    id: "young-black-dragon-king",
    name: "黑龙幼王",
    hp: 150,
    attackInterval: 3,
    damage: 18,
  },
];
