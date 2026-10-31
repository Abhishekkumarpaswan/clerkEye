import { defineConfig } from "vitest/config";
import tsconfigPaths from "vite-tsconfig-paths";

// Used only by `pnpm eval:matcher` / `pnpm eval:pipeline`: these run files that
// *write* eval/report.md, so they are kept out of the normal unit test glob.
export default defineConfig({
  plugins: [tsconfigPaths()],
  test: {
    environment: "node",
    include: ["eval/**/*.eval.ts"],
    testTimeout: 120_000,
    reporters: ["default"],
  },
});
