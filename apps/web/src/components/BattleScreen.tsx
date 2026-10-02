"use client";

import { useEffect, useRef, useState } from "react";
import { useGame } from "@/store";
import { petSVG, ELEMENT_NAMES, elementMultiplier, outfitById } from "@maomao/game-core";
import type { BattleEvent, SideStatus, StatusKind } from "@maomao/game-core";
import { characterSVG } from "@maomao/game-core";
import { Btn, HpBar, Sprite } from "./Ui";
import { sfx, startBgm, stopBgm } from "@/lib/sfx";

interface Anim { type: "lunge" | "hit" | "heal" | "shield" | "faint"; side: "player" | "enemy" }

export default function BattleScreen() {
  const battle = useGame((s) => s.battle);
  const events = useGame((s) => s.battleEvents);
  const meta = useGame((s) => s.battleMeta);
  const battleAction = useGame((s) => s.battleAction);
  const clearBattle = useGame((s) => s.clearBattle);
  const look = useGame((s) => s.look);
  const outfitId = useGame((s) => s.outfitId);
  const items = useGame((s) => s.items);

  const [anim, setAnim] = useState<Anim | null>(null);
  const [float, setFloat] = useState<{ side: "player" | "enemy"; text: string; crit?: boolean; eff?: string } | null>(null);
  const [msg, setMsg] = useState<string>("野生的胖胖跳了出来！");
  const [showResult, setShowResult] = useState(false);
  const [busy, setBusy] = useState(false);
  const [menuTab, setMenuTab] = useState<"moves" | "items">("moves");

  // 本地显示用 HP（随事件推进）
  const [dHp, setDHp] = useState({ player: battle?.player.hp ?? 0, enemy: battle?.enemy.hp ?? 0 });

  useEffect(() => {
    if (!battle) return;
    setDHp({ player: battle.player.hp, enemy: battle.enemy.hp });
    setMsg(meta?.kind === "boss" ? "暗影胖胖王挡在了面前！" : meta?.kind === "pvp" ? `${meta.pvpOpponentName ?? "对方"}接受了切磋！` : meta?.kind === "trainer" ? "大狗粪派出了宠物！" : "野生的胖胖跳了出来！");
    setShowResult(false);
    if (useGame.getState().soundOn) startBgm("battle");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [meta?.speciesId, meta?.level, meta?.kind]);

  // 事件动画播放
  useEffect(() => {
    if (!events.length) return;
    setBusy(true);
    let t = 0;
    const timers: ReturnType<typeof setTimeout>[] = [];
    const push = (fn: () => void, dt: number) => {
      timers.push(setTimeout(fn, t));
      t += dt;
    };
    for (const ev of events as BattleEvent[]) {
      switch (ev.type) {
        case "attack":
          push(() => setAnim({ type: "lunge", side: ev.side }), 420);
          break;
        case "damage":
          push(() => {
            setAnim({ type: "hit", side: ev.side });
            setFloat({ side: ev.side, text: `-${ev.amount}`, crit: ev.crit, eff: ev.effective });
            setDHp((h) => ({ ...h, [ev.side]: Math.max(0, h[ev.side] - ev.amount) }));
            if (ev.crit) sfx.crit(); else sfx.hit();
          }, 560);
          break;
        case "heal":
          push(() => {
            setAnim({ type: "heal", side: ev.side });
            setFloat({ side: ev.side, text: `+${ev.amount}` });
            setDHp((h) => ({ ...h, [ev.side]: h[ev.side] + ev.amount }));
            sfx.heal();
          }, 480);
          break;
        case "defend":
          push(() => { setAnim({ type: "shield", side: ev.side }); sfx.ballShake(); }, 380);
          break;
        case "status":
          push(() => {
            setAnim({ type: "shield", side: ev.side });
            setFloat({ side: ev.side, text: statusFloatText(ev.kind, ev.on) });
            sfx.ballShake();
          }, 520);
          break;
        case "statusDamage":
          push(() => {
            setAnim({ type: "hit", side: ev.side });
            setFloat({ side: ev.side, text: `${ev.kind === "poison" ? "☠" : "⚡"} -${ev.amount}` });
            setDHp((h) => ({ ...h, [ev.side]: Math.max(0, h[ev.side] - ev.amount) }));
            sfx.hit();
          }, 500);
          break;
        case "faint":
          push(() => setAnim({ type: "faint", side: ev.side }), 620);
          break;
        case "catch":
          push(() => {
            setAnim({ type: ev.success ? "faint" : "hit", side: "enemy" });
            setFloat({ side: "enemy", text: ev.success ? "🎯 捉住了！" : "🎯 挣脱了…" });
            if (ev.success) sfx.caught(); else sfx.breakout();
          }, 700);
          break;
        case "message":
          push(() => setMsg(ev.text), 900);
          break;
        case "end":
          push(() => {
            setShowResult(true);
            if (ev.result === "win") sfx.victory();
            else if (ev.result === "lose") sfx.defeat();
            else if (ev.result === "caught") sfx.caught();
          }, 250);
          break;
      }
    }
    timers.push(setTimeout(() => setBusy(false), t + 60));
    return () => timers.forEach(clearTimeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [events]);

  if (!battle || !meta) return null;

  const elColor: Record<string, string> = {
    fire: "#f2843c", water: "#57a8d8", grass: "#6fbf73", electric: "#e0a800", normal: "#b99a72", shadow: "#8a7a9e",
  };

  const doAction = (a: Parameters<typeof battleAction>[0]) => {
    if (busy || battle.over) return;
    battleAction(a);
  };

  const playerAnimClass = anim
    ? anim.side === "player"
      ? anim.type === "lunge"
        ? "anim-lunge-up"
        : anim.type === "hit"
          ? "anim-shake"
          : anim.type === "heal"
            ? "anim-heal"
            : anim.type === "faint"
              ? "anim-faint"
              : "anim-shield"
      : ""
    : "";
  const enemyAnimClass = anim
    ? anim.side === "enemy"
      ? anim.type === "lunge"
        ? "anim-lunge-down"
        : anim.type === "hit"
          ? "anim-shake"
          : anim.type === "heal"
            ? "anim-heal"
            : anim.type === "faint"
              ? "anim-faint"
              : "anim-shield"
      : ""
    : "";

  return (
    <div className="battle-layer">
      <div className={`battle-arena arena-${meta.kind}`}>
        {/* 顶部信息 */}
        <div className="battle-hud">
          <span className="battle-turn">回合 {battle.turn}</span>
          <span className="battle-zone-name">
            {meta.kind === "boss"
              ? "Boss 战"
              : meta.kind === "pvp"
                ? `与 ${meta.pvpOpponentName} 切磋`
                : meta.kind === "trainer"
                  ? "切磋比试"
                  : "野外遭遇"}
          </span>
        </div>

        {/* 敌人 */}
        <div className="battle-row enemy-row">
          <div className="battle-card enemy-card pop-in">
            <div className="battle-card-top">
              <b>{battle.enemy.name}</b>
              <span className="el-chip" style={{ background: elColor[battle.enemy.element] }}>
                {ELEMENT_NAMES[battle.enemy.element]}
              </span>
              <span className="lv">Lv.{battle.enemy.level}</span>
            </div>
            <HpBar hp={dHp.enemy} max={battle.enemy.maxHp} />
            <div className="battle-card-hpnum">{dHp.enemy}/{battle.enemy.maxHp}</div>
            <StatusBadges s={battle.enemyStatus} />
          </div>
          <div className={`battle-sprite enemy-sprite ${enemyAnimClass}`}>
            <Sprite svg={petSVG(battle.enemy.look)} />
            {anim?.side === "enemy" && anim.type === "shield" && <div className="shield-fx" />}
            {float?.side === "enemy" && (
              <FloatText text={float.text} crit={float.crit} eff={float.eff} />
            )}
          </div>
        </div>

        {/* 消息条 */}
        <div className="battle-msg">{msg}</div>

        {/* 玩家 */}
        <div className="battle-row player-row">
          <div className={`battle-sprite player-sprite ${playerAnimClass}`}>
            <Sprite svg={battle ? petSVG(battle.player.look) : ""} />
            {look && <div className="battle-trainer"><Sprite svg={characterSVG(look, outfitById(outfitId))} /></div>}
            {anim?.side === "player" && anim.type === "shield" && <div className="shield-fx" />}
            {float?.side === "player" && (
              <FloatText text={float.text} crit={float.crit} eff={float.eff} />
            )}
          </div>
          <div className="battle-card player-card">
            <div className="battle-card-top">
              <b>{battle.player.name}</b>
              <span className="el-chip" style={{ background: elColor[battle.player.element] }}>
                {ELEMENT_NAMES[battle.player.element]}
              </span>
              <span className="lv">Lv.{battle.player.level}</span>
            </div>
            <HpBar hp={dHp.player} max={battle.player.maxHp} />
            <div className="battle-card-hpnum">{dHp.player}/{battle.player.maxHp}</div>
            <StatusBadges s={battle.playerStatus} />
          </div>
        </div>

        {/* 行动菜单 */}
        {!showResult && (
          <div className="battle-menu">
            <div className="battle-tabs">
              <button className={`battle-tab ${menuTab === "moves" ? "on" : ""}`} onClick={() => setMenuTab("moves")}>招式</button>
              <button className={`battle-tab ${menuTab === "items" ? "on" : ""}`} onClick={() => setMenuTab("items")}>背包</button>
            </div>
            {menuTab === "moves" ? (
              <div className="battle-moves">
                {battle.player.moves.map((m, i) => {
                  const eff = elementMultiplier(m.element, battle.enemy.element);
                  const isNh = m.id === "fastball" || m.id === "truthBeam" || m.id === "cakeCrush" || m.id === "grandSlam";
                  const nhIcon = m.id === "cakeCrush" ? "🎂" : "⚾";
                  return (
                    <button
                      key={m.id}
                      className={`move-btn ${isNh ? "naihang-move" : ""}`}
                      disabled={busy || battle.over}
                      onClick={() => doAction({ kind: "move", moveIndex: i })}
                    >
                      <span className="move-name">
                        <i className="el-dot" style={{ background: elColor[m.element] }} />
                        {isNh && <span className="nh-ico">{nhIcon}</span>}
                        {m.name}
                        {m.id === "truthBeam" && <em className="nh-truth">「你想听实话吗」</em>}
                        {eff > 1 && <em className="eff-up">克制!</em>}
                        {eff < 1 && eff !== 1 && <em className="eff-down">收效差</em>}
                      </span>
                      <span className="move-power">威力 {m.power}</span>
                    </button>
                  );
                })}
                <button className="move-btn small" disabled={busy || battle.over} onClick={() => doAction({ kind: "defend" })}>
                  <span className="move-name">🛡 稳住阵脚</span>
                  <span className="move-power">减伤+回血</span>
                </button>
                {battle.canRun && (
                  <button className="move-btn small" disabled={busy || battle.over} onClick={() => doAction({ kind: "run" })}>
                    <span className="move-name">💨 逃跑</span>
                  </button>
                )}
              </div>
            ) : (
              <div className="battle-moves">
                {(["potion-s", "potion-l", "revive"] as const).map((id) => {
                  const names = { "potion-s": "小奶瓶", "potion-l": "大奶瓶", revive: "复活果冻" };
                  const heals = { "potion-s": 50, "potion-l": 120, revive: 0 };
                  const count = items[id] ?? 0;
                  return (
                    <button
                      key={id}
                      className="move-btn"
                      disabled={busy || battle.over || count <= 0 || (id === "revive" ? dHp.player > 0 : false)}
                      onClick={() => {
                        if (id === "revive") return;
                        doAction({ kind: "item", heal: heals[id] });
                      }}
                    >
                      <span className="move-name">🧴 {names[id]}</span>
                      <span className="move-power">×{count}</span>
                    </button>
                  );
                })}
                <button
                  className="move-btn"
                  disabled={busy || battle.over || (items["herb-cure"] ?? 0) <= 0 || (battle.playerStatus.poison <= 0 && battle.playerStatus.paralyze <= 0)}
                  onClick={() => doAction({ kind: "item", heal: 0, effect: "cure" })}
                >
                  <span className="move-name">🌿 解毒草</span>
                  <span className="move-power">解除异常 ×{items["herb-cure"] ?? 0}</span>
                </button>
                <button
                  className="move-btn"
                  disabled={busy || battle.over || (items["power-fruit"] ?? 0) <= 0 || battle.playerStatus.empower > 0}
                  onClick={() => doAction({ kind: "item", heal: 0, effect: "empower" })}
                >
                  <span className="move-name">🍎 力量果实</span>
                  <span className="move-power">攻击强化 ×{items["power-fruit"] ?? 0}</span>
                </button>
                {meta.kind === "wild" && (["ball-basic", "ball-great"] as const).map((id) => {
                  const names = { "ball-basic": "🔴 精灵球", "ball-great": "🔵 超级球" };
                  const count = items[id] ?? 0;
                  return (
                    <button
                      key={id}
                      className="move-btn catch-btn"
                      disabled={busy || battle.over || count <= 0}
                      onClick={() => doAction({ kind: "catch", ball: id === "ball-great" ? "great" : "basic" })}
                    >
                      <span className="move-name">{names[id]}</span>
                      <span className="move-power">投掷 ×{count}</span>
                    </button>
                  );
                })}
                {meta.kind !== "wild" && (
                  <p className="battle-item-tip">只有野生的胖胖才能捕捉哦～</p>
                )}
              </div>
            )}
          </div>
        )}

        {/* 结果横幅 */}
        {showResult && battle.result && (
          <div className="battle-result pop-in">
            {battle.result === "win" && (
              <>
                <div className="result-title win">🎉 获胜！</div>
                <p>获得 {meta.rewardCoins} 金币 · {meta.rewardExp} 经验</p>
              </>
            )}
            {battle.result === "lose" && (
              <>
                <div className="result-title lose">累瘫了……</div>
                <p>{meta.kind === "pvp" ? "切磋落败，练练级再赢回来！战绩已记录。" : "掉了 20 金币，回村休息一下吧。"}</p>
              </>
            )}
            {battle.result === "run" && (
              <>
                <div className="result-title">溜之大吉！</div>
                <p>好险好险……</p>
              </>
            )}
            {battle.result === "caught" && (
              <>
                <div className="result-title win">🎯 捕捉成功！</div>
                <p>{battle.enemy.name}（Lv.{battle.enemy.level}）加入了宠物仓库，快去冒险手册看看吧！</p>
              </>
            )}
            <Btn tone="sun" onClick={() => { stopBgm(); clearBattle(); }}>回到地图</Btn>
          </div>
        )}
      </div>
    </div>
  );
}

function FloatText({ text, crit, eff }: { text: string; crit?: boolean; eff?: string }) {
  return (
    <div className="float-dmg">
      <span className={crit ? "crit" : ""}>{text}</span>
      {crit && <em>会心一击!</em>}
      {eff === "super" && <em className="super">效果拔群!</em>}
      {eff === "weak" && <em className="weak">效果不佳…</em>}
    </div>
  );
}

function statusFloatText(kind: StatusKind, on: boolean): string {
  if (!on) return "状态解除";
  if (kind === "poison") return "☠ 中毒了!";
  if (kind === "paralyze") return "⚡ 麻痹了!";
  if (kind === "empower") return "💪 攻击提升!";
  return "🛡 护盾展开!";
}

function StatusBadges({ s }: { s: SideStatus }) {
  const badges: string[] = [];
  if (s.poison > 0) badges.push("☠");
  if (s.paralyze > 0) badges.push("⚡");
  if (s.empower > 0) badges.push("💪");
  if (s.guard > 0) badges.push("🛡");
  if (badges.length === 0) return null;
  return <div className="status-badges">{badges.map((b, i) => <i key={i}>{b}</i>)}</div>;
}
