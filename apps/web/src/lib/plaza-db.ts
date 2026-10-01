// 广场数据层:双模式存储
// - Cloudflare(next-on-pages)环境:用 D1 数据库(env.DB),整库存为一行 JSON 文档
// - 本地 Node 环境(dev):委托给 plaza-db.node.ts(运行时拼接模块名,打包器不追踪)
// Edge 打包产物中不出现任何 fs/path/crypto 引用。
import type { CharacterLook } from "@maomao/art-engine";
import type { DB, PlazaBond, PlazaPetInfo, PlazaPlayer, PlazaRequest } from "./plaza-types";

export type { DB, PlazaBond, PlazaPetInfo, PlazaPlayer, PlazaRequest };
export type { CharacterLook };

/** Cloudflare 环境探测:route.ts 会把 D1 绑定写到全局 __env.DB */
function cfDB(): D1Database | null {
  const env = (globalThis as unknown as { __env?: { DB?: D1Database } }).__env ?? undefined;
  return env?.DB ?? null;
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
  const { seedDB } = await import("./plaza-seed");
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
 * - 文件模式:委托 plaza-db.node.ts(仅本地 Node 环境)
 */
export async function withDB<T>(mutate: (db: DB) => Promise<T> | T): Promise<T> {
  const d1 = cfDB();
  if (d1) {
    const current = await loadFromD1(d1);
    const result = await mutate(current);
    await saveToD1(d1, current);
    return result;
  }
  // 本地 Node 模式:动态委托(模块名运行时拼接,避免打包器追踪)
  const nodeStore = "./plaza-db." + "node";
  const { loadDBFile, saveDBFile } = (await import(/* webpackIgnore: true */ nodeStore)) as {
    loadDBFile: () => Promise<DB>;
    saveDBFile: (db: DB) => Promise<void>;
  };
  const db = await loadDBFile();
  const result = await mutate(db);
  await saveDBFile(db);
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

/** Edge/Workers/Node 通用的 UUID 生成 */
function uuid(): string {
  const c = globalThis.crypto as Crypto & { randomUUID?: () => string };
  if (typeof c.randomUUID === "function") return c.randomUUID();
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (ch) => {
    const r = (Math.random() * 16) | 0;
    return (ch === "x" ? r : (r & 0x3) | 0x8).toString(16);
  });
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
  const nodeStore = "./plaza-db." + "node";
  const { loadDBFile } = (await import(/* webpackIgnore: true */ nodeStore)) as {
    loadDBFile: () => Promise<DB>;
  };
  const db = await loadDBFile();
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
