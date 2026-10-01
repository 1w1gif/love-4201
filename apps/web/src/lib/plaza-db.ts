// 广场数据层:双模式存储
// - Cloudflare(next-on-pages)环境:用 D1 数据库(env.DB),整库存为一行 JSON 文档
// - 本地 Node 环境(dev / 传统服务器):沿用原 JSON 文件方案,行为不变
// 注意:Edge 打包不允许静态 import fs/path/crypto,本地模式改为按需动态加载
import { mulberry32, SKIN_TONES, HAIR_COLORS, EYE_COLORS } from "@maomao/art-engine";
import type { CharacterLook } from "@maomao/art-engine";
import { ALL_SPECIES } from "@maomao/game-core";

/** Edge/Workers/Node 通用的 UUID 生成 */
function uuid(): string {
  const c = globalThis.crypto as Crypto & { randomUUID?: () => string };
  if (typeof c.randomUUID === "function") return c.randomUUID();
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (ch) => {
    const r = (Math.random() * 16) | 0;
    return (ch === "x" ? r : (r & 0x3) | 0x8).toString(16);
  });
}

/** 服务端玩家数据库:注册玩家互相可见、战绩与结缘关系持久化。 */

export interface PlazaPetInfo {
  name: string;
  speciesId: string;
  level: number;
}

export interface PlazaPlayer {
  id: string;
  name: string;
  pin: string;
  isMock: boolean;
  look: CharacterLook | null;
  outfitId: string;
  pet: PlazaPetInfo | null;
  record: { w: number; l: number };
  /** 主战宠物等级(排行榜用),玩家同步档案时更新 */
  level: number;
  createdAt: number;
}

export interface PlazaBond {
  id: string;
  a: string;
  b: string;
  points: number;
  lastGreet: string; // YYYY-MM-DD
  createdAt: number;
}

export interface PlazaRequest {
  id: string;
  from: string;
  to: string;
  createdAt: number;
}

interface DB {
  players: PlazaPlayer[];
  bonds: PlazaBond[];
  requests: PlazaRequest[];
  sessions: Record<string, string>; // token -> playerId
}

/** Cloudflare 环境探测:route.ts 会把 D1 绑定写到全局 __env.DB */
function cfDB(): D1Database | null {
  const env = (globalThis as unknown as { __env?: { DB?: D1Database } }).__env ?? undefined;
  return env?.DB ?? null;
}

// ---------- 本地文件模式(原逻辑保留,Node 专有模块按需动态加载) ----------

let dbPromise: Promise<DB> | null = null;

type FsPromises = typeof import("fs")["promises"];

/** 仅在本地 Node 模式下动态加载 fs,Edge 打包器不会追踪到 */
async function nodeFs(): Promise<FsPromises> {
  return (await import(/* webpackIgnore: true */ "fs")).promises as FsPromises;
}

async function loadDB(): Promise<DB> {
  const fs = await nodeFs();
  const path = await import(/* webpackIgnore: true */ "path");
  const DB_PATH = path.join(process.cwd(), "data", "plaza-db.json");
  try {
    const raw = await fs.readFile(DB_PATH, "utf-8");
    return JSON.parse(raw) as DB;
  } catch {
    const db = seedDB();
    await fs.mkdir(path.dirname(DB_PATH), { recursive: true });
    await fs.writeFile(DB_PATH, JSON.stringify(db, null, 2));
    return db;
  }
}

export function getDB(): Promise<DB> {
  dbPromise ??= loadDB();
  return dbPromise;
}

async function saveDB(db: DB): Promise<void> {
  const fs = await nodeFs();
  const path = await import(/* webpackIgnore: true */ "path");
  const DB_PATH = path.join(process.cwd(), "data", "plaza-db.json");
  await fs.mkdir(path.dirname(DB_PATH), { recursive: true });
  await fs.writeFile(DB_PATH, JSON.stringify(db, null, 2));
}

// ---------- Cloudflare D1 模式:单行 JSON 文档 ----------

/** 从 D1 读取整库;空库时播种并写回 */
export async function loadFromD1(db: D1Database): Promise<DB> {
  await db
    .prepare(
      `CREATE TABLE IF NOT EXISTS kv (k TEXT PRIMARY KEY, v TEXT NOT NULL)`
    )
    .run();
  const row = await db.prepare(`SELECT v FROM kv WHERE k = 'plaza'`).first<{ v: string }>();
  if (row?.v) return JSON.parse(row.v) as DB;
  const seeded = seedDB();
  await db
    .prepare(`INSERT INTO kv (k, v) VALUES ('plaza', ?)`)
    .bind(JSON.stringify(seeded))
    .run();
  return seeded;
}

/** 把整库写回 D1 */
export async function saveToD1(db: D1Database, data: DB): Promise<void> {
  await db
    .prepare(
      `INSERT INTO kv (k, v) VALUES ('plaza', ?) ON CONFLICT(k) DO UPDATE SET v = excluded.v`
    )
    .bind(JSON.stringify(data))
    .run();
}

/**
 * 统一的事务式读写入口:
 * - D1 模式:读整库 → mutator 修改 → 写回
 * - 文件模式:等价于原 getDB + saveDB
 * 所有业务函数只依赖它,不感知底层存储。
 */
export async function withDB<T>(mutate: (db: DB) => Promise<T> | T): Promise<T> {
  const d1 = cfDB();
  if (d1) {
    const current = await loadFromD1(d1);
    const result = await mutate(current);
    await saveToD1(d1, current);
    return result;
  }
  const db = await getDB();
  const result = await mutate(db);
  await saveDB(db);
  return result;
}

/** 亲密度等级 */
export function tierOf(points: number): { key: "friend" | "bestie" | "partner"; name: string; next: number | null } {
  if (points >= 80) return { key: "partner", name: "灵魂羁绊", next: null };
  if (points >= 30) return { key: "bestie", name: "挚友", next: 80 };
  return { key: "friend", name: "朋友", next: 30 };
}

/** 对外暴露的玩家档案(隐去密码) */
export function publicPlayer(p: PlazaPlayer) {
  return {
    id: p.id,
    name: p.name,
    isMock: p.isMock,
    look: p.look,
    outfitId: p.outfitId,
    pet: p.pet,
    record: p.record,
    level: p.level,
  };
}

/* ---------------- 种子模拟玩家 ---------------- */

const MOCK_NAMES = [
  "阿硕", "圆圆酱", "肥啾 trainer", "奶盖", "布丁狗", "星星眼", "铁头娃", "团子控",
];

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

function seedDB(): DB {
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
  // 模拟玩家之间预置一些羁绊
  const bonds: PlazaBond[] = [
    { id: uuid(), a: "mock-1", b: "mock-2", points: 44, lastGreet: "", createdAt: Date.now() - 5 * 86400000 },
    { id: uuid(), a: "mock-3", b: "mock-5", points: 91, lastGreet: "", createdAt: Date.now() - 9 * 86400000 },
  ];
  return { players, bonds, requests: [], sessions: {} };
}

function pickOutfit(rng: () => number): string {
  return ["tee", "hoodie", "overalls", "dress", "sport", "cape"][Math.floor(rng() * 6)];
}

/* ---------------- 业务操作(全部经 withDB,双模式通用) ---------------- */

function findByName(db: DB, name: string) {
  return db.players.find((p) => p.name === name);
}
function findByToken(db: DB, token: string) {
  const id = db.sessions[token];
  return id ? db.players.find((p) => p.id === id) : undefined;
}
function bondBetween(db: DB, a: string, b: string) {
  return db.bonds.find(
    (x) => (x.a === a && x.b === b) || (x.a === b && x.b === a)
  );
}

export async function register(name: string, pin: string) {
  return withDB(async (db) => {
    const clean = name.trim();
    if (!clean || clean.length > 8) return { error: "昵称要 1-8 个字哦" };
    if (!/^\d{4,6}$/.test(pin)) return { error: "口令是 4-6 位数字" };
    if (findByName(db, clean)) return { error: "这个昵称已经被占用了" };
    const player: PlazaPlayer = {
      id: uuid(),
      name: clean,
      pin,
      isMock: false,
      look: null,
      outfitId: "tee",
      pet: null,
      level: 1,
      record: { w: 0, l: 0 },
      createdAt: Date.now(),
    };
    db.players.push(player);
    const token = uuid();
    db.sessions[token] = player.id;
    // 两只模拟玩家主动向你发来结缘申请,让新玩家体验结缘流程
    const mocks = db.players.filter((p) => p.isMock).slice(0, 2);
    for (const m of mocks) {
      db.requests.push({ id: uuid(), from: m.id, to: player.id, createdAt: Date.now() });
    }
    return { token, player: publicPlayer(player) };
  });
}

export async function login(name: string, pin: string) {
  return withDB(async (db) => {
    const p = findByName(db, name.trim());
    if (!p || p.pin !== pin) return { error: "昵称或口令不对哦" };
    const token = uuid();
    db.sessions[token] = p.id;
    return { token, player: publicPlayer(p) };
  });
}

export async function syncProfile(token: string, profile: { look: CharacterLook; outfitId: string; pet: PlazaPetInfo }) {
  return withDB(async (db) => {
    const me = findByToken(db, token);
    if (!me) return { error: "请先登录" };
    me.look = profile.look;
    me.outfitId = profile.outfitId;
    me.pet = profile.pet;
    me.level = profile.pet.level;
    return { ok: true };
  });
}

export async function listPlaza(token?: string) {
  const d1 = cfDB();
  if (d1) {
    const db = await loadFromD1(d1);
    return plazaView(db, token);
  }
  const db = await getDB();
  return plazaView(db, token);
}

function plazaView(db: DB, token?: string) {
  const me = token ? findByToken(db, token) : undefined;
  const players = db.players.map(publicPlayer);
  const leaderboard = [...db.players]
    .sort((a, b) => b.level - a.level || b.record.w - a.record.w)
    .slice(0, 10)
    .map((p, i) => ({ rank: i + 1, level: p.level, name: p.name, isMock: p.isMock, isMe: me?.id === p.id, record: p.record }));
  const bonds = me
    ? db.bonds
        .filter((b) => b.a === me.id || b.b === me.id)
        .map((b) => {
          const otherId = b.a === me.id ? b.b : b.a;
          const other = db.players.find((p) => p.id === otherId);
          return other ? { id: b.id, points: b.points, lastGreet: b.lastGreet, other: publicPlayer(other) } : null;
        })
        .filter(Boolean)
    : [];
  const requests = me
    ? db.requests
        .filter((r) => r.to === me.id)
        .map((r) => {
          const from = db.players.find((p) => p.id === r.from);
          return from ? { id: r.id, from: publicPlayer(from) } : null;
        })
        .filter(Boolean)
    : [];
  return { players, bonds, requests, leaderboard, me: me ? publicPlayer(me) : null };
}

export async function recordBattle(token: string, opponentId: string, won: boolean) {
  return withDB(async (db) => {
    const me = findByToken(db, token);
    if (!me) return { error: "请先登录" };
    const opp = db.players.find((p) => p.id === opponentId);
    if (!opp) return { error: "找不到对手" };
    if (won) me.record.w += 1;
    else me.record.l += 1;
    if (opp.id !== me.id) {
      if (won) opp.record.l += 1;
      else opp.record.w += 1;
    }
    let bond: { points: number; tier: ReturnType<typeof tierOf>; gained: number } | null = null;
    const b = bondBetween(db, me.id, opp.id);
    if (b) {
      const gained = won ? 3 : 1;
      b.points += gained;
      bond = { points: b.points, tier: tierOf(b.points), gained };
    }
    return { ok: true, myRecord: me.record, bond };
  });
}

export async function bondRequest(token: string, targetId: string) {
  return withDB(async (db) => {
    const me = findByToken(db, token);
    if (!me) return { error: "请先登录" };
    const target = db.players.find((p) => p.id === targetId);
    if (!target) return { error: "找不到这位训练家" };
    if (target.id === me.id) return { error: "不能和自己结缘啦" };
    if (bondBetween(db, me.id, target.id)) return { error: "你们已经绑定关系啦" };
    if (db.requests.some((r) => (r.from === me.id && r.to === target.id))) return { error: "申请已经发过啦,等等吧" };
    // 模拟玩家会立刻接受申请
    if (target.isMock) {
      db.bonds.push({ id: uuid(), a: me.id, b: target.id, points: 5, lastGreet: "", createdAt: Date.now() });
      return { ok: true, auto: true, name: target.name };
    }
    db.requests.push({ id: uuid(), from: me.id, to: target.id, createdAt: Date.now() });
    return { ok: true, auto: false, name: target.name };
  });
}

export async function bondRespond(token: string, requestId: string, accept: boolean) {
  return withDB(async (db) => {
    const me = findByToken(db, token);
    if (!me) return { error: "请先登录" };
    const idx = db.requests.findIndex((r) => r.id === requestId && r.to === me.id);
    if (idx < 0) return { error: "没有这条申请" };
    const req = db.requests[idx];
    db.requests.splice(idx, 1);
    let name = "";
    if (accept) {
      const from = db.players.find((p) => p.id === req.from);
      name = from?.name ?? "";
      if (from && !bondBetween(db, me.id, from.id)) {
        db.bonds.push({ id: uuid(), a: me.id, b: from.id, points: 5, lastGreet: "", createdAt: Date.now() });
      }
    }
    return { ok: true, accept, name };
  });
}

export async function greet(token: string, targetId: string) {
  return withDB(async (db) => {
    const me = findByToken(db, token);
    if (!me) return { error: "请先登录" };
    const b = bondBetween(db, me.id, targetId);
    if (!b) return { error: "还没有绑定关系" };
    const today = new Date().toISOString().slice(0, 10);
    if (b.lastGreet === today) return { error: "今天已经打过招呼啦,明天再来～" };
    b.lastGreet = today;
    b.points += 2;
    return { ok: true, points: b.points, tier: tierOf(b.points) };
  });
}
