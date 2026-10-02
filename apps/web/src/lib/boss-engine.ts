// 组队 Boss 战斗引擎：两名玩家轮流出招 vs 强化暗影胖胖王（服务端权威）
import type { BossSide, BossState } from "./plaza-boss";

export interface BossAction {
  kind: "move" | "defend";
  moveIndex?: number;
}

function rngFrom(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 2 ** 32;
  };
}

const CHART: Record<string, Record<string, number>> = {
  fire: { grass: 1.5, water: 0.75, fire: 0.75 },
  water: { fire: 1.5, grass: 0.75, water: 0.75 },
  grass: { water: 1.5, electric: 1.25, fire: 0.75, grass: 0.75 },
  electric: { water: 1.5, electric: 0.75 },
  shadow: { normal: 1.25 },
  normal: { shadow: 0.8 },
};

/** 玩家行动（打 Boss） */
function playerAct(state: BossState, pi: number, action: BossAction): string[] {
  const log: string[] = [];
  const me = state.players[pi];
  const boss = state.boss;
  const rng = rngFrom(state.seed);
  state.seed = (state.seed * 1664525 + 1013904223) >>> 0;

  if (me.status.paralyze > 0 && rng() < 0.25) {
    log.push(`${me.name} 麻痹了，动弹不得！`);
    return log;
  }
  if (action.kind === "defend") {
    me.defending = true;
    me.status.guard = 3;
    const heal = Math.round(me.maxHp * 0.08);
    me.hp = Math.min(me.maxHp, me.hp + heal);
    log.push(`${me.name} 稳住阵脚，恢复了 ${heal} 点体力！`);
    return log;
  }
  const move = me.moves[Math.max(0, Math.min(me.moves.length - 1, action.moveIndex ?? 0))];
  log.push(`${me.name} 使出了「${move.name}」！`);
  const elem = CHART[move.element]?.[boss.element] ?? 1;
  const crit = rng() < 0.1;
  const variance = 0.9 + rng() * 0.2;
  let dmg = (move.power / 50) * me.atk * (100 / (100 + boss.def * 2)) * elem * variance;
  if (crit) dmg *= 1.5;
  if (me.status.empower > 0) dmg *= 1.4;
  const final = Math.max(1, Math.round(dmg));
  boss.hp = Math.max(0, boss.hp - final);
  log.push(`暗影胖胖王受到了 ${final} 点伤害${crit ? "（会心一击！）" : ""}${elem >= 1.25 ? " 效果拔群！" : ""}`);
  if (me.status.empower > 0) me.status.empower = 0;
  if (move.effect && boss.hp > 0 && rng() < move.effect.chance && boss.status[move.effect.kind] === 0) {
    boss.status[move.effect.kind] = 3;
    log.push(`暗影胖胖王${move.effect.kind === "poison" ? "中毒了！" : "麻痹了！"}`);
  }
  return log;
}

/** Boss 行动（随机打一名玩家；蓄力回合放重击） */
function bossAct(state: BossState): string[] {
  const log: string[] = [];
  const boss = state.boss;
  const rng = rngFrom(state.seed);
  state.seed = (state.seed * 1664525 + 1013904223) >>> 0;

  if (boss.status.poison > 0) {
    const dmg = Math.max(1, Math.round(boss.maxHp * 0.06));
    boss.hp = Math.max(0, boss.hp - dmg);
    log.push(`暗影胖胖王受毒素侵蚀，损失 ${dmg} 点体力。`);
    boss.status.poison -= 1;
  }
  if (boss.hp <= 0) return log;

  const living = state.players.filter((p) => p.hp > 0);
  if (!living.length) return log;
  const target = living[Math.floor(rng() * living.length)];

  boss.chargeIn -= 1;
  const charging = boss.chargeIn <= 0;
  if (charging) boss.chargeIn = 3;

  if (boss.status.paralyze > 0 && rng() < 0.25) {
    log.push("暗影胖胖王麻痹了，这一轮没动！");
    boss.status.paralyze -= 1;
    return log;
  }
  if (boss.status.paralyze > 0) boss.status.paralyze -= 1;

  const power = charging ? 95 : 55;
  if (charging) log.push("暗影胖胖王浑身黑气翻涌，放出了「暗影灭击」！");
  else log.push(`暗影胖胖王向 ${target.name} 扑了过来！`);

  const elem = CHART.shadow?.[target.element] ?? 1;
  const variance = 0.9 + rng() * 0.2;
  let dmg = (power / 50) * boss.atk * (100 / (100 + target.def * 2)) * elem * variance;
  if (target.defending) dmg *= 0.45;
  if (target.status.guard > 0) dmg *= 0.7;
  const final = Math.max(1, Math.round(dmg));
  target.hp = Math.max(0, target.hp - final);
  log.push(`${target.name} 受到了 ${final} 点伤害${charging ? "（重击！）" : ""}。`);
  return log;
}

/** 执行一整个玩家回合：该玩家出招 → Boss 反击 */
export function bossDoAction(state: BossState, playerId: string, action: BossAction): { state: BossState; error?: string } {
  const pi = state.players.findIndex((p) => p.playerId === playerId);
  if (pi < 0) return { state, error: "你不在这场讨伐里" };
  if (state.winner) return { state };
  const me = state.players[pi];
  if (me.hp <= 0) return { state, error: "你已经倒下了，等待队友继续战斗吧" };

  const log: string[] = [...playerAct(state, pi, action)];
  me.ready = true;

  // 两人都已行动（或一人已倒下另一人已行动）→ Boss 回合 + 新回合
  const alive = state.players.filter((p) => p.hp > 0);
  const allActed = alive.every((p) => p.ready) || (alive.length === 1 && alive[0].ready);
  if (allActed) {
    state.players.forEach((p) => (p.ready = false));
    log.push(...bossAct(state));
    // 回合末玩家状态结算
    for (const p of state.players) {
      if (p.hp <= 0) continue;
      if (p.status.poison > 0) {
        const dmg = Math.max(1, Math.round(p.maxHp * 0.08));
        p.hp = Math.max(0, p.hp - dmg);
        log.push(`${p.name} 受到毒素侵蚀，损失 ${dmg} 点体力。`);
        p.status.poison -= 1;
      }
      if (p.status.paralyze > 0) p.status.paralyze -= 1;
      if (p.status.guard > 0) {
        p.status.guard -= 1;
        if (p.status.guard === 0) p.defending = false;
      }
    }
    state.turnNo += 1;
  }

  if (state.boss.hp <= 0) {
    state.winner = "players";
    log.push("暗影胖胖王倒下了！星光重新照亮森林！🎉");
  } else if (state.players.every((p) => p.hp <= 0)) {
    state.winner = "boss";
    log.push("讨伐队全灭……暗影胖胖王发出得意的吼叫。");
  }
  state.log = [...state.log, ...log].slice(-14);
  return { state };
}
