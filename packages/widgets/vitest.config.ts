import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    // build.test and the render-view bridge test both (re)build dist/; run files one at a time.
    fileParallelism: false,
  },
});
