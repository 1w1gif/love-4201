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
  const [tab, setTab] = useState<"chat" | "spar">("chat");
  return (
    <div className="live-wrap">
      <div className="live-tabs">
        <button className={`panel-tab ${tab === "chat" ? "on" : ""}`} onClick={() => setTab("chat")}>💬 聊天大厅</button>
        <button className={`panel-tab ${tab === "spar" ? "on" : ""}`} onClick={() => setTab("spar")}>⚔ 实时切磋</button>
      </div>
      {tab === "chat" ? <PlazaChat token={token} myName={myName} /> : <OnlineSpar token={token} myName={myName} onBattleEnd={onBattleEnd} />}
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
