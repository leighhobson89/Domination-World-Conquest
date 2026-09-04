// Windows you can move, and a window that comes to the front when you touch it.
//
// Phase 7.4. Five windows float over the map -- the territory panel, Upgrade
// Territory, Buy Military, the transfer/attack window and the activity feed --
// and until now every one of them was nailed to a hard-coded percentage of the
// viewport. Two of them overlap by design (the feed opens on top of the territory
// panel at the start of every turn), which meant the only way to read what was
// underneath was to close what was on top.
//
// Three things here are less obvious than they look.
//
// **The drag moves the ANCHOR, not the element.** Every one of these windows is
// `position: fixed`, and three of them are centred with
// `transform: translate(-50%, -50%)`. Setting `left`/`top` from the bounding
// rectangle would fight that transform and jump the window by half its size on the
// first pointer move. So the drag reads the COMPUTED `left`/`top` -- which is a
// pixel value whatever the stylesheet wrote -- and shifts it. The transform is
// left completely alone.
//
// **A window anchored by its RIGHT edge is converted to a left anchor before the
// first move.** The drag only ever writes `left`/`top`, so on a window the
// stylesheet positioned with `right` (the AI game console is the one) both edges
// end up pinned -- and because its width is `auto`, pinning both edges is a
// resize, not a move: the window stretched across the whole screen as it was
// dragged. `releaseOppositeAnchors()` writes the measured `left`/`top` and clears
// `right`/`bottom` in the same breath, which is geometrically a no-op at that
// instant and leaves the element in the one anchor convention the drag can move.
//
// That is not merely tidy, it is load-bearing. `.title-transfer-attack-window` and
// `.content-transfer-header-row` are `position: fixed` INSIDE the transfer window,
// and a fixed child is positioned against the nearest ancestor with a transform.
// Take that transform off to "simplify" the drag and the transfer window's own
// header flies to the top-left corner of the screen.
//
// **Stacking is a counter, not a set of constants.** A focused window takes the
// next number above every other window. Constants cannot express "whichever one
// was touched last", which is the whole behaviour. The counter is renormalised
// rather than allowed to climb for ever -- see `bringToFront()`.
//
// **A drag starts on the handle; a FOCUS starts anywhere.** Clicking a row deep
// inside a window raises it, but only the title bar moves it. Mixing the two is
// how a table becomes impossible to select text in.

/**
 * The band these windows live in.
 *
 * Above the map chrome (9000) and below the modals (10000+): a dialog asking
 * whether to abandon the game must never end up behind the panel it was opened
 * from, which is exactly what an unbounded counter would eventually cause.
 */
export const WINDOW_Z_BASE = 9100;
const WINDOW_Z_CEILING = 9400;

/** Every window that has registered, in no particular order. */
const windows = new Set();

let topZ = WINDOW_Z_BASE;

/**
 * Put an element into the stacking group.
 *
 * Idempotent. A window that is registered but never focused keeps the base
 * z-index, which is what makes the group's default order the DOM order it had
 * before this existed.
 */
export function registerWindow(element) {
    if (!element || windows.has(element)) {
        return element;
    }
    windows.add(element);
    if (!element.style.zIndex) {
        element.style.zIndex = String(WINDOW_Z_BASE);
    }
    return element;
}

/**
 * Raise a window above every other one.
 *
 * The counter is renormalised when it reaches the ceiling: the registered windows
 * are sorted by the order they are currently stacked in and re-numbered from the
 * base. Without that, a long session of clicking between two panels would walk the
 * counter into the modal band and a confirm dialog would open behind them.
 */
export function bringToFront(element) {
    if (!element) {
        return;
    }
    registerWindow(element);

    // "Already on top" is not "has the highest number the counter has reached".
    // Every window starts at the base, so the first version of this test -- compare
    // against `topZ` -- was true for ALL of them until something moved, and nothing
    // could move because the test was true. A window is on top when no other
    // registered window is at or above it.
    if (isTopmost(element)) {
        return; // do not burn a number
    }

    if (topZ >= WINDOW_Z_CEILING) {
        renormalise();
    }

    topZ += 1;
    element.style.zIndex = String(topZ);
}

function isTopmost(element) {
    const mine = Number(element.style.zIndex) || 0;
    for (const other of windows) {
        if (other !== element && (Number(other.style.zIndex) || 0) >= mine) {
            return false;
        }
    }
    return true;
}

function renormalise() {
    const ordered = [...windows].sort(
        (a, b) => (Number(a.style.zIndex) || 0) - (Number(b.style.zIndex) || 0)
    );
    topZ = WINDOW_Z_BASE;
    for (const element of ordered) {
        element.style.zIndex = String(topZ);
        topZ += 1;
    }
}

/** How high the stack has climbed. Diagnostics and unit tests. */
export function currentTopZ() {
    return topZ;
}

/** Forget every registered window and reset the counter. Test seam, and New Game. */
export function resetWindowStack() {
    windows.clear();
    topZ = WINDOW_Z_BASE;
}

/**
 * Make `element` draggable by `handle`, and focusable by a click anywhere in it.
 *
 * @param {HTMLElement} element  the thing that moves -- usually the container
 * @param {HTMLElement} handle   the title bar
 * @param {object} [options]
 * @param {number} [options.edgeMargin]  how much of the window must stay on screen
 * @returns {() => void} a remover, so a component can undo itself in `destroy()`
 */
export function makeDraggable(element, handle, { edgeMargin = 60 } = {}) {
    if (!element || !handle) {
        return () => {};
    }

    registerWindow(element);
    handle.classList.add("window-drag-handle");

    let pointerId = null;
    let startX = 0;
    let startY = 0;
    let startLeft = 0;
    let startTop = 0;
    let minDx = -Infinity;
    let maxDx = Infinity;
    let minDy = -Infinity;
    let maxDy = Infinity;
    let captured = false;

    function onPointerDown(event) {
        // A control inside the title bar is a control, not a grip. Without this the
        // close button becomes a drag handle -- and worse than merely not closing,
        // a drag CANCELS the click, so the button stops working entirely. That is
        // exactly what happened to the transfer window's X, which was a `<div>`
        // with a listener rather than a `<button>`; `[role="button"]` and the
        // `.x-button*` families are here so the next one does not have to be found
        // by a failing spec.
        const onAControl = event.target.closest(
            'button, input, select, textarea, a, [role="button"], [class*="x-button"]'
        );
        if (event.button !== 0 || onAControl) {
            return;
        }

        bringToFront(element);

        const rect = element.getBoundingClientRect();
        const style = getComputedStyle(element);
        startLeft = parseFloat(style.left) || 0;
        startTop = parseFloat(style.top) || 0;
        releaseOppositeAnchors(element, startLeft, startTop);
        startX = event.clientX;
        startY = event.clientY;

        // Clamp in SCREEN space and convert to a delta, which is the only way this
        // works for both anchor conventions at once: three of these windows are
        // centred by a transform, so their `left` is the middle of the window and
        // two others' is the left edge.
        minDx = -rect.left - rect.width + edgeMargin;
        maxDx = window.innerWidth - rect.left - edgeMargin;
        minDy = -rect.top;
        maxDy = window.innerHeight - rect.top - edgeMargin;

        pointerId = event.pointerId;
        captured = capturePointer(handle, pointerId);
        // The transport is `window`, capture or no capture. Capture alone is not
        // enough and is not always available: the map is an `<object>`, so it is a
        // separate document and a pointer that wanders over it stops reporting to
        // this one -- which is what capture fixes -- but `setPointerCapture` THROWS
        // `NotFoundError` for any pointerdown with no live pointer behind it, and a
        // throw inside this handler is an uncaught page error. Listening on the
        // window as well means the drag works either way.
        window.addEventListener("pointermove", onPointerMove);
        window.addEventListener("pointerup", onPointerUp);
        window.addEventListener("pointercancel", onPointerUp);
        element.classList.add("is-dragging");
        event.preventDefault();
    }

    function onPointerMove(event) {
        if (pointerId === null || event.pointerId !== pointerId) {
            return;
        }
        const dx = clamp(event.clientX - startX, minDx, maxDx);
        const dy = clamp(event.clientY - startY, minDy, maxDy);
        element.style.left = startLeft + dx + "px";
        element.style.top = startTop + dy + "px";
    }

    function onPointerUp(event) {
        if (pointerId === null || event.pointerId !== pointerId) {
            return;
        }
        releasePointer(handle, pointerId, captured);
        captured = false;
        pointerId = null;
        window.removeEventListener("pointermove", onPointerMove);
        window.removeEventListener("pointerup", onPointerUp);
        window.removeEventListener("pointercancel", onPointerUp);
        element.classList.remove("is-dragging");
    }

    function onFocusClick() {
        bringToFront(element);
    }

    handle.addEventListener("pointerdown", onPointerDown);
    // Capture, so a row that stops the event from bubbling -- and the territory
    // table has several -- still raises the window it is in.
    element.addEventListener("pointerdown", onFocusClick, true);

    return () => {
        handle.removeEventListener("pointerdown", onPointerDown);
        window.removeEventListener("pointermove", onPointerMove);
        window.removeEventListener("pointerup", onPointerUp);
        window.removeEventListener("pointercancel", onPointerUp);
        element.removeEventListener("pointerdown", onFocusClick, true);
        handle.classList.remove("window-drag-handle");
        windows.delete(element);
    };
}

/**
 * Take pointer capture if the browser will give it, and say whether it did.
 *
 * `setPointerCapture` throws `NotFoundError` for a pointerdown with no live
 * pointer behind it -- a scripted `dispatchEvent`, or a pointer that was released
 * between the event being queued and the handler running. An uncaught throw here
 * would be an uncaught PAGE ERROR, which in this project fails every e2e spec in
 * the run (`tests/support/fixtures.js` collects them). The drag does not need
 * capture to work, only to work smoothly over the map's separate document.
 */
function capturePointer(handle, pointerId) {
    try {
        handle.setPointerCapture(pointerId);
        return true;
    } catch {
        return false;
    }
}

function releasePointer(handle, pointerId, wasCaptured) {
    if (!wasCaptured) {
        return;
    }
    try {
        if (handle.hasPointerCapture(pointerId)) {
            handle.releasePointerCapture(pointerId);
        }
    } catch {
        // Already gone -- the element was removed, or the pointer was cancelled.
    }
}

function clamp(value, low, high) {
    return Math.min(Math.max(value, low), high);
}

/**
 * Pin the window by its top-left corner, whatever the stylesheet pinned it by.
 *
 * Called once at the start of every drag. `left` and `top` are written to the
 * values just measured off the computed style, so nothing moves; `right` and
 * `bottom` are then cleared, so nothing is anchored on the far side any more.
 *
 * That second half is the point. The drag writes `left`/`top` and nothing else, so
 * a window the stylesheet placed with `right: 24px` and no width finishes the first
 * pointer move with BOTH horizontal edges specified -- and for an absolutely
 * positioned box with `width: auto` that is a resize, not a move. The AI game
 * console stretched from wherever it was dragged to all the way back to 24px off
 * the right edge of the screen, redrawing its border across the whole viewport.
 *
 * Done unconditionally rather than behind a test for which edges are set, because
 * there is nothing reliable to test: `getComputedStyle().right` on a positioned
 * element returns the USED value in pixels whether the stylesheet said `24px` or
 * `auto`, so "is this window right-anchored?" cannot be asked of the computed
 * style at all. Writing `auto` over an anchor that was already `auto` costs
 * nothing.
 */
function releaseOppositeAnchors(element, left, top) {
    element.style.left = left + "px";
    element.style.top = top + "px";
    element.style.right = "auto";
    element.style.bottom = "auto";
}

/**
 * Put a window back where the stylesheet puts it.
 *
 * A drag writes inline `left`/`top`, which outlive the window being closed and
 * reopened -- deliberately, because a player who moved a panel out of the way
 * expects it to stay there. What it must NOT outlive is a new game, which is the
 * one moment the whole screen goes back to its starting state.
 */
export function clearDragPosition(element) {
    if (!element) {
        return;
    }
    element.style.removeProperty("left");
    element.style.removeProperty("top");
    //The other half of `releaseOppositeAnchors()`. Dropping only `left`/`top` would
    //leave `right: auto` written on a window the stylesheet anchors by its right
    //edge, so a "reset to where the stylesheet puts it" would put it somewhere the
    //stylesheet does not.
    element.style.removeProperty("right");
    element.style.removeProperty("bottom");
}

/**
 * Every window back to its stylesheet position and to the base of the stack.
 *
 * Called from the reset that puts the country-selection screen up. It is the same
 * class of thing as `bottomTable.reset()` and `phaseBar.setMode(SELECTING)`: a
 * piece of screen state that a restart would otherwise inherit from the game it
 * replaced -- and this one is worse than most, because a window dragged to the far
 * corner of a previous game is a window a new player cannot find.
 */
export function resetAllWindowPositions() {
    for (const element of windows) {
        clearDragPosition(element);
        element.style.zIndex = String(WINDOW_Z_BASE);
    }
    topZ = WINDOW_Z_BASE;
}
