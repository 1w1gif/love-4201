import { ELEMENT_PALETTES, mulberry32, pick, pickMany, hashString } from "@maomao/art-engine";
import type { PetLook, ElementKey } from "@maomao/art-engine";
import type { PetSpecies, Element, Stats } from "./pet";

/** 第一章的宠物图鉴：5 个元素系 × 每系 2 种 + 2 种影系。 */
const SPECIES: PetSpecies[] = [
  {
    id: "pangpi", name: "胖皮", element: "normal", rarity: 1,
    base: { hp: 50, atk: 24, def: 24, spd: 22 },
    look: { body: "round", ears: "round", tail: "pom", pattern: "belly", eyes: "dot", mouth: "smile", colors: ELEMENT_PALETTES.normal, crest: "none" },
    flavor: "一天要吃八顿的圆滚滚，摸起来像刚出炉的面包。",
  },
  {
    id: "tuanzi", name: "团子", element: "normal", rarity: 2,
    base: { hp: 55, atk: 22, def: 28, spd: 18 },
    look: { body: "bean", ears: "long", tail: "none", pattern: "spots", eyes: "sleepy", mouth: "wavy", colors: { ...ELEMENT_PALETTES.normal, main: "#d8b48c" }, crest: "none" },
    flavor: "大部分时间在打盹，被吵醒会鼓起脸颊生气。",
  },
  {
    id: "yanqiu", name: "焰球", element: "fire", rarity: 2,
    base: { hp: 46, atk: 30, def: 20, spd: 26 },
    look: { body: "drop", ears: "pointy", tail: "pom", pattern: "belly", eyes: "round", mouth: "grin", colors: ELEMENT_PALETTES.fire, crest: "fire" },
    flavor: "开心时头顶会窜出小火苗，紧张时鼻子会冒烟。",
  },
  {
    id: "lala", name: "辣辣", element: "fire", rarity: 3,
    base: { hp: 44, atk: 32, def: 22, spd: 30 },
    look: { body: "chubby", ears: "pointy", tail: "curl", pattern: "stripes", eyes: "star", mouth: "cat", colors: { ...ELEMENT_PALETTES.fire, main: "#e85d5d" }, crest: "fire" },
    flavor: "性格火辣的小辣椒，吵架从来没输过。",
  },
  {
    id: "paopao", name: "泡泡", element: "water", rarity: 1,
    base: { hp: 48, atk: 24, def: 24, spd: 24 },
    look: { body: "cloud", ears: "fin", tail: "none", pattern: "belly", eyes: "round", mouth: "open", colors: ELEMENT_PALETTES.water, crest: "water" },
    flavor: "喜欢在天冷的时候吐泡泡取暖，咕噜咕噜。",
  },
  {
    id: "guagua", name: "呱呱", element: "water", rarity: 2,
    base: { hp: 50, atk: 26, def: 26, spd: 22 },
    look: { body: "drop", ears: "none", tail: "none", pattern: "belly", eyes: "happy", mouth: "wavy", colors: { ...ELEMENT_PALETTES.water, main: "#4a9ac9" }, crest: "water" },
    flavor: "雨天会站在屋檐下唱歌，跑调也唱得很认真。",
  },
  {
    id: "yaya", name: "芽芽", element: "grass", rarity: 1,
    base: { hp: 50, atk: 24, def: 26, spd: 20 },
    look: { body: "round", ears: "none", tail: "leaf", pattern: "belly", eyes: "dot", mouth: "cat", colors: ELEMENT_PALETTES.grass, crest: "grass" },
    flavor: "头顶的嫩芽每天都被自己偷闻，越闻越开心。",
  },
  {
    id: "taitai", name: "苔苔", element: "grass", rarity: 2,
    base: { hp: 56, atk: 22, def: 30, spd: 16 },
    look: { body: "bean", ears: "round", tail: "leaf", pattern: "stripes", eyes: "sleepy", mouth: "smile", colors: { ...ELEMENT_PALETTES.grass, main: "#5a9a6a" }, crest: "grass" },
    flavor: "身上长满青苔，晒太阳的时候会变成小山坡。",
  },
  {
    id: "diandian", name: "电电", element: "electric", rarity: 2,
    base: { hp: 46, atk: 28, def: 20, spd: 30 },
    look: { body: "round", ears: "antenna", tail: "bolt", pattern: "belly", eyes: "star", mouth: "grin", colors: ELEMENT_PALETTES.electric, crest: "electric" },
    flavor: "静电很多，摸它之前最好先碰一下墙壁。",
  },
  {
    id: "pipi", name: "噼噼", element: "electric", rarity: 3,
    base: { hp: 44, atk: 30, def: 22, spd: 32 },
    look: { body: "chubby", ears: "long", tail: "bolt", pattern: "stripes", eyes: "star", mouth: "cat", colors: { ...ELEMENT_PALETTES.electric, main: "#f0b429" }, crest: "electric" },
    flavor: "跑起来带电光，村里短路的电闸都归它管。",
  },
  {
    id: "yingying", name: "影影", element: "shadow", rarity: 2,
    base: { hp: 48, atk: 28, def: 24, spd: 26 },
    look: { body: "drop", ears: "pointy", tail: "curl", pattern: "none", eyes: "round", mouth: "wavy", colors: ELEMENT_PALETTES.shadow, crest: "shadow" },
    flavor: "被暗影雾气感染的胖胖，其实只是想找朋友玩。",
  },
  {
    id: "naihang", name: "奶航", element: "electric", rarity: 3,
    base: { hp: 58, atk: 36, def: 30, spd: 34 },
    look: { body: "chubby", ears: "none", tail: "none", pattern: "belly", eyes: "happy", mouth: "open", colors: { main: "#f7d54a", sub: "#fae28a", light: "#fdf3c8", deep: "#c9971f" }, crest: "none", glasses: true },
    flavor: "传说级的电系胖胖，戴着祖传的小黑框眼镜。据说眼镜后面藏着闪电，笑起来的时候整座岛的路灯都会亮。",
  },
  {
    id: "pangpangwang", name: "暗影胖胖王", element: "shadow", rarity: 3,
    base: { hp: 70, atk: 34, def: 30, spd: 24 },
    look: { body: "chubby", ears: "pointy", tail: "curl", pattern: "belly", eyes: "round", mouth: "grin", colors: ELEMENT_PALETTES.shadow, crest: "shadow" },
    flavor: "传说中森林最深处的大块头，其实是被误会的大好胖胖。",
  },
];

export const ALL_SPECIES = SPECIES;

export function speciesById(id: string): PetSpecies {
  const s = SPECIES.find((x) => x.id === id);
  if (!s) throw new Error(`unknown species: ${id}`);
  return s;
}

const ELEMENT_KEYS: ElementKey[] = ["fire", "water", "grass", "electric", "normal"];

/** 玩家挑选用的宠物池：固定 seed 生成 18 只，每只都是独一无二的组合 */
export function generatePetPool(seed: string, count = 18): PetSpecies[] {
  const rng = mulberry32(hashString(seed));
  const bodies = ["round", "chubby", "drop", "cloud", "bean"] as const;
  const ears = ["round", "pointy", "long", "none", "antenna", "fin"] as const;
  const tails = ["pom", "bolt", "leaf", "curl", "none"] as const;
  const patterns = ["belly", "spots", "stripes", "none"] as const;
  const eyes = ["dot", "round", "happy", "sleepy", "star"] as const;
  const mouths = ["smile", "grin", "cat", "open", "wavy"] as const;
  const namesA = ["咕", "毛", "波", "米", "嘟", "布", "奶", "麻", "球", "泡", "团", "汽"];
  const namesB = ["球", "团", "咚", "叽", "嘟", "丸", "糕", "布", "仔", "咪", "露", "芙"];
  const flavorPrefix = [
    "走路的时候一颠一颠的，",
    "睡觉会发出小小的呼噜声，",
    "看到好吃的眼睛会发光，",
    "最喜欢被拍脑袋，",
    "生气的时候会鼓成一颗球，",
    "每天早上都要伸十个懒腰，",
  ];
  const flavorSuffix = [
    "是村里的开心果。",
    "梦想是变得圆滚滚。",
    "对什么都充满好奇。",
    "撒娇技术全村第一。",
    "藏零食的技术一绝。",
    "跑起来像一颗毛球。",
  ];

  const used = new Set<string>();
  const out: PetSpecies[] = [];
  for (let i = 0; i < count; i++) {
    const elementKey = ELEMENT_KEYS[i % ELEMENT_KEYS.length];
    const pal = ELEMENT_PALETTES[elementKey];
    // 偶尔换主色，增加多样性
    const main = rng() < 0.35 ? shiftHue(pal.main) : pal.main;
    const look: PetLook = {
      body: pick(rng, bodies),
      ears: pick(rng, ears),
      tail: pick(rng, tails),
      pattern: pick(rng, patterns),
      eyes: pick(rng, eyes),
      mouth: pick(rng, mouths),
      crest: elementKey === "normal" ? "none" : (elementKey as PetLook["crest"]),
      colors: { ...pal, main },
    };
    const name = `${pick(rng, namesA)}${pick(rng, namesB)}`;
    if (used.has(name)) continue;
    used.add(name);
    const rarity: 1 | 2 | 3 = rng() < 0.2 ? 3 : rng() < 0.5 ? 2 : 1;
    const base: Stats = {
      hp: 40 + Math.floor(rng() * 12) + rarity * 3,
      atk: 18 + Math.floor(rng() * 10) + (rarity === 3 ? 4 : 0),
      def: 16 + Math.floor(rng() * 10) + (rarity === 2 ? 3 : 0),
      spd: 14 + Math.floor(rng() * 14) + (rarity === 3 ? 2 : 0),
    };
    const element: Element = elementKey;
    out.push({
      id: `pool-${seed}-${i}`,
      name,
      element,
      rarity,
      base,
      look,
      flavor: pick(rng, flavorPrefix) + pick(rng, flavorSuffix),
    });
  }
  return out;
}

/** 野生成 pet 实例（含名字与等级） */
export function wildSpeciesFor(zone: "meadow" | "forest", stepSeed: number): PetSpecies {
  const rng = mulberry32(stepSeed);
  if (zone === "meadow") {
    const pool = SPECIES.filter((s) => s.element !== "shadow" && s.rarity <= 2);
    return pick(rng, pool);
  }
  const pool = SPECIES.filter((s) => (s.element === "shadow" || s.rarity <= 3) && s.id !== "naihang");
  return pick(rng, pool);
}

function shiftHue(hex: string): string {
  // 轻微调整明度，产生同系变体
  const n = parseInt(hex.slice(1), 16);
  const r = Math.min(255, Math.max(0, ((n >> 16) & 255) + 12));
  const g = Math.min(255, Math.max(0, ((n >> 8) & 255) - 6));
  const b = Math.min(255, Math.max(0, (n & 255) + 10));
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, "0")}`;
}

export function pickStarterSpecies(affinity: Element, seed: string): PetSpecies[] {
  const pool = generatePetPool(seed, 18);
  const preferred = pool.filter((p) => p.element === affinity);
  const rest = pool.filter((p) => p.element !== affinity);
  return [...pickMany(mulberry32(1), preferred, 6), ...pickMany(mulberry32(2), rest, 12)];
}
