import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["firebase/tests/**/*.test.ts"],
    environment: "node",
    testTimeout: 20000,
    fileParallelism: false,
  },
});
