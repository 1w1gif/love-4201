// 在线切磋 + 聊天的服务端 action 处理（挂到 /api/plaza 的 POST switch 里用）
// 服务端权威：双方数值从 D1 档案构建，出招在服务端结算，防手改
import { speciesById, maxHpOf, atkOf, defOf, spdOf, movesOf } from "@maomao/game-core";
import type { Pet } from "@maomao/game-core";
import {
  sparCreate, sparJoin, sparCancel, sparGet, sparMyRoom, sparSaveState,
  chatPost, chatList, presenceTouch, presenceCount,
} from "./plaza-live";
import type { SparRoom, SparSide, SparState } from "./plaza-live";
import { sparDoAction } from "./spar-engine";
import { loadFromD1, publicPlayer } from "./plaza-db";
import type { DB } from "./plaza-db";

/** 从玩家档案构建战斗侧数据（与 game-core 数值公式一致） */
function sideFromPlayer(p: NonNullable<ReturnType<typeof publicPlayer>>, petInfo: { name: string; speciesId: string; level: number }): SparSide {
  const s = speciesById(petInfo.speciesId);
  const fake: Pet = {
    uid: "spar-" + p.id,
    speciesId: s.id,
    name: petInfo.name,
    element: s.element,
    rarity: s.rarity,
    look: s.look,
    base: s.base,
    level: petInfo.level,
    exp: 0,
    train: { atk: 0, def: 0, spd: 0 },
  };
  const moves = movesOf(fake).map((m) => ({
    id: m.id, name: m.name, power: m.power, element: m.element,
    effect: m.effect ? { kind: m.effect.kind, chance: m.effect.chance } : undefined,
  }));
  return {
    name: `${p.name}的${petInfo.name}`,
    element: s.element,
    level: petInfo.level,
    maxHp: maxHpOf(fake),
    hp: maxHpOf(fake),
    atk: atkOf(fake),
    def: defOf(fake),
    spd: spdOf(fake),
    moves,
    status: { poison: 0, paralyze: 0, empower: 0, guard: 0 },
    defending: false,
  };
}

function buildState(hostP: NonNullable<ReturnType<typeof publicPlayer>>, hostPet: { name: string; speciesId: string; level: number }, guestP: NonNullable<ReturnType<typeof publicPlayer>>, guestPet: { name: string; speciesId: string; level: number }): SparState {
  return {
    host: sideFromPlayer(hostP, hostPet),
    guest: sideFromPlayer(guestP, guestPet),
    turnNo: 1,
    log: [`${hostP.name} 向 ${guestP.name} 发起了切磋！`],
    seed: Math.floor(Math.random() * 2 ** 31),
    winner: null,
  };
}

/**
 * 处理 live 相关 action。返回 null 表示不是本模块的 action（调用方继续走原 switch）。
 * body/action 已在 route 层解析。
 */
export async function handleLiveAction(
  action: string,
  body: Record<string, unknown>,
  db: D1Database
): Promise<Record<string, unknown> | null> {
  const token = String(body.token ?? "");
  const me = token ? await tokenLookup(db, token) : null;

  switch (action) {
    case "sparChallenge": {
      if (!me) return { error: "请先登录" };
      const room = await sparCreate(db, me.id, me.name);
      return { ok: true, roomId: room.id };
    }
    case "sparCancel": {
      if (!me) return { error: "请先登录" };
      await sparCancel(db, String(body.roomId ?? ""), me.id);
      return { ok: true };
    }
    case "sparAccept": {
      if (!me) return { error: "请先登录" };
      const roomId = String(body.roomId ?? "");
      const r = await sparJoin(db, roomId, me.id, me.name);
      if (!r.ok) return { error: r.error };
      // 双方就位：从档案构建初始战斗状态
      const room = await sparGet(db, roomId);
      if (!room) return { error: "房间不存在" };
      const dbAll = await loadDb(db);
      const hostP = dbAll.players.find((x) => x.id === room.hostId);
      const guestP = dbAll.players.find((x) => x.id === me.id);
      if (!hostP?.pet || !guestP?.pet) return { error: "双方都要有宠物才能切磋哦" };
      const state = buildState(publicPlayer(hostP), hostP.pet, publicPlayer(guestP), guestP.pet);
      await sparSaveState(db, roomId, state, "active");
      return { ok: true };
    }
    case "sparDecline": {
      if (!me) return { error: "请先登录" };
      await db.prepare(`DELETE FROM spar_rooms WHERE id = ? AND guest_id IS NULL AND status = 'waiting'`)
        .bind(String(body.roomId ?? "")).run();
      return { ok: true };
    }
    case "sparMove": {
      if (!me) return { error: "请先登录" };
      const room = await sparGet(db, String(body.roomId ?? ""));
      if (!room?.state) return { error: "对局不存在" };
      const st = room.state;
      if (st.winner) return { state: st };
      const mySide: "host" | "guest" = room.hostId === me.id ? "host" : room.guestId === me.id ? "guest" : null as never;
      if (!mySide) return { error: "你不在这场对局里" };
      // 回合归属：host 先手，单回合交替；只允许当前回合方提交
      const whoseTurn = st.turnNo % 2 === 1 ? "host" : "guest";
      if (mySide !== whoseTurn) return { error: "还没轮到你", state: st };
      const kind = String(body.kind ?? "move") === "defend" ? "defend" : "move";
      const r = sparDoAction(st, mySide, { kind, moveIndex: Number(body.moveIndex ?? 0) });
      const status = r.state.winner ? (r.state.winner === "host" ? "host_won" : "guest_won") : "active";
      await sparSaveState(db, room.id, r.state, status);
      return { ok: true, state: r.state };
    }
    case "sparState": {
      const room = await sparGet(db, String(body.roomId ?? ""));
      if (!room) return { error: "对局不存在" };
      return { ok: true, room: { id: room.id, status: room.status, hostName: room.hostName, guestName: room.guestName, state: room.state } };
    }
    case "sparMyRoom": {
      if (!me) return { rooms: [] };
      const rooms = await sparMyRoom(db, me.id);
      return {
        ok: true,
        rooms: rooms.map((r: SparRoom) => ({
          id: r.id, status: r.status, hostId: r.hostId, hostName: r.hostName,
          guestId: r.guestId, guestName: r.guestName, state: r.state,
        })),
      };
    }
    case "chatPost": {
      if (!me) return { error: "请先登录" };
      const text = String(body.text ?? "");
      if (!text.trim()) return { error: "想说点什么呀" };
      const msg = await chatPost(db, me.id, me.name, text);
      await presenceTouch(db, me.id);
      return { ok: true, msg };
    }
    case "chatList": {
      if (me) await presenceTouch(db, me.id);
      const msgs = await chatList(db, Number(body.sinceId ?? 0));
      const online = await presenceCount(db);
      return { ok: true, msgs, online };
    }
    default:
      return null; // 不是 live 模块的 action
  }
}

/* ---------- helpers ---------- */

async function loadDb(db: D1Database): Promise<DB> {
  return loadFromD1(db);
}

// token → 玩家（异步读 D1 后内存查找）
async function tokenLookup(db: D1Database, token: string) {
  const all = await loadDb(db);
  const id = all.sessions[token];
  return id ? all.players.find((p) => p.id === id) ?? null : null;
}
