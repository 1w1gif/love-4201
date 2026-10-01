import { NextRequest, NextResponse } from "next/server";
import type { CharacterLook } from "@maomao/art-engine";
import {
  register, login, syncProfile, listPlaza, recordBattle, bondRequest, bondRespond, greet,
} from "@/lib/plaza-db";

export const runtime = "edge";
export const dynamic = "force-dynamic";

/** 从 next-on-pages 的请求上下文里取 D1 绑定,写到全局供 plaza-db 使用 */
function bindD1(req: NextRequest) {
  const env = (req as unknown as {
    cf?: { env?: { DB?: D1Database } };
  }).cf?.env;
  if (env?.DB) {
    (globalThis as unknown as { __env?: { DB?: D1Database } }).__env = { DB: env.DB };
  }
}

export async function GET(req: NextRequest) {
  bindD1(req);
  const token = req.nextUrl.searchParams.get("token") ?? undefined;
  const data = await listPlaza(token);
  return NextResponse.json(data);
}

export async function POST(req: NextRequest) {
  bindD1(req);
  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body || typeof body.action !== "string") {
    return NextResponse.json({ error: "bad request" }, { status: 400 });
  }
  let result: unknown;
  switch (body.action) {
    case "register":
      result = await register(String(body.name ?? ""), String(body.pin ?? ""));
      break;
    case "login":
      result = await login(String(body.name ?? ""), String(body.pin ?? ""));
      break;
    case "sync":
      result = await syncProfile(
        String(body.token ?? ""),
        body.profile as { look: CharacterLook; outfitId: string; pet: { name: string; speciesId: string; level: number } }
      );
      break;
    case "recordBattle":
      result = await recordBattle(String(body.token ?? ""), String(body.opponentId ?? ""), Boolean(body.won));
      break;
    case "bondRequest":
      result = await bondRequest(String(body.token ?? ""), String(body.targetId ?? ""));
      break;
    case "bondRespond":
      result = await bondRespond(String(body.token ?? ""), String(body.requestId ?? ""), Boolean(body.accept));
      break;
    case "greet":
      result = await greet(String(body.token ?? ""), String(body.targetId ?? ""));
      break;
    default:
      return NextResponse.json({ error: "unknown action" }, { status: 400 });
  }
  return NextResponse.json(result);
}
