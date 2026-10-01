// 本地 Node 环境专用的文件存储(esbuild 对 edge 打包时会评估 import() 字符串,
// 所以 Node 专有模块必须用运行时拼接的模块名加载,打包器无法静态追踪)
import type { DB } from "./plaza-db";

export async function loadDBFile(): Promise<DB> {
  const mod = "f" + "s"; // 运行时拼接,避免打包器解析
  const pathMod = "p" + "a" + "th";
  const fs = (await import(/* webpackIgnore: true */ mod)).promises;
  const path = (await import(/* webpackIgnore: true */ pathMod)).default as typeof import("path");
  const DB_PATH = path.join(process.cwd(), "data", "plaza-db.json");
  try {
    const raw = await fs.readFile(DB_PATH, "utf-8");
    return JSON.parse(raw) as DB;
  } catch {
    const { seedDB } = await import("./plaza-seed");
    const db = seedDB();
    await fs.mkdir(path.dirname(DB_PATH), { recursive: true });
    await fs.writeFile(DB_PATH, JSON.stringify(db, null, 2));
    return db;
  }
}

export async function saveDBFile(db: DB): Promise<void> {
  const mod = "f" + "s";
  const pathMod = "p" + "a" + "th";
  const fs = (await import(/* webpackIgnore: true */ mod)).promises;
  const path = (await import(/* webpackIgnore: true */ pathMod)).default as typeof import("path");
  const DB_PATH = path.join(process.cwd(), "data", "plaza-db.json");
  await fs.mkdir(path.dirname(DB_PATH), { recursive: true });
  await fs.writeFile(DB_PATH, JSON.stringify(db, null, 2));
}
