// 广场数据类型定义(plaza-db / plaza-db.node / plaza-seed 共用)
import type { CharacterLook } from "@maomao/art-engine";

export interface PlazaPetInfo {
  name: string;
  speciesId: string;
  level: number;
}

export interface PlazaPlayer {
  id: string;
  name: string;
  pin: string;
  isMock: boolean;
  look: CharacterLook | null;
  outfitId: string;
  pet: PlazaPetInfo | null;
  record: { w: number; l: number };
  /** 主战宠物等级(排行榜用),玩家同步档案时更新 */
  level: number;
  createdAt: number;
}

export interface PlazaBond {
  id: string;
  a: string;
  b: string;
  points: number;
  lastGreet: string; // YYYY-MM-DD
  createdAt: number;
}

export interface PlazaRequest {
  id: string;
  from: string;
  to: string;
  createdAt: number;
}

export interface DB {
  players: PlazaPlayer[];
  bonds: PlazaBond[];
  requests: PlazaRequest[];
  sessions: Record<string, string>; // token -> playerId
}
