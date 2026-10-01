import { OUTLINE } from "./palette";

export type FaceShape = "round" | "square" | "egg" | "heart";
export type HairStyle = "short" | "twin" | "bun" | "spiky" | "bowl" | "curly";
export type PersonEyes = "round" | "sparkle" | "happy" | "sleepy" | "dot";
export type PersonMouth = "smile" | "grin" | "cat" | "open" | "wavy" | "pout";
export type Accessory = "none" | "glasses" | "cap" | "hairpin" | "scarf";

export interface CharacterLook {
  faceShape: FaceShape;
  skin: string;
  eyeStyle: PersonEyes;
  eyeColor: string;
  mouth: PersonMouth;
  hair: HairStyle;
  hairColor: string;
  blush: boolean;
  accessory: Accessory;
}

export interface OutfitLook {
  id: "tee" | "hoodie" | "overalls" | "dress" | "sport" | "cape";
  main: string;
  sub: string;
}

const S = 'stroke-linejoin="round" stroke-linecap="round"';
const STROKE = `stroke="${OUTLINE}" stroke-width="3" ${S}`;

/* ---------------- 头形 ---------------- */
function headSVG(f: FaceShape, skin: string): string {
  switch (f) {
    case "round":
      return `<circle cx="60" cy="62" r="32" fill="${skin}" ${STROKE}/>`;
    case "square":
      return `<rect x="28" y="32" width="64" height="60" rx="22" fill="${skin}" ${STROKE}/>`;
    case "egg":
      return `<ellipse cx="60" cy="62" rx="29" ry="34" fill="${skin}" ${STROKE}/>`;
    case "heart":
      return `<path d="M60 96 C40 90 30 72 32 54 A28 28 0 0 1 88 54 C90 72 80 90 60 96 Z" fill="${skin}" ${STROKE}/>`;
  }
}

function earsSVG(skin: string): string {
  return `<circle cx="28" cy="66" r="5.5" fill="${skin}" ${STROKE}/><circle cx="92" cy="66" r="5.5" fill="${skin}" ${STROKE}/>`;
}

/* ---------------- 表情 ---------------- */
function eyesSVG(e: PersonEyes, eyeColor: string): string {
  const brow = `<path d="M40 47 Q46 44 52 47" fill="none" stroke="${OUTLINE}" stroke-width="2.5" ${S}/><path d="M68 47 Q74 44 80 47" fill="none" stroke="${OUTLINE}" stroke-width="2.5" ${S}/>`;
  switch (e) {
    case "round":
      return `${brow}<ellipse cx="47" cy="60" rx="6" ry="7.5" fill="#fff" stroke="${OUTLINE}" stroke-width="2.5"/><ellipse cx="73" cy="60" rx="6" ry="7.5" fill="#fff" stroke="${OUTLINE}" stroke-width="2.5"/><circle cx="48" cy="61" r="3.5" fill="${eyeColor}"/><circle cx="74" cy="61" r="3.5" fill="${eyeColor}"/><circle cx="49.4" cy="58.6" r="1.4" fill="#fff"/><circle cx="75.4" cy="58.6" r="1.4" fill="#fff"/>`;
    case "sparkle":
      return `${brow}<ellipse cx="47" cy="60" rx="7" ry="8.5" fill="#fff" stroke="${OUTLINE}" stroke-width="2.5"/><ellipse cx="73" cy="60" rx="7" ry="8.5" fill="#fff" stroke="${OUTLINE}" stroke-width="2.5"/><circle cx="47" cy="60.5" r="4.8" fill="${eyeColor}"/><circle cx="73" cy="60.5" r="4.8" fill="${eyeColor}"/><circle cx="49" cy="58" r="2" fill="#fff"/><circle cx="75" cy="58" r="2" fill="#fff"/><circle cx="44.8" cy="63" r="1.1" fill="#fff"/><circle cx="70.8" cy="63" r="1.1" fill="#fff"/>`;
    case "happy":
      return `${brow}<path d="M40 61 Q47 53 54 61" fill="none" stroke="${OUTLINE}" stroke-width="3.5" ${S}/><path d="M66 61 Q73 53 80 61" fill="none" stroke="${OUTLINE}" stroke-width="3.5" ${S}/>`;
    case "sleepy":
      return `${brow}<path d="M40 59 Q47 66 54 59" fill="none" stroke="${OUTLINE}" stroke-width="3.5" ${S}/><path d="M66 59 Q73 66 80 59" fill="none" stroke="${OUTLINE}" stroke-width="3.5" ${S}/>`;
    case "dot":
      return `${brow}<circle cx="47" cy="60" r="4" fill="${OUTLINE}"/><circle cx="73" cy="60" r="4" fill="${OUTLINE}"/><circle cx="48.4" cy="58.6" r="1.3" fill="#fff"/><circle cx="74.4" cy="58.6" r="1.3" fill="#fff"/>`;
  }
}

function mouthSVG(m: PersonMouth): string {
  switch (m) {
    case "smile":
      return `<path d="M53 74 Q60 80 67 74" fill="none" stroke="${OUTLINE}" stroke-width="3" ${S}/>`;
    case "grin":
      return `<path d="M51 72 Q60 84 69 72 Z" fill="${OUTLINE}"/><path d="M56 79 Q60 83 64 79 Z" fill="#f08080"/>`;
    case "cat":
      return `<path d="M52 74 Q56 78 60 74 Q64 78 68 74" fill="none" stroke="${OUTLINE}" stroke-width="3" ${S}/>`;
    case "open":
      return `<ellipse cx="60" cy="77" rx="6" ry="7.5" fill="${OUTLINE}"/><ellipse cx="60" cy="80" rx="3.5" ry="3" fill="#f08080"/>`;
    case "wavy":
      return `<path d="M51 75 Q56 71 60 75 Q64 79 69 75" fill="none" stroke="${OUTLINE}" stroke-width="3" ${S}/>`;
    case "pout":
      return `<path d="M56 76 Q60 72 64 76" fill="none" stroke="${OUTLINE}" stroke-width="3" ${S}/><ellipse cx="60" cy="80" rx="3" ry="2" fill="#e88a8a"/>`;
  }
}

function blushSVG(): string {
  return `<ellipse cx="38" cy="70" rx="5.5" ry="3.5" fill="#ff9d9d" opacity="0.6"/><ellipse cx="82" cy="70" rx="5.5" ry="3.5" fill="#ff9d9d" opacity="0.6"/>`;
}

/* ---------------- 头发 ---------------- */
function backHairSVG(h: HairStyle, color: string): string {
  const capBack = `<path d="M27 66 Q22 24 60 22 Q98 24 93 66 Q88 40 60 40 Q32 40 27 66 Z" fill="${color}" ${STROKE}/>`;
  switch (h) {
    case "twin":
      return `${capBack}<circle cx="20" cy="76" r="13" fill="${color}" ${STROKE}/><circle cx="100" cy="76" r="13" fill="${color}" ${STROKE}/>`;
    case "curly":
      return `<circle cx="34" cy="34" r="15" fill="${color}" ${STROKE}/><circle cx="60" cy="26" r="16" fill="${color}" ${STROKE}/><circle cx="86" cy="34" r="15" fill="${color}" ${STROKE}/><circle cx="22" cy="56" r="11" fill="${color}" ${STROKE}/><circle cx="98" cy="56" r="11" fill="${color}" ${STROKE}/>`;
    case "bun":
      return `${capBack}<circle cx="60" cy="18" r="12" fill="${color}" ${STROKE}/>`;
    default:
      return capBack;
  }
}

function frontHairSVG(h: HairStyle, color: string): string {
  const top = "M27 64 Q22 24 60 22 Q98 24 93 64";
  switch (h) {
    case "short":
      return `<path d="${top} Q90 46 84 44 Q78 52 70 45 Q64 54 58 45 Q50 52 42 45 Q34 47 27 64 Z" fill="${color}" ${STROKE}/>`;
    case "twin":
      return `<path d="${top} Q90 44 82 42 Q74 50 66 42 Q60 50 54 42 Q46 50 38 42 Q32 44 27 64 Z" fill="${color}" ${STROKE}/>`;
    case "bun":
      return `<path d="${top} Q89 40 80 40 Q70 46 60 42 Q50 46 40 40 Q31 40 27 64 Z" fill="${color}" ${STROKE}/>`;
    case "spiky":
      return `<path d="${top} Q88 42 84 40 L77 52 L70 38 L61 52 L52 38 L45 52 L38 40 Q32 42 27 64 Z" fill="${color}" ${STROKE}/>`;
    case "bowl":
      return `<path d="${top} Q90 42 60 40 Q30 42 27 64 Z" fill="${color}" ${STROKE}/>`;
    case "curly":
      return `<circle cx="38" cy="40" r="10" fill="${color}" ${STROKE}/><circle cx="56" cy="34" r="11" fill="${color}" ${STROKE}/><circle cx="76" cy="38" r="10" fill="${color}" ${STROKE}/>`;
  }
}

/* ---------------- 身体 & 服装 ---------------- */
function legsSVG(o: OutfitLook): string {
  const shoe = "#9a6a4f";
  return `<rect x="45" y="128" width="9" height="16" rx="4.5" fill="${o.sub === "#f5efe0" ? "#fcd0a8" : "#fcd0a8"}" ${STROKE}/><rect x="66" y="128" width="9" height="16" rx="4.5" fill="#fcd0a8" ${STROKE}/><ellipse cx="49" cy="147" rx="9" ry="5.5" fill="${shoe}" ${STROKE}/><ellipse cx="71" cy="147" rx="9" ry="5.5" fill="${shoe}" ${STROKE}/>`;
}

function outfitSVG(o: OutfitLook): string {
  const torso = `<rect x="38" y="96" width="44" height="38" rx="14" fill="${o.main}" ${STROKE}/>`;
  switch (o.id) {
    case "tee":
      return `${torso}<path d="M52 97 Q60 104 68 97" fill="none" stroke="${OUTLINE}" stroke-width="2.5" ${S}/>`;
    case "hoodie":
      return `${torso}<path d="M44 98 Q60 88 76 98 Q60 100 44 98 Z" fill="${o.sub}" ${STROKE}/><rect x="47" y="112" width="26" height="12" rx="6" fill="${o.sub}" ${STROKE}/><path d="M54 100 L53 108" stroke="${OUTLINE}" stroke-width="2" ${S}/><path d="M66 100 L67 108" stroke="${OUTLINE}" stroke-width="2" ${S}/>`;
    case "overalls":
      return `<rect x="38" y="96" width="44" height="38" rx="14" fill="#f5efe0" ${STROKE}/><rect x="46" y="104" width="28" height="30" rx="8" fill="${o.main}" ${STROKE}/><path d="M48 104 L50 97" stroke="${OUTLINE}" stroke-width="4" ${S}/><path d="M72 104 L70 97" stroke="${OUTLINE}" stroke-width="4" ${S}/><circle cx="52" cy="108" r="2.5" fill="${o.sub}"/><circle cx="68" cy="108" r="2.5" fill="${o.sub}"/>`;
    case "dress":
      return `<path d="M42 98 L78 98 Q86 118 90 134 L30 134 Q34 118 42 98 Z" fill="${o.main}" ${STROKE}/><path d="M34 126 Q60 132 86 126" fill="none" stroke="${o.sub}" stroke-width="4" ${S}/>`;
    case "sport":
      return `${torso}<path d="M46 97 L52 133" stroke="${o.sub}" stroke-width="4" ${S}/><path d="M74 97 L68 133" stroke="${o.sub}" stroke-width="4" ${S}/><path d="M60 96 L60 134" stroke="${OUTLINE}" stroke-width="2" ${S}/>`;
    case "cape":
      return `<path d="M40 98 Q26 124 32 140 L88 140 Q94 124 80 98 Z" fill="${o.sub}" ${STROKE}/>${torso}<circle cx="60" cy="101" r="3.5" fill="${o.sub}" ${STROKE}/>`;
  }
}

function armsSVG(o: OutfitLook, skin: string): string {
  const longSleeve = o.id === "hoodie" || o.id === "sport" || o.id === "cape";
  const armFill = longSleeve ? o.main : skin;
  return `<circle cx="33" cy="112" r="7.5" fill="${armFill}" ${STROKE}/><circle cx="87" cy="112" r="7.5" fill="${armFill}" ${STROKE}/>`;
}

/* ---------------- 配饰 ---------------- */
function accessorySVG(a: Accessory, color: string): string {
  switch (a) {
    case "glasses":
      return `<circle cx="47" cy="60" r="10" fill="rgba(255,255,255,0.25)" stroke="${OUTLINE}" stroke-width="2.5"/><circle cx="73" cy="60" r="10" fill="rgba(255,255,255,0.25)" stroke="${OUTLINE}" stroke-width="2.5"/><path d="M57 60 L63 60" stroke="${OUTLINE}" stroke-width="2.5" ${S}/><path d="M37 58 L28 56" stroke="${OUTLINE}" stroke-width="2.5" ${S}/><path d="M83 58 L92 56" stroke="${OUTLINE}" stroke-width="2.5" ${S}/>`;
    case "cap":
      return `<path d="M26 42 Q30 14 60 14 Q90 14 94 42 Q60 30 26 42 Z" fill="${color}" ${STROKE}/><path d="M26 42 Q60 32 94 42 L96 48 Q60 38 24 48 Z" fill="${color}" ${STROKE}/><circle cx="60" cy="14" r="3.5" fill="${color}" ${STROKE}/>`;
    case "hairpin":
      return `<circle cx="80" cy="34" r="3.5" fill="#ffd166" ${STROKE}/><circle cx="75" cy="30" r="3.5" fill="#ff9d9d" ${STROKE}/><circle cx="85" cy="30" r="3.5" fill="#ff9d9d" ${STROKE}/><circle cx="80" cy="26" r="3.5" fill="#ffd166" ${STROKE}/>`;
    case "scarf":
      return `<rect x="42" y="92" width="36" height="11" rx="5.5" fill="${color}" ${STROKE}/><rect x="66" y="100" width="11" height="18" rx="5.5" fill="${color}" ${STROKE}/>`;
    default:
      return "";
  }
}

/** 生成主角的完整 SVG 字符串 */
export function characterSVG(look: CharacterLook, outfit: OutfitLook): string {
  const shadow = `<ellipse cx="60" cy="153" rx="28" ry="5.5" fill="rgba(74,55,55,0.18)"/>`;
  const inner =
    shadow +
    backHairSVG(look.hair, look.hairColor) +
    (outfit.id === "cape" ? outfitSVG(outfit) : "") +
    legsSVG(outfit) +
    (outfit.id === "cape" ? "" : outfitSVG(outfit)) +
    armsSVG(outfit, look.skin) +
    headSVG(look.faceShape, look.skin) +
    earsSVG(look.skin) +
    (look.blush ? blushSVG() : "") +
    eyesSVG(look.eyeStyle, look.eyeColor) +
    mouthSVG(look.mouth) +
    frontHairSVG(look.hair, look.hairColor) +
    accessorySVG(look.accessory, outfit.main);
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 160" class="art-svg">${inner}</svg>`;
}
