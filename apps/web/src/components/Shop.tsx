"use client";

import { useState } from "react";
import { useGame } from "@/store";
import { SHOP_ITEMS, OUTFITS, characterSVG, outfitById } from "@maomao/game-core";
import { Btn, CoinBadge, Sprite } from "./Ui";

export default function Shop() {
  const { coins, items, ownedOutfits, outfitId, buyItem, buyOutfit, equipOutfit, look, openShop } = useGame();
  const [tab, setTab] = useState<"items" | "outfits">("items");

  return (
    <div className="overlay-layer">
      <div className="panel card pop-in">
        <div className="panel-head">
          <h3>胖婶商店</h3>
          <CoinBadge coins={coins} />
          <button className="close-btn" onClick={() => openShop(false)}>✕</button>
        </div>
        <div className="panel-tabs">
          <button className={`panel-tab ${tab === "items" ? "on" : ""}`} onClick={() => setTab("items")}>道具</button>
          <button className={`panel-tab ${tab === "outfits" ? "on" : ""}`} onClick={() => setTab("outfits")}>服装</button>
        </div>

        {tab === "items" ? (
          <div className="shop-list">
            {SHOP_ITEMS.map((it) => (
              <div key={it.id} className="shop-row">
                <div className="shop-item-icon">{it.kind === "potion" ? "🧴" : it.kind === "ball" ? (it.id === "ball-great" ? "🔵" : "🔴") : "🍮"}</div>
                <div className="shop-item-info">
                  <b>{it.name} <span className="owned">已有 {items[it.id] ?? 0}</span></b>
                  <p>{it.desc}</p>
                </div>
                <Btn tone="sun" onClick={() => buyItem(it.id, it.price)} disabled={coins < it.price}>
                  {it.price} 金币
                </Btn>
              </div>
            ))}
          </div>
        ) : (
          <div className="shop-list">
            {OUTFITS.map((o) => {
              const owned = ownedOutfits.includes(o.id);
              return (
                <div key={o.id} className="shop-row">
                  <div className="shop-item-icon outfit-preview">
                    {look && <Sprite svg={characterSVG(look, outfitById(o.id))} />}
                  </div>
                  <div className="shop-item-info">
                    <b>{o.name} {owned && <span className="owned">已拥有</span>}</b>
                    <p>{o.desc}</p>
                  </div>
                  {owned ? (
                    <Btn tone={outfitId === o.id ? "mint" : "cream"} onClick={() => equipOutfit(o.id)}>
                      {outfitId === o.id ? "穿着中" : "换上"}
                    </Btn>
                  ) : (
                    <Btn tone="sun" onClick={() => buyOutfit(o.id, o.price)} disabled={coins < o.price}>
                      {o.price} 金币
                    </Btn>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
