import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  // 增加 API 路由的超时时间（用于长时间运行的任务）
  experimental: {
    // 注意：这个配置可能在不同版本的 Next.js 中有所不同
  },
};

export default nextConfig;
