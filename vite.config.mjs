import { defineConfig } from "vite";
import fs from "node:fs";
import path from "node:path";
import { writeMusicManifest } from "./tools/build-music-manifest.mjs";

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

// `resources/music/tracks.json` is the list of mp3s the audio manager shuffles
// through. A browser cannot read a directory and there is no server here, so the
// folder listing has to be written down -- and the one thing that must never
// happen is a track being dropped into `resources/music/` and silently ignored.
// Regenerating it whenever Vite starts or builds means adding an mp3 and
// reloading is the whole procedure; `npm run build:music` does the same job
// without Vite. See `tools/build-music-manifest.mjs`.
function refreshMusicManifest() {
  return {
    name: "refresh-music-manifest",
    buildStart() {
      writeMusicManifest();
    },
    configureServer() {
      writeMusicManifest();
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

  // There are deliberately no `optimizeDeps` and no bare-specifier imports anywhere
  // in the game. `index.html` loads the entry modules as plain `<script
  // type="module">` tags against the SOURCE files, so anything the browser cannot
  // resolve on its own breaks the page outside Vite -- see
  // `src/platform/vendor/lz-string.js`, which is vendored for exactly that reason.

  server: {
    port: 3000,
    strictPort: false,
    open: false,
  },

  preview: {
    port: 4173,
    strictPort: true,
  },

  plugins: [refreshMusicManifest(), copyVerbatimDirs(OUT_DIR)],
});
