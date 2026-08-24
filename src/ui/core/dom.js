// Element construction, mounting and event wiring.
//
// Refactor Phase 6.2. The pattern this replaces occurs 294 times across ui.js,
// resourceCalculations.js and transferAndAttack.js, and reads like this:
//
//     const topTableFlag = document.createElement("td");
//     topTableFlag.classList.add("iconCell");
//     topTableFlag.setAttribute("id", ids.flagTop);
//     topTableFlag.addEventListener("mouseover", () => { ... });
//     topTableFlag.addEventListener("mouseout", () => { ... });
//     ...
//     topTableRow.appendChild(topTableFlag);
//
// Six statements, five of which exist only because `createElement` takes no
// properties. Written with `el()` the same element is one expression, the
// structure is visible as structure, and -- the part that matters for Phase 6.3
// -- every listener it attaches is recorded, so the component that owns it can
// take them all off again in `destroy()`.
//
// Like `registry.js`, this file imports nothing. It touches the DOM but it does
// not know anything about this game.

/**
 * Property names that are set as DOM PROPERTIES rather than attributes,
 * because the two are not interchangeable: `disabled`, `value` and `checked`
 * have live property values that an attribute write does not update, and
 * `textContent` / `innerHTML` have no attribute form at all.
 *
 * Everything not listed here and not handled specially in `el()` is assigned
 * as a property too -- `src`, `alt`, `type`, `href` and friends all work that
 * way. `attrs` is the escape hatch for the ones that do not (`viewBox`,
 * `uniqueid`, anything hyphenated or namespaced).
 */
const SVG_NS = "http://www.w3.org/2000/svg";

function applyClasses(node, value) {
    if (!value) return;
    const names = Array.isArray(value) ? value : String(value).split(/\s+/);
    for (const name of names) {
        if (name) node.classList.add(name);
    }
}

function appendChild(node, child) {
    // `false`, `null` and `undefined` are skipped so a caller can write
    // `condition && el(...)` inline. `0` is content and is kept.
    if (child === null || child === undefined || child === false || child === true) return;
    if (Array.isArray(child)) {
        for (const one of child) appendChild(node, one);
        return;
    }
    node.appendChild(typeof child === "object" ? child : document.createTextNode(String(child)));
}

/**
 * Build an element.
 *
 * @param {string} tag           e.g. "div", "button", "td"
 * @param {object} [props]       see below
 * @param {*} [children]         a node, a string, or a (nested) array of either
 * @returns {HTMLElement}
 *
 * Recognised props, all optional:
 *
 *   id        element id -- pass a value from `registry.js`, never a literal
 *   class     a class name, a space-separated string, or an array of names
 *   text      textContent
 *   html      innerHTML (only where the content is genuinely markup)
 *   style     an object of camelCase CSS properties
 *   attrs     an object of literal attribute names -- for hyphenated ones
 *   dataset   an object of data-* values
 *   on        an object of { eventName: handler }
 *
 * Anything else is assigned straight onto the element as a property, which is
 * what `src`, `alt`, `type`, `disabled`, `value` and `checked` all want.
 */
export function el(tag, props = {}, children = null) {
    const node = document.createElement(tag);
    applyProps(node, props);
    appendChild(node, children);
    return node;
}

/** As `el()`, but in the SVG namespace -- map markers, patterns, overlays. */
export function svgEl(tag, props = {}, children = null) {
    const node = document.createElementNS(SVG_NS, tag);
    applyProps(node, props);
    appendChild(node, children);
    return node;
}

function applyProps(node, props) {
    for (const [key, value] of Object.entries(props)) {
        if (value === undefined) continue;
        switch (key) {
            case "id":
                node.setAttribute("id", value);
                break;
            case "class":
            case "className":
                applyClasses(node, value);
                break;
            case "text":
                node.textContent = value;
                break;
            case "html":
                node.innerHTML = value;
                break;
            case "style":
                Object.assign(node.style, value);
                break;
            case "attrs":
                for (const [name, attr] of Object.entries(value)) {
                    if (attr !== undefined && attr !== null) node.setAttribute(name, attr);
                }
                break;
            case "dataset":
                Object.assign(node.dataset, value);
                break;
            case "on":
                for (const [event, handler] of Object.entries(value)) {
                    if (handler) on(node, event, handler);
                }
                break;
            default:
                node[key] = value;
        }
    }
}

/**
 * Append children to a parent and return the parent.
 *
 * `parent` may be an element or an element id, which is what makes the mount
 * line of a component read as one statement: the containers in index.html are
 * all addressed by id.
 *
 *     mount(ids.menuContainer, menu);
 */
export function mount(parent, ...children) {
    const node = typeof parent === "string" ? document.getElementById(parent) : parent;
    if (!node) throw new Error(`mount: no element for "${parent}"`);
    for (const child of children) appendChild(node, child);
    return node;
}

/** Remove every child of an element, and return it. */
export function clear(node) {
    while (node.firstChild) node.removeChild(node.firstChild);
    return node;
}

/**
 * Attach a listener and return the function that takes it off again.
 *
 * The return value is the whole point. `addEventListener` gives a component no
 * way to undo itself without keeping a reference to the exact same handler, and
 * the handlers here are overwhelmingly inline arrow functions -- which is why
 * the transfer/attack window ended up adding and removing three transient
 * `#popup-confirm` listeners per phase instead of installing one (Phase 5.7).
 * A `create()` collects these; `destroy()` calls them.
 */
export function on(target, event, handler, options) {
    target.addEventListener(event, handler, options);
    return () => target.removeEventListener(event, handler, options);
}

/**
 * A collector for the above, so a component does not have to keep an array by
 * hand.
 *
 *     const listeners = listenerGroup();
 *     listeners.on(button, "click", onClick);
 *     ...
 *     listeners.removeAll();   // in destroy()
 */
export function listenerGroup() {
    const offs = [];
    return {
        on(target, event, handler, options) {
            offs.push(on(target, event, handler, options));
            return this;
        },
        removeAll() {
            while (offs.length) offs.pop()();
        },
        get size() {
            return offs.length;
        },
    };
}
