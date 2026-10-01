import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@maomao/art-engine", "@maomao/game-core"],
  // 部署到个人主页的 /game/ 子路径下。
  // 想单独以根路径跑（比如本地 npm run dev），设置环境变量 NO_BASE_PATH=1 即可。
  basePath: process.env.NO_BASE_PATH ? undefined : "/game",
  env: {
    // 与 basePath 保持一致，供客户端 fetch 使用
    NEXT_PUBLIC_BASE_PATH: process.env.NO_BASE_PATH ? "" : "/game",
  },
};

export default nextConfig;

