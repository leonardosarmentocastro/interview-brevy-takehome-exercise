import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

process.env.NODE_ENV ||= "test";
process.env.DATABASE_URL ||=
  "postgres://brevy:brevy@localhost:5433/brevy_test";

export default defineConfig({
  resolve: {
    alias: [
      {
        find: /^@test\//,
        replacement: fileURLToPath(new URL("./test/", import.meta.url)),
      },
      {
        find: /^@\//,
        replacement: fileURLToPath(new URL("./src/", import.meta.url)),
      },
    ],
  },
  test: {
    globalSetup: ["./test/global-setup.ts"],
    setupFiles: ["./test/setup.ts"],
    fileParallelism: false,
  },
});
