import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

process.env.NODE_ENV ||= "test";

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
});
