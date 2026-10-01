import type { CharacterLook } from "@maomao/art-engine";
import type { Element } from "./pet";

/**
 * 图块图例：
 * "#" 树（阻挡） "," 路 "t" 高草（遇敌） "f" 花 "w" 水（阻挡）
 * "h" 房子（阻挡） "r" 石头（阻挡） "F" 栅栏（阻挡） "B" Boss 触发点
 * "." 草地
 */
export interface ZoneMap {
  id: string;
  name: string;
  rows: string[];
  ambient: "village" | "meadow" | "forest";
  encounter?: { levels: [number, number]; rate: number };
  portals: { x: number; y: number; to: { zone: string; x: number; y: number }; requiresFlag?: string }[];
}

export interface NpcDef {
  id: string;
  zone: string;
  x: number;
  y: number;
  name: string;
  role: "elder" | "villager" | "shop" | "trainer" | "friend";
  look: CharacterLook;
}

export const VILLAGE: ZoneMap = {
  id: "village",
  name: "圆滚滚村",
  ambient: "village",
  rows: [
    "####################",
    "#..hh..hh.....f....#",
    "#..hh..hh..f.......#",
    "#..................#",
    "#.f................#",
    "#,,,,,,,,,,,,,,,,,,,", // 东出口
    "#..........f.......#",
    "#..f...............#",
    "#........f.....f...#",
    "#.f................#",
    "#..................#",
    "#..................#",
    "####################",
  ],
  portals: [{ x: 19, y: 5, to: { zone: "meadow", x: 1, y: 5 }, requiresFlag: "intro" }],
};

export const MEADOW: ZoneMap = {
  id: "meadow",
  name: "风铃草原",
  ambient: "meadow",
  encounter: { levels: [2, 3], rate: 0.14 },
  rows: [
    "####################",
    "#..................#",
    "#..tttt.......f....#",
    "#..tttt..f.........#",
    "#..tttt.....www....#",
    ",...........www....,", // 西/东出口
    "#....tt.....www....#",
    "#.f................#",
    "#.....ttttt........#",
    "#.....ttttt..f.....#",
    "#..f..ttttt........#",
    "#..................#",
    "####################",
  ],
  portals: [
    { x: 0, y: 5, to: { zone: "village", x: 18, y: 5 } },
    { x: 19, y: 5, to: { zone: "forest", x: 1, y: 5 }, requiresFlag: "meadowEvent" },
  ],
};

export const FOREST: ZoneMap = {
  id: "forest",
  name: "迷雾森林",
  ambient: "forest",
  encounter: { levels: [6, 8], rate: 0.16 },
  rows: [
    "####################",
    "#..#........#..tt..#",
    "#.....##...........#",
    "#..t.....#....t....#",
    "#....t.......tt..#.#",
    ",,,,,,t..#.....t...#", // 西入口
    "#.#........t.......#",
    "#.....t.......#....#",
    "#..#....tt....t..t.#",
    "#......tt....B.....#",
    "#..t...............#",
    "#.....#......#.....#",
    "####################",
  ],
  portals: [{ x: 0, y: 5, to: { zone: "meadow", x: 18, y: 5 } }],
};

export const ZONES: Record<string, ZoneMap> = { village: VILLAGE, meadow: MEADOW, forest: FOREST };

export const NPCS: NpcDef[] = [
  {
    id: "elder", zone: "village", x: 6, y: 4, name: "宇航", role: "elder",
    look: { faceShape: "round", skin: "#f2b58c", eyeStyle: "sleepy", eyeColor: "#4a3737", mouth: "wavy", hair: "bowl", hairColor: "#e8e0d0", blush: false, accessory: "none" },
  },
  {
    id: "shopkeep", zone: "village", x: 12, y: 3, name: "胖婶商店", role: "shop",
    look: { faceShape: "round", skin: "#fcd0a8", eyeStyle: "happy", eyeColor: "#4a3737", mouth: "grin", hair: "bun", hairColor: "#a86a3d", blush: true, accessory: "scarf" },
  },
  {
    id: "villager", zone: "village", x: 15, y: 8, name: "村民小豆", role: "villager",
    look: { faceShape: "egg", skin: "#ffe3c8", eyeStyle: "round", eyeColor: "#3d5a8c", mouth: "smile", hair: "spiky", hairColor: "#6b4a3a", blush: true, accessory: "cap" },
  },
  {
    id: "guard", zone: "village", x: 17, y: 5, name: "大狗粪", role: "trainer",
    look: { faceShape: "square", skin: "#d9975f", eyeStyle: "dot", eyeColor: "#4a3737", mouth: "smile", hair: "short", hairColor: "#3f3245", blush: false, accessory: "none" },
  },
  {
    id: "mei", zone: "meadow", x: 10, y: 8, name: "旅人小圆", role: "friend",
    look: { faceShape: "heart", skin: "#ffe3c8", eyeStyle: "sparkle", eyeColor: "#8c4a6b", mouth: "smile", hair: "twin", hairColor: "#e07a9b", blush: true, accessory: "hairpin" },
  },
];

export function tileAt(zone: ZoneMap, x: number, y: number): string {
  if (y < 0 || y >= zone.rows.length || x < 0 || x >= zone.rows[y].length) return "#";
  return zone.rows[y][x];
}

export const SOLID = new Set(["#", "h", "w", "r", "F"]);
export function isSolid(zone: ZoneMap, x: number, y: number, npcs: { x: number; y: number }[]): boolean {
  const t = tileAt(zone, x, y);
  if (SOLID.has(t)) return true;
  return npcs.some((n) => n.x === x && n.y === y);
}

export const ENCOUNTER_ELEMENT_HINT: Record<string, Element[]> = {
  meadow: ["grass", "normal", "electric"],
  forest: ["shadow", "normal", "grass"],
};
