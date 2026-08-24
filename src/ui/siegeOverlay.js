// The siege markers on the map, rendered from the siege lists.
//
// This is the surviving half of `normalizeSiegeState()` (Phase 4.5). That function
// ran once per turn and swept all 359 paths to do two jobs: reconcile the
// `underSiege` attribute against the siege lists, and reconcile the siege overlay
// images against the same lists. The first job no longer exists -- `underSiege` is
// derived from the lists, so it cannot disagree with them. The second is real work,
// because an <image> element is not derived from anything; it has to be created and
// removed. So it moved here, and it is driven by `siegeChanged` rather than by a
// once-a-turn sweep.
//
// The id is `siegeImage_<territory name with spaces underscored>`. Six territory
// names carry real parentheses (audit 5.2 AI), which makes them invalid in a CSS
// selector, so this looks images up with `getElementById` and never `querySelector`.

const SVG_NS = "http://www.w3.org/2000/svg";
const XLINK_NS = "http://www.w3.org/1999/xlink";

function overlayId(territoryName) {
    return "siegeImage_" + territoryName.replace(/\s+/g, "_");
}

function existingOverlay(path, territoryName) {
    return path.ownerDocument?.getElementById(overlayId(territoryName)) ?? null;
}

/**
 * Put a siege marker on a territory, or take it off.
 *
 * @param {Element} path            the territory path
 * @param {string} territoryName    its stable name
 * @param {boolean} underSiege
 * @param {boolean} aiSiege         AI sieges get the smaller, faded marker
 */
export function renderSiegeOverlay(path, territoryName, underSiege, aiSiege) {
    if (!path || !territoryName) {
        return;
    }

    const existing = existingOverlay(path, territoryName);

    if (!underSiege) {
        existing?.remove();
        return;
    }
    if (existing) {
        return;
    }

    // getBBox() throws on a path that is not rendered yet, which is why the original
    // wrapped this. A missing marker is cosmetic; a throw here would escape into the
    // turn loop, which has no catch anywhere in it.
    try {
        const bounds = path.getBBox();
        const centerX = bounds.x + bounds.width / 2;
        const centerY = bounds.y + bounds.height / 2;

        const image = document.createElementNS(SVG_NS, "image");
        image.setAttributeNS(XLINK_NS, "href", aiSiege ? "siegeai.png" : "siege.png");

        //Phase 5.8. A marker is decoration and must never intercept a click. Without this
        //the <image> sits over the middle of the territory it marks, and a hit test at the
        //centre of a besieged territory returns the marker rather than the path -- so the
        //player cannot click their own besieged territory, which is the only route to
        //VIEW SIEGE. Same class of bug as `#tooltip` having no `pointer-events: none`.
        let size = Math.min(bounds.width * 0.7, bounds.height * 0.7);
        if (aiSiege) {
            size *= 0.6;
            image.setAttribute("style", "opacity: 0.4; pointer-events: none");
        } else {
            image.setAttribute("style", "pointer-events: none");
        }

        image.setAttribute("x", (centerX - size / 2).toString());
        image.setAttribute("y", (centerY - size / 2).toString());
        image.setAttribute("z-index", "9999");
        image.setAttribute("width", size.toString());
        image.setAttribute("height", size.toString());
        image.setAttribute("id", overlayId(territoryName));

        path.parentNode.appendChild(image);
    } catch {
        // not laid out yet; the next siege change will try again
    }
}
