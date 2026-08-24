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

let element = null;

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
 * Position the box next to the pointer, flipping it above when there is not
 * enough room below.
 *
 * The callers that measure their own content first still do so and call
 * `moveTo` directly -- a tall purchase or upgrade tooltip needs its real height
 * to decide, and that is only known once it is displayed.
 */
export function followPointer(x, y, { flipWithin = 100, liftBy = 30 } = {}) {
    const clearsBottom = window.innerHeight - y >= flipWithin;
    moveTo(x - OFFSET_LEFT, clearsBottom ? y + OFFSET_BELOW : y - liftBy);
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
    followPointer,
    height,
    elementRef,
};
