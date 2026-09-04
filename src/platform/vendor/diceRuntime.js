// Loading three.js and cannon-es, on demand.
//
// Battle overhaul B.10.3, and this file IS the decision that item asked for: **`dist/` comes off
// the critical path.**
//
// What it was. `index.html` loaded three classic scripts before anything else:
//
//     <script src="./dist/cannon-bundle.js"></script>       124 KB
//     <script src="./dist/three-bundle.js"></script>         646 KB
//     <script src="./dist/bufferutils-bundle.js"></script>    14 KB
//
// Eight hundred kilobytes, parsed and evaluated on every single page view, blocking the parser,
// in service of a canvas that is empty until the player opens a battle -- which most page views
// never do at all. Before B.6.5 wired the dice up they were being loaded for a feature that was
// switched off; now they are loaded for one that is used a few times a session.
//
// WHY NOT `defer`. It would stop the parser blocking, which is most of the latency, but the
// bytes still travel and still evaluate on the way to the main menu. The whole point of the
// audit item is that the cost is avoidable, not merely mistimeable.
//
// WHY THE SCRIPTS ARE STILL CLASSIC, AND STILL IN `dist/`. CLAUDE.md is emphatic: `index.html`
// loads the game's entry modules against the SOURCE files, so every import in the codebase is a
// relative path the browser resolves itself, and `import * as THREE from "three"` is something
// only a bundler can resolve. Outside Vite the browser rejects it at module-evaluation time
// inside the bootstrap chain, and the symptom is a page that never reaches the main menu. So
// these stay committed UMD bundles that set globals, exactly as they were -- what changes is
// only WHEN the tags are added to the document.
//
// THE CONTRACT. `load()` resolves once `window.THREE`, `window.CANNON` and the buffer utilities
// are all defined. It is idempotent and concurrent-safe: every caller gets the same promise, so
// two rounds resolving at once cannot inject six script tags. Order is preserved -- the buffer
// utilities extend `THREE` and must not run before it -- by loading them in sequence rather than
// in parallel, which costs one round trip on the first battle of a session and nothing
// afterwards.

/**
 * In document order. `bufferutils` attaches to `THREE`, so it goes last, and `cannon` is
 * independent but is listed first to match what `index.html` used to do.
 */
const BUNDLES = Object.freeze([
    "./dist/cannon-bundle.js",
    "./dist/three-bundle.js",
    "./dist/bufferutils-bundle.js"
]);

let loading = null;

/** Are the globals already present? True after the first successful load. */
export function diceRuntimeLoaded() {
    return typeof window !== "undefined"
        && typeof window.THREE !== "undefined"
        && typeof window.CANNON !== "undefined";
}

function loadScript(source) {
    return new Promise((resolve, reject) => {
        const existing = document.querySelector(`script[src="${source}"]`);
        if (existing) {
            //Already in the document -- either from a previous call or because someone put the
            //tag back in index.html. Either way there is nothing to add.
            resolve();
            return;
        }
        const script = document.createElement("script");
        script.src = source;
        //NOT `async`. These three have to evaluate in order, and `async` on an injected script
        //is the default -- which would let the buffer utilities run before THREE exists.
        script.async = false;
        script.addEventListener("load", () => resolve(), { once: true });
        script.addEventListener("error", () =>
            reject(new Error(`dice runtime: ${source} failed to load`)), { once: true });
        document.head.appendChild(script);
    });
}

/**
 * Load the physics and rendering runtime, once.
 *
 * @returns {Promise<boolean>} true once the globals are available; rejects if a bundle 404s.
 */
export function loadDiceRuntime() {
    if (diceRuntimeLoaded()) {
        return Promise.resolve(true);
    }
    if (loading) {
        return loading;
    }
    loading = (async () => {
        for (const bundle of BUNDLES) {
            await loadScript(bundle);
        }
        if (!diceRuntimeLoaded()) {
            //A bundle loaded but did not define what it was supposed to. Failing loudly here is
            //much better than the alternative, which is a `THREE is not defined` thrown from
            //inside a physics loop three calls deeper.
            throw new Error("dice runtime: the bundles loaded but THREE/CANNON are not defined");
        }
        return true;
    })();
    //A failed load must not poison every later attempt: a battle two turns from now deserves a
    //fresh try, and the caller already treats a failed roll as cosmetic.
    loading.catch(() => {
        loading = null;
    });
    return loading;
}
