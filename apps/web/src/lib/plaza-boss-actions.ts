// 组队 Boss 的服务端 action 处理
import { speciesById, maxHpOf, atkOf, defOf, movesOf } from "@maomao/game-core";
import type { Pet } from "@maomao/game-core";
import { bossCreate, bossJoin, bossCancel, bossGet, bossMyRoom, bossSaveState } from "./plaza-boss";
import type { BossSide, BossState } from "./plaza-boss";
import { bossDoAction } from "./boss-engine";
import { loadFromD1 } from "./plaza-db";

/** 暗影胖胖王（组队版）：3 倍血量、高攻 */
function makeBoss(playerLevels: number[]): BossState["boss"] {
  const s = speciesById("pangpangwang");
  const level = Math.max(12, ...playerLevels);
  const fake: Pet = {
    uid: "boss", speciesId: s.id, name: s.name, element: s.element, rarity: s.rarity,
    look: s.look, base: s.base, level, exp: 0, train: { atk: 0, def: 0, spd: 0 },
  };
  const maxHp = maxHpOf(fake) * 3;
  return {
    name: "暗影胖胖王", element: s.element, level,
    maxHp, hp: maxHp,
    atk: Math.round(atkOf(fake) * 1.15),
    def: defOf(fake),
    status: { poison: 0, paralyze: 0, guard: 0 },
    chargeIn: 3,
  };
}

function sideFromPlayer(playerId: string, name: string, petInfo: { name: string; speciesId: string; level: number }): BossSide {
  const s = speciesById(petInfo.speciesId);
  const fake: Pet = {
    uid: "boss-" + playerId, speciesId: s.id, name: petInfo.name, element: s.element, rarity: s.rarity,
    look: s.look, base: s.base, level: petInfo.level, exp: 0, train: { atk: 0, def: 0, spd: 0 },
  };
  return {
    playerId, name,
    petName: petInfo.name,
    element: s.element,
    level: petInfo.level,
    maxHp: maxHpOf(fake),
    hp: maxHpOf(fake),
    atk: atkOf(fake),
    def: defOf(fake),
    spd: 0,
    moves: movesOf(fake).map((m) => ({
      id: m.id, name: m.name, power: m.power, element: m.element,
      effect: m.effect ? { kind: m.effect.kind, chance: m.effect.chance } : undefined,
    })),
    status: { poison: 0, paralyze: 0, empower: 0, guard: 0 },
    defending: false,
    ready: false,
  };
}

async function tokenLookup(db: D1Database, token: string) {
  const all = await loadFromD1(db);
  const id = all.sessions[token];
  return id ? all.players.find((p) => p.id === id) ?? null : null;
}

export async function handleBossAction(
  action: string,
  body: Record<string, unknown>,
  db: D1Database
): Promise<Record<string, unknown> | null> {
  const token = String(body.token ?? "");
  const me = token ? await tokenLookup(db, token) : null;

  switch (action) {
    case "bossChallenge": {
      if (!me) return { error: "请先登录" };
      const room = await bossCreate(db, me.id, me.name);
      return { ok: true, roomId: room.id };
    }
    case "bossCancel": {
      if (!me) return { error: "请先登录" };
      await bossCancel(db, String(body.roomId ?? ""), me.id);
      return { ok: true };
    }
    case "bossJoin": {
      if (!me) return { error: "请先登录" };
      const roomId = String(body.roomId ?? "");
      const r = await bossJoin(db, roomId, me.id, me.name);
      if (!r.ok) return { error: r.error };
      const room = await bossGet(db, roomId);
      if (!room) return { error: "房间不存在" };
      const all = await loadFromD1(db);
      const hostP = all.players.find((x) => x.id === room.hostId);
      const guestP = all.players.find((x) => x.id === me.id);
      if (!hostP?.pet || !guestP?.pet) return { error: "双方都要有宠物才能讨伐 Boss 哦" };
      const state: BossState = {
        boss: makeBoss([hostP.pet.level, guestP.pet.level]),
        players: [
          sideFromPlayer(hostP.id, hostP.name, hostP.pet),
          sideFromPlayer(guestP.id, guestP.name, guestP.pet),
        ],
        turnNo: 1,
        log: [`${hostP.name} 和 ${guestP.name} 组成了讨伐队，向森林深处进发！`],
        seed: Math.floor(Math.random() * 2 ** 31),
        winner: null,
      };
      await bossSaveState(db, roomId, state, "active");
      return { ok: true };
    }
    case "bossMove": {
      if (!me) return { error: "请先登录" };
      const room = await bossGet(db, String(body.roomId ?? ""));
      if (!room?.state) return { error: "讨伐不存在" };
      const kind = String(body.kind ?? "move") === "defend" ? "defend" : "move";
      const r = bossDoAction(room.state, me.id, { kind, moveIndex: Number(body.moveIndex ?? 0) });
      if (r.error) return { error: r.error, state: r.state };
      const status = r.state.winner === "players" ? "won" : r.state.winner === "boss" ? "lost" : "active";
      await bossSaveState(db, room.id, r.state, status);
      return { ok: true, state: r.state };
    }
    case "bossState": {
      const room = await bossGet(db, String(body.roomId ?? ""));
      if (!room) return { error: "讨伐不存在" };
      return {
        ok: true,
        room: {
          id: room.id, status: room.status, hostName: room.hostName, guestName: room.guestName, state: room.state,
        },
      };
    }
    case "bossMyRoom": {
      if (!me) return { rooms: [] };
      const rooms = await bossMyRoom(db, me.id);
      return {
        ok: true,
        rooms: rooms.map((r) => ({
          id: r.id, status: r.status, hostName: r.hostName, guestName: r.guestName, state: r.state,
        })),
      };
    }
    default:
      return null;
  }
}
