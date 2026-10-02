import { elementMultiplier, NAIHANG_CATCHPHRASE } from "./pet";
import type { BattleBattler, Move, MoveEffectKind } from "./pet";
import { mulberry32 } from "@maomao/art-engine";

export type StatusKind = "poison" | "paralyze" | "empower" | "guard";

export type BattleSide = "player" | "enemy";

export type BattleEvent =
  | { type: "attack"; side: BattleSide; move: Move }
  | { type: "damage"; side: BattleSide; amount: number; crit: boolean; effective: "super" | "weak" | "normal" }
  | { type: "heal"; side: BattleSide; amount: number }
  | { type: "defend"; side: BattleSide }
  | { type: "faint"; side: BattleSide }
  | { type: "catch"; success: boolean; ball: "basic" | "great" }
  | { type: "message"; text: string }
  /** 状态附加（on=true）或解除（on=false） */
  | { type: "status"; side: BattleSide; kind: StatusKind; on: boolean }
  /** 中毒等状态的每回合扣血 */
  | { type: "statusDamage"; side: BattleSide; kind: MoveEffectKind; amount: number }
  | { type: "end"; result: "win" | "lose" | "run" | "caught" };

export type PlayerAction =
  | { kind: "move"; moveIndex: number }
  | { kind: "defend" }
  | { kind: "item"; heal: number; effect?: "cure" | "empower" }
  | { kind: "catch"; ball: "basic" | "great" }
  | { kind: "run" };

/** 一侧的状态计数（剩余回合数，0 = 无） */
export interface SideStatus {
  poison: number;
  paralyze: number;
  /** 下一次攻击威力提升（用掉即清零） */
  empower: number;
  /** 护盾剩余回合 */
  guard: number;
}

export function newSideStatus(): SideStatus {
  return { poison: 0, paralyze: 0, empower: 0, guard: 0 };
}

export interface BattleState {
  player: BattleBattler;
  enemy: BattleBattler;
  turn: number;
  playerDefending: boolean;
  enemyDefending: boolean;
  playerStatus: SideStatus;
  enemyStatus: SideStatus;
  rngSeed: number;
  over: boolean;
  result: "win" | "lose" | "run" | "caught" | null;
  canRun: boolean;
}

export function createBattle(
  player: BattleBattler,
  enemy: BattleBattler,
  opts?: { canRun?: boolean; seed?: number }
): BattleState {
  return {
    player,
    enemy,
    turn: 1,
    playerDefending: false,
    enemyDefending: false,
    playerStatus: newSideStatus(),
    enemyStatus: newSideStatus(),
    rngSeed: opts?.seed ?? Math.floor(Math.random() * 2 ** 31),
    over: false,
    result: null,
    canRun: opts?.canRun ?? true,
  };
}

interface DamageResult {
  dmg: number;
  crit: boolean;
  effective: "super" | "weak" | "normal";
  empowered: boolean;
}

const STATUS_NAMES: Record<StatusKind, string> = {
  poison: "中毒",
  paralyze: "麻痹",
  empower: "攻击强化",
  guard: "护盾",
};

function calcDamage(
  attacker: BattleBattler,
  defender: BattleBattler,
  move: Move,
  rng: () => number,
  defending: boolean,
  atkStatus: SideStatus,
  defStatus: SideStatus
): DamageResult {
  const elem = elementMultiplier(move.element, defender.element);
  const crit = rng() < 0.1;
  const variance = 0.9 + rng() * 0.2;
  let dmg = (move.power / 50) * attacker.atk * (100 / (100 + defender.def * 2)) * elem * variance;
  if (crit) dmg *= 1.5;
  if (defending) dmg *= 0.45;
  if (defStatus.guard > 0) dmg *= 0.7;
  const empowered = atkStatus.empower > 0;
  if (empowered) dmg *= 1.4;
  const effective = elem >= 1.25 ? "super" : elem <= 0.8 ? "weak" : "normal";
  return { dmg: Math.max(1, Math.round(dmg)), crit, effective, empowered };
}

function applyMoveEffect(
  move: Move,
  attacker: BattleBattler,
  defender: BattleBattler,
  defStatus: SideStatus,
  rng: () => number,
  events: BattleEvent[],
  atkStatus?: SideStatus
) {
  if (!move.effect || defender.hp <= 0) return;
  // 「你想听实话吗」：命中后给奶航自己加攻（对手麻痹则效果翻倍）
  if (move.id === "truthBeam" && atkStatus) {
    atkStatus.empower = 1;
    events.push({ type: "status", side: attacker.owner, kind: "empower", on: true });
    events.push({ type: "message", text: `${attacker.name}：「${NAIHANG_CATCHPHRASE}」实话是——下一击你会接不住！` });
    return;
  }
  if (defStatus[move.effect.kind] > 0) return; // 已有该状态则不重复附加
  if (rng() >= move.effect.chance) return;
  defStatus[move.effect.kind] = move.effect.kind === "poison" ? 4 : 3;
  events.push({ type: "status", side: defender.owner, kind: move.effect.kind, on: true });
  events.push({ type: "message", text: `${defender.name} ${move.effect.kind === "poison" ? "中毒了！" : "麻痹了，动弹不得！"}` });
}

function attackOnce(
  attacker: BattleBattler,
  defender: BattleBattler,
  move: Move,
  defending: boolean,
  rng: () => number,
  events: BattleEvent[],
  atkStatus: SideStatus,
  defStatus: SideStatus
) {
  events.push({ type: "attack", side: attacker.owner, move });
  // 奶航专属招式：出手前喊口头禅
  if (attacker.moves.includes(move) && (move.id === "fastball" || move.id === "grandSlam") && rng() < 0.35) {
    events.push({ type: "message", text: `${attacker.name} 推了推眼镜：「${NAIHANG_CATCHPHRASE}」⚾` });
  }
  const { dmg, crit, effective, empowered } = calcDamage(attacker, defender, move, rng, defending, atkStatus, defStatus);
  defender.hp = Math.max(0, defender.hp - dmg);
  events.push({ type: "damage", side: defender.owner, amount: dmg, crit, effective });
  if (empowered) {
    atkStatus.empower = 0;
    events.push({ type: "status", side: attacker.owner, kind: "empower", on: false });
  }
  if (defender.hp > 0) applyMoveEffect(move, attacker, defender, defStatus, rng, events, atkStatus);
  if (defender.hp <= 0) {
    events.push({ type: "faint", side: defender.owner });
  }
}

/** 回合结束时的状态结算：中毒扣血、各状态倒数 */
function tickStatus(
  battler: BattleBattler,
  status: SideStatus,
  events: BattleEvent[]
) {
  if (status.poison > 0) {
    const dmg = Math.max(1, Math.round(battler.maxHp * 0.08));
    battler.hp = Math.max(0, battler.hp - dmg);
    events.push({ type: "statusDamage", side: battler.owner, kind: "poison", amount: dmg });
    status.poison -= 1;
    if (status.poison === 0) events.push({ type: "status", side: battler.owner, kind: "poison", on: false });
    if (battler.hp > 0) {
      events.push({ type: "message", text: `${battler.name} 被毒素侵蚀，损失了 ${dmg} 点体力。` });
    }
  }
  if (status.paralyze > 0) {
    status.paralyze -= 1;
    if (status.paralyze === 0) events.push({ type: "status", side: battler.owner, kind: "paralyze", on: false });
  }
  if (status.guard > 0) {
    status.guard -= 1;
    if (status.guard === 0) events.push({ type: "status", side: battler.owner, kind: "guard", on: false });
  }
}

/** 麻痹判定：返回 true 表示麻到无法行动 */
function isParalyzed(status: SideStatus, name: string, rng: () => number, events: BattleEvent[]): boolean {
  if (status.paralyze <= 0) return false;
  if (rng() < 0.25) {
    events.push({ type: "message", text: `${name} 麻痹了，动弹不得！` });
    return true;
  }
  return false;
}

/** 捕捉成功率：血量越低越容易抓，稀有度越高越难，超级球加成 1.6 倍 */
export function catchChance(hpRatio: number, rarity: 1 | 2 | 3, ball: "basic" | "great"): number {
  const hpFactor = (1 - Math.min(1, Math.max(0, hpRatio))) * 0.8 + 0.1;
  const rarityMod = rarity === 1 ? 1 : rarity === 2 ? 0.7 : 0.5;
  const ballBonus = ball === "great" ? 1.6 : 1;
  return Math.min(0.95, Math.max(0.03, hpFactor * rarityMod * ballBonus));
}

/** 执行一整回合（玩家行动 + 敌方行动），返回事件流供 UI 播放动画 */
export function takeTurn(state: BattleState, action: PlayerAction): BattleEvent[] {
  if (state.over) return [];
  const events: BattleEvent[] = [];
  const rng = mulberry32(state.rngSeed);
  state.rngSeed = (state.rngSeed * 1664525 + 1013904223) >>> 0;

  const player = state.player;
  const enemy = state.enemy;
  const playerStatus = state.playerStatus;
  const enemyStatus = state.enemyStatus;
  state.playerDefending = false;
  state.enemyDefending = false;

  // 投掷精灵球：成功则战斗立刻结束，失败则对方照常进攻
  if (action.kind === "catch") {
    const chance = catchChance(enemy.hp / enemy.maxHp, enemy.rarity, action.ball);
    const ballName = action.ball === "great" ? "超级球" : "精灵球";
    if (rng() < chance) {
      state.over = true;
      state.result = "caught";
      events.push({ type: "catch", success: true, ball: action.ball });
      events.push({ type: "message", text: `嘿！${enemy.name} 钻进了${ballName}，被捉住啦！` });
      events.push({ type: "end", result: "caught" });
    } else {
      events.push({ type: "catch", success: false, ball: action.ball });
      events.push({ type: "message", text: `哎呀，${enemy.name} 从${ballName}里挣脱出来了！` });
      if (!isParalyzed(enemyStatus, enemy.name, rng, events)) {
        const enemyMove = enemy.moves[Math.floor(rng() * enemy.moves.length)] ?? enemy.moves[0];
        attackOnce(enemy, player, enemyMove, state.playerDefending, rng, events, enemyStatus, playerStatus);
        if (player.hp <= 0) {
          state.over = true;
          state.result = "lose";
          events.push({ type: "message", text: `${player.name} 累得倒下了……` });
          events.push({ type: "end", result: "lose" });
        } else {
          state.turn += 1;
        }
      } else {
        state.turn += 1;
      }
    }
    return events;
  }

  if (action.kind === "run") {
    const chance = Math.min(0.9, 0.5 + (player.spd - enemy.spd) * 0.03);
    if (rng() < chance) {
      state.over = true;
      state.result = "run";
      events.push({ type: "message", text: "成功溜掉了！屁股一扭就跑。" });
      events.push({ type: "end", result: "run" });
      return events;
    }
    events.push({ type: "message", text: "没溜掉！被抓住了尾巴……" });
  } else if (action.kind === "item") {
    if (action.effect === "cure") {
      playerStatus.poison = 0;
      playerStatus.paralyze = 0;
      events.push({ type: "status", side: "player", kind: "poison", on: false });
      events.push({ type: "status", side: "player", kind: "paralyze", on: false });
      events.push({ type: "message", text: `${player.name} 的状态恢复正常了！` });
    } else if (action.effect === "empower") {
      playerStatus.empower = 1;
      events.push({ type: "status", side: "player", kind: "empower", on: true });
      events.push({ type: "message", text: `${player.name} 浑身充满力量，下一次攻击威力大增！` });
    } else {
      const heal = Math.min(action.heal, player.maxHp - player.hp);
      player.hp += heal;
      events.push({ type: "heal", side: "player", amount: heal });
    }
  } else if (action.kind === "defend") {
    state.playerDefending = true;
    playerStatus.guard = Math.max(playerStatus.guard, 3);
    const heal = Math.round(player.maxHp * 0.1);
    player.hp = Math.min(player.maxHp, player.hp + heal);
    events.push({ type: "defend", side: "player" });
    events.push({ type: "heal", side: "player", amount: heal });
    if (playerStatus.guard === 3) {
      events.push({ type: "status", side: "player", kind: "guard", on: true });
    }
  }

  const enemyMove = enemy.moves[Math.floor(rng() * enemy.moves.length)] ?? enemy.moves[0];
  const enemySpecial = rng() < 0.15; // 敌人偶尔防御
  const playerFirst = action.kind === "move" && (player.spd > enemy.spd || (player.spd === enemy.spd && rng() < 0.5));

  const doPlayerMove = () => {
    if (isParalyzed(playerStatus, player.name, rng, events)) return;
    const move = player.moves[action.kind === "move" ? action.moveIndex : 0];
    attackOnce(player, enemy, move, state.enemyDefending, rng, events, playerStatus, enemyStatus);
  };
  const doEnemyMove = () => {
    if (isParalyzed(enemyStatus, enemy.name, rng, events)) return;
    if (enemySpecial) {
      state.enemyDefending = true;
      enemyStatus.guard = Math.max(enemyStatus.guard, 3);
      const heal = Math.round(enemy.maxHp * 0.08);
      enemy.hp = Math.min(enemy.maxHp, enemy.hp + heal);
      events.push({ type: "defend", side: "enemy" });
      events.push({ type: "heal", side: "enemy", amount: heal });
      events.push({ type: "status", side: "enemy", kind: "guard", on: true });
      return;
    }
    attackOnce(enemy, player, enemyMove, state.playerDefending, rng, events, enemyStatus, playerStatus);
  };

  if (action.kind === "move") {
    if (playerFirst) {
      doPlayerMove();
      if (enemy.hp > 0) doEnemyMove();
    } else {
      doEnemyMove();
      if (player.hp > 0) doPlayerMove();
    }
  } else {
    // 玩家用了道具/防御/逃跑失败，敌人行动
    if (enemy.hp > 0) doEnemyMove();
  }

  // 回合结束：状态结算（中毒扣血 / 各状态倒数）
  if (enemy.hp > 0) tickStatus(enemy, enemyStatus, events);
  if (player.hp > 0) tickStatus(player, playerStatus, events);

  if (enemy.hp <= 0) {
    state.over = true;
    state.result = "win";
    events.push({ type: "message", text: `太棒了！${enemy.name} 被打败啦！` });
    events.push({ type: "end", result: "win" });
  } else if (player.hp <= 0) {
    state.over = true;
    state.result = "lose";
    events.push({ type: "message", text: `${player.name} 累得倒下了……` });
    events.push({ type: "end", result: "lose" });
  } else {
    state.turn += 1;
  }
  return events;
}

export { STATUS_NAMES };
