import swc from "unplugin-swc";
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["test/**/*.test.ts"],
    // The suite talks to one Postgres and shares lockout rows keyed on email, so the
    // files run in sequence rather than racing each other.
    fileParallelism: false,
    hookTimeout: 30_000,
  },
  // esbuild cannot emit design:paramtypes, which is what Nest reads to resolve a
  // constructor parameter typed as a class. Without this the container injects
  // undefined and every controller fails at the first call.
  plugins: [swc.vite({ module: { type: "es6" } })],
});
