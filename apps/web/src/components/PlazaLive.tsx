"use client";

// 实时切磋 + 广场聊天：D1 状态 + 2 秒轮询（免 WebSocket，Workers 免费套餐可用）
import { useCallback, useEffect, useRef, useState } from "react";
import { plazaPost } from "@/lib/plaza-client";
import { ELEMENT_NAMES } from "@maomao/game-core";
import { Btn, HpBar } from "./Ui";

/* =============== 类型 =============== */

interface SparSide {
  name: string;
  element: string;
  level: number;
  maxHp: number;
  hp: number;
  moves: { id: string; name: string; power: number; element: string; effect?: { kind: string; chance: number } }[];
  status: { poison: number; paralyze: number; empower: number; guard: number };
}
interface SparState {
  host: SparSide;
  guest: SparSide;
  turnNo: number;
  log: string[];
  winner: "host" | "guest" | null;
}
interface RoomInfo {
  id: string;
  status: string;
  hostId: string;
  hostName: string;
  guestId: string | null;
  guestName: string | null;
  state: SparState | null;
}
interface ChatMsg { id: number; playerId: string; name: string; text: string; createdAt: number }

const elColor: Record<string, string> = {
  fire: "#f2843c", water: "#57a8d8", grass: "#6fbf73", electric: "#e0a800", normal: "#b99a72", shadow: "#8a7a9e",
};

/* =============== 主组件：挂在广场面板里 =============== */

export default function PlazaLive({ token, myName, onBattleEnd }: {
  token: string;
  myName: string;
  onBattleEnd?: (won: boolean, opponentName: string) => void;
}) {
  const [tab, setTab] = useState<"chat" | "spar" | "boss">("chat");
  return (
    <div className="live-wrap">
      <div className="live-tabs">
        <button className={`panel-tab ${tab === "chat" ? "on" : ""}`} onClick={() => setTab("chat")}>💬 聊天</button>
        <button className={`panel-tab ${tab === "spar" ? "on" : ""}`} onClick={() => setTab("spar")}>⚔ 切磋</button>
        <button className={`panel-tab ${tab === "boss" ? "on" : ""}`} onClick={() => setTab("boss")}>👑 组队Boss</button>
      </div>
      {tab === "chat" && <PlazaChat token={token} myName={myName} />}
      {tab === "spar" && <OnlineSpar token={token} myName={myName} onBattleEnd={onBattleEnd} />}
      {tab === "boss" && <BossRaid token={token} myName={myName} onBattleEnd={onBattleEnd} />}
    </div>
  );
}

/* =============== 组队 Boss =============== */

interface BossBoss { name: string; element: string; level: number; maxHp: number; hp: number; status: { poison: number }; chargeIn: number }
interface BossPlayer { playerId: string; name: string; petName: string; element: string; level: number; maxHp: number; hp: number; moves: { id: string; name: string; power: number; element: string }[]; hpReady?: boolean }
interface BossStateT { boss: BossBoss; players: BossPlayer[]; turnNo: number; log: string[]; winner: "players" | "boss" | null }
interface BossRoomT { id: string; status: string; hostName: string; guestName: string | null; state: BossStateT | null }

function BossRaid({ token, myName, onBattleEnd }: {
  token: string;
  myName: string;
  onBattleEnd?: (won: boolean, opponentName: string) => void;
}) {
  const [room, setRoom] = useState<BossRoomT | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const rewardedRef = useRef(false);

  // 轮询我的讨伐房
  useEffect(() => {
    let alive = true;
    const tick = async () => {
      try {
        const r = await plazaPost<{ rooms?: BossRoomT[] }>({ action: "bossMyRoom", token });
        if (!alive) return;
        const active = (r.rooms ?? []).find((x) => x.status === "active" || x.status === "waiting");
        if (active) setRoom(active);
        else if (room && (room.status === "won" || room.status === "lost")) {
          // 保留结算画面几轮后再清
        } else if (!room || room.status !== "waiting") setRoom((cur) => (cur && cur.status === "waiting" ? cur : null));
      } catch { /* ignore */ }
    };
    tick();
    const t = setInterval(tick, 2500);
    return () => { alive = false; clearInterval(t); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  // 对局中每 2 秒同步最新状态
  useEffect(() => {
    if (!room || room.status !== "active") return;
    const t = setInterval(async () => {
      const r = await plazaPost<{ room?: BossRoomT }>({ action: "bossState", token, roomId: room.id });
      if (r.room) setRoom(r.room);
    }, 2000);
    return () => clearInterval(t);
  }, [room?.id, room?.status, token]);

  // 胜利结算上报（只发一次）
  useEffect(() => {
    if (!room?.state?.winner || rewardedRef.current) return;
    rewardedRef.current = true;
    const won = room.state.winner === "players";
    onBattleEnd?.(won, "暗影胖胖王(组队)");
  }, [room?.state?.winner, room, onBattleEnd]);

  const createRoom = async () => {
    setBusy(true); setErr(null);
    const r = await plazaPost<{ roomId?: string; error?: string }>({ action: "bossChallenge", token });
    setBusy(false);
    if (r.error || !r.roomId) { setErr(r.error ?? "发起失败"); return; }
    setRoom({ id: r.roomId, status: "waiting", hostName: myName, guestName: null, state: null });
  };
  const cancelRoom = async () => {
    if (!room) return;
    await plazaPost({ action: "bossCancel", token, roomId: room.id });
    setRoom(null);
  };
  const doMove = async (moveIndex: number, kind: "move" | "defend" = "move") => {
    if (!room || busy) return;
    setBusy(true);
    const r = await plazaPost<{ state?: BossStateT; error?: string }>({ action: "bossMove", token, roomId: room.id, moveIndex, kind });
    setBusy(false);
    if (r.error) { setErr(r.error); setTimeout(() => setErr(null), 2500); return; }
    if (r.state) setRoom({ ...room, state: r.state, status: r.state.winner ? (r.state.winner === "players" ? "won" : "lost") : "active" });
  };

  if (room?.state && (room.status === "active" || room.status === "won" || room.status === "lost")) {
    const st = room.state;
    const meP = st.players.find((p) => p.name === myName) ?? st.players[0];
    const ally = st.players.find((p) => p !== meP);
    return (
      <div className="spar-arena boss-arena">
        <div className="boss-card">
          <div className="boss-title">👑 {st.boss.name} <span className="lv">Lv.{st.boss.level}</span></div>
          <HpBar hp={st.boss.hp} max={st.boss.maxHp} />
          <span className="spar-hpnum">{st.boss.hp}/{st.boss.maxHp} {st.boss.status.poison > 0 && "☠"} · 蓄力还剩 {Math.max(0, st.boss.chargeIn)} 回合</span>
        </div>
        <div className="spar-log">{st.log.slice(-6).map((l, i) => <p key={i}>{l}</p>)}</div>
        <div className="boss-team">
          <div className="spar-card">
            <b>{meP.name}</b> <span className="lv">Lv.{meP.level}</span>
            <HpBar hp={meP.hp} max={meP.maxHp} />
            <span className="spar-hpnum">{meP.hp}/{meP.maxHp}</span>
          </div>
          {ally && (
            <div className="spar-card">
              <b>{ally.name}</b> <span className="lv">Lv.{ally.level}</span>
              <HpBar hp={ally.hp} max={ally.maxHp} />
              <span className="spar-hpnum">{ally.hp}/{ally.maxHp}</span>
            </div>
          )}
        </div>
        {st.winner ? (
          <div className={`spar-result ${st.winner === "players" ? "" : "lose"}`}>
            {st.winner === "players" ? "🎉 讨伐成功！星光回来了！" : "团灭了……重整旗鼓再来！"}
            <div style={{ marginTop: 10 }}>
              <Btn tone="cream" onClick={() => { setRoom(null); rewardedRef.current = false; }}>返回大厅</Btn>
            </div>
          </div>
        ) : (
          <div className="spar-actions">
            {meP.hp > 0 ? meP.moves.map((m, i) => (
              <button key={m.id} className="move-btn" disabled={busy} onClick={() => doMove(i)}>
                <span className="move-name"><i className="el-dot" style={{ background: elColor[m.element] }} />{m.name}</span>
                <span className="move-power">威力 {m.power}</span>
              </button>
            )) : <p className="spar-waitturn">你已倒下，为队友祈祷吧……</p>}
            {meP.hp > 0 && (
              <button className="move-btn small" disabled={busy} onClick={() => doMove(0, "defend")}>
                <span className="move-name">🛡 稳住阵脚</span>
              </button>
            )}
            {err && <p className="spar-err">{err}</p>}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="spar-wrap">
      {err && <div className="spar-err">{err}</div>}
      {room?.status === "waiting" ? (
        <div className="spar-waiting pop-in">
          <p>👑 组建讨伐队中……</p>
          <div className="spar-roomcode">房间码：<b>{room.id}</b></div>
          <p className="spar-tip">把码发给朋友，TA 在下面输入即可组队！两人齐了自动开战。</p>
          <Btn tone="cream" onClick={cancelRoom}>解散队伍</Btn>
        </div>
      ) : (
        <div className="spar-idle">
          <p className="spar-tip">
            组队讨伐<b>暗影胖胖王</b>！两人合力才能战胜的强大 Boss（血量 3 倍、会蓄力重击）。<br />
            胜利后双方都拿丰厚奖励，结缘搭档一起讨伐还能加深羁绊！
          </p>
          <Btn tone="coral" onClick={createRoom} disabled={busy}>👑 组建讨伐队</Btn>
          <BossJoinBox token={token} onJoined={(r) => setRoom(r)} />
        </div>
      )}
    </div>
  );
}

function BossJoinBox({ token, onJoined }: { token: string; onJoined: (r: BossRoomT) => void }) {
  const [code, setCode] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const join = async () => {
    if (!code.trim() || busy) return;
    setBusy(true); setMsg(null);
    const r = await plazaPost<{ ok?: boolean; error?: string }>({ action: "bossJoin", token, roomId: code.trim().toUpperCase() });
    setBusy(false);
    if (r.error) { setMsg(r.error); return; }
    const st = await plazaPost<{ room?: BossRoomT }>({ action: "bossState", token, roomId: code.trim().toUpperCase() });
    if (st.room) onJoined(st.room);
  };
  return (
    <div className="spar-join">
      <input className="chat-input" placeholder="输入讨伐队房间码" maxLength={8} value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} />
      <Btn tone="sky" onClick={join} disabled={busy || !code.trim()}>加入讨伐</Btn>
      {msg && <p className="spar-err">{msg}</p>}
    </div>
  );
}

/* =============== 聊天大厅 =============== */

function PlazaChat({ token, myName }: { token: string; myName: string }) {
  const [msgs, setMsgs] = useState<ChatMsg[]>([]);
  const [online, setOnline] = useState(0);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const lastId = useRef(0);
  const boxRef = useRef<HTMLDivElement>(null);

  const poll = useCallback(async () => {
    try {
      const r = await plazaPost<{ msgs?: ChatMsg[]; online?: number; error?: string }>({
        action: "chatList", token, sinceId: lastId.current,
      });
      if (r.msgs && r.msgs.length) {
        lastId.current = Math.max(lastId.current, ...r.msgs.map((m) => m.id));
        setMsgs((prev) => [...prev, ...r.msgs!].slice(-60));
        requestAnimationFrame(() => {
          if (boxRef.current) boxRef.current.scrollTop = boxRef.current.scrollHeight;
        });
      }
      if (typeof r.online === "number") setOnline(r.online);
    } catch { /* 断网时静默，下轮再试 */ }
  }, [token]);

  useEffect(() => {
    poll();
    const t = setInterval(poll, 2500);
    return () => clearInterval(t);
  }, [poll]);

  const send = async () => {
    const text = draft.trim();
    if (!text || sending) return;
    setSending(true);
    const r = await plazaPost({ action: "chatPost", token, text });
    setSending(false);
    if (r.error) return;
    setDraft("");
    poll();
  };

  return (
    <div className="chat-wrap">
      <div className="chat-head">
        <span className={`online-dot ${online > 1 ? "hot" : ""}`} />
        当前在线 {online} 人
      </div>
      <div className="chat-box" ref={boxRef}>
        {msgs.length === 0 && <p className="chat-empty">还没有人说话，来抢个沙发～</p>}
        {msgs.map((m) => (
          <div key={m.id} className="chat-line">
            <b className={m.name === myName ? "me" : ""}>{m.name}：</b>
            <span>{m.text}</span>
          </div>
        ))}
      </div>
      <div className="chat-input-row">
        <input
          className="chat-input"
          placeholder="说点什么……（最多 80 字）"
          maxLength={80}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") send(); }}
        />
        <Btn tone="sun" onClick={send} disabled={sending || !draft.trim()}>发送</Btn>
      </div>
    </div>
  );
}

/* =============== 实时切磋 =============== */

function OnlineSpar({ token, myName, onBattleEnd }: {
  token: string;
  myName: string;
  onBattleEnd?: (won: boolean, opponentName: string) => void;
}) {
  const [roomId, setRoomId] = useState<string | null>(null);
  const [room, setRoom] = useState<RoomInfo | null>(null);
  const [incoming, setIncoming] = useState<RoomInfo | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const endedRef = useRef(false);

  // 轮询：我的房间状态（被挑战/对局进行/结束）
  useEffect(() => {
    let alive = true;
    const tick = async () => {
      try {
        const r = await plazaPost<{ rooms?: RoomInfo[] }>({ action: "sparMyRoom", token });
        if (!alive || !r.rooms) return;
        const active = r.rooms.find((x) => x.status === "active" || x.status === "waiting");
        if (active) {
          setRoomId(active.id);
          setRoom(active);
          // 我是房主且对方已加入 → 提示开战；我是客人 → 弹出战确认由 accept 流程处理
        }
        const waitingForMe = r.rooms.find((x) => x.status === "waiting" && x.hostId && x.guestId === null && x.hostName !== myName);
        // waiting 房间只有房主可见自己的；被挑战方通过 sparState 全量轮询看不到未加入的房，
        // 所以"被挑战"走全服广播：见下方 sparIncoming 轮询
        if (!active) {
          setRoom(null);
          setRoomId(null);
        }
        setIncoming(waitingForMe ?? null);
      } catch { /* ignore */ }
    };
    tick();
    const t = setInterval(tick, 2000);
    return () => { alive = false; clearInterval(t); };
  }, [token, myName]);

  // 对局结束上报（只触发一次）
  useEffect(() => {
    if (!room?.state?.winner || endedRef.current) return;
    endedRef.current = true;
    const iAmHost = room.hostName === myName;
    const iWon = (room.state.winner === "host") === iAmHost;
    const oppName = iAmHost ? room.guestName : room.hostName;
    onBattleEnd?.(iWon, oppName ?? "对手");
  }, [room?.state?.winner, room, myName, onBattleEnd]);

  const challenge = async () => {
    setBusy(true);
    setErr(null);
    const r = await plazaPost<{ roomId?: string; error?: string }>({ action: "sparChallenge", token });
    setBusy(false);
    if (r.error || !r.roomId) { setErr(r.error ?? "发起失败"); return; }
    setRoomId(r.roomId);
    setRoom({ id: r.roomId, status: "waiting", hostId: "me", hostName: myName, guestId: null, guestName: null, state: null });
  };

  const cancel = async () => {
    if (!roomId) return;
    await plazaPost({ action: "sparCancel", token, roomId });
    setRoomId(null);
    setRoom(null);
  };

  const doMove = async (moveIndex: number, kind: "move" | "defend" = "move") => {
    if (!roomId || busy) return;
    setBusy(true);
    const r = await plazaPost<{ state?: SparState; error?: string }>({ action: "sparMove", token, roomId, moveIndex, kind });
    setBusy(false);
    if (r.error) { setErr(r.error); setTimeout(() => setErr(null), 2000); return; }
    if (r.state && room) setRoom({ ...room, state: r.state });
  };

  // 出招后也轮询一次，让对手回合尽快显示
  useEffect(() => {
    if (!roomId || room?.status !== "active") return;
    const t = setInterval(async () => {
      const r = await plazaPost<{ room?: RoomInfo }>({ action: "sparState", token, roomId });
      if (r.room) setRoom(r.room);
    }, 2000);
    return () => clearInterval(t);
  }, [roomId, room?.status, token]);

  if (room?.status === "active" && room.state) {
    return <SparArena room={room} myName={myName} busy={busy} err={err} onMove={doMove} />;
  }

  return (
    <div className="spar-wrap">
      {err && <div className="spar-err">{err}</div>}
      {!room && (
        <div className="spar-idle">
          <p className="spar-tip">
            发起挑战后把房间码告诉对方，对方在下面输入房间码加入，就能实时对战！
            （双方都在线时效果最佳）
          </p>
          <Btn tone="coral" onClick={challenge} disabled={busy}>⚔ 发起实时切磋</Btn>
          <JoinBox token={token} onJoined={(r) => { setRoomId(r.id); setRoom(r); }} />
        </div>
      )}
      {room?.status === "waiting" && room.hostName === myName && (
        <div className="spar-waiting pop-in">
          <p>等待挑战者中……</p>
          <div className="spar-roomcode">房间码：<b>{room.id}</b></div>
          <p className="spar-tip">把这个码发给你的朋友，让 TA 在「输入房间码加入」里填入！</p>
          <Btn tone="cream" onClick={cancel}>取消挑战</Btn>
        </div>
      )}
      {room?.status === "active" && !room.state && (
        <div className="spar-waiting"><p>正在布置战场……</p></div>
      )}
      {(room?.status === "host_won" || room?.status === "guest_won") && room.state && (
        <SparArena room={room} myName={myName} busy={busy} err={err} onMove={doMove} />
      )}
    </div>
  );
}

function JoinBox({ token, onJoined }: { token: string; onJoined: (r: RoomInfo) => void }) {
  const [code, setCode] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const join = async () => {
    if (!code.trim() || busy) return;
    setBusy(true);
    setMsg(null);
    const r = await plazaPost<{ ok?: boolean; error?: string }>({ action: "sparAccept", token, roomId: code.trim() });
    setBusy(false);
    if (r.error) { setMsg(r.error); return; }
    const st = await plazaPost<{ room?: RoomInfo }>({ action: "sparState", token, roomId: code.trim() });
    if (st.room) onJoined(st.room);
  };
  return (
    <div className="spar-join">
      <input className="chat-input" placeholder="输入房间码加入对局" maxLength={8} value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} />
      <Btn tone="sky" onClick={join} disabled={busy || !code.trim()}>加入</Btn>
      {msg && <p className="spar-err">{msg}</p>}
    </div>
  );
}

function SparArena({ room, myName, busy, err, onMove }: {
  room: RoomInfo;
  myName: string;
  busy: boolean;
  err: string | null;
  onMove: (i: number, kind?: "move" | "defend") => void;
}) {
  const st = room.state!;
  const iAmHost = room.hostName === myName;
  const me = iAmHost ? st.host : st.guest;
  const foe = iAmHost ? st.guest : st.host;
  const myTurn = st.winner ? false : (st.turnNo % 2 === 1) === iAmHost;

  return (
    <div className="spar-arena">
      <div className="spar-foe">
        <div className="spar-card">
          <b>{foe.name}</b> <span className="lv">Lv.{foe.level}</span>
          <span className="el-chip" style={{ background: elColor[foe.element] }}>{ELEMENT_NAMES[foe.element as keyof typeof ELEMENT_NAMES] ?? foe.element}</span>
          <HpBar hp={foe.hp} max={foe.maxHp} />
          <span className="spar-hpnum">{foe.hp}/{foe.maxHp}</span>
        </div>
      </div>
      <div className="spar-log">
        {st.log.slice(-6).map((l, i) => <p key={i}>{l}</p>)}
      </div>
      <div className="spar-me">
        <div className="spar-card">
          <b>{me.name}</b> <span className="lv">Lv.{me.level}</span>
          <span className="el-chip" style={{ background: elColor[me.element] }}>{ELEMENT_NAMES[me.element as keyof typeof ELEMENT_NAMES] ?? me.element}</span>
          <HpBar hp={me.hp} max={me.maxHp} />
          <span className="spar-hpnum">{me.hp}/{me.maxHp}</span>
        </div>
      </div>
      {st.winner ? (
        <div className="spar-result pop-in">
          {(st.winner === "host") === iAmHost ? "🎉 你赢啦！" : "惜败……再练练！"}
        </div>
      ) : (
        <div className="spar-actions">
          {myTurn ? (
            <>
              {me.moves.map((m, i) => (
                <button key={m.id} className="move-btn" disabled={busy} onClick={() => onMove(i)}>
                  <span className="move-name">
                    <i className="el-dot" style={{ background: elColor[m.element] }} />
                    {m.name}
                  </span>
                  <span className="move-power">威力 {m.power}</span>
                </button>
              ))}
              <button className="move-btn small" disabled={busy} onClick={() => onMove(0, "defend")}>
                <span className="move-name">🛡 稳住阵脚</span>
              </button>
            </>
          ) : (
            <p className="spar-waitturn">等待对方出招……</p>
          )}
          {err && <p className="spar-err">{err}</p>}
        </div>
      )}
    </div>
  );
}
