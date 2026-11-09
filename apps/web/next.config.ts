import type { NextConfig } from "next";

const config: NextConfig = {
  transpilePackages: ["@zernio-elements/catalog", "@zernio-elements/react", "@zernio-elements/rules", "@zernio-elements/server"],
};

export default config;
