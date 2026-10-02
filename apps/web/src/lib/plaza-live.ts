// 实时切磋 + 广场聊天数据层（D1 模式专用，本地文件模式降级为不支持）
// 表结构：
//   spar_rooms(id TEXT PK, host_id, guest_id, status, turn, state_json, updated_at)
//   chat_msgs(id INTEGER PK AUTOINCREMENT, player_id, name, text, created_at)
// 在线判定：玩家 30 秒内在 sync 里出现过（记 presence 表）

type SparStatus = "waiting" | "active" | "host_won" | "guest_won" | "declined" | "cancelled";

export interface SparState {
  /** 双方宠物的战斗快照（简化 BattleState，双方各一份 HP/状态） */
  host: SparSide;
  guest: SparSide;
  /** 回合数（奇数=host 出招回合，偶数=guest） */
  turnNo: number;
  /** 最近 12 条战斗播报 */
  log: string[];
  seed: number;
  winner: "host" | "guest" | null;
}

export interface SparSide {
  name: string;
  element: string;
  level: number;
  maxHp: number;
  hp: number;
  atk: number;
  def: number;
  spd: number;
  /** 招式（id/name/power/element 与 game-core Move 对齐，JSON 传输） */
  moves: { id: string; name: string; power: number; element: string; effect?: { kind: "poison" | "paralyze"; chance: number } }[];
  status: { poison: number; paralyze: number; empower: number; guard: number };
  defending: boolean;
}

export interface SparRoom {
  id: string;
  hostId: string;
  hostName: string;
  guestId: string | null;
  guestName: string | null;
  status: SparStatus;
  state: SparState | null;
  updatedAt: number;
}

export interface ChatMsg {
  id: number;
  playerId: string;
  name: string;
  text: string;
  createdAt: number;
}

const ROOM_TTL = 10 * 60 * 1000; // 房间 10 分钟无活动自动作废
const PRESENCE_TTL = 35 * 1000;

export async function ensureLiveTables(db: D1Database): Promise<void> {
  await db.batch([
    db.prepare(`CREATE TABLE IF NOT EXISTS spar_rooms (
      id TEXT PRIMARY KEY,
      host_id TEXT NOT NULL,
      host_name TEXT NOT NULL,
      guest_id TEXT,
      guest_name TEXT,
      status TEXT NOT NULL DEFAULT 'waiting',
      state_json TEXT,
      updated_at INTEGER NOT NULL
    )`),
    db.prepare(`CREATE TABLE IF NOT EXISTS chat_msgs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      player_id TEXT NOT NULL,
      name TEXT NOT NULL,
      text TEXT NOT NULL,
      created_at INTEGER NOT NULL
    )`),
    db.prepare(`CREATE INDEX IF NOT EXISTS idx_chat_created ON chat_msgs (created_at)`),
  ]);
}

/** 踢掉过期房间与旧聊天（每次操作顺手清理，成本极低） */
async function cleanup(db: D1Database) {
  const now = Date.now();
  await db.batch([
    db.prepare(`DELETE FROM spar_rooms WHERE updated_at < ?`).bind(now - ROOM_TTL),
    db.prepare(`DELETE FROM chat_msgs WHERE created_at < ?`).bind(now - 24 * 3600 * 1000),
  ]);
}

/** 创建切磋房（发起挑战） */
export async function sparCreate(db: D1Database, hostId: string, hostName: string): Promise<SparRoom> {
  await ensureLiveTables(db);
  await cleanup(db);
  // 一个人同时只能开一间房
  await db.prepare(`DELETE FROM spar_rooms WHERE host_id = ? AND status = 'waiting'`).bind(hostId).run();
  const id = crypto.randomUUID().slice(0, 8);
  const now = Date.now();
  await db.prepare(
    `INSERT INTO spar_rooms (id, host_id, host_name, status, updated_at) VALUES (?, ?, ?, 'waiting', ?)`
  ).bind(id, hostId, hostName, now).run();
  return { id, hostId, hostName, guestId: null, guestName: null, status: "waiting", state: null, updatedAt: now };
}

/** 加入切磋房（接受挑战）；hostState/guestState 由调用方（API 层）根据双方档案构建 */
export async function sparJoin(
  db: D1Database, roomId: string, guestId: string, guestName: string
): Promise<{ ok: boolean; error?: string }> {
  await ensureLiveTables(db);
  const row = await db.prepare(`SELECT * FROM spar_rooms WHERE id = ?`).bind(roomId).first<Record<string, unknown>>();
  if (!row) return { ok: false, error: "这场挑战已经不存在了（超时或已取消）" };
  if (row.status !== "waiting") return { ok: false, error: "这场挑战已经被别人先接了！" };
  if (row.host_id === guestId) return { ok: false, error: "不能挑战自己哦" };
  await db.prepare(`UPDATE spar_rooms SET guest_id = ?, guest_name = ?, status = 'active', updated_at = ? WHERE id = ?`)
    .bind(guestId, guestName, Date.now(), roomId).run();
  return { ok: true };
}

/** 房主取消未开战的挑战 */
export async function sparCancel(db: D1Database, roomId: string, byId: string): Promise<{ ok: boolean }> {
  await db.prepare(`DELETE FROM spar_rooms WHERE id = ? AND host_id = ? AND status = 'waiting'`).bind(roomId, byId).run();
  return { ok: true };
}

export async function sparGet(db: D1Database, roomId: string): Promise<SparRoom | null> {
  const row = await db.prepare(`SELECT * FROM spar_rooms WHERE id = ?`).bind(roomId).first<Record<string, unknown>>();
  if (!row) return null;
  return rowToRoom(row);
}

/** 我参与中的房间（发起的或被卷入的），供轮询发现"有人向我发起挑战" */
export async function sparMyRoom(db: D1Database, playerId: string): Promise<SparRoom[]> {
  await ensureLiveTables(db);
  await cleanup(db);
  const rs = await db.prepare(
    `SELECT * FROM spar_rooms WHERE (host_id = ? OR guest_id = ?) AND updated_at > ?
     ORDER BY updated_at DESC LIMIT 3`
  ).bind(playerId, playerId, Date.now() - ROOM_TTL).all<Record<string, unknown>>();
  return (rs.results ?? []).map(rowToRoom);
}

export async function sparSaveState(db: D1Database, roomId: string, state: SparState, status: SparStatus): Promise<void> {
  await db.prepare(`UPDATE spar_rooms SET state_json = ?, status = ?, updated_at = ? WHERE id = ?`)
    .bind(JSON.stringify(state), status, Date.now(), roomId).run();
}

/** 在线玩家数：最近 35 秒 sync 过档案的人数 */
export async function presenceCount(db: D1Database): Promise<number> {
  await db.prepare(`CREATE TABLE IF NOT EXISTS presence (player_id TEXT PRIMARY KEY, seen_at INTEGER NOT NULL)`).run();
  await db.prepare(`DELETE FROM presence WHERE seen_at < ?`).bind(Date.now() - PRESENCE_TTL).run();
  const r = await db.prepare(`SELECT COUNT(*) AS n FROM presence`).first<{ n: number }>();
  return r?.n ?? 0;
}

export async function presenceTouch(db: D1Database, playerId: string): Promise<void> {
  await db.prepare(`CREATE TABLE IF NOT EXISTS presence (player_id TEXT PRIMARY KEY, seen_at INTEGER NOT NULL)`).run();
  await db.prepare(
    `INSERT INTO presence (player_id, seen_at) VALUES (?, ?)
     ON CONFLICT(player_id) DO UPDATE SET seen_at = excluded.seen_at`
  ).bind(playerId, Date.now()).run();
}

export async function chatPost(db: D1Database, playerId: string, name: string, text: string): Promise<ChatMsg> {
  await ensureLiveTables(db);
  const clean = text.trim().slice(0, 80);
  if (!clean) throw new Error("empty message");
  const createdAt = Date.now();
  await db.prepare(`INSERT INTO chat_msgs (player_id, name, text, created_at) VALUES (?, ?, ?, ?)`)
    .bind(playerId, name, clean, createdAt).run();
  return { id: createdAt, playerId, name, text: clean, createdAt };
}

export async function chatList(db: D1Database, sinceId = 0, limit = 40): Promise<ChatMsg[]> {
  await ensureLiveTables(db);
  const rs = await db.prepare(
    `SELECT * FROM chat_msgs WHERE id > ? ORDER BY id DESC LIMIT ?`
  ).bind(sinceId, limit).all<Record<string, unknown>>();
  return (rs.results ?? [])
    .map(rowToMsg)
    .reverse(); // 旧→新
}

function rowToMsg(r: Record<string, unknown>): ChatMsg {
  return {
    id: Number(r.id),
    playerId: String(r.player_id),
    name: String(r.name),
    text: String(r.text),
    createdAt: Number(r.created_at),
  };
}

function rowToRoom(r: Record<string, unknown>): SparRoom {
  return {
    id: String(r.id),
    hostId: String(r.host_id),
    hostName: String(r.host_name),
    guestId: r.guest_id ? String(r.guest_id) : null,
    guestName: r.guest_name ? String(r.guest_name) : null,
    status: r.status as SparStatus,
    state: r.state_json ? (JSON.parse(String(r.state_json)) as SparState) : null,
    updatedAt: Number(r.updated_at),
  };
}
