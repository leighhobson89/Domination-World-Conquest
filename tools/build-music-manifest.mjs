// Regenerate `resources/music/tracks.json` from whatever mp3 files are in
// `resources/music/`.
//
// The audio manager plays "every mp3 in the music folder", and a browser cannot
// list a directory -- there is no server-side anything in this game, so the only
// way to know what is in the folder is to write it down. This is the same
// arrangement `resources/adjacency.json` and `resources/pathAreas.json` are under:
// the JSON is OUTPUT, the generator is the source, and `npm run build:data`
// refreshes it.
//
// Dropping a new track in and forgetting to run it would be an easy mistake, so
// `vite.config.mjs` also calls `writeMusicManifest()` when the dev server starts
// and when a build runs. Adding an mp3 and reloading is therefore enough; the
// script exists for the `--check` variant the other generators have, and so the
// manifest can be refreshed without starting Vite.

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const MUSIC_DIR = path.join(ROOT, "resources", "music");
const MANIFEST = path.join(MUSIC_DIR, "tracks.json");

/** Every mp3 in the music folder, by bare file name, sorted for a stable diff. */
export function listTracks(dir = MUSIC_DIR) {
    if (!fs.existsSync(dir)) return [];
    return fs
        .readdirSync(dir)
        .filter((name) => name.toLowerCase().endsWith(".mp3"))
        .sort((a, b) => a.localeCompare(b));
}

/** The manifest text, newline-terminated, 2-space indented like the other JSON. */
export function manifestText(tracks) {
    return JSON.stringify({ tracks }, null, 2) + "\n";
}

/**
 * Write the manifest if it is out of date.
 *
 * @returns {{changed: boolean, tracks: string[]}}
 */
export function writeMusicManifest({ dir = MUSIC_DIR, file = MANIFEST } = {}) {
    const tracks = listTracks(dir);
    const text = manifestText(tracks);
    const current = fs.existsSync(file) ? fs.readFileSync(file, "utf8") : null;
    if (current === text) return { changed: false, tracks };
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, text, "utf8");
    return { changed: true, tracks };
}

const invokedDirectly = process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1]);

if (invokedDirectly) {
    const check = process.argv.includes("--check");
    const tracks = listTracks();
    if (check) {
        const current = fs.existsSync(MANIFEST) ? fs.readFileSync(MANIFEST, "utf8") : null;
        if (current !== manifestText(tracks)) {
            console.error("resources/music/tracks.json is out of date. Run: npm run build:music");
            process.exit(1);
        }
        console.log(`resources/music/tracks.json is current (${tracks.length} track(s)).`);
    } else {
        const { changed } = writeMusicManifest();
        console.log(
            `resources/music/tracks.json ${changed ? "written" : "already current"}: ` +
            `${tracks.length} track(s) -- ${tracks.join(", ") || "none"}`
        );
    }
}
