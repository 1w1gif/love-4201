const { spawnSync } = require("child_process");
// next-on-pages does: spawn("npx", ["vercel", "build"]) with no shell.
// On Windows, spawn() without shell:true only finds .exe files (not .cmd),
// and "npx" is npx.cmd — hence ENOENT. Same for "bash".
// Fix: create real .exe shims is overkill; instead we pre-install a tiny
// package that provides an npx.exe? Simplest robust fix: use npm exec form by
// patching spawn — but we can't patch the lib easily.
// Actually Node's spawn on Windows DOES check PATHEXT via libuv (CreateProcess
// resolves .cmd only with shell). Without shell it fails. So we must put a
// real npx.exe on PATH. Node ships none, but we can compile a 2-line exe?
// No compiler needed: use a copy of node.exe named npx.exe won't work (arg0 differs).
// Instead: use the shim approach that DOES work — generate a "npx.exe" is not
// possible without compiler, so we monkey-patch child_process.spawn inside a
// bootstrap that runs BEFORE loading next-on-pages.
const cp = require("child_process");
const path = require("path");
const origSpawn = cp.spawn;
cp.spawn = function patchedSpawn(cmd, args, opts) {
  if (cmd === "npx" && process.platform === "win32") {
    return origSpawn.call(this, "npx.cmd", args, opts);
  }
  return origSpawn.apply(this, arguments);
};
// bash: git's bash.exe — put real bash on PATH instead of patching (it's a real exe)
process.env.PATH = "C:\\Users\\WJH\\.zcode\\tools\\PortableGit\\bin;" + process.env.PATH;

require(path.resolve(process.cwd(), "node_modules/@cloudflare/next-on-pages/dist/index.js"));
