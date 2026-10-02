// 种子数据(本地文件模式与 D1 模式共用)
import { mulberry32, SKIN_TONES, HAIR_COLORS, EYE_COLORS } from "@maomao/art-engine";
import type { CharacterLook } from "@maomao/art-engine";
import { ALL_SPECIES } from "@maomao/game-core";
import type { DB, PlazaBond, PlazaPlayer } from "./plaza-db";

// NPC 已按需求全部下线:种子只建空广场,真人玩家注册后自动向彼此发结缘申请的逻辑见 plaza-db.register
const MOCK_NAMES: string[] = [];

function mockLook(rng: () => number): CharacterLook {
  const pick = <T,>(arr: readonly T[]): T => arr[Math.floor(rng() * arr.length)];
  return {
    faceShape: pick(["round", "square", "egg", "heart"] as const),
    skin: pick(SKIN_TONES),
    eyeStyle: pick(["round", "sparkle", "happy", "sleepy", "dot"] as const),
    eyeColor: pick(EYE_COLORS),
    mouth: pick(["smile", "grin", "cat", "open", "wavy", "pout"] as const),
    hair: pick(["short", "twin", "bun", "spiky", "bowl", "curly"] as const),
    hairColor: pick(HAIR_COLORS),
    blush: rng() < 0.7,
    accessory: pick(["none", "glasses", "cap", "hairpin", "scarf"] as const),
  };
}

export function pickOutfit(rng: () => number): string {
  return ["tee", "hoodie", "overalls", "dress", "sport", "cape"][Math.floor(rng() * 6)];
}

export function seedDB(): DB {
  const rng = mulberry32(772026);
  const species = ALL_SPECIES.filter((s) => s.id !== "pangpangwang");
  const players: PlazaPlayer[] = MOCK_NAMES.map((name, i) => {
    const r = mulberry32(9000 + i * 77);
    const s = species[Math.floor(rng() * species.length)];
    return {
      id: `mock-${i + 1}`,
      name,
      pin: "",
      isMock: true,
      look: mockLook(r),
      outfitId: pickOutfit(r),
      pet: {
        name: `${s.name}·${name.slice(0, 2)}`,
        speciesId: s.id,
        level: 6 + Math.floor(rng() * 9), // 6-14
      },
      level: 6 + Math.floor(rng() * 9), // 与宠物等级一致,供排行
      record: { w: 2 + Math.floor(rng() * 12), l: 1 + Math.floor(rng() * 7) },
      createdAt: Date.now() - (i + 1) * 86400000,
    };
  });
  // (原 NPC 预置羁绊已随 NPC 一起移除)
  const bonds: PlazaBond[] = [];
  return { players, bonds, requests: [], sessions: {} };
}

/** Edge/Workers/Node 通用的 UUID 生成 */
function uuid(): string {
  const c = globalThis.crypto as Crypto & { randomUUID?: () => string };
  if (typeof c.randomUUID === "function") return c.randomUUID();
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (ch) => {
    const r = (Math.random() * 16) | 0;
    return (ch === "x" ? r : (r & 0x3) | 0x8).toString(16);
  });
}
