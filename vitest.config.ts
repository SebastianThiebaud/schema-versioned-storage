import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    include: ["**/__tests__/**/*.test.ts"],
    exclude: ["**/node_modules/**", "**/dist/**"],
    coverage: {
      provider: "v8",
      reporter: ["text", "json", "html"],
      include: ["src/**/*.ts", "scripts/lib/**/*.ts"],
      exclude: [
        "node_modules/",
        "**/__tests__/**",
        "**/*.test.ts",
        "**/templates/**",
        "**/examples/**",
        "**/schema-hashes.ts",
        "**/migrations/index.ts",
        "src/adapters/async-storage.ts", // React Native specific, requires RN environment for full coverage
        "scripts/**/*.mjs", // CLI entry points, tested via integration tests
      ],
    },
  },
  resolve: {
    alias: {
      "@": "./src",
    },
  },
});
