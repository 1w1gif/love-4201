// 组队 Boss 数据层：boss_rooms 表，房间制 2 人协力打暗影胖胖王
// 复用 spar 的模式：房间码 + 服务端权威结算 + 轮询同步

export interface BossSide {
  playerId: string;
  name: string;
  petName: string;
  element: string;
  level: number;
  maxHp: number;
  hp: number;
  atk: number;
  def: number;
  spd: number;
  moves: { id: string; name: string; power: number; element: string; effect?: { kind: "poison" | "paralyze"; chance: number } }[];
  status: { poison: number; paralyze: number; empower: number; guard: number };
  defending: boolean;
  /** 已出招次数（双方轮流） */
  ready: boolean;
}

export interface BossState {
  boss: {
    name: string;
    element: string;
    level: number;
    maxHp: number;
    hp: number;
    atk: number;
    def: number;
    status: { poison: number; paralyze: number; guard: number };
    /** Boss 每 3 回合蓄力一次重击 */
    chargeIn: number;
  };
  players: BossSide[];
  turnNo: number;
  log: string[];
  seed: number;
  /** null=进行中；'players'=胜利；'boss'=团灭 */
  winner: "players" | "boss" | null;
}

export interface BossRoom {
  id: string;
  hostId: string;
  hostName: string;
  guestId: string | null;
  guestName: string | null;
  status: "waiting" | "active" | "won" | "lost";
  state: BossState | null;
  updatedAt: number;
}

const ROOM_TTL = 15 * 60 * 1000;

export async function ensureBossTables(db: D1Database): Promise<void> {
  await db.prepare(`CREATE TABLE IF NOT EXISTS boss_rooms (
    id TEXT PRIMARY KEY,
    host_id TEXT NOT NULL,
    host_name TEXT NOT NULL,
    guest_id TEXT,
    guest_name TEXT,
    status TEXT NOT NULL DEFAULT 'waiting',
    state_json TEXT,
    updated_at INTEGER NOT NULL
  )`).run();
}

export async function bossCreate(db: D1Database, hostId: string, hostName: string): Promise<BossRoom> {
  await ensureBossTables(db);
  await db.prepare(`DELETE FROM boss_rooms WHERE host_id = ? AND status = 'waiting'`).bind(hostId).run();
  const id = "B" + crypto.randomUUID().slice(0, 7).toUpperCase();
  const now = Date.now();
  await db.prepare(`INSERT INTO boss_rooms (id, host_id, host_name, status, updated_at) VALUES (?, ?, ?, 'waiting', ?)`)
    .bind(id, hostId, hostName, now).run();
  return { id, hostId, hostName, guestId: null, guestName: null, status: "waiting", state: null, updatedAt: now };
}

export async function bossJoin(db: D1Database, roomId: string, guestId: string, guestName: string): Promise<{ ok: boolean; error?: string }> {
  await ensureBossTables(db);
  const row = await db.prepare(`SELECT * FROM boss_rooms WHERE id = ?`).bind(roomId).first<Record<string, unknown>>();
  if (!row) return { ok: false, error: "这支讨伐队已经解散了（超时或取消）" };
  if (row.status !== "waiting") return { ok: false, error: "这支讨伐队已经出发了！" };
  if (row.host_id === guestId) return { ok: false, error: "不能和自己组队哦" };
  await db.prepare(`UPDATE boss_rooms SET guest_id = ?, guest_name = ?, status = 'active', updated_at = ? WHERE id = ?`)
    .bind(guestId, guestName, Date.now(), roomId).run();
  return { ok: true };
}

export async function bossCancel(db: D1Database, roomId: string, byId: string): Promise<void> {
  await db.prepare(`DELETE FROM boss_rooms WHERE id = ? AND host_id = ? AND status = 'waiting'`).bind(roomId, byId).run();
}

export async function bossGet(db: D1Database, roomId: string): Promise<BossRoom | null> {
  const row = await db.prepare(`SELECT * FROM boss_rooms WHERE id = ?`).bind(roomId).first<Record<string, unknown>>();
  if (!row) return null;
  return bossRowToRoom(row);
}

export async function bossMyRoom(db: D1Database, playerId: string): Promise<BossRoom[]> {
  await ensureBossTables(db);
  await db.prepare(`DELETE FROM boss_rooms WHERE updated_at < ?`).bind(Date.now() - ROOM_TTL).run();
  const rs = await db.prepare(
    `SELECT * FROM boss_rooms WHERE (host_id = ? OR guest_id = ?) AND updated_at > ? ORDER BY updated_at DESC LIMIT 3`
  ).bind(playerId, playerId, Date.now() - ROOM_TTL).all<Record<string, unknown>>();
  return (rs.results ?? []).map(bossRowToRoom);
}

export async function bossSaveState(db: D1Database, roomId: string, state: BossState, status: "active" | "won" | "lost"): Promise<void> {
  await db.prepare(`UPDATE boss_rooms SET state_json = ?, status = ?, updated_at = ? WHERE id = ?`)
    .bind(JSON.stringify(state), status, Date.now(), roomId).run();
}

function bossRowToRoom(r: Record<string, unknown>): BossRoom {
  return {
    id: String(r.id),
    hostId: String(r.host_id),
    hostName: String(r.host_name),
    guestId: r.guest_id ? String(r.guest_id) : null,
    guestName: r.guest_name ? String(r.guest_name) : null,
    status: r.status as BossRoom["status"],
    state: r.state_json ? (JSON.parse(String(r.state_json)) as BossState) : null,
    updatedAt: Number(r.updated_at),
  };
}
