"use client";

import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import type { CharacterLook } from "@maomao/art-engine";
import {
  battlerOf, createBattle, expToNext, makePetFromSpecies,
  maxHpOf, speciesById, takeTurn, trainCost, MAX_LEVEL,
} from "@maomao/game-core";
import type { BattleState, Pet, PlayerAction } from "@maomao/game-core";
import type { BattleEvent } from "@maomao/game-core";
import { DIALOGS } from "@maomao/game-core";
import type { DialogLine } from "@maomao/game-core";
import { ZONES, tileAt, isSolid, NPCS } from "@maomao/game-core";
import { plazaPost } from "@/lib/plaza-client";
import type { PlazaPlayerPublic } from "@/lib/plaza-client";

export type Phase = "title" | "quiz" | "create" | "pickPet" | "world";

export interface BattleMeta {
  kind: "wild" | "trainer" | "boss" | "pvp";
  speciesId: string;
  level: number;
  rewardCoins: number;
  rewardExp: number;
  onWinFlag?: string;
  afterDialog?: string;
  loseDialog?: string;
  pvpOpponentId?: string;
  pvpOpponentName?: string;
}

export type StarterSpecies = import("@maomao/game-core").PetSpecies;

interface DialogState {
  lines: DialogLine[];
  index: number;
  after?: string; // 结束后执行的动作，如 "flag:intro" | "openShop" | "battle:guard" | "boss"
}

export interface GameState {
  phase: Phase;
  affinity: string | null;
  playerName: string;
  look: CharacterLook | null;
  outfitId: string;
  ownedOutfits: string[];
  coins: number;
  pet: Pet | null;
  /** 宠物仓库：捉到的胖胖都存这里，可与主战宠物互换 */
  storage: Pet[];
  items: Record<string, number>;
  flags: Record<string, boolean>;
  zone: string;
  px: number;
  py: number;

  // 瞬态
  battle: BattleState | null;
  battleMeta: BattleMeta | null;
  battleEvents: BattleEvent[];
  dialog: DialogState | null;
  shopOpen: boolean;
  panelOpen: boolean;
  plazaOpen: boolean;
  toast: string | null;
  chapterDone: boolean;
  /** 广场账号（服务端注册的训练家身份） */
  account: { token: string; playerId: string; name: string } | null;

  // actions
  goto: (p: Phase) => void;
  newGame: () => void;
  setAffinity: (e: string) => void;
  setLook: (l: CharacterLook) => void;
  setName: (n: string) => void;
  chooseStarter: (species: StarterSpecies, nickname?: string) => void;

  movePlayer: (dx: number, dy: number) => void;
  interact: () => void;
  say: (lines: DialogLine[], after?: string) => void;
  advanceDialog: () => void;
  closeDialog: () => void;

  startBattle: (meta: BattleMeta) => void;
  battleAction: (action: PlayerAction) => void;
  clearBattle: () => void;
  endBattleProcessed: () => void;

  openShop: (v: boolean) => void;
  openPanel: (v: boolean) => void;
  setActivePet: (uid: string) => void;
  openPlaza: (v: boolean) => void;
  setAccount: (a: GameState["account"]) => void;
  startPvp: (opponent: PlazaPlayerPublic) => void;
  buyItem: (id: string, price: number) => void;
  buyOutfit: (id: string, price: number) => void;
  equipOutfit: (id: string) => void;
  train: (stat: "atk" | "def" | "spd") => void;
  usePotion: (id: string, heal: number) => void;
  revive: (id: string) => void;
  showToast: (t: string) => void;
  resetSave: () => void;
}

let uidCounter = 0;
const nextUid = () => `pet-${Date.now().toString(36)}-${uidCounter++}`;

/** 锁定传送门提示的限频时间戳 */
let lastGateToastAt = 0;

function addExp(pet: Pet, exp: number): { levels: number } {
  let levels = 0;
  pet.exp += exp;
  while (pet.level < MAX_LEVEL && pet.exp >= expToNext(pet.level)) {
    pet.exp -= expToNext(pet.level);
    pet.level += 1;
    levels += 1;
  }
  return { levels };
}

export const useGame = create<GameState>()(
  persist(
    (set, get) => ({
      phase: "title",
      affinity: null,
      playerName: "",
      look: null,
      outfitId: "tee",
      ownedOutfits: ["tee"],
      coins: 120,
      pet: null,
      storage: [],
      items: { "potion-s": 2, "potion-l": 0, revive: 0, "ball-basic": 2 },
      flags: {},
      zone: "village",
      px: 8,
      py: 8,

      battle: null,
      battleMeta: null,
      battleEvents: [],
      dialog: null,
      shopOpen: false,
      panelOpen: false,
      plazaOpen: false,
      toast: null,
      chapterDone: false,
      account: null,

      goto: (p) => set({ phase: p }),
      newGame: () =>
        set({
          phase: "quiz", affinity: null, playerName: "", look: null, outfitId: "tee",
          ownedOutfits: ["tee"], coins: 120,
          pet: null,
          storage: [],
          items: { "potion-s": 2, "potion-l": 0, revive: 0 },
          flags: {}, zone: "village", px: 8, py: 8,
          battle: null, battleMeta: null, dialog: null, shopOpen: false,
          panelOpen: false, chapterDone: false,
        }),
      setAffinity: (e) => set({ affinity: e, phase: "create" }),
      setLook: (l) => set({ look: l }),
      setName: (n) => set({ playerName: n }),
      chooseStarter: (species, nickname) => {
        const pet = makePetFromSpecies(species, nextUid(), 5, nickname || species.name);
        set({ pet, phase: "world", px: 8, py: 8, zone: "village" });
        // 开场剧情
        setTimeout(() => {
          get().say(DIALOGS.elderIntro, "flag:intro");
        }, 400);
      },

      movePlayer: (dx, dy) => {
        const st = get();
        if (st.dialog || st.battle || st.shopOpen || st.panelOpen || st.phase !== "world") return;
        const zone = ZONES[st.zone];
        const nx = st.px + dx;
        const ny = st.py + dy;
        const npcBodies = NPCS.filter((n) => n.zone === st.zone).map((n) => ({ x: n.x, y: n.y }));
        if (isSolid(zone, nx, ny, npcBodies)) return;
        // 传送门
        const portal = zone.portals.find((p) => p.x === nx && p.y === ny);
        if (portal) {
          if (portal.requiresFlag && !st.flags[portal.requiresFlag]) {
            // 同一条提示 4 秒内不重复弹，避免连点刷屏
            const now = Date.now();
            if (now - lastGateToastAt > 4000) {
              lastGateToastAt = now;
              get().showToast("好像还不知道要去哪……先跟宇航聊聊吧！");
            }
            return;
          }
          set({ zone: portal.to.zone, px: portal.to.x, py: portal.to.y });
          return;
        }
        set({ px: nx, py: ny });
        // Boss 触发
        if (tileAt(zone, nx, ny) === "B" && !st.flags.bossDone) {
          get().say(DIALOGS.bossIntro, "battle:boss");
          return;
        }
        // 遇敌
        const enc = zone.encounter;
        if (enc && tileAt(zone, nx, ny) === "t" && Math.random() < enc.rate) {
          const speciesPool = st.zone === "meadow"
            ? ["yaya", "paopao", "pangpi", "diandian", "guagua"]
            : ["yingying", "taitai", "tuanzi", "lala", "yanqiu"];
          const sid = speciesPool[Math.floor(Math.random() * speciesPool.length)];
          const level = enc.levels[0] + Math.floor(Math.random() * (enc.levels[1] - enc.levels[0] + 1));
          get().startBattle({
            kind: "wild",
            speciesId: sid,
            level,
            rewardCoins: level * 7 + 15,
            rewardExp: level * 10,
          });
        }
      },

      interact: () => {
        const st = get();
        if (st.dialog || st.battle || st.shopOpen || st.panelOpen || st.phase !== "world") return;
        // 面前的 NPC：优先朝向最近一格
        const dirs = [
          { dx: 0, dy: 1 }, { dx: 0, dy: -1 }, { dx: 1, dy: 0 }, { dx: -1, dy: 0 },
        ];
        for (const d of dirs) {
          const npc = NPCS.find((n) => n.zone === st.zone && n.x === st.px + d.dx && n.y === st.py + d.dy);
          if (npc) {
            switch (npc.role) {
              case "elder":
                if (!st.flags.intro) get().say(DIALOGS.elderIntro, "flag:intro");
                else if (st.flags.bossDone && !st.flags.elderFinal) get().say(DIALOGS.bossWin.filter((l) => l.speaker === "宇航"), "flag:elderFinal");
                else get().say([{ speaker: "宇航", text: "草原和森林都在东边，累了就回村歇歇脚～" }]);
                return;
              case "villager":
                get().say(DIALOGS.villagerChat);
                return;
              case "shop":
                get().say(DIALOGS.shopGreeting, "openShop");
                return;
              case "trainer":
                if (!st.flags.guardBeaten) get().say(DIALOGS.guardPre, "battle:guard");
                else get().say(DIALOGS.guardWin);
                return;
              case "friend":
                if (!st.flags.meadowEvent) get().say(DIALOGS.meadowEvent, "flag:meadowEvent+items");
                else get().say([{ speaker: "旅人小圆", text: "森林的入口已经打开啦，一切拜托你了！" }]);
                return;
            }
          }
        }
        get().showToast("这里好像没人可以聊天……");
      },

      say: (lines, after) => set({ dialog: { lines, index: 0, after } }),
      advanceDialog: () => {
        const d = get().dialog;
        if (!d) return;
        if (d.index < d.lines.length - 1) {
          set({ dialog: { ...d, index: d.index + 1 } });
        } else {
          set({ dialog: null });
          if (d.after) runAfter(set, get, d.after);
        }
      },
      closeDialog: () => set({ dialog: null }),

      startBattle: (meta) => {
        const st = get();
        if (!st.pet) return;
        const s = speciesById(meta.speciesId);
        const enemyPet = makePetFromSpecies(s, "enemy", meta.level);
        const enemy = battlerOf(enemyPet);
        enemy.owner = "enemy";
        const player = battlerOf(st.pet);
        // 体力不足三成就开打，先提醒一句（不拦截，玩家可以硬闯）
        if (player.hp / player.maxHp < 0.3 && meta.kind !== "pvp") {
          get().showToast(`${player.name} 体力不足三成，稳妥起见先喝瓶奶瓶吧！`);
        }
        // 第一次遇到野生胖胖时，提示可以捕捉
        if (meta.kind === "wild" && !st.flags.firstCatchHint) {
          set({ flags: { ...st.flags, firstCatchHint: true } });
          setTimeout(() => get().showToast("提示：野生的胖胖可以在「背包」里用精灵球捕捉，血越少越好抓！"), 1200);
        }
        set({
          battle: createBattle(player, enemy, { canRun: meta.kind === "wild" }),
          battleMeta: meta,
          battleEvents: [],
        });
      },

      battleAction: (action) => {
        const st = get();
        if (!st.battle || st.battle.over) return;
        if (action.kind === "catch") {
          // 投球消耗一颗精灵球
          const ballId = action.ball === "great" ? "ball-great" : "ball-basic";
          if ((st.items[ballId] ?? 0) <= 0) {
            get().showToast("精灵球用完啦，去胖婶商店补货！");
            return;
          }
          set({ items: { ...st.items, [ballId]: st.items[ballId] - 1 } });
        }
        if (action.kind === "item") {
          // 消耗品：自动找奶瓶
          const meta = st.battleMeta;
          const heal = action.heal;
          const itemId = heal > 60 ? "potion-l" : "potion-s";
          if ((st.items[itemId] ?? 0) <= 0) {
            get().showToast("奶瓶用完啦！");
            return;
          }
          set({ items: { ...st.items, [itemId]: st.items[itemId] - 1 } });
        }
        const events = takeTurn(st.battle, action);
        set({ battle: { ...st.battle }, battleEvents: events });
        // 结算
        if (st.battle.over && st.battle.result) {
          handleBattleEnd(set, get, st.battle.result, events);
        }
      },
      clearBattle: () => set({ battle: null, battleMeta: null, battleEvents: [] }),
      endBattleProcessed: () => set({ battleEvents: [] }),

      openShop: (v) => set({ shopOpen: v }),
      openPanel: (v) => set({ panelOpen: v }),
      setActivePet: (uid) => {
        const st = get();
        const idx = st.storage.findIndex((p) => p.uid === uid);
        if (idx < 0 || !st.pet) return;
        const old = { ...st.pet };
        const picked = st.storage[idx];
        const storage = [...st.storage];
        storage.splice(idx, 1);
        storage.unshift(old);
        set({ pet: picked, storage });
        get().showToast(`${picked.name} 成为主战宠物！${old.name} 休息一下，进了仓库。`);
      },
      openPlaza: (v) => set({ plazaOpen: v }),
      setAccount: (a) => set({ account: a }),

      startPvp: (opponent) => {
        const st = get();
        if (!st.pet) {
          get().showToast("先去领养一只胖胖宠物再来切磋吧！");
          return;
        }
        if ((st.pet.hp ?? maxHpOf(st.pet)) <= 0) {
          get().showToast("宠物累瘫了，先恢复体力再来！");
          return;
        }
        if (opponent.id === st.account?.playerId) {
          get().showToast("不能和自己切磋啦！");
          return;
        }
        if (!opponent.pet) {
          get().showToast("对方还没有宠物，切磋不了……");
          return;
        }
        const s = speciesById(opponent.pet.speciesId);
        const enemyPet = makePetFromSpecies(s, "pvp-enemy", opponent.pet.level, opponent.pet.name);
        const enemy = battlerOf(enemyPet);
        enemy.owner = "enemy";
        const player = battlerOf(st.pet);
        set({
          battle: createBattle(player, enemy, { canRun: false }),
          battleMeta: {
            kind: "pvp",
            speciesId: opponent.pet.speciesId,
            level: opponent.pet.level,
            rewardCoins: 60,
            rewardExp: 30,
            pvpOpponentId: opponent.id,
            pvpOpponentName: opponent.name,
          },
          battleEvents: [],
          plazaOpen: false,
        });
      },

      buyItem: (id, price) => {
        const st = get();
        if (st.coins < price) {
          get().showToast("金币不够啦，去草原打几架吧！");
          return;
        }
        set({ coins: st.coins - price, items: { ...st.items, [id]: (st.items[id] ?? 0) + 1 } });
        get().showToast("买好啦！");
      },
      buyOutfit: (id, price) => {
        const st = get();
        if (st.ownedOutfits.includes(id)) return;
        if (st.coins < price) {
          get().showToast("金币不够啦，去草原打几架吧！");
          return;
        }
        set({ coins: st.coins - price, ownedOutfits: [...st.ownedOutfits, id], outfitId: id });
        get().showToast("新衣服到手，已经穿上啦！");
      },
      equipOutfit: (id) => set({ outfitId: id }),
      train: (stat) => {
        const st = get();
        if (!st.pet) return;
        const cost = trainCost(st.pet.train[stat]);
        if (st.coins < cost) {
          get().showToast("金币不够啦！");
          return;
        }
        const pet = { ...st.pet, train: { ...st.pet.train, [stat]: st.pet.train[stat] + 1 } };
        set({ coins: st.coins - cost, pet });
        get().showToast("训练成功！感觉更有力量了！");
      },
      usePotion: (id, heal) => {
        const st = get();
        if (!st.pet || (st.items[id] ?? 0) <= 0) return;
        if ((st.pet.hp ?? maxHpOf(st.pet)) >= maxHpOf(st.pet)) {
          get().showToast("体力满满的，不用喝啦！");
          return;
        }
        const max = maxHpOf(st.pet);
        const pet = { ...st.pet, hp: Math.min(max, (st.pet.hp ?? max) + heal) };
        set({ items: { ...st.items, [id]: st.items[id] - 1 }, pet });
        get().showToast(`${pet.name} 恢复了体力！`);
      },
      revive: (id) => {
        const st = get();
        if (!st.pet || (st.items[id] ?? 0) <= 0) return;
        const max = maxHpOf(st.pet);
        if ((st.pet.hp ?? max) > 0) {
          get().showToast("宠物还好好的，先收着吧！");
          return;
        }
        const pet = { ...st.pet, hp: Math.ceil(max / 2) };
        set({ items: { ...st.items, [id]: st.items[id] - 1 }, pet });
        get().showToast(`${pet.name} 弹起来啦！`);
      },
      showToast: (t) => {
        set({ toast: t });
        setTimeout(() => {
          if (get().toast === t) set({ toast: null });
        }, 2200);
      },
      resetSave: () => {
        set({
          phase: "title", affinity: null, playerName: "", look: null, outfitId: "tee",
          ownedOutfits: ["tee"], coins: 120, pet: null,
          storage: [],
          items: { "potion-s": 2, "potion-l": 0, revive: 0 },
          flags: {}, zone: "village", px: 8, py: 8,
          battle: null, battleMeta: null, dialog: null, shopOpen: false, panelOpen: false, chapterDone: false,
        });
      },
    }),
    {
      name: "maomao-save-v1",
      version: 1,
      migrate: (persisted) => {
        // v1：新增宠物仓库，旧存档自动补空仓库
        return { ...(persisted as object), storage: (persisted as { storage?: Pet[] }).storage ?? [] };
      },
      storage: createJSONStorage(() => localStorage),
      partialize: (s) => ({
        phase: s.phase, affinity: s.affinity, playerName: s.playerName, look: s.look,
        outfitId: s.outfitId, ownedOutfits: s.ownedOutfits, coins: s.coins, pet: s.pet,
        storage: s.storage, items: s.items, flags: s.flags, zone: s.zone, px: s.px, py: s.py, chapterDone: s.chapterDone,
        account: s.account,
      }),
    }
  )
);

// 开发调试探针：浏览器控制台可用 __game 查看游戏状态
if (typeof window !== "undefined") {
  (window as unknown as { __game: typeof useGame }).__game = useGame;
}

function runAfter(set: (p: Partial<GameState>) => void, get: () => GameState, after: string) {
  if (after === "flag:intro") {
    set({ flags: { ...get().flags, intro: true } });
    get().showToast("东村门打开啦！去草原看看吧 →");
  } else if (after === "flag:meadowEvent+items") {
    set({
      flags: { ...get().flags, meadowEvent: true },
      items: { ...get().items, "potion-l": (get().items["potion-l"] ?? 0) + 3 },
    });
    get().showToast("森林入口打开啦！获得 大奶瓶 ×3");
  } else if (after === "openShop") {
    set({ shopOpen: true });
  } else if (after === "battle:guard") {
    get().startBattle({
      kind: "trainer", speciesId: "tuanzi", level: 4,
      rewardCoins: 120, rewardExp: 60,
      onWinFlag: "guardBeaten", afterDialog: "guardWin", loseDialog: "guardLose",
    });
  } else if (after === "battle:boss") {
    get().startBattle({
      kind: "boss", speciesId: "pangpangwang", level: 11,
      rewardCoins: 400, rewardExp: 200,
      onWinFlag: "bossDone", afterDialog: "bossWin", loseDialog: "bossLoseHint",
    });
  }
}

function handleBattleEnd(
  set: (p: Partial<GameState>) => void,
  get: () => GameState,
  result: "win" | "lose" | "run" | "caught",
  _events: BattleEvent[]
) {
  const st = get();
  const meta = st.battleMeta;
  if (!meta || !st.pet || !st.battle) return;
  const pet = { ...st.pet };

  // 捕捉成功：对方进仓库（保留当前体力），不算胜负
  if (result === "caught") {
    const caught = makePetFromSpecies(speciesById(meta.speciesId), nextUid(), meta.level);
    caught.hp = Math.max(1, st.battle.enemy.hp);
    set({ storage: [caught, ...st.storage] });
    setTimeout(() => {
      get().showToast(`${caught.name}（Lv.${caught.level}）加入了宠物仓库！去冒险手册里看看吧～`);
    }, 500);
    return;
  }

  // PvP：把战绩上报到服务器（未登录则提示）
  if (meta.kind === "pvp" && meta.pvpOpponentId) {
    const token = st.account?.token;
    if (!token) {
      setTimeout(() => get().showToast("注册广场账号后，切磋战绩才会被记录哦！"), 400);
    } else {
      const won = result === "win";
      plazaPost<{ error?: string; bond?: { points: number; gained: number }; myRecord?: { w: number; l: number } }>({
        action: "recordBattle", token, opponentId: meta.pvpOpponentId, won,
      }).then((r) => {
        if (r.error) {
          get().showToast(r.error);
        } else if (r.bond) {
          get().showToast(`和 ${meta.pvpOpponentName} 的亲密度 +${r.bond.gained}！当前 ${r.bond.points}`);
        } else if (r.myRecord) {
          get().showToast(won ? `切磋获胜！战绩已记录（${r.myRecord.w} 胜 ${r.myRecord.l} 负）` : "切磋落败，战绩已记录，下次再赢回来！");
        }
      }).catch(() => {});
    }
  }

  if (result === "win") {
    pet.hp = st.battle.player.hp;
    const { levels } = addExp(pet, meta.rewardExp);
    const newFlags = { ...st.flags };
    if (meta.onWinFlag) newFlags[meta.onWinFlag] = true;
    set({ pet, coins: st.coins + meta.rewardCoins, flags: newFlags });
    setTimeout(() => {
      get().showToast(`获得 ${meta.rewardCoins} 金币 和 ${meta.rewardExp} 经验！`);
      if (levels > 0) get().showToast(`${pet.name} 升到了 Lv.${pet.level}！`);
      if (meta.afterDialog) {
        const lines = DIALOGS[meta.afterDialog];
        if (lines) get().say(lines);
      }
      if (meta.onWinFlag === "bossDone") set({ chapterDone: true });
    }, 300);
  } else if (result === "lose") {
    pet.hp = Math.ceil(maxHpOf(pet) / 2);
    if (meta.kind !== "pvp") pet.exp = Math.max(0, pet.exp - Math.floor(meta.rewardExp * 0.3));
    set({ pet, coins: meta.kind === "pvp" ? st.coins : Math.max(0, st.coins - 20) });
    setTimeout(() => {
      if (meta.kind !== "pvp") get().showToast(`输了也不气馁！掉了 20 金币，回村休整一下。`);
      if (meta.loseDialog) {
        const lines = DIALOGS[meta.loseDialog];
        if (lines) get().say(lines);
      }
      // 传送回村口
      if (meta.kind !== "trainer" && meta.kind !== "pvp") set({ zone: "village", px: 8, py: 8 });
    }, 300);
  } else {
    // run：保留当前体力
    pet.hp = st.battle.player.hp;
    set({ pet });
  }
}

// 结算文案辅助（UI 用）
export function effectivenessText(eff: "super" | "weak" | "normal"): string {
  if (eff === "super") return "效果拔群！";
  if (eff === "weak") return "效果不太理想……";
  return "";
}
