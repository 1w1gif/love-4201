"use client";

import { useGame } from "@/store";
import {
  petSVG, maxHpOf, atkOf, defOf, spdOf, trainCost, expToNext,
  ELEMENT_NAMES, outfitById, characterSVG, OUTFITS,
} from "@maomao/game-core";
import { Btn, Sprite } from "./Ui";

const EL_COLOR: Record<string, string> = {
  fire: "#f2843c", water: "#57a8d8", grass: "#6fbf73", electric: "#e0a800", normal: "#b99a72", shadow: "#8a7a9e",
};

export default function PetPanel() {
  const { pet, storage, coins, items, outfitId, ownedOutfits, look, playerName, flags, chapterDone } = useGame();
  const { train, usePotion, revive, equipOutfit, openPanel, goto, setActivePet } = useGame();
  if (!pet) return null;

  const maxHp = maxHpOf(pet);
  const hp = pet.hp ?? maxHp;
  const expPct = Math.min(100, (pet.exp / expToNext(pet.level)) * 100);

  return (
    <div className="overlay-layer">
      <div className="panel card pop-in panel-wide">
        <div className="panel-head">
          <h3>{playerName || "勇者"}的冒险手册</h3>
          <span className="coin-badge small"><i className="coin-icon" />{coins}</span>
          <button className="close-btn" onClick={() => openPanel(false)}>✕</button>
        </div>

        <div className="panel-body two-col">
          {/* 宠物养成 */}
          <div className="panel-sec">
            <div className="pet-hero">
              <div className="pet-hero-art"><Sprite svg={petSVG(pet.look)} /></div>
              <div className="pet-hero-info">
                <b className="pet-hero-name">
                  {pet.name}
                  <span className="el-chip" style={{ background: EL_COLOR[pet.element] }}>{ELEMENT_NAMES[pet.element]}</span>
                </b>
                <div className="lv-line">Lv.{pet.level} <span className="exp-mini">经验 {pet.exp}/{expToNext(pet.level)}</span></div>
                <div className="expbar"><div style={{ width: `${expPct}%` }} /></div>
                <div className="hp-line">体力 {hp}/{maxHp}</div>
              </div>
            </div>

            <div className="train-grid">
              <TrainRow label="攻击" value={atkOf(pet)} extra={pet.train.atk} color="#ef6f6f" cost={trainCost(pet.train.atk)} onTrain={() => train("atk")} coins={coins} />
              <TrainRow label="防御" value={defOf(pet)} extra={pet.train.def} color="#57a8d8" cost={trainCost(pet.train.def)} onTrain={() => train("def")} coins={coins} />
              <TrainRow label="速度" value={spdOf(pet)} extra={pet.train.spd} color="#f2c94c" cost={trainCost(pet.train.spd)} onTrain={() => train("spd")} coins={coins} />
            </div>
            <p className="train-tip">花金币做专项训练，让胖胖变得更强！升级也能涨属性。</p>

            {/* 宠物仓库：捉到的胖胖都在这里，可切换主战 */}
            {storage.length > 0 && (
              <div className="bag-sec">
                <b className="sec-title">宠物仓库（{storage.length}）· 点卡片换主战</b>
                <div className="storage-grid">
                  {storage.map((p) => {
                    const pMax = p.base.hp + p.level * 5;
                    const pHp = p.hp ?? pMax;
                    return (
                      <button key={p.uid} className={`storage-card ${pHp <= 0 ? "tired" : ""}`} onClick={() => setActivePet(p.uid)}>
                        <Sprite svg={petSVG(p.look)} />
                        <b>{p.name}</b>
                        <span className="lv">Lv.{p.level} · 体力 {pHp}/{pMax}</span>
                        <span className="storage-cta">设为主战</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* 背包 */}
            <div className="bag-sec">
              <b className="sec-title">背包</b>
              <div className="bag-row">
                <button className="bag-item" disabled={(items["potion-s"] ?? 0) <= 0 || hp >= maxHp} onClick={() => usePotion("potion-s", 50)}>
                  🧴 小奶瓶 ×{items["potion-s"] ?? 0}<small>恢复50</small>
                </button>
                <button className="bag-item" disabled={(items["potion-l"] ?? 0) <= 0 || hp >= maxHp} onClick={() => usePotion("potion-l", 120)}>
                  🍼 大奶瓶 ×{items["potion-l"] ?? 0}<small>恢复120</small>
                </button>
                <button className="bag-item" disabled={(items["revive"] ?? 0) <= 0 || hp > 0} onClick={() => revive("revive")}>
                  🍮 复活果冻 ×{items["revive"] ?? 0}<small>倒下时用</small>
                </button>
              </div>
            </div>
          </div>

          {/* 衣柜 & 进度 */}
          <div className="panel-sec">
            <b className="sec-title">衣柜（换装即时生效）</b>
            <div className="wardrobe-grid">
              {OUTFITS.filter((o) => ownedOutfits.includes(o.id)).map((o) => (
                <button key={o.id} className={`wardrobe-card ${outfitId === o.id ? "on" : ""}`} onClick={() => equipOutfit(o.id)}>
                  <Sprite svg={characterSVG(look!, outfitById(o.id))} />
                  <span>{o.name}</span>
                </button>
              ))}
            </div>
            <b className="sec-title">第一章 · 圆滚滚村的骚动</b>
            <div className="quest-list">
              <Quest done={!!flags.intro} text="听宇航讲村子的怪事" />
              <Quest done={!!flags.guardBeaten} text="和大狗粪切磋一场" />
              <Quest done={!!flags.meadowEvent} text="在风铃草原找到线索" />
              <Quest done={!!flags.bossDone} text="查明迷雾森林的真相" />
            </div>
            {chapterDone && <div className="chapter-done">🏆 第一章完成！谢谢你拯救了圆滚滚村！</div>}
            <div className="panel-foot">
              <Btn tone="cream" onClick={() => { openPanel(false); goto("title"); }}>回标题</Btn>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function TrainRow({ label, value, extra, color, cost, onTrain, coins }: {
  label: string; value: number; extra: number; color: string; cost: number; onTrain: () => void; coins: number;
}) {
  return (
    <div className="train-row">
      <span className="train-label" style={{ color }}>{label}</span>
      <b className="train-val">{value}</b>
      <Btn tone="sun" className="train-btn" onClick={onTrain} disabled={coins < cost}>
        训练 {cost}💰
      </Btn>
    </div>
  );
}

function Quest({ done, text }: { done: boolean; text: string }) {
  return (
    <div className={`quest ${done ? "done" : ""}`}>
      <span className="quest-check">{done ? "✓" : "　"}</span>
      {text}
    </div>
  );
}
