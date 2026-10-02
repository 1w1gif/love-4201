// 在线切磋战斗引擎：服务端权威的轻量回合制（双方各 4 招式轮流出招）
// 与 game-core 的 Move 结构兼容，但状态机在服务端（D1），双方轮询同步
import type { SparSide, SparState } from "./plaza-live";

export interface SparAction {
  kind: "move" | "defend";
  moveIndex?: number;
}

export interface SparTurnResult {
  state: SparState;
  log: string[];
}

function rngFrom(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 2 ** 32;
  };
}

function calcDamage(atkSide: SparSide, defSide: SparSide, move: { power: number; element: string }, rng: () => number): { dmg: number; crit: boolean } {
  const CHART: Record<string, Record<string, number>> = {
    fire: { grass: 1.5, water: 0.75, fire: 0.75 },
    water: { fire: 1.5, grass: 0.75, water: 0.75 },
    grass: { water: 1.5, electric: 1.25, fire: 0.75, grass: 0.75 },
    electric: { water: 1.5, electric: 0.75 },
    shadow: { normal: 1.25 },
    normal: { shadow: 0.8 },
  };
  const elem = CHART[move.element]?.[defSide.element] ?? 1;
  const crit = rng() < 0.1;
  const variance = 0.9 + rng() * 0.2;
  let dmg = (move.power / 50) * atkSide.atk * (100 / (100 + defSide.def * 2)) * elem * variance;
  if (crit) dmg *= 1.5;
  if (defSide.defending) dmg *= 0.45;
  if (defSide.status.guard > 0) dmg *= 0.7;
  if (atkSide.status.empower > 0) dmg *= 1.4;
  return { dmg: Math.max(1, Math.round(dmg)), crit };
}

/** 执行一侧行动并返回播报；返回 null 表示行动方已麻痹跳过 */
export function sparDoAction(state: SparState, side: "host" | "guest", action: SparAction): SparTurnResult {
  const log: string[] = [];
  const me = side === "host" ? state.host : state.guest;
  const foe = side === "host" ? state.guest : state.host;
  const rng = rngFrom(state.seed);
  state.seed = (state.seed * 1664525 + 1013904223) >>> 0;

  // 麻痹判定
  if (me.status.paralyze > 0 && rng() < 0.25) {
    log.push(`${me.name} 麻痹了，动弹不得！`);
  } else if (action.kind === "defend") {
    me.defending = true;
    me.status.guard = 3;
    const heal = Math.round(me.maxHp * 0.08);
    me.hp = Math.min(me.maxHp, me.hp + heal);
    log.push(`${me.name} 稳住阵脚，恢复了 ${heal} 点体力！`);
  } else {
    const move = me.moves[Math.max(0, Math.min(me.moves.length - 1, action.moveIndex ?? 0))];
    log.push(`${me.name} 使出了「${move.name}」！`);
    const { dmg, crit } = calcDamage(me, foe, move, rng);
    foe.hp = Math.max(0, foe.hp - dmg);
    log.push(`${foe.name} 受到了 ${dmg} 点伤害${crit ? "（会心一击！）" : ""}。`);
    // 自身强化消耗
    if (me.status.empower > 0) {
      me.status.empower = 0;
      log.push(`${me.name} 的强化之力用掉了！`);
    }
    // 附加效果
    if (move.effect && foe.hp > 0 && rng() < move.effect.chance && foe.status[move.effect.kind] === 0) {
      foe.status[move.effect.kind] = move.effect.kind === "poison" ? 3 : 2;
      log.push(`${foe.name} ${move.effect.kind === "poison" ? "中毒了！" : "麻痹了！"}`);
    }
  }

  // 回合末结算：毒伤/倒数
  for (const [nm, sd] of [["host", state.host], ["guest", state.guest]] as const) {
    if (sd.hp <= 0) continue;
    if (sd.status.poison > 0) {
      const dmg = Math.max(1, Math.round(sd.maxHp * 0.08));
      sd.hp = Math.max(0, sd.hp - dmg);
      log.push(`${sd.name} 受到毒素侵蚀，损失 ${dmg} 点体力。`);
      sd.status.poison -= 1;
    }
    if (sd.status.paralyze > 0) sd.status.paralyze -= 1;
    if (sd.status.guard > 0) {
      sd.status.guard -= 1;
      if (sd.status.guard === 0) sd.defending = false;
    }
  }

  // 胜负
  if (state.guest.hp <= 0 && state.host.hp <= 0) {
    state.winner = state.host.hp >= state.guest.hp ? "host" : "guest";
  } else if (state.guest.hp <= 0) {
    state.winner = "host";
  } else if (state.host.hp <= 0) {
    state.winner = "guest";
  }
  if (state.winner) {
    log.push(state.winner === "host" ? `${state.host.name} 获胜！🎉` : `${state.guest.name} 获胜！🎉`);
  } else {
    state.turnNo += 1;
  }
  state.log = [...state.log, ...log].slice(-12);
  return { state, log };
}
