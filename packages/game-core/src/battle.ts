import { elementMultiplier } from "./pet";
import type { BattleBattler, Element, Move } from "./pet";
import { mulberry32 } from "@maomao/art-engine";

export type BattleEvent =
  | { type: "attack"; side: "player" | "enemy"; move: Move }
  | { type: "damage"; side: "player" | "enemy"; amount: number; crit: boolean; effective: "super" | "weak" | "normal" }
  | { type: "heal"; side: "player" | "enemy"; amount: number }
  | { type: "defend"; side: "player" | "enemy" }
  | { type: "faint"; side: "player" | "enemy" }
  | { type: "catch"; success: boolean; ball: "basic" | "great" }
  | { type: "message"; text: string }
  | { type: "end"; result: "win" | "lose" | "run" | "caught" };

export type PlayerAction =
  | { kind: "move"; moveIndex: number }
  | { kind: "defend" }
  | { kind: "item"; heal: number }
  | { kind: "catch"; ball: "basic" | "great" }
  | { kind: "run" };

export interface BattleState {
  player: BattleBattler;
  enemy: BattleBattler;
  turn: number;
  playerDefending: boolean;
  enemyDefending: boolean;
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
}

function calcDamage(attacker: BattleBattler, defender: BattleBattler, move: Move, rng: () => number, defending: boolean): DamageResult {
  const elem = elementMultiplier(move.element, defender.element);
  const crit = rng() < 0.1;
  const variance = 0.9 + rng() * 0.2;
  let dmg = (move.power / 50) * attacker.atk * (100 / (100 + defender.def * 2)) * elem * variance;
  if (crit) dmg *= 1.5;
  if (defending) dmg *= 0.45;
  const effective = elem >= 1.25 ? "super" : elem <= 0.8 ? "weak" : "normal";
  return { dmg: Math.max(1, Math.round(dmg)), crit, effective };
}

function attackOnce(
  attacker: BattleBattler,
  defender: BattleBattler,
  move: Move,
  defending: boolean,
  rng: () => number,
  events: BattleEvent[]
) {
  events.push({ type: "attack", side: attacker.owner, move });
  const { dmg, crit, effective } = calcDamage(attacker, defender, move, rng, defending);
  defender.hp = Math.max(0, defender.hp - dmg);
  events.push({ type: "damage", side: defender.owner, amount: dmg, crit, effective });
  if (defender.hp <= 0) {
    events.push({ type: "faint", side: defender.owner });
  }
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
      const enemyMove = enemy.moves[Math.floor(rng() * enemy.moves.length)] ?? enemy.moves[0];
      attackOnce(enemy, player, enemyMove, state.playerDefending, rng, events);
      if (player.hp <= 0) {
        state.over = true;
        state.result = "lose";
        events.push({ type: "message", text: `${player.name} 累得倒下了……` });
        events.push({ type: "end", result: "lose" });
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
    const heal = Math.min(action.heal, player.maxHp - player.hp);
    player.hp += heal;
    events.push({ type: "heal", side: "player", amount: heal });
  } else if (action.kind === "defend") {
    state.playerDefending = true;
    const heal = Math.round(player.maxHp * 0.1);
    player.hp = Math.min(player.maxHp, player.hp + heal);
    events.push({ type: "defend", side: "player" });
    events.push({ type: "heal", side: "player", amount: heal });
  }

  const enemyMove = enemy.moves[Math.floor(rng() * enemy.moves.length)] ?? enemy.moves[0];
  const enemySpecial = rng() < 0.15; // 敌人偶尔防御
  const playerFirst = action.kind === "move" && (player.spd > enemy.spd || (player.spd === enemy.spd && rng() < 0.5));

  const doPlayerMove = () => {
    const move = player.moves[action.kind === "move" ? action.moveIndex : 0];
    attackOnce(player, enemy, move, state.enemyDefending, rng, events);
  };
  const doEnemyMove = () => {
    if (enemySpecial) {
      state.enemyDefending = true;
      const heal = Math.round(enemy.maxHp * 0.08);
      enemy.hp = Math.min(enemy.maxHp, enemy.hp + heal);
      events.push({ type: "defend", side: "enemy" });
      events.push({ type: "heal", side: "enemy", amount: heal });
      return;
    }
    attackOnce(enemy, player, enemyMove, state.playerDefending, rng, events);
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
