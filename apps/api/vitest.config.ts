import swc from "unplugin-swc";
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["test/**/*.test.ts"],
    // Starts a real Postgres when nothing has supplied one, so the suite runs on a bare
    // checkout. It runs before the workers fork, which is what lets it hand them the
    // connection strings through the environment.
    globalSetup: ["test/setup/database.ts"],
    // The suite talks to one Postgres and shares lockout rows keyed on email, so the
    // files run in sequence rather than racing each other.
    fileParallelism: false,
    hookTimeout: 60_000,
  },
  // esbuild cannot emit design:paramtypes, which is what Nest reads to resolve a
  // constructor parameter typed as a class. Without this the container injects
  // undefined and every controller fails at the first call.
  plugins: [swc.vite({ module: { type: "es6" } })],
});
