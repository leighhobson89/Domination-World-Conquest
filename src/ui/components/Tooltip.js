// The hover tooltip.
//
// Refactor Phase 6.3, and the first component out of the `DOMContentLoaded`
// block because it is the one with no dependencies at all -- it has no store
// state, no phase, no selection. It is a box that follows the pointer.
//
// It is also where two long-standing problems get closed:
//
// 1. `tooltip` was never declared anywhere. All 128 uses across ui.js and
//    resourceCalculations.js resolved to `window.tooltip`, which exists only
//    because a `<div id="tooltip">` was in index.html -- named window access.
//    ESLint flagged every one as `no-undef`, and the whole thing would have
//    broken silently the moment the element was renamed or the code moved into
//    a scope with a local of the same name. The element is now created here and
//    reached through an imported object.
//
// 2. `#tooltip` had no `pointer-events: none`, so a box that deliberately sits
//    under the pointer intercepted the click the player was about to make. The
//    e2e page objects park the pointer in a corner before every interaction to
//    work around it. Production code should not need that, and now does not:
//    the element is created with `pointer-events: none`, in the same class as
//    the siege overlays and the attack marker.
//
// The public shape is `create()` / `destroy()` like every other component, but
// there is no `update(state)`: nothing in `GameState` decides what a tooltip
// says. What goes in it is decided by whatever the pointer is over, so callers
// push content in.

import { ids } from "../core/registry.js";
import { el, mount } from "../core/dom.js";

/** How far left of the pointer the box sits, and how far below it. */
const OFFSET_LEFT = 40;
const OFFSET_BELOW = 25;

/**
 * How close to the edge of the window the box may come, and how far above the
 * pointer it sits once it has been lifted.
 */
const EDGE_MARGIN = 8;
const GAP_ABOVE = 18;

let element = null;
/** The last measured size, invalidated whenever the content changes. */
let measured = null;

/**
 * Build the tooltip element and attach it to the document.
 *
 * Safe to call twice: the second call returns the element the first one made,
 * so a stray re-entry cannot leave two boxes with the same id in the document
 * (which is how the siege overlays used to end up duplicated).
 */
export function create() {
    if (element) return element;
    element = el("div", {
        id: ids.tooltip,
        // The whole point of this element is to sit under the pointer, so it
        // must never be the thing the pointer hits.
        style: { pointerEvents: "none" },
    });
    mount(document.body, element);
    return element;
}

function node() {
    return element ?? create();
}

/** Replace the contents. Markup, because most callers build a small table. */
export function setContent(html) {
    node().innerHTML = html;
    //A new box is a new size, and `placeNear()` cannot decide anything without one.
    measured = null;
}

/** What the tooltip currently says. Used by the hover specs. */
export function content() {
    return node().innerHTML;
}

export function show() {
    node().style.display = "block";
}

export function hide() {
    node().style.display = "none";
}

/** Clear and hide in one call -- the pair that ends every mouseout handler. */
export function clear() {
    setContent("");
    hide();
}

export function isVisible() {
    return node().style.display === "block";
}

/**
 * Move the box. Both arguments are pixel numbers relative to the viewport;
 * the "px" is this function's business, not the caller's.
 */
export function moveTo(left, top) {
    const style = node().style;
    style.left = left + "px";
    style.top = top + "px";
}

/**
 * Measure the box, once per change of content.
 *
 * `offsetHeight` is zero while an element is `display: none`, which is why every
 * caller used to guess the flip with a constant instead. This measures a hidden
 * box by showing it INVISIBLY for the duration -- `visibility: hidden` takes
 * layout where `display: none` does not -- and caches the answer, because
 * `placeNear()` is called from a `mousemove` handler that fires dozens of times a
 * second and `getBoundingClientRect()` forces a layout every time it is asked.
 */
function measure() {
    if (measured) {
        return measured;
    }
    const box = node();
    const hidden = box.style.display !== "block";
    if (hidden) {
        box.style.visibility = "hidden";
        box.style.display = "block";
    }
    const rect = box.getBoundingClientRect();
    if (hidden) {
        box.style.display = "none";
        box.style.visibility = "";
    }
    measured = { width: rect.width, height: rect.height };
    return measured;
}

/**
 * Put the box beside the pointer, and keep the whole of it on screen.
 *
 * THE ONE PLACE THIS DECISION IS MADE. There were eight copies of it, each with its
 * own constant: `y - 30`, `y - 50`, `y - tooltipHeight`, `y - (tooltipHeight + 25)`,
 * and three different guesses at how near the bottom counted as near. Leigh reported
 * what that produced: *"tooltips near the bottom ... are causing the browser to
 * flicker and resize when they get too near the bottom"*.
 *
 * BOTH HALVES OF THAT WERE REAL AND THEY HAD DIFFERENT CAUSES.
 *
 * The RESIZE was `#tooltip` being `position: absolute`, so a box placed near the foot
 * of the window extended the DOCUMENT, raised a scrollbar, and reflowed the page --
 * which moved the pointer's target, which moved the tooltip, which is the flicker. It
 * is `position: fixed` now, and a fixed box cannot extend anything. That is the fix
 * that matters, and it is one line of CSS.
 *
 * The FLICKER also had a second source, in the callers that DID measure: they set the
 * content, showed the box, read `offsetHeight`, hid it, moved it and showed it again --
 * two forced reflows and a visible flash of the box in the wrong place, on every
 * `mousemove`. Measuring invisibly and caching removes both.
 *
 * The rule itself: below the pointer if the whole box fits, otherwise lifted so it
 * sits ABOVE the pointer by its own height rather than by a constant -- a constant
 * cannot be right for a one-line label and an eight-row territory tooltip at once.
 * Then clamped into the window on both axes, so a tooltip at the right-hand edge is
 * not half off screen.
 */
export function placeNear(x, y, { offsetLeft = OFFSET_LEFT } = {}) {
    const { width, height: boxHeight } = measure();
    const spot = placementFor({
        x,
        y,
        width,
        height: boxHeight,
        viewportWidth: window.innerWidth,
        viewportHeight: window.innerHeight,
        offsetLeft
    });
    moveTo(spot.left, spot.top);
}

/**
 * Where the box goes, as arithmetic.
 *
 * Separated from `placeNear()` above so the rule can be stated in Node: the placement
 * has four edge cases and every one of them is a pixel comparison, which is exactly the
 * kind of thing that is tedious to reach by hovering and trivial to assert. `placeNear()`
 * is then only the part that measures a real element and writes two styles.
 *
 * @param {{x: number, y: number, width: number, height: number,
 *          viewportWidth: number, viewportHeight: number, offsetLeft?: number}} input
 * @returns {{left: number, top: number}}
 */
export function placementFor({
    x,
    y,
    width,
    height: boxHeight,
    viewportWidth,
    viewportHeight,
    offsetLeft = OFFSET_LEFT
}) {
    let top = y + OFFSET_BELOW;
    if (top + boxHeight > viewportHeight - EDGE_MARGIN) {
        //LIFTED BY ITS OWN HEIGHT, not by a constant. The eight copies of this that used
        //to exist lifted by 30, by 50, by the height, or by the height plus 25, and three
        //of them decided "near the bottom" with a fixed 100px -- so a tall tooltip near
        //the foot of the window was moved up by less than its own height and still ran off
        //the end.
        top = y - boxHeight - GAP_ABOVE;
    }
    //A box taller than the space above the pointer starts at the top of the window
    //instead. It then overlaps the pointer, which is unavoidable and harmless: the
    //tooltip carries `pointer-events: none`, so it still cannot eat the click.
    if (top < EDGE_MARGIN) {
        top = EDGE_MARGIN;
    }

    let left = x - offsetLeft;
    const rightLimit = viewportWidth - width - EDGE_MARGIN;
    if (left > rightLimit) {
        left = rightLimit;
    }
    if (left < EDGE_MARGIN) {
        left = EDGE_MARGIN;
    }

    return { left, top };
}

/** The rendered height, which is only meaningful while the box is displayed. */
export function height() {
    return node().offsetHeight;
}

/** Escape hatch for the two places that still need the element itself. */
export function elementRef() {
    return node();
}

export function destroy() {
    element?.remove();
    element = null;
}

/**
 * The imported handle. Every call site uses this rather than a bare `tooltip`
 * identifier, which is what takes the named-window-access gotcha out of the
 * codebase.
 */
export const tooltip = {
    create,
    destroy,
    setContent,
    content,
    show,
    hide,
    clear,
    isVisible,
    moveTo,
    placeNear,
    placementFor,
    height,
    elementRef,
};
