import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["app/src/**/*.test.ts", "scripts/**/*.test.ts"],
    environment: "node",
  },
});
