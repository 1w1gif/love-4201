"use client";

import { useMemo, useState } from "react";
import { useGame } from "@/store";
import { petSVG, speciesById, pickStarterSpecies, ELEMENT_NAMES, ELEMENT_NAMES as EN, type Element } from "@maomao/game-core";
import type { PetSpecies } from "@maomao/game-core";
import { Btn, Sprite } from "./Ui";

const EL_COLOR: Record<Element, string> = {
  fire: "#f2843c", water: "#57a8d8", grass: "#6fbf73", electric: "#e0a800", normal: "#b99a72", shadow: "#8a7a9e",
};

export default function PetPicker() {
  const { affinity, chooseStarter } = useGame();
  const seed = "chapter1";
  const pool = useMemo(() => {
    // 限定精灵「奶航」固定出现在选宠列表最前面
    return [speciesById("naihang"), ...pickStarterSpecies((affinity ?? "normal") as Element, seed)];
  }, [affinity]);
  const [sel, setSel] = useState<PetSpecies | null>(null);

  return (
    <div className="screen screen-pick">
      <div className="pick-head">
        <h2>挑一只你的专属宠物</h2>
        <p className="pick-tip">每一只都是独一无二的胖胖，点击卡片看看详情～</p>
      </div>
      <div className="pick-grid">
        {pool.map((p, i) => (
          <button
            key={p.id}
            className={`pick-card ${sel?.id === p.id ? "sel" : ""} ${p.id === "naihang" ? "special" : ""}`}
            style={{ animationDelay: `${i * 0.04}s` }}
            onClick={() => setSel(p)}
          >
            {p.id === "naihang" && <span className="special-tag">限定 ★</span>}
            <div className="pick-art"><Sprite svg={petSVG(p.look)} /></div>
            <div className="pick-name">{p.name}</div>
            <div className="pick-tags">
              <span className="el-chip" style={{ background: EL_COLOR[p.element] }}>{ELEMENT_NAMES[p.element]}</span>
              <span className="rar-chip">{"★".repeat(p.rarity)}</span>
            </div>
          </button>
        ))}
      </div>
      {sel && (
        <div className="pick-detail card pop-in">
          <div className="pick-detail-art"><Sprite svg={petSVG(sel.look)} /></div>
          <div className="pick-detail-info">
            <div className="pick-detail-title">
              <b>{sel.name}</b>
              <span className="el-chip" style={{ background: EL_COLOR[sel.element] }}>{EN[sel.element]}系</span>
              <span className="rar-chip">{"★".repeat(sel.rarity)}</span>
            </div>
            <p className="pick-flavor">{sel.flavor}</p>
            <div className="stat-grid">
              <Stat label="体力" v={sel.base.hp} max={75} color="#5fae8e" />
              <Stat label="攻击" v={sel.base.atk} max={40} color="#ef6f6f" />
              <Stat label="防御" v={sel.base.def} max={40} color="#57a8d8" />
              <Stat label="速度" v={sel.base.spd} max={40} color="#f2c94c" />
            </div>
          </div>
          <div className="pick-confirm">
            <Btn tone="sun" onClick={() => chooseStarter(sel)}>就决定是它了！</Btn>
          </div>
        </div>
      )}
    </div>
  );
}

function Stat({ label, v, max, color }: { label: string; v: number; max: number; color: string }) {
  return (
    <div className="stat">
      <span className="stat-label">{label}</span>
      <div className="stat-bar"><div style={{ width: `${(v / max) * 100}%`, background: color }} /></div>
      <span className="stat-num">{v}</span>
    </div>
  );
}
