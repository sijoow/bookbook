import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  cacheComponents: true,
  partialPrefetching: true,
  // mongodb 드라이버는 번들에서 빼서 Node 그대로 불러온다
  serverExternalPackages: ["mongodb"],
};

export default nextConfig;
