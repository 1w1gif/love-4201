export interface ShopItem {
  id: string;
  name: string;
  price: number;
  kind: "potion" | "revive" | "ball";
  heal?: number;
  desc: string;
}

export const SHOP_ITEMS: ShopItem[] = [
  { id: "potion-s", name: "小奶瓶", price: 30, kind: "potion", heal: 50, desc: "咕嘟咕嘟，恢复 50 点体力。" },
  { id: "potion-l", name: "大奶瓶", price: 80, kind: "potion", heal: 120, desc: "超大一杯！恢复 120 点体力。" },
  { id: "revive", name: "复活果冻", price: 120, kind: "revive", desc: "把累瘫的宠物弹起来，恢复一半体力。" },
  { id: "ball-basic", name: "精灵球", price: 40, kind: "ball", desc: "丢向野生的胖胖试试运气——对方血越少越好抓！" },
  { id: "ball-great", name: "超级球", price: 100, kind: "ball", desc: "捕捉概率 1.6 倍的高级球，用来抓稀有胖胖。" },
];

export interface OutfitItem {
  id: "tee" | "hoodie" | "overalls" | "dress" | "sport" | "cape";
  name: string;
  price: number;
  main: string;
  sub: string;
  desc: string;
}

export const OUTFITS: OutfitItem[] = [
  { id: "tee", name: "初始小T恤", price: 0, main: "#f5efe0", sub: "#f6d55c", desc: "简单舒服，永远的好朋友。" },
  { id: "hoodie", name: "毛茸茸卫衣", price: 120, main: "#f39a6b", sub: "#fcd9a8", desc: "穿上去像个小饭团。" },
  { id: "overalls", name: "背带裤", price: 150, main: "#7a8cd8", sub: "#f6d55c", desc: "干活的打扮，精神十足。" },
  { id: "dress", name: "花朵连衣裙", price: 160, main: "#e07a9b", sub: "#f5efe0", desc: "转个圈裙摆会开花。" },
  { id: "sport", name: "运动服", price: 180, main: "#5fae8e", sub: "#f5efe0", desc: "跑步的时候嗖嗖的。" },
  { id: "cape", name: "勇者小披风", price: 300, main: "#b78ed8", sub: "#ef6f6f", desc: "披上它，感觉自己能打赢全世界。" },
];

export function outfitById(id: string): OutfitItem {
  return OUTFITS.find((o) => o.id === id) ?? OUTFITS[0];
}
