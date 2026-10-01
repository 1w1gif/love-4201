import type { CharacterLook } from "@maomao/art-engine";

/** 广场客户端 API 封装 */

export interface PlazaPetInfo {
  name: string;
  speciesId: string;
  level: number;
}

export interface PlazaPlayerPublic {
  id: string;
  name: string;
  isMock: boolean;
  look: CharacterLook | null;
  outfitId: string;
  pet: PlazaPetInfo | null;
  record: { w: number; l: number };
  level: number;
}

export interface PlazaBondInfo {
  id: string;
  points: number;
  lastGreet: string;
  other: PlazaPlayerPublic;
}

export interface PlazaRequestInfo {
  id: string;
  from: PlazaPlayerPublic;
}

export interface LeaderboardRow {
  rank: number;
  level: number;
  name: string;
  isMock: boolean;
  isMe: boolean;
  record: { w: number; l: number };
}

export interface PlazaData {
  players: PlazaPlayerPublic[];
  bonds: PlazaBondInfo[];
  requests: PlazaRequestInfo[];
  leaderboard: LeaderboardRow[];
  me: PlazaPlayerPublic | null;
}

// basePath 由 next.config.ts 注入到 NEXT_PUBLIC_BASE_PATH（构建时读取）
const BASE = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

export async function plazaGet(token?: string): Promise<PlazaData> {
  const r = await fetch(`${BASE}/api/plaza${token ? `?token=${encodeURIComponent(token)}` : ""}`, { cache: "no-store" });
  return r.json();
}

export async function plazaPost<T = Record<string, unknown>>(body: Record<string, unknown>): Promise<T & { error?: string }> {
  const r = await fetch(`${BASE}/api/plaza`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return r.json();
}

export function tierOf(points: number): { key: "friend" | "bestie" | "partner"; name: string; next: number | null } {
  if (points >= 80) return { key: "partner", name: "灵魂羁绊", next: null };
  if (points >= 30) return { key: "bestie", name: "挚友", next: 80 };
  return { key: "friend", name: "朋友", next: 30 };
}
