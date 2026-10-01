"use client";

import { useMemo } from "react";
import { useGame } from "@/store";
import { generatePetPool, petSVG, characterSVG } from "@maomao/game-core";
import { mulberry32 } from "@maomao/art-engine";
import type { CharacterLook } from "@maomao/art-engine";
import { Btn, Sprite } from "./Ui";
import PetPicker from "./PetPicker";
import WorldScreen from "./World";
import Plaza from "./Plaza";
import BattleScreen from "./BattleScreen";

export default function GameRoot() {
  const phase = useGame((s) => s.phase);
  const battle = useGame((s) => s.battle);
  const plazaOpen = useGame((s) => s.plazaOpen);
  const screen = (() => {
    switch (phase) {
      case "title":
        return <TitleScreen />;
      case "quiz":
        return <Quiz />;
      case "create":
        return <Creator />;
      case "pickPet":
        return <PetPicker />;
      case "world":
        return <WorldScreen />;
      default:
        return <TitleScreen />;
    }
  })();
  return (
    <>
      {screen}
      {plazaOpen && <Plaza />}
      {battle && <BattleScreen />}
    </>
  );
}

/* ================= 标题页 ================= */
function TitleScreen() {
  const { newGame, goto, pet, playerName, openPlaza } = useGame();
  const hasSave = !!pet;
  const floaters = useMemo(() => {
    const pool = generatePetPool("title-screen", 10);
    const rng = mulberry32(20260930);
    return pool.map((p, i) => {
      // 只在左右两侧活动，避免遮挡中央标题
      const left = rng() < 0.5 ? 3 + rng() * 16 : 78 + rng() * 16;
      const top = 5 + rng() * 84;
      return {
        svg: petSVG(p.look),
        left,
        top,
        delay: i * 0.7,
        size: 64 + Math.floor(rng() * 3) * 26,
      };
    });
  }, []);
  return (
    <div className="screen screen-title">
      {floaters.map((f, i) => (
        <div
          key={i}
          className="title-floater"
          style={{ left: `${f.left}%`, top: `${f.top}%`, animationDelay: `${f.delay}s`, width: f.size, height: f.size }}
        >
          <Sprite svg={f.svg} />
        </div>
      ))}
      <div className="title-center">
        <div className="title-eyebrow">圆滚滚 × 冒险 × 养成</div>
        <h1 className="title-logo">
          <span>4201</span>
          <span className="title-logo-accent">爱情故事</span>
        </h1>
        <p className="title-sub">捏一个自己，挑一只胖胖宠物，去岛上冒险吧！</p>
        <div className="title-actions">
          {hasSave && (
            <Btn tone="mint" onClick={() => goto("world")}>
              ▶ 继续冒险（{playerName || "勇者"}）
            </Btn>
          )}
          <Btn tone="sun" onClick={newGame}>
            {hasSave ? "重新开始新冒险" : "▶ 开始冒险"}
          </Btn>
        </div>
        <div className="title-plaza">
          <Btn tone="sky" onClick={() => openPlaza(true)}>👥 训练家广场</Btn>
        </div>
        <p className="title-hint">进度会自动保存在浏览器里</p>
      </div>
    </div>
  );
}

/* ================= 性格问答 ================= */
const QUIZ: { q: string; options: { text: string; element: string }[] }[] = [
  {
    q: "难得的休息日，你会怎么过？",
    options: [
      { text: "出门疯玩一整天！", element: "fire" },
      { text: "在家睡到自然醒", element: "normal" },
      { text: "雨天窝在窗边看书", element: "water" },
      { text: "去公园躺草地发呆", element: "grass" },
      { text: "把家里的电器拆了", element: "electric" },
    ],
  },
  {
    q: "好朋友难过的时候，你会？",
    options: [
      { text: "拉TA出门大喊大叫释放压力", element: "fire" },
      { text: "安安静静陪在TA身边", element: "grass" },
      { text: "讲一堆冷笑话逗TA", element: "normal" },
      { text: "深夜和TA促膝长谈", element: "water" },
      { text: "带TA去吃奇怪的新店", element: "electric" },
    ],
  },
  {
    q: "如果可以实现一个愿望？",
    options: [
      { text: "变得超级强！", element: "fire" },
      { text: "每天都安稳开心", element: "normal" },
      { text: "守护重要的人", element: "grass" },
      { text: "看遍世界每个角落", element: "water" },
      { text: "造出改变世界的发明", element: "electric" },
    ],
  },
  {
    q: "以下哪种天气你最心动？",
    options: [
      { text: "热辣辣的大晴天", element: "fire" },
      { text: "温柔的小微风", element: "grass" },
      { text: "哗啦啦的下雨天", element: "water" },
      { text: "轰隆隆的雷雨夜", element: "electric" },
      { text: "适合打盹的暖洋洋", element: "normal" },
    ],
  },
];

const ELEMENT_LABEL: Record<string, string> = {
  fire: "火焰", water: "流水", grass: "青草", electric: "闪电", normal: "团子",
};

function Quiz() {
  const [step, setStep] = useReactState(0);
  const [scores, setScores] = useReactState<Record<string, number>>({});
  const setAffinity = useGame((s) => s.setAffinity);

  const choose = (element: string) => {
    const next = { ...scores, [element]: (scores[element] ?? 0) + 1 };
    if (step < QUIZ.length - 1) {
      setScores(next);
      setStep(step + 1);
    } else {
      const best = Object.entries(next).sort((a, b) => b[1] - a[1])[0]?.[0] ?? "normal";
      setScores(next);
      setTimeout(() => setAffinity(best), 350);
    }
  };
  const q = QUIZ[step];
  return (
    <div className="screen screen-quiz">
      <div className="card quiz-card">
        <div className="quiz-progress">
          {QUIZ.map((_, i) => (
            <span key={i} className={`dot ${i <= step ? "on" : ""}`} />
          ))}
        </div>
        <div className="quiz-tag">气质小测试 {step + 1}/{QUIZ.length}</div>
        <h2 className="quiz-q">{q.q}</h2>
        <div className="quiz-options">
          {q.options.map((o, i) => (
            <button key={i} className="quiz-option" style={{ animationDelay: `${i * 0.06}s` }} onClick={() => choose(o.element)}>
              {o.text}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

// 简易 useState 封装（避免文件顶部额外 import 干扰阅读）
import { useState as useReactState } from "react";

/* ================= 捏人 ================= */
function Creator() {
  const { affinity, look, setLook, setName, playerName, goto } = useGame();
  const [local, setLocal] = useReactState<CharacterLook>(
    look ?? {
      faceShape: "round", skin: "#ffe3c8", eyeStyle: "round", eyeColor: "#4a3737",
      mouth: "smile", hair: "short", hairColor: "#6b4a3a", blush: true, accessory: "none",
    }
  );
  const [name, setLocalName] = useReactState(playerName || "");
  const [diceKey, setDiceKey] = useReactState(0);

  const svg = useMemo(() => characterSVG(local, { id: "tee", main: "#f5efe0", sub: "#f6d55c" }), [local]);

  const randomize = () => {
    const rng = mulberry32(Date.now() % 100000 + diceKey);
    setDiceKey(diceKey + 1);
    const pickA = <T,>(arr: readonly T[]): T => arr[Math.floor(rng() * arr.length)];
    setLocal({
      faceShape: pickA(["round", "square", "egg", "heart"] as const),
      skin: pickA(["#ffe3c8", "#fcd0a8", "#f2b58c", "#d9975f", "#b0713e"]),
      eyeStyle: pickA(["round", "sparkle", "happy", "sleepy", "dot"] as const),
      eyeColor: pickA(["#4a3737", "#6b4a2f", "#3d6b52", "#3d5a8c", "#8c4a6b"]),
      mouth: pickA(["smile", "grin", "cat", "open", "wavy", "pout"] as const),
      hair: pickA(["short", "twin", "bun", "spiky", "bowl", "curly"] as const),
      hairColor: pickA(["#3f3245", "#6b4a3a", "#a86a3d", "#e8b04b", "#d96a4f", "#7a8cd8", "#5fae8e", "#e07a9b"]),
      blush: rng() < 0.7,
      accessory: pickA(["none", "glasses", "cap", "hairpin", "scarf"] as const),
    });
  };

  const start = () => {
    setLook(local);
    setName(name.trim() || "小勇者");
    goto("pickPet");
  };

  return (
    <div className="screen screen-create">
      <div className="create-head">
        <h2>捏一个你自己</h2>
        {affinity && (
          <div className="affinity-chip" data-el={affinity}>
            你的气质是【{ELEMENT_LABEL[affinity]}系】等下可以重点关注对应宠物哦
          </div>
        )}
      </div>
      <div className="create-body">
        <div className="create-preview card">
          <div className="preview-stage">
            <Sprite svg={svg} className="pop-in" />
          </div>
          <input
            className="name-input"
            placeholder="给自己起个名字（最多6个字）"
            maxLength={6}
            value={name}
            onChange={(e) => setLocalName(e.target.value)}
          />
        </div>
        <div className="create-options">
          <OptionRow
            label="脸型"
            options={[["round", "圆圆"], ["square", "方方"], ["egg", "鹅蛋"], ["heart", "桃心"]]}
            value={local.faceShape}
            onChange={(v) => setLocal({ ...local, faceShape: v as CharacterLook["faceShape"] })}
          />
          <OptionRow
            label="发型"
            options={[["short", "利落短发"], ["twin", "元气双马尾"], ["bun", "丸子头"], ["spiky", "刺猬头"], ["bowl", "蘑菇头"], ["curly", "蓬蓬卷"]]}
            value={local.hair}
            onChange={(v) => setLocal({ ...local, hair: v as CharacterLook["hair"] })}
          />
          <SwatchRow
            label="发色"
            colors={["#3f3245", "#6b4a3a", "#a86a3d", "#e8b04b", "#d96a4f", "#7a8cd8", "#5fae8e", "#e07a9b"]}
            value={local.hairColor}
            onChange={(v) => setLocal({ ...local, hairColor: v })}
          />
          <OptionRow
            label="眼睛"
            options={[["round", "圆圆眼"], ["sparkle", "星星眼"], ["happy", "眯眯笑"], ["sleepy", "困困眼"], ["dot", "豆豆眼"]]}
            value={local.eyeStyle}
            onChange={(v) => setLocal({ ...local, eyeStyle: v as CharacterLook["eyeStyle"] })}
          />
          <SwatchRow
            label="眼色"
            colors={["#4a3737", "#6b4a2f", "#3d6b52", "#3d5a8c", "#8c4a6b"]}
            value={local.eyeColor}
            onChange={(v) => setLocal({ ...local, eyeColor: v })}
          />
          <OptionRow
            label="嘴巴"
            options={[["smile", "微笑"], ["grin", "哈哈"], ["cat", "喵喵"], ["open", "哇哦"], ["wavy", "波浪"], ["pout", "嘟嘟"]]}
            value={local.mouth}
            onChange={(v) => setLocal({ ...local, mouth: v as CharacterLook["mouth"] })}
          />
          <SwatchRow
            label="肤色"
            colors={["#ffe3c8", "#fcd0a8", "#f2b58c", "#d9975f", "#b0713e"]}
            value={local.skin}
            onChange={(v) => setLocal({ ...local, skin: v })}
          />
          <OptionRow
            label="配饰"
            options={[["none", "不戴"], ["glasses", "眼镜"], ["cap", "棒球帽"], ["hairpin", "小花夹"], ["scarf", "小围巾"]]}
            value={local.accessory}
            onChange={(v) => setLocal({ ...local, accessory: v as CharacterLook["accessory"] })}
          />
          <OptionRow
            label="腮红"
            options={[["yes", "要脸红"], ["no", "不要"]]}
            value={local.blush ? "yes" : "no"}
            onChange={(v) => setLocal({ ...local, blush: v === "yes" })}
          />
          <div className="create-actions">
            <Btn tone="cream" onClick={randomize}>🎲 随机一个</Btn>
            <Btn tone="coral" onClick={start}>✓ 就这样，去找宠物！</Btn>
          </div>
        </div>
      </div>
    </div>
  );
}

function OptionRow({ label, options, value, onChange }: {
  label: string;
  options: [string, string][];
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="opt-row">
      <div className="opt-label">{label}</div>
      <div className="opt-chips">
        {options.map(([v, text]) => (
          <button key={v} className={`chip ${value === v ? "on" : ""}`} onClick={() => onChange(v)}>{text}</button>
        ))}
      </div>
    </div>
  );
}

function SwatchRow({ label, colors, value, onChange }: {
  label: string;
  colors: string[];
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="opt-row">
      <div className="opt-label">{label}</div>
      <div className="opt-chips">
        {colors.map((c) => (
          <button
            key={c}
            className={`swatch ${value === c ? "on" : ""}`}
            style={{ background: c }}
            onClick={() => onChange(c)}
            aria-label={c}
          />
        ))}
      </div>
    </div>
  );
}
