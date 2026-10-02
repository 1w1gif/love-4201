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
import { ZONES, tileAt, isSolid, NPCS, WILD_POOLS, HERO_LEVELS } from "@maomao/game-core";
import { HERO_NPCS, HERO_SPECIES_IDS } from "@maomao/game-core";
import type { HeroDef } from "@maomao/game-core";
import { SHOP_ITEMS, OUTFITS } from "@maomao/game-core";
import {
  ACHIEVEMENTS, checkAchievements, dailyTasksFor, todayKey, nextStreak, signinReward,
} from "@maomao/game-core";
import { plazaPost } from "@/lib/plaza-client";
import type { PlazaPlayerPublic } from "@/lib/plaza-client";

export type Phase = "title" | "quiz" | "create" | "pickPet" | "world";

export interface BattleMeta {
  kind: "wild" | "trainer" | "boss" | "pvp" | "hero";
  speciesId: string;
  level: number;
  rewardCoins: number;
  rewardExp: number;
  onWinFlag?: string;
  afterDialog?: string;
  loseDialog?: string;
  pvpOpponentId?: string;
  pvpOpponentName?: string;
  /** hero 战：对应英雄 NPC 定义（对话/捕捉引导用） */
  heroId?: string;
  /** hero 战：召唤出来的英雄胖胖名字 */
  heroPetName?: string;
}

export type StarterSpecies = import("@maomao/game-core").PetSpecies;

/** 管理员面板（GM）可执行的操作 */
export type GmAction =
  | "coins"      // +5000 金币
  | "items"      // 全道具 ×9
  | "outfits"    // 解锁全部衣服
  | "maxLevel"   // 宠物升到满级
  | "heal"       // 恢复满体力
  | "ch1done"    // 一键通关第一章
  | "ch2entry"   // 解锁第二章入口
  | "ch2done";   // 一键通关第二章

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
  /** 广场打开时落在哪个标签（大厅/训练家/排行/羁绊） */
  plazaTab: "live" | "players" | "rank" | "bonds";
  dailyOpen: boolean;
  /** 管理员面板（隐藏入口：标题连点 7 下或输入 4201） */
  gmOpen: boolean;
  toast: string | null;
  chapterDone: boolean;
  chapter2Done: boolean;
  /** 广场账号（服务端注册的训练家身份） */
  account: { token: string; playerId: string; name: string } | null;
  /** 拜访模式：正在参观谁的地图（World 渲染互动按钮，可返回） */
  visiting: { playerId: string; name: string; returnZone: string; returnPx: number; returnPy: number } | null;

  /** 成就/日常/签到状态 */
  stats: Record<string, number>;
  achievementsClaimed: Record<string, boolean>;
  dailyDate: string;
  dailyProgress: Record<string, number>;
  dailyClaimed: Record<string, boolean>;
  signin: { lastDate: string; streak: number; totalDays: number };
  soundOn: boolean;
  /** 新达成、待展示的成就 id（瞬态） */
  pendingAchievement: string | null;

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
  /** 王者英雄 NPC 对话：召唤宠物切磋 / 打赢后可捕捉 */
  heroTalk: (hero: HeroDef) => void;
  battleAction: (action: PlayerAction) => void;
  clearBattle: () => void;
  endBattleProcessed: () => void;

  openShop: (v: boolean) => void;
  openPanel: (v: boolean) => void;
  openDaily: (v: boolean) => void;
  setActivePet: (uid: string) => void;
  openPlaza: (v: boolean, tab?: "live" | "players" | "rank" | "bonds") => void;
  /** 拜访在线玩家：传送到对方场景，记录出发点以便返回 */
  visitPlayer: (playerId: string, name: string, zone: string) => void;
  endVisit: () => void;
  /** 组队 Boss 讨伐结算：胜利发金币/经验，失败仅提示 */
  bossRaidReward: (won: boolean) => void;
  /** 直接增减金币（送礼等社交消费用） */
  addCoins: (delta: number) => void;
  openGm: (v: boolean) => void;
  /** 管理员面板操作：直接改写存档数值 */
  gmDo: (what: GmAction) => void;
  setAccount: (a: GameState["account"]) => void;
  startPvp: (opponent: PlazaPlayerPublic) => void;
  /** 击杀/事件钩子：更新统计并检查成就/日常 */
  trackStat: (key: string, delta?: number) => void;
  claimAchievement: (id: string) => void;
  claimDaily: (id: string) => void;
  doSignin: () => void;
  dismissAchievement: () => void;
  setSoundOn: (v: boolean) => void;
  claimAllReady: () => void;
  buyItem: (id: string, price: number) => void;
  buyOutfit: (id: string, price: number) => void;
  equipOutfit: (id: string) => void;
  train: (stat: "atk" | "def" | "spd") => void;
  usePotion: (id: string, heal: number) => void;
  revive: (id: string) => void;
  /** 喂经验糖果：直接给主战宠物加经验 */
  useCandy: (id: string) => void;
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
      plazaTab: "players",
      dailyOpen: false,
      gmOpen: false,
      toast: null,
      chapterDone: false,
      chapter2Done: false,
      account: null,
  visiting: null,

      stats: {},
      achievementsClaimed: {},
      dailyDate: "",
      dailyProgress: {},
      dailyClaimed: {},
      signin: { lastDate: "", streak: 0, totalDays: 0 },
      soundOn: true,
      pendingAchievement: null,

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
          panelOpen: false, chapterDone: false, chapter2Done: false, visiting: null,
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
              get().showToast("这条路好像还没打通……找找附近的伙伴聊聊吧！");
            }
            return;
          }
          set({ zone: portal.to.zone, px: portal.to.x, py: portal.to.y });
          return;
        }
        set({ px: nx, py: ny });
        // Boss 触发（每张地图有自己的 Boss 配置）
        if (tileAt(zone, nx, ny) === "B" && zone.boss && !st.flags[zone.boss.flag]) {
          get().say(DIALOGS[zone.boss.intro], zone.boss.battle);
          return;
        }
        // 遇敌（物种池按地图配置）
        const enc = zone.encounter;
        if (enc && tileAt(zone, nx, ny) === "t" && Math.random() < enc.rate) {
          const speciesPool = WILD_POOLS[st.zone] ?? WILD_POOLS.meadow;
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
                else if (st.flags.boss2Done && !st.flags.elderFinal2) get().say([
                  { speaker: "宇航", text: "星光湖的星星全亮啦！昨晚全村都在湖边看星星，热闹得很！" },
                  { speaker: "宇航", text: "两章大冒险都完成的你，已经是传说级的训练家了！" },
                ], "flag:elderFinal2");
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
                else if (st.flags.bossDone && !st.flags.ch2Start) get().say([
                  { speaker: "旅人小圆", text: "森林深处的谜团解开了？厉害！对了，森林东边的出口好像有新动静……" },
                  { speaker: "旅人小圆", text: "穿过它就是星光湖畔。听说最近湖里的星光在熄灭，你去看看吧！" },
                ]);
                else get().say([{ speaker: "旅人小圆", text: "森林的入口已经打开啦，一切拜托你了！" }]);
                return;
              case "mystic":
                if (!st.flags.ch2Start) get().say(DIALOGS.mysticMeet, "flag:ch2Start+items2");
                else get().say(DIALOGS.mysticAfter);
                return;
              case "keeper":
                if (!st.flags.keeperTalked) get().say(DIALOGS.keeperPre, "flag:keeperTalked");
                else get().say(DIALOGS.keeperAfter);
                return;
              case "hero": {
                const hero = HERO_NPCS.find((h) => h.id === npc.id);
                if (!hero) return;
                get().heroTalk(hero);
                return;
              }
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
        // 英雄战：召唤台词 + 英雄胖胖可捕捉（抓到即"收服英雄本人"）
        if (meta.kind === "hero") {
          const hero = HERO_NPCS.find((h) => h.id === meta.heroId);
          if (hero) {
            setTimeout(() => get().showToast(`${hero.name}：「${hero.summonLine}」`), 900);
          }
          set({
            battle: createBattle(player, enemy, { canRun: true }),
            battleMeta: meta,
            battleEvents: [],
          });
          get().trackStat("battles");
          get().trackStat("dailyBattles");
          return;
        }
        // 逃跑/失败也计入总战斗场次
        get().trackStat("battles");
        get().trackStat("dailyBattles");
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
          // 消耗品：按效果找对应道具
          const itemId = action.effect === "cure"
            ? "herb-cure"
            : action.effect === "empower"
              ? "power-fruit"
              : action.heal > 60 ? "potion-l" : "potion-s";
          if ((st.items[itemId] ?? 0) <= 0) {
            get().showToast(itemId === "herb-cure" ? "解毒草用完啦！" : itemId === "power-fruit" ? "力量果实用完啦！" : "奶瓶用完啦！");
            return;
          }
          set({ items: { ...st.items, [itemId]: st.items[itemId] - 1 } });
          get().trackStat("itemsUsed");
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

      heroTalk: (hero) => {
        const st = get();
        const beaten = !!st.flags[`heroBeat_${hero.id}`];
        const petName = speciesById(hero.petSpeciesId).name;
        const lines: DialogLine[] = [];
        if (!st.flags[`heroMet_${hero.id}`]) {
          lines.push({ speaker: hero.name, text: `${hero.title}·${hero.name}，在此有礼了。你是圆滚滚村的训练家吧？` });
          lines.push({ speaker: hero.name, text: `我在岛上修行，闲来无事就想找人过两招。我的搭档「${petName}」也想活动活动筋骨。` });
        }
        if (!beaten) {
          lines.push({ speaker: hero.name, text: hero.summonLine });
          lines.push({ speaker: hero.name, text: `来吧，切磋一场！赢了的话……嘿嘿，任你处置。` });
          get().say(lines, `battle:hero_${hero.id}`);
        } else {
          // 打赢过：重复切磋 or 引导捕捉（英雄本人也能被收服成宠物！）
          if (!st.flags[`heroCaught_${hero.id}`]) {
            lines.push({ speaker: hero.name, text: hero.loseLine });
            lines.push({ speaker: hero.name, text: `不服气？那再来！——这次我可不会放水了。对了……你要是想用精灵球收服我本人，我也不拦你，输了就跟你走！` });
            get().say(lines, `battle:hero_${hero.id}`);
          } else {
            lines.push({ speaker: hero.name, text: hero.loseLine });
            lines.push({ speaker: hero.name, text: `随时欢迎再来切磋！我的搭档也在等你哦。` });
            get().say(lines, `battle:hero_${hero.id}`);
          }
        }
      },

      openShop: (v) => set({ shopOpen: v }),
      openPanel: (v) => set({ panelOpen: v }),
      openDaily: (v) => set({ dailyOpen: v }),
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
      openPlaza: (v, tab) => set((s) => ({ plazaOpen: v, plazaTab: tab ?? s.plazaTab })),
      visitPlayer: (playerId, name, zone) => {
        const st = get();
        // 找一个安全的落点：对方位置附近由 World 的 worldPlayers 同步，这里传送到场景入口附近
        const spot: Record<string, { px: number; py: number }> = {
          village: { px: 8, py: 8 }, meadow: { px: 2, py: 2 }, forest: { px: 2, py: 2 }, lake: { px: 2, py: 2 }, cave: { px: 2, py: 2 },
        };
        const s = spot[zone] ?? { px: 8, py: 8 };
        set({
          visiting: { playerId, name, returnZone: st.zone, returnPx: st.px, returnPy: st.py },
          zone, px: s.px, py: s.py,
          plazaOpen: false,
        });
      },
      endVisit: () => {
        const v = get().visiting;
        if (!v) return;
        set({ visiting: null, zone: v.returnZone, px: v.returnPx, py: v.returnPy });
        get().showToast("回到了自己的世界");
      },
      addCoins: (delta) => set((s) => ({ coins: Math.max(0, s.coins + delta) })),
      bossRaidReward: (won) => {
        const st = get();
        if (won && st.pet) {
          const pet = { ...st.pet };
          const coins = 150;
          const exp = 80;
          const { levels } = addExp(pet, exp);
          set({ coins: st.coins + coins, pet });
          get().trackStat("wins");
          get().trackStat("coinsEarned", coins);
          if (levels > 0) get().trackStat("levelUps", levels);
          get().showToast(`👑 讨伐成功！获得 ${coins} 金币 + ${exp} 经验${levels > 0 ? `，${pet.name} 升到了 Lv.${pet.level}！` : "！"}`);
        } else if (won) {
          set({ coins: st.coins + 150 });
          get().showToast("👑 讨伐成功！获得 150 金币（先去领养宠物才能拿经验哦）");
        } else {
          get().showToast("讨伐失败……组个更强搭档再挑战！");
        }
      },
      setAccount: (a) => set({ account: a }),

      openGm: (v) => set({ gmOpen: v }),
      gmDo: (what) => {
        const st = get();
        switch (what) {
          case "coins": {
            set({ coins: st.coins + 5000 });
            get().trackStat("coinsEarned", 5000);
            get().showToast("🔧 +5000 金币到账！");
            break;
          }
          case "items": {
            const items = { ...st.items };
            for (const it of SHOP_ITEMS) items[it.id] = 9;
            set({ items });
            get().showToast("🔧 全道具已补满 ×9！");
            break;
          }
          case "outfits": {
            set({ ownedOutfits: OUTFITS.map((o) => o.id) });
            get().trackStat("outfitsOwned", 0);
            get().showToast("🔧 全部衣服已解锁！");
            break;
          }
          case "maxLevel": {
            if (!st.pet) return;
            const pet = { ...st.pet, level: MAX_LEVEL, exp: 0, hp: maxHpOf(st.pet) };
            set({ pet });
            get().trackStat("levelUps", 0);
            get().showToast(`🔧 ${pet.name} 已升到 Lv.${MAX_LEVEL}！`);
            break;
          }
          case "heal": {
            if (!st.pet) return;
            const pet = { ...st.pet, hp: maxHpOf(st.pet) };
            set({ pet });
            get().showToast(`🔧 ${pet.name} 体力已回满！`);
            break;
          }
          case "ch1done": {
            set({
              flags: { ...st.flags, intro: true, guardBeaten: true, meadowEvent: true, bossDone: true, elderFinal: true },
              chapterDone: true,
            });
            get().trackStat("bossDone", 0);
            get().showToast("🔧 第一章已标记完成！森林东边通往星光湖畔。");
            break;
          }
          case "ch2entry": {
            set({
              flags: { ...st.flags, ch2Start: true, keeperTalked: true },
              items: { ...st.items, "potion-l": Math.max(st.items["potion-l"] ?? 0, 2) },
            });
            get().showToast("🔧 第二章入口已解锁！洞窟之门开了。");
            break;
          }
          case "ch2done": {
            set({
              flags: { ...st.flags, boss2Done: true },
              chapter2Done: true,
            });
            get().trackStat("boss2Done", 0);
            get().showToast("🔧 第二章已标记完成！星光重新亮起啦。");
            break;
          }
        }
      },

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
        get().trackStat("outfitsOwned");
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
        get().trackStat("dailyTrain");
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
        get().trackStat("itemsUsed");
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
        get().trackStat("itemsUsed");
        get().showToast(`${pet.name} 弹起来啦！`);
      },
      useCandy: (id) => {
        const st = get();
        if (!st.pet || (st.items[id] ?? 0) <= 0) return;
        if (st.pet.level >= MAX_LEVEL) {
          get().showToast(`${st.pet.name} 已经满级啦，糖果留着给别人吃～`);
          return;
        }
        const pet = { ...st.pet };
        const { levels } = addExp(pet, 100);
        set({ items: { ...st.items, [id]: st.items[id] - 1 }, pet });
        get().trackStat("itemsUsed");
        if (levels > 0) get().trackStat("levelUps", levels);
        get().showToast(levels > 0 ? `${pet.name} 吃下糖果，升到了 Lv.${pet.level}！` : `${pet.name} 获得了 100 点经验！`);
      },
      showToast: (t) => {
        set({ toast: t });
        setTimeout(() => {
          if (get().toast === t) set({ toast: null });
        }, 2200);
      },

      trackStat: (key, delta = 1) => {
        const st = get();
        // 日常进度：跨天自动重置
        const today = todayKey();
        const isDaily = key.startsWith("daily");
        let dailyProgress = st.dailyProgress;
        let dailyDate = st.dailyDate;
        if (isDaily && st.dailyDate !== today) {
          dailyDate = today;
          dailyProgress = {};
        }
        const nextProgress = isDaily
          ? { ...dailyProgress, [key]: (dailyProgress[key] ?? 0) + delta }
          : dailyProgress;
        const nextStats = { ...st.stats, [key]: (st.stats[key] ?? 0) + delta };

        // 主战宠物等级单独追踪
        if (st.pet) {
          nextStats.maxLevel = Math.max(nextStats.maxLevel ?? 0, st.pet.level);
        }

        set({ stats: nextStats, dailyDate, dailyProgress: nextProgress });

        // 检查新达成的成就（未领取的）
        const newly = checkAchievements(nextStats, st.achievementsClaimed);
        if (newly.length > 0 && !st.pendingAchievement) {
          set({ pendingAchievement: newly[0].id });
        }
      },

      claimAchievement: (id) => {
        const st = get();
        if (st.achievementsClaimed[id]) return;
        const def = ACHIEVEMENTS.find((a) => a.id === id);
        if (!def) return;
        if ((st.stats[def.stat] ?? 0) < def.target) return;
        set({
          achievementsClaimed: { ...st.achievementsClaimed, [id]: true },
          coins: st.coins + def.reward,
          pendingAchievement: st.pendingAchievement === id ? null : st.pendingAchievement,
        });
        get().showToast(`🏆 成就达成「${def.name}」+${def.reward} 金币！`);
      },

      claimDaily: (id) => {
        const st = get();
        const today = todayKey();
        if (st.dailyDate !== today) return;
        if (st.dailyClaimed[id]) return;
        const def = dailyTasksFor(today).find((d) => d.id === id);
        if (!def) return;
        if ((st.dailyProgress[def.stat] ?? 0) < def.target) return;
        set({
          dailyClaimed: { ...st.dailyClaimed, [id]: true },
          coins: st.coins + def.reward,
        });
        get().showToast(`📋 日常完成「${def.name}」+${def.reward} 金币！`);
      },

      doSignin: () => {
        const st = get();
        const today = todayKey();
        if (st.signin.lastDate === today) return;
        const streak = nextStreak(st.signin, today);
        const reward = signinReward(streak);
        set({
          signin: { lastDate: today, streak, totalDays: st.signin.totalDays + 1 },
          coins: st.coins + reward.coins,
          items: reward.ball
            ? { ...st.items, "ball-basic": (st.items["ball-basic"] ?? 0) + reward.ball }
            : st.items,
        });
        get().showToast(
          `📅 签到成功（连续 ${streak} 天）！+${reward.coins} 金币${reward.ball ? ` +精灵球×${reward.ball}` : ""}`
        );
      },

      dismissAchievement: () => set({ pendingAchievement: null }),
      setSoundOn: (v) => set({ soundOn: v }),

      claimAllReady: () => {
        const st = get();
        // 一键领取所有已达成未领取的成就 + 已完成未领取的日常
        let total = 0;
        const claimable = checkAchievements(st.stats, st.achievementsClaimed);
        const achievementsClaimed = { ...st.achievementsClaimed };
        for (const a of claimable) {
          achievementsClaimed[a.id] = true;
          total += a.reward;
        }
        const today = todayKey();
        let dailyClaimed = st.dailyClaimed;
        if (st.dailyDate === today) {
          dailyClaimed = { ...st.dailyClaimed };
          for (const d of dailyTasksFor(today)) {
            if (!dailyClaimed[d.id] && (st.dailyProgress[d.stat] ?? 0) >= d.target) {
              dailyClaimed[d.id] = true;
              total += d.reward;
            }
          }
        }
        if (total > 0) {
          set({ achievementsClaimed, dailyClaimed, coins: st.coins + total, pendingAchievement: null });
          get().showToast(`🎉 一键领取 +${total} 金币！`);
        } else {
          get().showToast("还没有可领取的奖励哦");
        }
      },
      resetSave: () => {
        set({
          phase: "title", affinity: null, playerName: "", look: null, outfitId: "tee",
          ownedOutfits: ["tee"], coins: 120, pet: null,
          storage: [],
          items: { "potion-s": 2, "potion-l": 0, revive: 0 },
          flags: {}, zone: "village", px: 8, py: 8,
          battle: null, battleMeta: null, dialog: null, shopOpen: false, panelOpen: false, chapterDone: false, chapter2Done: false,
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
        storage: s.storage, items: s.items, flags: s.flags, zone: s.zone, px: s.px, py: s.py,
        chapterDone: s.chapterDone, chapter2Done: s.chapter2Done,
        account: s.account,
        stats: s.stats, achievementsClaimed: s.achievementsClaimed,
        dailyDate: s.dailyDate, dailyProgress: s.dailyProgress, dailyClaimed: s.dailyClaimed,
        signin: s.signin, soundOn: s.soundOn,
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
  } else if (after === "battle:boss2") {
    get().startBattle({
      kind: "boss", speciesId: "lan", level: 16,
      rewardCoins: 600, rewardExp: 320,
      onWinFlag: "boss2Done", afterDialog: "boss2Win", loseDialog: "boss2LoseHint",
    });
  } else if (after.startsWith("battle:hero_")) {
    const heroId = after.slice("battle:hero_".length);
    const hero = HERO_NPCS.find((h) => h.id === heroId);
    if (!hero) return;
    const level = HERO_LEVELS[hero.zone] ?? 5;
    get().startBattle({
      kind: "hero", speciesId: hero.petSpeciesId, level,
      rewardCoins: level * 22 + 60, rewardExp: level * 14 + 20,
      onWinFlag: `heroBeat_${hero.id}`, heroId: hero.id, heroPetName: hero.name,
    });
  } else if (after === "flag:ch2Start+items2") {
    set({
      flags: { ...get().flags, ch2Start: true },
      items: { ...get().items, "potion-l": (get().items["potion-l"] ?? 0) + 2 },
    });
    get().showToast("洞窟入口打开啦！获得 大奶瓶 ×2");
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
    get().trackStat("catches");
    get().trackStat("dailyCatches");
    get().trackStat("petsOwned");
    // 英雄战里抓到的是"英雄本人"：打上英雄标记并播报
    if (meta.kind === "hero" && meta.heroId) {
      set({ flags: { ...st.flags, [`heroCaught_${meta.heroId}`]: true } });
      const hero = HERO_NPCS.find((h) => h.id === meta.heroId);
      if (hero) {
        setTimeout(() => get().say([
          { speaker: hero.name, text: `……愿赌服输！从今往后，我的剑/扇/拳（和这个人）都归你差遣！` },
          { speaker: "系统", text: `${hero.name} 加入了宠物仓库！英雄胖胖的专属招式一并用王者技能表。` },
        ]), 600);
      }
    }
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
    // 成就/日常统计（battles 已在 startBattle 计入）
    get().trackStat("wins");
    get().trackStat("dailyWins");
    get().trackStat("coinsEarned", meta.rewardCoins);
    if (levels > 0) get().trackStat("levelUps", levels);
    if (meta.kind === "pvp" && meta.pvpOpponentId) get().trackStat("pvpWins");
    if (meta.onWinFlag === "bossDone") get().trackStat("bossDone");
    if (meta.onWinFlag === "boss2Done") get().trackStat("boss2Done");
    // 对手身上还挂着中毒/麻痹状态时获胜，计一次"战术胜利"
    if (st.battle.enemyStatus.poison > 0 || st.battle.enemyStatus.paralyze > 0) {
      get().trackStat("statusWins");
    }
    setTimeout(() => {
      get().showToast(`获得 ${meta.rewardCoins} 金币 和 ${meta.rewardExp} 经验！`);
      if (levels > 0) get().showToast(`${pet.name} 升到了 Lv.${pet.level}！`);
      if (meta.kind === "hero" && meta.heroId) {
        // 英雄战获胜：英雄认输 + 引导用精灵球收服（英雄本人 / 英雄胖胖）
        const hero = HERO_NPCS.find((h) => h.id === meta.heroId);
        if (hero) {
          const firstBeat = !st.flags[`heroBeat_${hero.id}`];
          const lines: DialogLine[] = [{ speaker: hero.name, text: hero.loseLine }];
          if (firstBeat) {
            lines.push({ speaker: hero.name, text: `告诉你个秘密：下次来找我，可以试试用精灵球「收服」我本人——输了我就跟你走！` });
          }
          if (!st.flags[`heroCaught_${hero.id}`]) {
            lines.push({ speaker: "系统", text: `提示：找英雄再切磋一场，把 TA 的体力打到很低后投精灵球，就能把英雄本人收进仓库！（英雄胖胖也能抓哦）` });
          }
          get().say(lines);
        }
      } else if (meta.afterDialog) {
        const lines = DIALOGS[meta.afterDialog];
        if (lines) get().say(lines);
      }
      if (meta.onWinFlag === "bossDone") set({ chapterDone: true });
      if (meta.onWinFlag === "boss2Done") set({ chapter2Done: true });
    }, 300);
  } else if (result === "lose") {
    pet.hp = Math.ceil(maxHpOf(pet) / 2);
    if (meta.kind !== "pvp") pet.exp = Math.max(0, pet.exp - Math.floor(meta.rewardExp * 0.3));
    set({ pet, coins: meta.kind === "pvp" ? st.coins : Math.max(0, st.coins - 20) });
    setTimeout(() => {
      if (meta.kind !== "pvp") get().showToast(`输了也不气馁！掉了 20 金币，回村休整一下。`);
      if (meta.kind === "hero" && meta.heroId) {
        const hero = HERO_NPCS.find((h) => h.id === meta.heroId);
        if (hero) get().say([{ speaker: hero.name, text: hero.winLine }]);
      } else if (meta.loseDialog) {
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
