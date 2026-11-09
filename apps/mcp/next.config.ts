import type { NextConfig } from "next";

const config: NextConfig = {
  transpilePackages: ["@zernio-elements/rules", "@zernio-elements/server", "@zernio-elements/catalog"],
};

export default config;
