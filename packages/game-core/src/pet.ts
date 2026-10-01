import type { PetLook } from "@maomao/art-engine";

export type Element = "fire" | "water" | "grass" | "electric" | "normal" | "shadow";

export const ELEMENT_NAMES: Record<Element, string> = {
  fire: "火",
  water: "水",
  grass: "草",
  electric: "电",
  normal: "普",
  shadow: "影",
};

/** 属性克制：进攻方 → 防守方 = 倍率 */
const CHART: Partial<Record<Element, Partial<Record<Element, number>>>> = {
  fire: { grass: 1.5, water: 0.75, fire: 0.75 },
  water: { fire: 1.5, grass: 0.75, water: 0.75 },
  grass: { water: 1.5, electric: 1.25, fire: 0.75, grass: 0.75 },
  electric: { water: 1.5, electric: 0.75 },
  shadow: { normal: 1.25 },
  normal: { shadow: 0.8 },
};

export function elementMultiplier(atk: Element, def: Element): number {
  return CHART[atk]?.[def] ?? 1;
}

export interface Stats {
  hp: number;
  atk: number;
  def: number;
  spd: number;
}

export interface Move {
  id: string;
  name: string;
  power: number;
  element: Element;
  desc: string;
}

export const MOVE_TACKLE: Move = { id: "tackle", name: "墩墩撞击", power: 40, element: "normal", desc: "圆滚滚的身体撞过去。" };
const ELEM_SKILLS: Record<Element, { basic: Move; ult: Move }> = {
  fire: {
    basic: { id: "spark", name: "火花蹦蹦", power: 55, element: "fire", desc: "弹出小火星烫对手。" },
    ult: { id: "flameCharge", name: "烈焰滚冲", power: 85, element: "fire", desc: "裹着火焰滚动冲撞！" },
  },
  water: {
    basic: { id: "waterGun", name: "水枪啾啾", power: 55, element: "water", desc: "呲出高压水柱。" },
    ult: { id: "bubbleBeam", name: "泡泡光束", power: 85, element: "water", desc: "轰出大泡泡洪流！" },
  },
  grass: {
    basic: { id: "leafBlade", name: "叶叶飞刀", power: 55, element: "grass", desc: "甩出锋利的叶子。" },
    ult: { id: "vineSlam", name: "藤鞭猛击", power: 85, element: "grass", desc: "藤蔓抽击，力道十足！" },
  },
  electric: {
    basic: { id: "zap", name: "电电麻麻", power: 55, element: "electric", desc: "啪的一声放电。" },
    ult: { id: "voltRush", name: "十万闪冲", power: 85, element: "electric", desc: "带电冲锋，快如闪电！" },
  },
  normal: {
    basic: { id: "bodySlam", name: "肉肉压压", power: 55, element: "normal", desc: "用肉乎乎的身体压。" },
    ult: { id: "gigaRoll", name: "巨团翻滚", power: 85, element: "normal", desc: "变成巨球碾压过去！" },
  },
  shadow: {
    basic: { id: "shadowClaw", name: "暗影爪爪", power: 60, element: "shadow", desc: "影子的爪子挠过去。" },
    ult: { id: "shadowBurst", name: "影子爆发", power: 90, element: "shadow", desc: "释放积攒的暗影能量！" },
  },
};

export function movesForElement(element: Element, level: number): Move[] {
  const list = [MOVE_TACKLE, ELEM_SKILLS[element].basic];
  if (level >= 10) list.push(ELEM_SKILLS[element].ult);
  return list;
}

/* ---------------- 宠物 ---------------- */

export interface PetSpecies {
  id: string;
  name: string;
  element: Element;
  rarity: 1 | 2 | 3;
  base: Stats;
  look: PetLook;
  flavor: string;
}

export interface Pet {
  uid: string;
  speciesId: string;
  name: string;
  element: Element;
  rarity: 1 | 2 | 3;
  look: PetLook;
  base: Stats;
  level: number;
  exp: number;
  train: { atk: number; def: number; spd: number };
  /** 当前体力（战斗外也保留），为空时视为满体力 */
  hp?: number;
}

export const MAX_LEVEL = 30;

export function expToNext(level: number): number {
  return level * 30;
}

export function maxHpOf(pet: Pet): number {
  return Math.round(pet.base.hp + pet.level * 5);
}
export function atkOf(pet: Pet): number {
  return Math.round(pet.base.atk + pet.train.atk * 2 + pet.level * 0.9);
}
export function defOf(pet: Pet): number {
  return Math.round(pet.base.def + pet.train.def * 2 + pet.level * 0.7);
}
export function spdOf(pet: Pet): number {
  return Math.round(pet.base.spd + pet.train.spd * 2 + pet.level * 0.6);
}

export function trainCost(current: number): number {
  return (current + 1) * 40;
}

export function movesOf(pet: Pet): Move[] {
  return movesForElement(pet.element, pet.level);
}

export interface BattleBattler {
  name: string;
  element: Element;
  look: PetLook;
  level: number;
  rarity: 1 | 2 | 3;
  atk: number;
  def: number;
  spd: number;
  maxHp: number;
  hp: number;
  moves: Move[];
  owner: "player" | "enemy";
}

export function battlerOf(pet: Pet): BattleBattler {
  const maxHp = maxHpOf(pet);
  return {
    name: pet.name,
    element: pet.element,
    look: pet.look,
    level: pet.level,
    rarity: pet.rarity,
    atk: atkOf(pet),
    def: defOf(pet),
    spd: spdOf(pet),
    maxHp,
    hp: pet.hp ?? maxHp,
    moves: movesOf(pet),
    owner: "player",
  };
}

export function makePetFromSpecies(s: PetSpecies, uid: string, level: number, nickname?: string): Pet {
  return {
    uid,
    speciesId: s.id,
    name: nickname ?? s.name,
    element: s.element,
    rarity: s.rarity,
    look: s.look,
    base: s.base,
    level,
    exp: 0,
    train: { atk: 0, def: 0, spd: 0 },
  };
}
