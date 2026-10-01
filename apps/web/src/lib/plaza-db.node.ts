// 本地 Node 环境专用的文件存储
// esbuild 会做常量折叠,即使 "f"+"s" 也能被静态解析;
// 唯一可靠的办法:用运行时构造的标识符索引模块,打包器完全无法追踪。
import type { DB } from "./plaza-db";

type NodeRequire = (id: string) => unknown;

/** 运行时获取 Node 的 require(esbuild 产物在 Workers 里不会执行此路径) */
function nodeRequire(): NodeRequire | null {
  // eslint-disable-next-line @typescript-eslint/no-implied-eval
  const rt = (0, eval)("typeof require === 'function' ? require : null") as NodeRequire | null;
  return rt;
}

export async function loadDBFile(): Promise<DB> {
  const req = nodeRequire();
  if (!req) throw new Error("local file mode requires Node.js runtime");
  const fs = req("fs") as typeof import("fs");
  const path = req("path") as typeof import("path");
  const DB_PATH = path.join(process.cwd(), "data", "plaza-db.json");
  try {
    const raw = await fs.promises.readFile(DB_PATH, "utf-8");
    return JSON.parse(raw) as DB;
  } catch {
    const { seedDB } = await import("./plaza-seed");
    const db = seedDB();
    await fs.promises.mkdir(path.dirname(DB_PATH), { recursive: true });
    await fs.promises.writeFile(DB_PATH, JSON.stringify(db, null, 2));
    return db;
  }
}

export async function saveDBFile(db: DB): Promise<void> {
  const req = nodeRequire();
  if (!req) throw new Error("local file mode requires Node.js runtime");
  const fs = req("fs") as typeof import("fs");
  const path = req("path") as typeof import("path");
  const DB_PATH = path.join(process.cwd(), "data", "plaza-db.json");
  await fs.promises.mkdir(path.dirname(DB_PATH), { recursive: true });
  await fs.promises.writeFile(DB_PATH, JSON.stringify(db, null, 2));
}
