// 补录 next@15.4.11 顶层 lock 条目(CI 严格校验要求,本地 npm 只写在 workspace 子目录)
const fs = require("fs");
const path = process.argv[2] || "package-lock.json";
const lock = JSON.parse(fs.readFileSync(path, "utf8"));
if (!lock.packages["node_modules/next"]) {
  const wsNext = lock.packages["apps/web/node_modules/next"];
  if (!wsNext) throw new Error("workspace next entry not found");
  lock.packages["node_modules/next"] = { ...wsNext };
  fs.writeFileSync(path, JSON.stringify(lock, null, 2));
}
const check = JSON.parse(fs.readFileSync(path, "utf8"));
console.log("top-level next:", check.packages["node_modules/next"]?.version ?? "MISSING");
