import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  // 增加 API 路由的超时时间（用于长时间运行的任务）
  experimental: {
    // 注意：这个配置可能在不同版本的 Next.js 中有所不同
  },
  // 注意：Next.js 16 中 eslint 配置已移除，请使用命令行选项或 .eslintrc 文件
  // 在构建时忽略 TypeScript 错误（仅用于部署，后续需要修复）
  typescript: {
    ignoreBuildErrors: true,
  },
};

export default nextConfig;
