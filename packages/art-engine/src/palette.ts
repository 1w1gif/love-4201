/** 调色板：整体走"圆滚滚奶油风"——低饱和粉彩 + 深可可色描边。 */

export const OUTLINE = "#4a3737"; // 所有形象的统一描边色（暖深棕，比纯黑柔和）
export const OUTLINE_SOFT = "rgba(74,55,55,0.35)";

export const SKIN_TONES = [
  "#ffe3c8",
  "#fcd0a8",
  "#f2b58c",
  "#d9975f",
  "#b0713e",
];

export const HAIR_COLORS = [
  "#3f3245", // 深紫黑
  "#6b4a3a", // 棕
  "#a86a3d", // 栗
  "#e8b04b", // 金
  "#d96a4f", // 红棕
  "#7a8cd8", // 蓝紫
  "#5fae8e", // 薄荷绿
  "#e07a9b", // 粉
];

export const OUTFIT_COLORS = [
  "#f6d55c",
  "#f39a6b",
  "#ef6f6f",
  "#e07a9b",
  "#b78ed8",
  "#7a8cd8",
  "#5fae8e",
  "#57b8c9",
  "#8a9a6b",
  "#f5efe0",
];

export const EYE_COLORS = [
  "#4a3737",
  "#6b4a2f",
  "#3d6b52",
  "#3d5a8c",
  "#8c4a6b",
];

/** 元素主题色：主色 / 副色 / 淡色 */
export const ELEMENT_PALETTES = {
  fire: { main: "#f2843c", sub: "#f6b03c", light: "#fcd9a8", deep: "#c95a2a" },
  water: { main: "#57a8d8", sub: "#7cc4e8", light: "#cfeaf6", deep: "#3a7cab" },
  grass: { main: "#6fbf73", sub: "#9ed98a", light: "#dcf2cf", deep: "#4a9155" },
  electric: { main: "#f2c94c", sub: "#f7e08a", light: "#fdf3c8", deep: "#d1a023" },
  normal: { main: "#e8c9a0", sub: "#f3e0c2", light: "#faf3e4", deep: "#b99a72" },
  shadow: { main: "#8a7a9e", sub: "#6b5a85", light: "#cfc2e0", deep: "#4a3d63" },
} as const;

export type ElementKey = keyof typeof ELEMENT_PALETTES;
