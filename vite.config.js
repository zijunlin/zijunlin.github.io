import { gameEntry } from './src/features/work-games/build-entry.js';
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [gameEntry()],
  base: "/",
  build: {
    outDir: "dist",
    emptyOutDir: true
  }
});
