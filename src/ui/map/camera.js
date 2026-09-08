// The map camera: zoom level, the viewBox, and drag-to-pan.
//
// Phase 6.7. This was ~230 lines in `ui.js` reading and writing eight module-level
// `let`s that nothing else had any business touching -- `zoomLevel`, `isDragging`,
// `lastMouseX/Y`, `isAnimating`, and the three `animationStart*` handles. They are
// closed over here instead, so the only way to move the camera is through this
// module's exported functions.
//
// Two SVG documents are kept in step: the territory map and the coastline overlay
// beneath it. They have different origins (`ORIGIN_MAIN` vs `ORIGIN_COASTLINE`) but
// identical dimensions, so the coastline viewBox is always the main one plus a fixed
// offset. Deriving it that way rather than computing it twice is what guarantees the
// two layers cannot drift -- letting them drift is what makes the coastlines slide
// out from under the land.
//
// --- what changed in 6.7, and why --------------------------------------------
//
// **Zoom is instant.** It used to interpolate the viewBox over 500 ms through
// `requestAnimationFrame`, guarded by an `isAnimating` latch that DROPPED any wheel
// event arriving mid-flight -- so a quick double-scroll moved one step, not two.
// The animation is gone at the developer's request and the latch went with it,
// because there is no longer anything to be in the middle of.
//
// **Zoom is anchored to the pointer.** The old code centred the new viewBox on the
// pointer with two hard-coded fudge offsets (`+ 280`, `+ 150`) that only ever
// approximated the mapping between client pixels and user units. It now converts the
// pointer to user coordinates properly -- honouring `preserveAspectRatio="xMidYMid
// meet"`, which letterboxes the viewBox inside the element -- and solves for the
// viewBox that leaves the point under the cursor exactly where it is. The result is
// clamped to the original bounds, so no zoom or pan can ever show empty space past
// the edge of the world.
//
// The camera reads no game state and writes none. It is pure view.

const ORIGIN_MAIN = { x: 312, y: -207, width: 1947, height: 1040 };
const ORIGIN_COASTLINE = { x: 1072, y: 158, width: 1947, height: 1040 };

// The coastline layer is the main layer shifted by a constant. Both are 1947x1040.
const COASTLINE_OFFSET_X = ORIGIN_COASTLINE.x - ORIGIN_MAIN.x;
const COASTLINE_OFFSET_Y = ORIGIN_COASTLINE.y - ORIGIN_MAIN.y;

const MAX_ZOOM_LEVEL = 6;

// The visible fraction of the original viewBox at each zoom level, indexed by level.
// Index 0 is unused so the table reads as 1-based, matching the level itself. These
// are the six branches of the `if (zoomLevel === n)` ladder this replaced.
const ZOOM_SCALE = [null, 1, 0.8, 0.6, 0.4, 0.3, 0.2];

let mainTag = null;
let coastLineTag = null;

let zoomLevel = 1;
let dragging = false;
let lastMouseX = 0;
let lastMouseY = 0;

/**
 * How far the pointer may travel during a press and still count as a click, in screen pixels.
 *
 * Not zero, and that is the point of having a number at all: a click made with a real hand
 * moves a pixel or two between the button going down and coming up, so "moved at all" would
 * suppress legitimate clicks. Four pixels is under the width of a border and far under any
 * pan a player makes on purpose.
 */
const PAN_SLOP_PX = 4;

//How far this press has travelled, and whether the press that just finished was a PAN. The
//second is what the click arriving afterwards has to ask -- see `endedInPan()`.
let pressTravel = 0;
let pressWasPan = false;

// Anything that draws in map user units but has to stay a constant size ON SCREEN has
// to be told when the magnification changes. The attack arrows are the only subscriber
// today. Deliberately fired from `zoomMap()` and not from `commit()`: a pan changes the
// origin and not the scale, and `commit()` runs on every mousemove of a drag.
const zoomListeners = new Set();

/**
 * Be told when the zoom level changes. Returns its own remover, the same contract
 * `src/ui/core/dom.js`'s `on()` has.
 */
export function onZoomChanged(listener) {
    zoomListeners.add(listener);
    return () => zoomListeners.delete(listener);
}

function announceZoom() {
    for (const listener of zoomListeners) {
        listener(zoomLevel);
    }
}

/** Point the camera at the two `<svg>` elements. Called once, from `svgMapLoaded()`. */
export function attachCamera(svgTag, svgCoastLinesTag) {
    mainTag = svgTag;
    coastLineTag = svgCoastLinesTag;
}

export function currentZoomLevel() {
    return zoomLevel;
}

/**
 * The whole world, in map user units -- the viewBox before any zoom or pan.
 *
 * Exported for the cloud overlay, which is the one thing on the map that has to place itself
 * across the WORLD rather than across the view: a cloud drifts off one edge and wraps back in
 * at the other, and the current viewBox is a window onto that, not the extent of it. A copy is
 * returned rather than the constant itself, because it is the only fixed fact the camera has
 * and a caller that mutated it would move the edge of the world.
 */
export function worldBounds() {
    return { ...ORIGIN_MAIN };
}

/** Set the level without moving the view. */
export function setZoomLevel(value) {
    zoomLevel = value;
    return zoomLevel;
}

export function isDragging() {
    return dragging;
}

/**
 * Did the press that has just finished move the map?
 *
 * **`isDragging()` CANNOT ANSWER THIS, AND THAT IS THE BUG THIS EXISTS FOR.** The browser fires
 * `mouseup` before `click`, and `mouseup` is where `endDrag()` clears the flag -- so by the
 * time a click handler runs, `isDragging()` is false whether the player clicked or dragged
 * halfway across the world. Every `if (!isDragging())` inside a click handler is therefore
 * always true, which is why dragging the relief map dropped it back to the political map on
 * release: the click that ended the pan was treated as a click on a territory, and clicking a
 * territory is what leaves the relief.
 *
 * The flag is set by `endDrag()` and cleared by the next `beginDrag()`, so it describes exactly
 * one gesture: the one whose click is about to arrive.
 */
export function endedInPan() {
    return pressWasPan;
}

function clamp(value, min, max) {
    // A viewBox wider than its bounds gives max < min; pin to min rather than to a
    // NaN-ish inversion, which is what would put the map off the edge of the world.
    return max < min ? min : Math.max(min, Math.min(max, value));
}

function parseViewBox(tag) {
    const [x, y, width, height] = tag.getAttribute("viewBox").split(" ").map(parseFloat);
    return { x, y, width, height };
}

function writeViewBox(tag, box) {
    tag.setAttribute("viewBox", `${box.x} ${box.y} ${box.width} ${box.height}`);
}

/**
 * The main viewBox, and the coastline viewBox derived from it, written together.
 *
 * `box` is clamped to `ORIGIN_MAIN` first: every caller wants the same guarantee,
 * which is that nothing outside the original bounds is ever on screen.
 */
function commit(box) {
    const width = Math.min(box.width, ORIGIN_MAIN.width);
    const height = Math.min(box.height, ORIGIN_MAIN.height);

    const x = clamp(box.x, ORIGIN_MAIN.x, ORIGIN_MAIN.x + ORIGIN_MAIN.width - width);
    const y = clamp(box.y, ORIGIN_MAIN.y, ORIGIN_MAIN.y + ORIGIN_MAIN.height - height);

    writeViewBox(mainTag, { x, y, width, height });
    writeViewBox(coastLineTag, {
        x: x + COASTLINE_OFFSET_X,
        y: y + COASTLINE_OFFSET_Y,
        width,
        height
    });
}

/**
 * Where a client-space point falls in the main layer's user coordinates, as a
 * fraction of the current viewBox in each axis.
 *
 * The SVG default `preserveAspectRatio="xMidYMid meet"` scales the viewBox uniformly
 * to fit the element and centres the remainder, so the mapping is not simply
 * `offset / elementWidth` whenever the element's aspect ratio differs from the
 * viewBox's. Getting this wrong is what the old `+ 280` / `+ 150` constants were
 * papering over.
 *
 * @returns {{fx: number, fy: number}} both in [0, 1]
 */
function pointerFractionOfViewBox(clientX, clientY) {
    const rect = mainTag.getBoundingClientRect();
    const box = parseViewBox(mainTag);

    if (!rect.width || !rect.height) {
        return { fx: 0.5, fy: 0.5 };
    }

    const renderScale = Math.min(rect.width / box.width, rect.height / box.height);
    const contentWidth = box.width * renderScale;
    const contentHeight = box.height * renderScale;
    const letterboxX = (rect.width - contentWidth) / 2;
    const letterboxY = (rect.height - contentHeight) / 2;

    const fx = (clientX - rect.left - letterboxX) / contentWidth;
    const fy = (clientY - rect.top - letterboxY) / contentHeight;

    return { fx: clamp(fx, 0, 1), fy: clamp(fy, 0, 1) };
}

/**
 * How many map user units one screen pixel covers right now.
 *
 * The same `min(rect / box)` render scale `pointerFractionOfViewBox()` solves for,
 * inverted. It is what lets something drawn INSIDE the map document be sized in
 * screen pixels: a stroke of `n * userUnitsPerPixel()` is n pixels wide at any zoom
 * level, which is the whole reason the attack arrows are redrawn when the zoom
 * changes rather than left to be magnified with the land.
 *
 * Returns 1 before the map is laid out, which is a sane arrow rather than a NaN one.
 */
export function userUnitsPerPixel() {
    if (!mainTag) {
        return 1;
    }
    const rect = mainTag.getBoundingClientRect();
    const box = parseViewBox(mainTag);
    if (!rect.width || !rect.height || !box.width || !box.height) {
        return 1;
    }
    const renderScale = Math.min(rect.width / box.width, rect.height / box.height);
    return renderScale > 0 ? 1 / renderScale : 1;
}

/**
 * A wheel event, or the literal string `"init"` to reset the camera to the whole
 * world without changing the zoom level.
 *
 * One wheel notch is one level. The point under the cursor stays under the cursor,
 * except where the clamp to the world bounds prevents it -- at which point the map
 * has hit its edge and holding the anchor would mean showing nothing.
 */
export function zoomMap(event) {
    if (event === "init") {
        commit({ ...ORIGIN_MAIN });
        announceZoom();
        return;
    }

    const delta = Math.sign(event.deltaY);
    if (delta < 0 && zoomLevel < MAX_ZOOM_LEVEL) {
        zoomLevel++;
    } else if (delta > 0 && zoomLevel > 1) {
        zoomLevel--;
    } else {
        return; // already at a clamp; a wheel event there changes nothing
    }

    const before = parseViewBox(mainTag);
    const { fx, fy } = pointerFractionOfViewBox(event.clientX, event.clientY);

    // The user-space point the pointer is over right now.
    const anchorX = before.x + fx * before.width;
    const anchorY = before.y + fy * before.height;

    const scale = ZOOM_SCALE[zoomLevel];
    const width = ORIGIN_MAIN.width * scale;
    const height = ORIGIN_MAIN.height * scale;

    // Solve for the origin that leaves the anchor at the same fraction of the box.
    commit({ x: anchorX - fx * width, y: anchorY - fy * height, width, height });
    announceZoom();
}

/** Left button down: start a drag if there is anything to pan. */
export function beginDrag(event) {
    if (event.button !== 0) {
        return;
    }
    //RESET WHETHER OR NOT A DRAG STARTS. At zoom 1 there is nothing to pan, so no drag begins
    //-- and a stale "the last gesture was a pan" left over from before the player zoomed out
    //would swallow their next click.
    pressTravel = 0;
    pressWasPan = false;
    if (zoomLevel > 1) {
        dragging = true;
        lastMouseX = event.clientX;
        lastMouseY = event.clientY;
        event.preventDefault();
    }
}

/** Left button up: stop dragging. Returns true when a drag actually ended. */
export function endDrag(event) {
    if (event.button === 0 && dragging) {
        dragging = false;
        //Remembered for the click that is about to follow. See `endedInPan()`.
        pressWasPan = pressTravel > PAN_SLOP_PX;
        return true;
    }
    return false;
}

/**
 * A mousemove. Does nothing unless the left button is held at a zoom level above 1.
 *
 * The drag moves the map by the same distance the pointer moved, in user units --
 * so the land follows the cursor rather than lagging by a factor of the zoom level,
 * which is what the old `dx / zoomLevel` did.
 */
export function panMap(event) {
    if (!dragging || zoomLevel <= 1 || event.buttons !== 1) {
        return;
    }
    event.preventDefault();

    const box = parseViewBox(mainTag);
    const rect = mainTag.getBoundingClientRect();
    const renderScale = rect.width ? Math.min(rect.width / box.width, rect.height / box.height) : 1;

    //Measured in SCREEN pixels, before the render scale is divided out: the question the slop
    //answers is "did the player's hand move", which is a fact about the screen and not about
    //how much world that happened to drag past at this zoom.
    pressTravel += Math.abs(event.clientX - lastMouseX) + Math.abs(event.clientY - lastMouseY);

    const dx = (event.clientX - lastMouseX) / renderScale;
    const dy = (event.clientY - lastMouseY) / renderScale;

    commit({ x: box.x - dx, y: box.y - dy, width: box.width, height: box.height });

    document.body.style.overflow = "hidden";

    lastMouseX = event.clientX;
    lastMouseY = event.clientY;
}
