import type { NextConfig } from "next";

const config: NextConfig = {
  devIndicators: false,
  transpilePackages: ["@zernio-elements/catalog", "@zernio-elements/react", "@zernio-elements/rules", "@zernio-elements/server"],
  async headers() {
    // The shadcn CLI and other tools fetch registry items cross-origin.
    return [{ source: "/r/:path*", headers: [{ key: "Access-Control-Allow-Origin", value: "*" }] }];
  },
};

export default config;
