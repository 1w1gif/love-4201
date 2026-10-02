"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useGame } from "@/store";
import {
  ZONES, NPCS, characterSVG, petSVG, outfitById, HERO_NPCS,
} from "@maomao/game-core";
import type { OutfitLook } from "@maomao/art-engine";
import { Btn, CoinBadge, Sprite } from "./Ui";
import DialogBox from "./DialogBox";
import Shop from "./Shop";
import PetPanel from "./PetPanel";
import DailyPanel from "./DailyPanel";
import { sfx, startBgm, stopBgm, resume as resumeAudio } from "@/lib/sfx";
import { plazaPost } from "@/lib/plaza-client";

const TS = 44; // tile size

const NPC_OUTFITS: Record<string, OutfitLook> = {
  elder: { id: "tee", main: "#f5efe0", sub: "#8a9a6b" },
  shopkeep: { id: "dress", main: "#f39a6b", sub: "#f5efe0" },
  villager: { id: "hoodie", main: "#7a8cd8", sub: "#f5efe0" },
  guard: { id: "sport", main: "#5fae8e", sub: "#f5efe0" },
  mei: { id: "dress", main: "#e07a9b", sub: "#f5efe0" },
  mystic: { id: "wizard", main: "#6a4a9e", sub: "#f5efe0" },
  keeper: { id: "mecha", main: "#8a97a8", sub: "#ef6f6f" },
};

// 王者英雄 NPC：穿各自的英雄配色服装（heroes.ts 定义）
const HERO_OUTFITS: Record<string, OutfitLook> = Object.fromEntries(
  HERO_NPCS.map((h) => [h.id, h.outfit])
);

export default function WorldScreen() {
  const st = useGame();
  const zone = ZONES[st.zone];
  const [viewport, setViewport] = useState({ w: 800, h: 520 });
  const viewportRef = useRef<HTMLDivElement>(null);
  const [petPos, setPetPos] = useState({ x: st.px, y: st.py });

  // NPC 位置快照（阻挡判定）
  const zoneNpcs = useMemo(() => NPCS.filter((n) => n.zone === st.zone), [st.zone]);

  // 同场景在线玩家：上报自己的位置 + 拉取别人（2.5s 轮询）
  const [onlinePlayers, setOnlinePlayers] = useState<{ playerId: string; name: string; px: number; py: number; look: Parameters<typeof characterSVG>[0] }[]>([]);
  useEffect(() => {
    if (!st.account) { setOnlinePlayers([]); return; }
    let alive = true;
    const tick = async () => {
      const s = useGame.getState();
      if (!s.account || !s.look) return;
      try {
        const r = await plazaPost<{ players?: typeof onlinePlayers; error?: string }>({
          action: "worldPlayers", token: s.account.token, zone: s.zone, px: s.px, py: s.py, look: s.look,
        });
        if (alive && r.players) setOnlinePlayers(r.players);
      } catch { /* 断网静默 */ }
    };
    tick();
    const t = setInterval(tick, 2500);
    return () => { alive = false; clearInterval(t); };
  }, [st.account, st.zone]);

  // 拜访互动：切磋（直接向对方发起，免房间码）与送礼
  const visitSpar = (p: { playerId: string; name: string; px: number; py: number; look?: unknown }) => {
    const s = useGame.getState();
    if (!s.pet) { s.showToast("先去领养一只胖胖宠物再来切磋吧！"); return; }
    // 拉对方档案（species/level 从 worldPlayers 的 look 不足，走广场列表）
    s.openPlaza(true, "players");
    s.showToast(`向 ${p.name} 发起切磋：在训练家列表点 TA 的「⚔ 切磋」即可开战！`);
  };
  const visitGift = (p: { playerId: string; name: string }) => {
    const s = useGame.getState();
    if (s.coins < 20) { s.showToast("金币不够啦（送礼需要 20 金币）"); return; }
    s.addCoins(-20);
    plazaPost({ action: "giftSend", token: s.account?.token ?? "", targetId: p.playerId }).then((r: { points?: number; error?: string }) => {
      if (r.error) { s.addCoins(20); s.showToast(r.error); return; }
      s.showToast(`礼物送出！和 ${p.name} 的羁绊 +3（当前 ${r.points}）🎁`);
    });
  };

  // 视口尺寸
  useEffect(() => {
    const el = viewportRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => {
      setViewport({ w: el.clientWidth, h: el.clientHeight });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const worldW = zone.rows[0].length * TS;
  const worldH = zone.rows.length * TS;
  // 世界小于视口时整体居中，否则镜头跟随主角
  const camX = worldW < viewport.w
    ? (worldW - viewport.w) / 2
    : clamp(st.px * TS + TS / 2 - viewport.w / 2, 0, worldW - viewport.w);
  const camY = worldH < viewport.h
    ? (worldH - viewport.h) / 2
    : clamp(st.py * TS + TS / 2 - viewport.h / 2, 0, worldH - viewport.h);

  // 宠物跟随：记录上一格
  const prevPos = useRef({ x: st.px, y: st.py });
  useEffect(() => {
    if (st.px !== prevPos.current.x || st.py !== prevPos.current.y) {
      setPetPos({ ...prevPos.current });
      prevPos.current = { x: st.px, y: st.py };
    }
  }, [st.px, st.py]);
  // 换地图（传送）后，宠物直接落到主角脚边，避免残留在旧地图坐标
  useEffect(() => {
    setPetPos({ x: st.px, y: st.py });
    prevPos.current = { x: st.px, y: st.py };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [st.zone]);

  // 键盘 & 摇杆输入循环
  const inputRef = useRef<{ keys: string[]; joy: { x: number; y: number } | null }>({ keys: [], joy: null });
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      const k = e.key.toLowerCase();
      const map: Record<string, string> = {
        arrowup: "up", w: "up", arrowdown: "down", s: "down",
        arrowleft: "left", a: "left", arrowright: "right", d: "right",
      };
      if (map[k]) {
        e.preventDefault();
        if (!inputRef.current.keys.includes(map[k])) inputRef.current.keys.push(map[k]);
      } else if (k === " " || k === "enter") {
        e.preventDefault();
        // 对话优先：有对话时推进对话，否则尝试交互（单一处理入口，避免竞态）
        const cur = useGame.getState();
        if (cur.dialog) cur.advanceDialog();
        else st.interact();
      } else if (k === "c") {
        st.openPanel(true);
      }
    };
    const up = (e: KeyboardEvent) => {
      const k = e.key.toLowerCase();
      const map: Record<string, string> = {
        arrowup: "up", w: "up", arrowdown: "down", s: "down",
        arrowleft: "left", a: "left", arrowright: "right", d: "right",
      };
      inputRef.current.keys = inputRef.current.keys.filter((x) => x !== map[k]);
    };
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
    };
  }, [st]);

  useEffect(() => {
    const iv = setInterval(() => {
      const s = useGame.getState();
      const input = inputRef.current;
      let dx = 0, dy = 0;
      if (input.joy) {
        if (Math.abs(input.joy.x) > Math.abs(input.joy.y)) dx = Math.sign(input.joy.x);
        else dy = Math.sign(input.joy.y);
      } else {
        const k = input.keys[input.keys.length - 1];
        if (k === "up") dy = -1;
        else if (k === "down") dy = 1;
        else if (k === "left") dx = -1;
        else if (k === "right") dx = 1;
      }
      if (dx || dy) s.movePlayer(dx, dy);
    }, 150);
    return () => clearInterval(iv);
  }, []);

  const playerSvg = useMemo(
    () => (st.look ? characterSVG(st.look, outfitById(st.outfitId)) : ""),
    [st.look, st.outfitId]
  );
  const petSvg = useMemo(() => (st.pet ? petSVG(st.pet.look) : ""), [st.pet]);

  const facing = lastFacing(st.px, st.py, prevPos.current);
  const nearNpc = zoneNpcs.find(
    (n) => Math.abs(n.x - st.px) + Math.abs(n.y - st.py) === 1
  );

  const maxHp = st.pet ? st.pet.base.hp + st.pet.level * 5 : 0;
  const hp = st.pet ? (st.pet.hp ?? maxHp) : 0;

  // BGM：按地图氛围切换；音效开关关掉即停
  useEffect(() => {
    if (!st.soundOn) { stopBgm(); return; }
    resumeAudio();
    startBgm(zone.ambient === "forest" ? "battle" : "town");
    return () => stopBgm();
  }, [st.zone, st.soundOn]);

  // 首次用户交互后解锁 AudioContext
  useEffect(() => {
    const unlock = () => { if (st.soundOn) resumeAudio(); };
    window.addEventListener("pointerdown", unlock, { once: true });
    window.addEventListener("keydown", unlock, { once: true });
    return () => {
      window.removeEventListener("pointerdown", unlock);
      window.removeEventListener("keydown", unlock);
    };
  }, [st.soundOn]);

  return (
    <div className={`screen screen-world ambient-${zone.ambient}`}>
      {/* HUD */}
      <div className="hud">
        <div className="hud-left">
          <div className="zone-badge">{zone.name}</div>
          <CoinBadge coins={st.coins} />
          {st.visiting && (
            <div className="visit-banner">
              🚪 正在拜访 <b>{st.visiting.name}</b> 的世界
              <button className="visit-back" onClick={() => st.endVisit()}>返回我的世界</button>
            </div>
          )}
        </div>
        <div className="hud-right">
          {st.pet && (
            <div className="pet-chip" onClick={() => st.openPanel(true)}>
              <Sprite svg={petSvg} className="pet-chip-sprite" />
              <div className="pet-chip-info">
                <b>{st.pet.name} <span className="lv">Lv.{st.pet.level}</span></b>
                <div className="hpbar mini">
                  <div className="hpbar-fill" style={{ width: `${(hp / maxHp) * 100}%`, background: hp / maxHp > 0.5 ? "#5fae8e" : hp / maxHp > 0.2 ? "#f2c94c" : "#ef6f6f" }} />
                </div>
              </div>
            </div>
          )}
          <Btn tone="sun" className="hall-btn" onClick={() => st.openPlaza(true, "live")}>🔥 大厅</Btn>
          <Btn tone="cream" onClick={() => st.openDaily(true)}>任务</Btn>
          <Btn tone="cream" onClick={() => st.openPlaza(true)}>广场</Btn>
          <Btn tone="cream" onClick={() => st.openPanel(true)}>宠物·背包</Btn>
          <button
            className="sound-btn"
            title={st.soundOn ? "关闭音效" : "开启音效"}
            onClick={() => { st.setSoundOn(!st.soundOn); sfx.click(); }}
          >
            {st.soundOn ? "🔊" : "🔇"}
          </button>
        </div>
      </div>

      {/* 地图视口 */}
      <div className="viewport" ref={viewportRef}>
        <div
          className="world"
          style={{ width: worldW, height: worldH, transform: `translate(${-camX}px, ${-camY}px)` }}
        >
          {zone.rows.map((row, y) =>
            row.split("").map((ch, x) => (
              <Tile key={`${x}-${y}`} ch={ch} x={x} y={y} bossDone={zone.boss ? !!st.flags[zone.boss.flag] : false} />
            ))
          )}
          {zoneNpcs.map((n) => (
            <div key={n.id} className="entity npc" style={{ left: n.x * TS, top: n.y * TS - 26 }}>
              <Sprite svg={characterSVG(n.look, NPC_OUTFITS[n.id] ?? NPC_OUTFITS[n.role] ?? NPC_OUTFITS.elder)} />
              <div className={`npc-name ${n.role === "hero" ? "hero-name" : ""}`}>{n.name}</div>
              {nearNpc?.id === n.id && <div className="talk-bubble">！</div>}
            </div>
          ))}
          {/* 同场景的其他在线玩家 */}
          {onlinePlayers.map((p) => (
            <div key={p.playerId} className="entity online-player" style={{ left: p.px * TS, top: p.py * TS - 24 }}>
              <Sprite svg={characterSVG(p.look, outfitById("tee"))} />
              <div className="online-name">{p.name}</div>
              {/* 拜访模式下，被拜访者身边出现互动按钮 */}
              {st.visiting?.playerId === p.playerId && Math.abs(p.px - st.px) + Math.abs(p.py - st.py) <= 2 && (
                <div className="visit-actions">
                  <button className="va-btn fight" onClick={() => visitSpar(p)}>⚔ 切磋</button>
                  <button className="va-btn gift" onClick={() => visitGift(p)}>🎁 送礼</button>
                </div>
              )}
            </div>
          ))}
          {/* 跟随的宠物 */}
          {st.pet && (
            <div className="entity pet-follower" style={{ left: petPos.x * TS + 6, top: petPos.y * TS + 14 }}>
              <Sprite svg={petSvg} />
            </div>
          )}
          {/* 主角 */}
          <div
            className={`entity player facing-${facing}`}
            style={{ left: st.px * TS, top: st.py * TS - 24 }}
          >
            <Sprite svg={playerSvg} />
          </div>
        </div>
        <div className="zone-label">{zone.name}</div>
      </div>

      {/* 移动端操作 */}
      <Joystick onChange={(j) => (inputRef.current.joy = j)} />
      <div className="touch-actions">
        <button className="round-btn big" onClick={() => st.interact()}>💬</button>
      </div>

      <p className="move-hint">WASD / 方向键移动 · 空格对话 · C 打开背包</p>

      {st.dialog && <DialogBox />}
      {st.shopOpen && <Shop />}
      {st.panelOpen && <PetPanel />}
      {st.dailyOpen && <DailyPanel />}
      <Toast />
    </div>
  );
}

/* ---------------- 地块 ---------------- */
function Tile({ ch, x, y, bossDone }: { ch: string; x: number; y: number; bossDone?: boolean }) {
  const alt = (x + y) % 2 === 0 ? "alt" : "";
  let cls = `tile t-ground ${alt}`;
  if (ch === ",") cls = `tile t-path ${alt}`;
  else if (ch === "t") cls = `tile t-grass ${alt}`;
  else if (ch === "f") cls = `tile t-flower ${alt}`;
  else if (ch === "w") cls = "tile t-water";
  else if (ch === "#") cls = "tile t-tree";
  else if (ch === "h") cls = `tile t-house ${y === 0 || (x + y) % 3 !== 0 ? "" : ""}`;
  else if (ch === "r") cls = "tile t-rock";
  else if (ch === "B") cls = `tile t-boss ${bossDone ? "done" : ""}`;
  else if (ch === "F") cls = "tile t-fence";
  return (
    <div
      className={cls}
      style={{ left: x * TS, top: y * TS, width: TS, height: TS }}
    />
  );
}

/* ---------------- 虚拟摇杆 ---------------- */
function Joystick({ onChange }: { onChange: (j: { x: number; y: number } | null) => void }) {
  const baseRef = useRef<HTMLDivElement>(null);
  const [knob, setKnob] = useState({ x: 0, y: 0 });
  const activeRef = useRef(false);

  const handle = (e: React.PointerEvent) => {
    const el = baseRef.current;
    if (!el || !activeRef.current) return;
    const rect = el.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    let dx = (e.clientX - cx) / (rect.width / 2);
    let dy = (e.clientY - cy) / (rect.height / 2);
    const len = Math.hypot(dx, dy);
    if (len > 1) { dx /= len; dy /= len; }
    setKnob({ x: dx * 26, y: dy * 26 });
    onChange({ x: dx, y: dy });
  };

  const end = () => {
    activeRef.current = false;
    setKnob({ x: 0, y: 0 });
    onChange(null);
  };

  return (
    <div
      className="joystick"
      ref={baseRef}
      onPointerDown={(e) => {
        activeRef.current = true;
        (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
        handle(e);
      }}
      onPointerMove={handle}
      onPointerUp={end}
      onPointerCancel={end}
    >
      <div className="joystick-knob" style={{ transform: `translate(${knob.x}px, ${knob.y}px)` }} />
    </div>
  );
}

/* ---------------- Toast ---------------- */
function Toast() {
  const toast = useGame((s) => s.toast);
  if (!toast) return null;
  return <div className="toast pop-in">{toast}</div>;
}

function clamp(v: number, min: number, max: number) {
  return Math.max(min, Math.min(max, v));
}

function lastFacing(cx: number, cy: number, prev: { x: number; y: number }): string {
  const dx = cx - prev.x;
  const dy = cy - prev.y;
  if (dx > 0) return "right";
  if (dx < 0) return "left";
  if (dy > 0) return "down";
  if (dy < 0) return "up";
  return "down";
}
