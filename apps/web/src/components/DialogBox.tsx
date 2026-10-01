"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useGame } from "@/store";
import { NPCS, characterSVG, petSVG, outfitById } from "@maomao/game-core";
import type { OutfitLook } from "@maomao/art-engine";
import { Sprite } from "./Ui";

const NPC_OUTFITS: Record<string, OutfitLook> = {
  elder: { id: "tee", main: "#f5efe0", sub: "#8a9a6b" },
  shopkeep: { id: "dress", main: "#f39a6b", sub: "#f5efe0" },
  villager: { id: "hoodie", main: "#7a8cd8", sub: "#f5efe0" },
  guard: { id: "sport", main: "#5fae8e", sub: "#f5efe0" },
  mei: { id: "dress", main: "#e07a9b", sub: "#f5efe0" },
};

export default function DialogBox() {
  const dialog = useGame((s) => s.dialog);
  const look = useGame((s) => s.look);
  const pet = useGame((s) => s.pet);
  const outfitId = useGame((s) => s.outfitId);
  const [shown, setShown] = useState(0);

  const line = dialog?.lines[dialog.index];

  useEffect(() => {
    setShown(0);
    if (!line) return;
    const iv = setInterval(() => {
      setShown((n) => {
        if (n >= line.text.length) {
          clearInterval(iv);
          return n;
        }
        return n + 1;
      });
    }, 28);
    return () => clearInterval(iv);
  }, [line]);
  // 注意：空格/回车由 World.tsx 统一处理，这里不重复监听，避免双重触发

  const portraitSvg = useMemo(() => {
    if (!line) return "";
    const npc = NPCS.find((n) => n.name === line.speaker);
    if (npc) return characterSVG(npc.look, NPC_OUTFITS[npc.role] ?? NPC_OUTFITS.elder);
    if (pet && line.speaker.includes(pet.name)) return petSVG(pet.look);
    if (look && line.speaker.includes("小家伙")) return characterSVG(look, outfitById(outfitId));
    return "";
  }, [line, look, pet, outfitId]);

  if (!dialog || !line) return null;
  const full = shown >= line.text.length;

  // 点第一下补全本句，再点一下才翻页（视觉小说的常规手感）
  const handleClick = () => {
    if (!full) setShown(line.text.length);
    else useGame.getState().advanceDialog();
  };

  return (
    <div className="dialog-layer" onClick={handleClick}>
      <div className="dialog-box pop-in">
        {portraitSvg && (
          <div className="dialog-portrait">
            <Sprite svg={portraitSvg} />
          </div>
        )}
        <div className="dialog-content">
          <div className="dialog-speaker">{line.speaker}</div>
          <p className="dialog-text">
            {line.text.slice(0, shown)}
            {!full && <span className="dialog-caret">▍</span>}
          </p>
          {full && <div className="dialog-next">▼ 点击继续</div>}
        </div>
      </div>
    </div>
  );
}
