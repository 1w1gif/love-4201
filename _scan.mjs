import { readFileSync, readdirSync, statSync } from "fs";
import { join } from "path";

function walk(dir) {
  let out = [];
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    const s = statSync(p);
    if (s.isDirectory()) out.push(...walk(p));
    else if (/\.(tsx?|css)$/.test(name)) out.push(p);
  }
  return out;
}

let hits = 0;
for (const f of walk("apps/web/src")) {
  const lines = readFileSync(f, "utf-8").split("\n");
  lines.forEach((line, i) => {
    if (/((href|src)\s*=\s*"|fetch\(\s*[`"'])\/(?!\/)/.test(line)) {
      hits++;
      console.log(`${f}:${i + 1}: ${line.trim().slice(0, 100)}`);
    }
  });
}
console.log("TOTAL:", hits);
