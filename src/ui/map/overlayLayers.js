// The one group at the end of the map document that everything drawn ON the map lives in.
//
// SVG HAS NO Z-INDEX: what is painted last wins. Clicking a territory re-appends its path to
// the end of the map document -- that is how the game raises a selection above its neighbours,
// and there are five such re-appends in `ui.js` alone -- so anything drawn over the map has to
// be put back on top afterwards or it disappears under the territory that was just clicked.
// The military view learned this the hard way: a territory's force figure vanished the moment
// you touched it.
//
// **WHY IT IS ONE LAYER AND NOT ONE PER OVERLAY.** The fix for the above is a `MutationObserver`
// that re-appends the overlay whenever anything else is added to the root. Two overlays each
// enforcing "I am last" is not two fixes, it is a LOOP: each re-append fires the other's
// observer, which re-appends, for ever. So there is a single parent kept last, and the overlays
// are ordered groups inside it -- which also makes the stacking between them a stated fact
// (`GROUP_ORDER`) rather than an accident of which one happened to draw first.
//
// The parent carries `pointer-events: none` for every child: an overlay sits over the middle of
// the territory it describes, which is exactly where the player clicks to select it. Same rule
// as the siege markers and `#tooltip`.

const SVG_NS = "http://www.w3.org/2000/svg";

/** The id of the parent group. Not in `registry.js`: it exists inside the MAP's document. */
export const OVERLAY_ROOT_ID = "mapOverlayLayer";

/**
 * The overlays, bottom to top.
 *
 * Clouds are at the bottom because they are scenery and everything above them is information:
 * weather that could hide a force figure or a threatened border would be a decoration that
 * costs the player the thing the map is for. Flags come next because they are an identity
 * label and the military marks are a warning; where those two ever compete for the same pixels
 * the warning wins. In practice they do not -- a figure and a flag are mutually exclusive on
 * one territory -- but "in practice they do not" is not a stacking rule.
 */
const GROUP_ORDER = Object.freeze(["clouds", "flags", "military"]);

let mapDocument = null;
let guard = null;

/**
 * Point the overlays at the map's contentDocument, and start keeping them on top.
 *
 * Idempotent, and called by every overlay module rather than by one of them on the others'
 * behalf -- an overlay that could be initialised before the module that happened to own the
 * attach would draw into nothing.
 */
export function attachOverlayLayers(svgDocument) {
    if (svgDocument && svgDocument !== mapDocument) {
        guard?.disconnect();
        guard = null;
        mapDocument = svgDocument;
    }
}

/** The parent, created on demand and always re-appended last. */
function overlayRoot() {
    if (!mapDocument) {
        return null;
    }
    let root = mapDocument.getElementById(OVERLAY_ROOT_ID);
    if (!root) {
        root = mapDocument.createElementNS(SVG_NS, "g");
        root.setAttribute("id", OVERLAY_ROOT_ID);
        root.setAttribute("style", "pointer-events: none");
    }
    mapDocument.documentElement.appendChild(root);
    startGuard(root);
    return root;
}

/**
 * Put the overlay back on top whenever anything else is appended beside it.
 *
 * Re-appending fires the observer once more, which finds the root already last and stops -- so
 * it terminates.
 */
function startGuard(root) {
    if (guard || !mapDocument) {
        return;
    }
    const documentRoot = mapDocument.documentElement;
    guard = new MutationObserver(() => {
        if (documentRoot.lastElementChild !== root) {
            documentRoot.appendChild(root);
        }
    });
    guard.observe(documentRoot, { childList: true });
}

/**
 * One overlay's group, created on demand and inserted in `GROUP_ORDER`.
 *
 * Inserted rather than appended: an overlay switched on later must not end up above one that
 * was already drawn simply because it arrived second.
 *
 * @param {string} name  a member of `GROUP_ORDER`
 * @param {string} elementId  the id the group carries, so specs and other modules can find it
 */
export function overlayGroup(name, elementId) {
    const root = overlayRoot();
    if (!root) {
        return null;
    }
    const existing = mapDocument.getElementById(elementId);
    if (existing && existing.parentNode === root) {
        return existing;
    }

    const group = existing ?? mapDocument.createElementNS(SVG_NS, "g");
    group.setAttribute("id", elementId);
    group.setAttribute("data-overlay", name);

    const rank = GROUP_ORDER.indexOf(name);
    const after = Array.from(root.children).find(
        child => GROUP_ORDER.indexOf(child.getAttribute("data-overlay")) > rank
    );
    root.insertBefore(group, after ?? null);
    return group;
}

/** Take one overlay off the map. The parent stays: another overlay may still be using it. */
export function removeOverlayGroup(elementId) {
    mapDocument?.getElementById(elementId)?.remove();
}

/** Is the parent currently the last thing in the map document? For the e2e assertion. */
export function overlayIsOnTop() {
    const root = mapDocument?.getElementById(OVERLAY_ROOT_ID);
    return Boolean(root) && mapDocument.documentElement.lastElementChild === root;
}
