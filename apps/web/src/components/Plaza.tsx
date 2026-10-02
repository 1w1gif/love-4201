"use client";

import { useCallback, useEffect, useState } from "react";
import { useGame } from "@/store";
import { characterSVG, outfitById } from "@maomao/game-core";
import { plazaGet, plazaPost, tierOf } from "@/lib/plaza-client";
import type { PlazaData, PlazaPlayerPublic } from "@/lib/plaza-client";
import PlazaLive from "./PlazaLive";
import { Btn, Sprite } from "./Ui";

export default function Plaza() {
  const { account, setAccount, openPlaza, showToast, startPvp, pet, look, outfitId, playerName, plazaTab } = useGame();
  const [tab, setTab] = useState<"players" | "bonds" | "rank" | "live">(plazaTab ?? "players");
  const [data, setData] = useState<PlazaData | null>(null);
  const [busy, setBusy] = useState(false);
  const [loadError, setLoadError] = useState(false);

  const refresh = useCallback(async () => {
    try {
      const d = await plazaGet(account?.token);
      setData(d);
      setLoadError(false);
    } catch {
      setLoadError(true);
    }
  }, [account?.token]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  // 登录状态下，把自己的最新形象同步到服务器档案
  useEffect(() => {
    if (!account?.token || !pet || !look) return;
    plazaPost({
      action: "sync",
      token: account.token,
      profile: { look, outfitId, pet: { name: pet.name, speciesId: pet.speciesId, level: pet.level } },
    }).then(() => refresh());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [account?.token]);

  const doSpar = (p: PlazaPlayerPublic) => {
    startPvp(p);
  };

  const doBond = async (p: PlazaPlayerPublic) => {
    if (!account) return;
    setBusy(true);
    const r = await plazaPost({ action: "bondRequest", token: account.token, targetId: p.id });
    setBusy(false);
    if (r.error) { showToast(r.error); return; }
    showToast(r.auto ? `${r.name} 秒通过了你的结缘申请！羁绊 +5` : `已向 ${r.name} 发出结缘申请！`);
    refresh();
  };

  const doGreet = async (p: PlazaPlayerPublic) => {
    if (!account) return;
    setBusy(true);
    const r = await plazaPost<{ points?: number; tier?: { name: string }; error?: string }>({ action: "greet", token: account.token, targetId: p.id });
    setBusy(false);
    if (r.error || r.points === undefined || !r.tier) { showToast(r.error ?? "问候失败"); return; }
    showToast(`和 ${p.name} 打过招呼啦！亲密度 ${r.points}（${r.tier.name}）`);
    useGame.getState().trackStat("bonds", 0); // 刷新 maxLevel 等无关，仅保证 stats 存在
    useGame.getState().trackStat("dailyGreet");
    refresh();
  };

  const doRespond = async (requestId: string, accept: boolean) => {
    if (!account) return;
    setBusy(true);
    const r = await plazaPost({ action: "bondRespond", token: account.token, requestId, accept });
    setBusy(false);
    if (r.error) { showToast(r.error); return; }
    showToast(accept ? `你和 ${r.name} 的羁绊成立啦！` : "已婉拒对方的申请");
    if (accept) useGame.getState().trackStat("bonds");
    refresh();
  };

  if (!account) {
    return (
      <div className="overlay-layer">
        <PlazaLogin onLogged={(a) => { setAccount(a); }} onClose={() => openPlaza(false)} />
      </div>
    );
  }

  const myBonds = data?.bonds ?? [];
  const requests = data?.requests ?? [];
  const players = (data?.players ?? [])
    .filter((p) => p.id !== account.playerId)
    .sort((a, b) => b.record.w - a.record.w);

  return (
    <div className="overlay-layer">
      <div className="panel card pop-in panel-wide plaza-panel">
        <div className="panel-head">
          <h3>训练家广场</h3>
          <span className="plaza-me">{account.name} 的广场</span>
          <button className="close-btn" onClick={() => openPlaza(false)}>✕</button>
        </div>

        <div className="panel-tabs">
          <button className={`panel-tab ${tab === "players" ? "on" : ""}`} onClick={() => setTab("players")}>
            训练家（{players.length}）
          </button>
          <button className={`panel-tab ${tab === "live" ? "on" : ""}`} onClick={() => setTab("live")}>🔥 大厅</button>
          <button className={`panel-tab ${tab === "rank" ? "on" : ""}`} onClick={() => setTab("rank")}>🏆 排行榜</button>
          <button className={`panel-tab ${tab === "bonds" ? "on" : ""}`} onClick={() => setTab("bonds")}>
            我的羁绊（{myBonds.length}）{requests.length > 0 && <em className="req-badge">{requests.length}</em>}
          </button>
        </div>

        {!data && !loadError && <div className="plaza-loading">正在连接广场……</div>}
        {!data && loadError && (
          <div className="plaza-loading">
            广场连接失败了……
            <div style={{ marginTop: 10 }}>
              <Btn tone="sun" onClick={refresh}>↻ 重试</Btn>
            </div>
          </div>
        )}

        {data && tab === "live" && (
          <PlazaLive
            token={account.token}
            myName={account.name}
            onBattleEnd={(won, oppName) => {
              // 组队 Boss 胜利：发讨伐奖励（金币+经验由 store 处理）
              if (oppName.includes("组队")) {
                useGame.getState().bossRaidReward(won);
              } else {
                showToast(won ? `实时切磋赢了 ${oppName}！` : `输给了 ${oppName}，下次扳回来！`);
              }
              refresh();
            }}
          />
        )}

        {data && tab === "rank" && (
          <div className="plaza-list">
            <p className="plaza-tip">按主战宠物等级排名（同分按胜场），每 10 名展示一页 · 同步自己的档案后会实时上榜</p>
            {(data?.leaderboard ?? []).map((row) => (
              <div key={row.rank} className={`rank-row ${row.isMe ? "me" : ""}`}>
                <span className="rank-medal">{row.rank === 1 ? "🥇" : row.rank === 2 ? "🥈" : row.rank === 3 ? "🥉" : `#${row.rank}`}</span>
                <b className="rank-name">
                  {row.name}
                  {row.isMe && <span className="mock-chip">我</span>}
                  {row.isMock && <span className="mock-chip">NPC</span>}
                </b>
                <span className="rank-level">Lv.{row.level}</span>
                <span className="rank-record">{row.record.w}胜 {row.record.l}负</span>
              </div>
            ))}
            {(data?.leaderboard.length ?? 0) === 0 && <p className="plaza-tip">排行榜暂时空空如也。</p>}
          </div>
        )}

        {data && tab === "players" && (
          <div className="plaza-list">
            {players.map((p) => {
              const bond = myBonds.find((b) => b.other.id === p.id);
              return (
                <div key={p.id} className="plaza-row">
                  <div className="plaza-avatar">
                    {p.look ? <Sprite svg={characterSVG(p.look, outfitById(p.outfitId))} /> : <span className="plaza-noavatar">?</span>}
                  </div>
                  <div className="plaza-info">
                    <b>
                      {p.name}
                      {bond && <span className="bond-chip" data-tier={tierOf(bond.points).key}>{tierOf(bond.points).name} · {bond.points}</span>}
                      {p.isMock && <span className="mock-chip">NPC</span>}
                    </b>
                    <p className="plaza-petline">
                      {p.pet ? `宠物：${p.pet.name}（Lv.${p.pet.level}）` : "还没有宠物"}
                      <span className="plaza-record">战绩 {p.record.w}胜 {p.record.l}负</span>
                    </p>
                  </div>
                  <div className="plaza-actions">
                    <Btn tone="coral" onClick={() => doSpar(p)} disabled={busy}>⚔ 切磋</Btn>
                    {bond ? (
                      <Btn tone="mint" onClick={() => doGreet(p)} disabled={busy}>💬 问候</Btn>
                    ) : (
                      <Btn tone="sky" onClick={() => doBond(p)} disabled={busy}>💗 结缘</Btn>
                    )}
                  </div>
                </div>
              );
            })}
            <p className="plaza-tip">切磋获胜 +3 亲密度 / 落败 +1，每日问候 +2 · 亲密度 30 升挚友、80 升灵魂羁绊</p>
          </div>
        )}

        {data && tab === "bonds" && (
          <div className="plaza-list">
            {requests.length > 0 && (
              <>
                <b className="sec-title">收到的结缘申请</b>
                {requests.map((r) => (
                  <div key={r.id} className="plaza-row">
                    <div className="plaza-avatar">
                      {r.from.look ? <Sprite svg={characterSVG(r.from.look, outfitById(r.from.outfitId))} /> : <span className="plaza-noavatar">?</span>}
                    </div>
                    <div className="plaza-info">
                      <b>{r.from.name}</b>
                      <p className="plaza-petline">想和你绑定亲密关系！</p>
                    </div>
                    <div className="plaza-actions">
                      <Btn tone="mint" onClick={() => doRespond(r.id, true)} disabled={busy}>✓ 同意</Btn>
                      <Btn tone="cream" onClick={() => doRespond(r.id, false)} disabled={busy}>婉拒</Btn>
                    </div>
                  </div>
                ))}
              </>
            )}
            <b className="sec-title">已绑定的羁绊</b>
            {myBonds.length === 0 && <p className="plaza-tip">还没有羁绊，去「训练家」页发结缘申请吧！</p>}
            {myBonds
              .slice()
              .sort((a, b) => b.points - a.points)
              .map((b) => {
                const tier = tierOf(b.points);
                const pct = tier.next ? Math.min(100, (b.points / tier.next) * 100) : 100;
                return (
                  <div key={b.id} className="plaza-row">
                    <div className="plaza-avatar">
                      {b.other.look ? <Sprite svg={characterSVG(b.other.look, outfitById(b.other.outfitId))} /> : <span className="plaza-noavatar">?</span>}
                    </div>
                    <div className="plaza-info">
                      <b>
                        {b.other.name}
                        <span className="bond-chip" data-tier={tier.key}>{tier.name}</span>
                      </b>
                      <p className="plaza-petline">
                        亲密度 {b.points}{tier.next ? ` / ${tier.next}` : "（已满级）"}
                        <span className="plaza-record">战绩 {b.other.record.w}胜 {b.other.record.l}负</span>
                      </p>
                      <div className="bond-bar"><div style={{ width: `${pct}%` }} /></div>
                    </div>
                    <div className="plaza-actions">
                      <Btn tone="coral" onClick={() => doSpar(b.other)} disabled={busy}>⚔ 切磋</Btn>
                      <Btn tone="mint" onClick={() => doGreet(b.other)} disabled={busy}>💬 问候</Btn>
                    </div>
                  </div>
                );
              })}
          </div>
        )}
      </div>
    </div>
  );
}

/* ---------------- 注册 / 登录 ---------------- */
function PlazaLogin({ onLogged, onClose }: { onLogged: (a: { token: string; playerId: string; name: string }) => void; onClose: () => void }) {
  const [mode, setMode] = useState<"register" | "login">("register");
  const [name, setName] = useState("");
  const [pin, setPin] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    setErr(null);
    setBusy(true);
    const r = await plazaPost<{ token?: string; player?: { id: string; name: string }; error?: string }>({
      action: mode, name, pin,
    });
    setBusy(false);
    if (r.error || !r.token || !r.player) {
      setErr(r.error ?? "出错了，再试一次");
      return;
    }
    onLogged({ token: r.token, playerId: r.player.id, name: r.player.name });
    onClose();
  };

  return (
    <div className="panel card pop-in plaza-login">
      <div className="panel-head">
        <h3>训练家广场</h3>
        <button className="close-btn" onClick={onClose}>✕</button>
      </div>
      <p className="plaza-login-tip">
        {mode === "register"
          ? "注册一个训练家身份，就能和其他玩家互相切磋、绑定羁绊！"
          : "欢迎回来！输入昵称和口令登录。"}
      </p>
      <div className="login-form">
        <label>昵称</label>
        <input className="name-input" placeholder="给自己起个名号（1-8字）" maxLength={8} value={name} onChange={(e) => setName(e.target.value)} />
        <label>数字口令</label>
        <input className="name-input" placeholder="4-6 位数字" maxLength={6} inputMode="numeric" value={pin} onChange={(e) => setPin(e.target.value.replace(/\D/g, ""))} />
        {err && <div className="login-err">{err}</div>}
        <div className="create-actions">
          <Btn tone="cream" onClick={() => { setMode(mode === "register" ? "login" : "register"); setErr(null); }}>
            {mode === "register" ? "已有账号？去登录" : "没有账号？去注册"}
          </Btn>
          <Btn tone="sun" onClick={submit} disabled={busy || !name || pin.length < 4}>
            {mode === "register" ? "✓ 注册并进入" : "登录"}
          </Btn>
        </div>
      </div>
    </div>
  );
}
