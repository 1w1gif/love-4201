export type PetBody = "round" | "chubby" | "drop" | "cloud" | "bean";
export type PetEars = "round" | "pointy" | "long" | "none" | "antenna" | "fin";
export type PetTail = "pom" | "bolt" | "leaf" | "curl" | "none";
export type PetPattern = "belly" | "spots" | "stripes" | "none";
export type PetEyes = "dot" | "round" | "happy" | "sleepy" | "star";
export type PetMouth = "smile" | "grin" | "cat" | "open" | "wavy";

export interface PetColors {
  main: string;
  sub: string;
  light: string;
  deep: string;
}

export interface PetLook {
  body: PetBody;
  ears: PetEars;
  tail: PetTail;
  pattern: PetPattern;
  eyes: PetEyes;
  mouth: PetMouth;
  colors: PetColors;
  /** 头顶元素装饰，如火焰/水滴/嫩叶/电花 */
  crest: "fire" | "water" | "grass" | "electric" | "none" | "shadow";
  /** 黑框小眼镜（奶航同款） */
  glasses?: boolean;
}

import { OUTLINE } from "./palette";

const S = 'stroke-linejoin="round" stroke-linecap="round"';

function wrap(inner: string, viewBox = "0 0 120 120"): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${viewBox}" class="art-svg">${inner}</svg>`;
}

function petal(x: number, y: number, r: number, fill: string): string {
  return `<circle cx="${x}" cy="${y}" r="${r}" fill="${fill}" stroke="${OUTLINE}" stroke-width="3" ${S}/>`;
}

/* ---------------- 尾巴（画在身体后面） ---------------- */
function tailSVG(t: PetTail, c: PetColors): string {
  switch (t) {
    case "pom":
      return petal(100, 88, 11, c.sub);
    case "bolt":
      return `<path d="M92 92 L108 74 L98 72 L110 56" fill="none" stroke="${OUTLINE}" stroke-width="9" ${S}/><path d="M92 92 L108 74 L98 72 L110 56" fill="none" stroke="${c.sub}" stroke-width="4" ${S}/>`;
    case "leaf":
      return `<path d="M92 92 Q112 84 112 64 Q96 68 90 84 Z" fill="${c.sub}" stroke="${OUTLINE}" stroke-width="3" ${S}/><path d="M94 86 Q102 78 108 70" fill="none" stroke="${c.deep}" stroke-width="2" ${S}/>`;
    case "curl":
      return `<path d="M94 90 Q116 88 112 68 Q108 52 96 58" fill="none" stroke="${OUTLINE}" stroke-width="10" ${S}/><path d="M94 90 Q116 88 112 68 Q108 52 96 58" fill="none" stroke="${c.sub}" stroke-width="5" ${S}/>`;
    default:
      return "";
  }
}

/* ---------------- 耳朵（画在身体后面，从头顶伸出） ---------------- */
function earsSVG(e: PetEars, c: PetColors): string {
  switch (e) {
    case "round":
      return (
        petal(30, 34, 13, c.main) +
        petal(90, 34, 13, c.main) +
        `<circle cx="30" cy="34" r="6" fill="${c.light}"/><circle cx="90" cy="34" r="6" fill="${c.light}"/>`
      );
    case "pointy":
      return `<path d="M26 44 L34 14 L48 38 Z" fill="${c.main}" stroke="${OUTLINE}" stroke-width="3" ${S}/><path d="M94 44 L86 14 L72 38 Z" fill="${c.main}" stroke="${OUTLINE}" stroke-width="3" ${S}/><path d="M31 36 L34 22 L41 34 Z" fill="${c.light}"/><path d="M89 36 L86 22 L79 34 Z" fill="${c.light}"/>`;
    case "long":
      return `<rect x="26" y="6" width="15" height="42" rx="7.5" fill="${c.main}" stroke="${OUTLINE}" stroke-width="3" ${S}/><rect x="79" y="6" width="15" height="42" rx="7.5" fill="${c.main}" stroke="${OUTLINE}" stroke-width="3" ${S}/><rect x="30" y="12" width="7" height="26" rx="3.5" fill="${c.light}"/><rect x="83" y="12" width="7" height="26" rx="3.5" fill="${c.light}"/>`;
    case "antenna":
      return `<path d="M42 30 Q36 12 26 8" fill="none" stroke="${OUTLINE}" stroke-width="4" ${S}/><path d="M78 30 Q84 12 94 8" fill="none" stroke="${OUTLINE}" stroke-width="4" ${S}/>${petal(25, 8, 6, c.sub)}${petal(95, 8, 6, c.sub)}`;
    case "fin":
      return `<path d="M24 62 Q6 52 4 36 Q22 40 32 52 Z" fill="${c.sub}" stroke="${OUTLINE}" stroke-width="3" ${S}/><path d="M96 62 Q114 52 116 36 Q98 40 88 52 Z" fill="${c.sub}" stroke="${OUTLINE}" stroke-width="3" ${S}/>`;
    default:
      return "";
  }
}

/* ---------------- 身体 ---------------- */
function bodySVG(b: PetBody, c: PetColors): string {
  const stroke = `stroke="${OUTLINE}" stroke-width="3" ${S}`;
  switch (b) {
    case "round":
      return `<circle cx="60" cy="68" r="37" fill="${c.main}" ${stroke}/>`;
    case "chubby":
      return `<ellipse cx="60" cy="70" rx="41" ry="34" fill="${c.main}" ${stroke}/>`;
    case "drop":
      return `<path d="M60 28 C82 30 95 56 95 76 C95 96 80 105 60 105 C40 105 25 96 25 76 C25 56 38 30 60 28 Z" fill="${c.main}" ${stroke}/>`;
    case "cloud":
      return `<path d="M32 84 A14 14 0 0 1 22 58 A18 18 0 0 1 52 42 A17 17 0 0 1 86 50 A15 15 0 0 1 90 80 A16 16 0 0 1 68 92 L42 92 A15 15 0 0 1 32 84 Z" fill="${c.main}" ${stroke}/>`;
    case "bean":
      return `<rect x="22" y="36" width="76" height="68" rx="32" fill="${c.main}" ${stroke}/>`;
  }
}

function feetSVG(c: PetColors): string {
  return `<ellipse cx="44" cy="104" rx="10" ry="6" fill="${c.deep}" stroke="${OUTLINE}" stroke-width="3" ${S}/><ellipse cx="76" cy="104" rx="10" ry="6" fill="${c.deep}" stroke="${OUTLINE}" stroke-width="3" ${S}/>`;
}

function armsSVG(c: PetColors): string {
  return petal(23, 80, 8, c.main) + petal(97, 80, 8, c.main);
}

/* ---------------- 花纹 ---------------- */
function patternSVG(p: PetPattern, c: PetColors): string {
  switch (p) {
    case "belly":
      return `<ellipse cx="60" cy="84" rx="21" ry="15" fill="${c.light}" opacity="0.9"/>`;
    case "spots":
      return `<circle cx="38" cy="52" r="5" fill="${c.sub}"/><circle cx="80" cy="88" r="6" fill="${c.sub}"/><circle cx="86" cy="48" r="4" fill="${c.sub}"/>`;
    case "stripes":
      return `<path d="M44 40 Q46 50 44 56" stroke="${c.deep}" stroke-width="6" fill="none" opacity="0.55" stroke-linecap="round"/><path d="M60 36 Q62 48 60 54" stroke="${c.deep}" stroke-width="6" fill="none" opacity="0.55" stroke-linecap="round"/><path d="M76 40 Q78 50 76 56" stroke="${c.deep}" stroke-width="6" fill="none" opacity="0.55" stroke-linecap="round"/>`;
    default:
      return "";
  }
}

/* ---------------- 表情 ---------------- */
function eyesSVG(e: PetEyes, eyeColor: string): string {
  switch (e) {
    case "dot":
      return `<circle cx="46" cy="62" r="5" fill="${OUTLINE}"/><circle cx="74" cy="62" r="5" fill="${OUTLINE}"/><circle cx="47.8" cy="60.2" r="1.7" fill="#fff"/><circle cx="75.8" cy="60.2" r="1.7" fill="#fff"/>`;
    case "round":
      return `<ellipse cx="46" cy="62" rx="7" ry="8.5" fill="#fff" stroke="${OUTLINE}" stroke-width="2.5"/><ellipse cx="74" cy="62" rx="7" ry="8.5" fill="#fff" stroke="${OUTLINE}" stroke-width="2.5"/><circle cx="47" cy="63.5" r="4" fill="${eyeColor}"/><circle cx="75" cy="63.5" r="4" fill="${eyeColor}"/><circle cx="48.5" cy="60" r="1.6" fill="#fff"/><circle cx="76.5" cy="60" r="1.6" fill="#fff"/>`;
    case "happy":
      return `<path d="M39 64 Q46 54 53 64" fill="none" stroke="${OUTLINE}" stroke-width="4" ${S}/><path d="M67 64 Q74 54 81 64" fill="none" stroke="${OUTLINE}" stroke-width="4" ${S}/>`;
    case "sleepy":
      return `<path d="M39 61 Q46 68 53 61" fill="none" stroke="${OUTLINE}" stroke-width="4" ${S}/><path d="M67 61 Q74 68 81 61" fill="none" stroke="${OUTLINE}" stroke-width="4" ${S}/>`;
    case "star":
      return `<path d="M46 55 L48.2 60.2 L54 60.8 L49.8 64.6 L51 70 L46 67 L41 70 L42.2 64.6 L38 60.8 L43.8 60.2 Z" fill="${eyeColor}" stroke="${OUTLINE}" stroke-width="2"/><path d="M74 55 L76.2 60.2 L82 60.8 L77.8 64.6 L79 70 L74 67 L69 70 L70.2 64.6 L66 60.8 L71.8 60.2 Z" fill="${eyeColor}" stroke="${OUTLINE}" stroke-width="2"/>`;
  }
}

function mouthSVG(m: PetMouth): string {
  switch (m) {
    case "smile":
      return `<path d="M52 76 Q60 83 68 76" fill="none" stroke="${OUTLINE}" stroke-width="3.5" ${S}/>`;
    case "grin":
      return `<path d="M50 74 Q60 86 70 74 Z" fill="${OUTLINE}"/><path d="M55 81 Q60 86 65 81 Z" fill="#f08080"/>`;
    case "cat":
      return `<path d="M51 75 Q55.5 80 60 75 Q64.5 80 69 75" fill="none" stroke="${OUTLINE}" stroke-width="3.5" ${S}/>`;
    case "open":
      return `<ellipse cx="60" cy="79" rx="7" ry="9" fill="${OUTLINE}"/><ellipse cx="60" cy="83" rx="4" ry="3.5" fill="#f08080"/>`;
    case "wavy":
      return `<path d="M50 77 Q55 73 60 77 Q65 81 70 77" fill="none" stroke="${OUTLINE}" stroke-width="3.5" ${S}/>`;
  }
}

function blushSVG(): string {
  return `<ellipse cx="33" cy="72" rx="6" ry="4" fill="#ff9d9d" opacity="0.65"/><ellipse cx="87" cy="72" rx="6" ry="4" fill="#ff9d9d" opacity="0.65"/>`;
}

/* ---------------- 头顶元素装饰 ---------------- */
function crestSVG(crest: PetLook["crest"], c: PetColors): string {
  switch (crest) {
    case "fire":
      return `<path d="M60 8 Q72 18 66 30 Q63 26 60 24 Q57 30 52 28 Q48 18 60 8 Z" fill="${c.main}" stroke="${OUTLINE}" stroke-width="2.5" ${S}/><path d="M60 16 Q65 21 62 27 Q60 25 58 26 Q57 20 60 16 Z" fill="${c.sub}"/>`;
    case "water":
      return `<path d="M60 10 Q70 24 66 30 Q60 36 54 30 Q50 24 60 10 Z" fill="${c.main}" stroke="${OUTLINE}" stroke-width="2.5" ${S}/><circle cx="57" cy="26" r="2.5" fill="#fff" opacity="0.8"/>`;
    case "grass":
      return `<path d="M60 32 Q48 28 46 14 Q58 16 60 28 Z" fill="${c.sub}" stroke="${OUTLINE}" stroke-width="2.5" ${S}/><path d="M60 32 Q72 28 74 14 Q62 16 60 28 Z" fill="${c.main}" stroke="${OUTLINE}" stroke-width="2.5" ${S}/>`;
    case "electric":
      return `<path d="M62 6 L52 22 L59 22 L56 34 L68 16 L61 16 Z" fill="${c.sub}" stroke="${OUTLINE}" stroke-width="2.5" ${S}/>`;
    case "shadow":
      return `<path d="M40 22 Q36 10 44 6 Q46 16 52 20 Z" fill="${c.deep}" stroke="${OUTLINE}" stroke-width="2.5" ${S}/><path d="M80 22 Q84 10 76 6 Q74 16 68 20 Z" fill="${c.deep}" stroke="${OUTLINE}" stroke-width="2.5" ${S}/>`;
    default:
      return `<path d="M56 30 Q60 22 64 30" fill="none" stroke="${c.deep}" stroke-width="3.5" ${S}/>`;
  }
}

function glassesSVG(): string {
  return `<circle cx="46" cy="62" r="12.5" fill="rgba(255,255,255,0.28)" stroke="${OUTLINE}" stroke-width="4.5" ${S}/><circle cx="74" cy="62" r="12.5" fill="rgba(255,255,255,0.28)" stroke="${OUTLINE}" stroke-width="4.5" ${S}/><path d="M58.5 61 Q60 59.5 61.5 61" fill="none" stroke="${OUTLINE}" stroke-width="4" ${S}/><path d="M33.5 60 L24 55" fill="none" stroke="${OUTLINE}" stroke-width="4" ${S}/><path d="M86.5 60 L96 55" fill="none" stroke="${OUTLINE}" stroke-width="4" ${S}/>`;
}

/** 生成一只宠物的完整 SVG 字符串 */
export function petSVG(look: PetLook, opts?: { blush?: boolean }): string {
  const c = look.colors;
  const shadow = `<ellipse cx="60" cy="109" rx="30" ry="6" fill="rgba(74,55,55,0.18)"/>`;
  const inner =
    shadow +
    tailSVG(look.tail, c) +
    earsSVG(look.ears, c) +
    bodySVG(look.body, c) +
    patternSVG(look.pattern, c) +
    feetSVG(c) +
    armsSVG(c) +
    (opts?.blush ? blushSVG() : "") +
    eyesSVG(look.eyes, c.deep) +
    mouthSVG(look.mouth) +
    (look.glasses ? glassesSVG() : "") +
    crestSVG(look.crest, c);
  return wrap(inner);
}
