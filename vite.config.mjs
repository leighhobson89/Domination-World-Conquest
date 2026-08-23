import { defineConfig } from "vite";
import fs from "node:fs";
import path from "node:path";

const ROOT = import.meta.dirname;

// Directories that must reach the browser byte-for-byte at their original URLs.
//
// `resources/` is referenced from ~100 hand-written string paths across the game
// ("resources/flags/Germany.png", "resources/svgMaster.svg", ...) and from
// `<object data="...">` in index.html, which Vite's HTML transform does not
// rewrite. `dist/` holds the pre-built UMD bundles for three/cannon/buffer-utils
// that `dices.js` needs as globals at import time.
//
// Rather than move either one (which would mean editing every string path), they
// are copied verbatim into the build output. In dev, Vite already serves any file
// under the project root at its own path, so nothing is needed there.
const VERBATIM_DIRS = ["resources", "dist"];

function copyVerbatimDirs(outDir) {
  return {
    name: "copy-verbatim-dirs",
    apply: "build",
    closeBundle() {
      for (const dir of VERBATIM_DIRS) {
        const from = path.resolve(ROOT, dir);
        if (fs.existsSync(from)) {
          fs.cpSync(from, path.resolve(ROOT, outDir, dir), { recursive: true });
        }
      }
    },
  };
}

// NOT `dist/` -- that name is already taken by the committed webpack UMD bundles,
// and Vite empties its outDir on every build.
const OUT_DIR = "build";

export default defineConfig({
  root: ".",

  // Vite's default `public/` does not exist here; VERBATIM_DIRS covers the job.
  publicDir: false,

  build: {
    outDir: OUT_DIR,
    emptyOutDir: true,
    target: "es2022",
    sourcemap: true,
  },

  server: {
    port: 3000,
    strictPort: false,
    open: false,
  },

  preview: {
    port: 4173,
    strictPort: true,
  },

  plugins: [copyVerbatimDirs(OUT_DIR)],
});
