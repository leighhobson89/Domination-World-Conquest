// The Dominapedia: this game's manual, opened from the main menu.
//
// Refactor plan Phase 7.6. The menu has carried an inert Help button since the
// theme overhaul rebuilt it; this is what the button now does, and the button is
// called Dominapedia because that is what the manual is called -- a menu item and
// the screen it opens should not be two names.
//
// It is the Options panel's bigger sibling and shares its scrim, its buttons and
// its Escape behaviour on purpose (the same reason `SaveLoadPanel.js` does): three
// screens that open from one menu should not be three designs. What it does NOT
// share is the shape. Options is a dialog -- a handful of settings, read top to
// bottom, dismissed. This is a book, so it is a full-screen window with a title
// bar, a contents column down the left and a content pane filling the rest.
//
// Four decisions worth recording:
//
//   * **The catalogue is data and lives elsewhere.** `src/ui/dominapedia/topics.js`
//     holds the sections, the sub-topics and the walk over them, imports nothing,
//     and is unit-tested in Node. This file renders whatever that file says and
//     has no opinion about the content -- adding a page is one entry there and no
//     change here.
//   * **Previous / Next walk SUB-TOPICS, not sections, and they wrap.** Next from
//     the last page of the book lands on the first, and Previous from the first
//     lands on the last, so neither button is ever disabled and the player can
//     read the whole thing by pressing one key. The wrap is in `topics.js` and is
//     pinned by its unit spec, because it is the case nobody exercises by hand.
//   * **Both columns scroll, independently.** The panel itself never scrolls: it
//     is a fixed-height grid, and the two panes each own their overflow. That is
//     what keeps the title bar and the Previous / Next footer on screen while a
//     long page is being read. Changing the page scrolls the content pane back to
//     the top -- landing halfway down a new page reads as a rendering fault.
//   * **Navigating opens the section the new page is in and leaves the rest as the
//     player left them.** Collapsing everything else on every click would undo the
//     player's own browsing; opening nothing would leave the current page with no
//     visible mark in the contents.
//
// There is no `update(state)`. The Dominapedia is a book, not a view of the world,
// so it follows nothing in the store -- the same reason `OptionsPanel`, `Tooltip`
// and `MainMenu` have none.

import { classNames, ids } from "../core/registry.js";
import { el, mount, on } from "../core/dom.js";
import { chevronIcon } from "../icons.js";
import {
    DOMINAPEDIA_SECTIONS,
    firstTopicId,
    nextTopicId,
    previousTopicId,
    topicById,
    topicCount,
    topicIndex,
} from "../dominapedia/topics.js";

let root = null;
let navColumn = null;
let contentPane = null;
let breadcrumb = null;
let contentTitle = null;
let contentSummary = null;
let contentBody = null;
let positionLabel = null;
let removers = [];
/** The sub-topic on screen. Always a real id -- `open()` guarantees it. */
let currentTopicId = null;
/** Which sections are expanded in the contents column, by section id. */
const openSections = new Set();
/** The click sound, so the manual sounds like the menu it opens from. */
let onSound = null;

/* ------------------------------------------------------------------ content --- */

/**
 * One body block.
 *
 * The vocabulary is deliberately small -- a paragraph, a sub-heading, a list, and
 * the note that says a page is still a placeholder. Content that needed markup
 * would be content that had opinions about how the panel looks.
 */
function bodyBlock(block) {
    switch (block.kind) {
        case "h":
            return el("h4", { class: "dominapedia-body-heading", text: block.text });
        case "ul":
            return el(
                "ul",
                { class: "dominapedia-body-list" },
                block.items.map((item) => el("li", { text: item }))
            );
        case "todo":
            return el("p", { class: "dominapedia-body-todo", text: block.text });
        case "p":
        default:
            return el("p", { class: "dominapedia-body-text", text: block.text });
    }
}

/** Paint the right-hand pane from the catalogue entry for `currentTopicId`. */
function renderContent() {
    const topic = topicById(currentTopicId);
    if (!topic || !contentBody) return;

    breadcrumb.textContent = topic.sectionTitle;
    contentTitle.textContent = topic.title;
    contentSummary.textContent = topic.summary ?? "";
    contentBody.replaceChildren(...topic.body.map(bodyBlock));

    // "4 of 19" rather than a progress bar: the player is being told where they
    // are in a book, and a book has numbered pages.
    positionLabel.textContent = `${topicIndex(topic.id) + 1} of ${topicCount()}`;

    // A new page starts at its top. Keeping the scroll offset across a navigation
    // drops the reader into the middle of something they have not read.
    contentPane.scrollTop = 0;
}

/* ------------------------------------------------------------------ contents --- */

/** One sub-topic link in the left-hand column. */
function topicLink(topic) {
    const isCurrent = topic.id === currentTopicId;
    const link = el("button", {
        class: classNames.dominapediaTopicLink,
        text: topic.title,
        attrs: {
            type: "button",
            "data-topic": topic.id,
            // A tab strip's own current item is what `aria-current` is for, and it
            // is also how the e2e suite asks which page is showing without reading
            // a cosmetic class.
            ...(isCurrent ? { "aria-current": "page" } : {}),
            title: topic.summary ?? topic.title,
        },
        on: {
            click() {
                onSound?.();
                showTopic(topic.id);
            },
        },
    });
    link.classList.toggle(classNames.dominapediaIsCurrent, isCurrent);
    return link;
}

/** One collapsible main topic, with its sub-topics inside it. */
function sectionGroup(section) {
    const isOpenSection = openSections.has(section.id);

    const header = el(
        "button",
        {
            class: classNames.dominapediaSectionHeader,
            attrs: {
                type: "button",
                "aria-expanded": isOpenSection ? "true" : "false",
                "data-section": section.id,
            },
            on: {
                click() {
                    onSound?.();
                    if (openSections.has(section.id)) {
                        openSections.delete(section.id);
                    } else {
                        openSections.add(section.id);
                    }
                    renderNav();
                },
            },
        },
        [
            chevronIcon(),
            el("span", { class: "dominapedia-section-label", text: section.title }),
            el("span", {
                class: "dominapedia-section-count",
                text: String(section.topics.length),
            }),
        ]
    );

    const list = el(
        "div",
        { class: classNames.dominapediaSectionTopics },
        section.topics.map(topicLink)
    );

    const group = el("div", { class: classNames.dominapediaSection }, [header, list]);
    group.classList.toggle(classNames.dominapediaIsOpen, isOpenSection);
    group.setAttribute("data-section", section.id);
    return group;
}

/** Rebuild the contents column. Cheap: nineteen buttons and six headers. */
function renderNav() {
    if (!navColumn) return;
    navColumn.replaceChildren(...DOMINAPEDIA_SECTIONS.map(sectionGroup));
}

/* ---------------------------------------------------------------- navigation --- */

/**
 * Show a sub-topic, whatever it was reached from -- a link, Previous, Next, or
 * `open()`.
 *
 * The section holding it is opened but nothing else is closed: collapsing the
 * player's own browsing on every click is the kind of tidiness that reads as the
 * panel fighting back.
 */
export function showTopic(id) {
    const topic = topicById(id);
    if (!topic) return;
    currentTopicId = topic.id;
    openSections.add(topic.sectionId);
    renderNav();
    renderContent();
    scrollCurrentLinkIntoView();
}

/**
 * Keep the current page's link visible in the contents column.
 *
 * Pressing Next through a long section otherwise walks the highlight off the
 * bottom of a column that is not scrolling itself. `block: "nearest"` so a link
 * already on screen does not jump.
 */
function scrollCurrentLinkIntoView() {
    const link = navColumn?.querySelector(`[data-topic="${currentTopicId}"]`);
    link?.scrollIntoView({ block: "nearest" });
}

function goNext() {
    onSound?.();
    showTopic(nextTopicId(currentTopicId));
}

function goPrevious() {
    onSound?.();
    showTopic(previousTopicId(currentTopicId));
}

/* -------------------------------------------------------------------- panel --- */

/**
 * @param {object} [options]
 * @param {() => void} [options.onSound] the click sound, chosen by the caller
 */
export function create({ onSound: soundHandler } = {}) {
    if (root) return root;
    onSound = soundHandler ?? null;

    navColumn = el(
        "nav",
        {
            id: ids.dominapediaNav,
            class: "dominapedia-nav",
            attrs: { "aria-label": "Dominapedia contents" },
        }
    );

    breadcrumb = el("p", { id: ids.dominapediaBreadcrumb, class: "dominapedia-breadcrumb" });
    contentTitle = el("h3", {
        id: ids.dominapediaContentTitle,
        class: "dominapedia-content-title",
    });
    contentSummary = el("p", {
        id: ids.dominapediaContentSummary,
        class: "dominapedia-content-summary",
    });
    contentBody = el("div", { id: ids.dominapediaContentBody, class: "dominapedia-content-body" });

    contentPane = el(
        "article",
        {
            id: ids.dominapediaContent,
            class: "dominapedia-content",
            // The pane is what scrolls, so it is what has to be reachable by
            // keyboard for Page Down to do anything.
            attrs: { tabindex: "0" },
        },
        [breadcrumb, contentTitle, contentSummary, contentBody]
    );

    positionLabel = el("span", {
        id: ids.dominapediaPosition,
        class: "dominapedia-position",
    });

    // Never disabled, at either end: the walk wraps, which is the whole reason
    // `topics.js` owns it rather than this file doing index arithmetic inline.
    const previousButton = el(
        "button",
        {
            id: ids.dominapediaPrevBtn,
            class: ["options-button", "options-button-ghost", "dominapedia-step"],
            attrs: { type: "button" },
            on: { click: goPrevious },
        },
        [chevronIcon(), el("span", { text: "Previous" })]
    );

    const nextButton = el(
        "button",
        {
            id: ids.dominapediaNextBtn,
            class: ["options-button", "options-button-primary", "dominapedia-step"],
            attrs: { type: "button" },
            on: { click: goNext },
        },
        [el("span", { text: "Next" }), chevronIcon()]
    );

    const panel = el("div", { id: ids.dominapediaPanel, class: "dominapedia-panel" }, [
        // THE MAIN BAR. The same furniture every other window in the game wears --
        // `.window-title-bar` -- so the manual does not read as a different product
        // from the game it documents.
        el("header", { class: ["window-title-bar", "dominapedia-titlebar"] }, [
            el("h2", {
                id: ids.dominapediaTitle,
                class: ["window-title-text", "dominapedia-title"],
                text: "Dominapedia",
            }),
            el("button", {
                id: ids.dominapediaCloseBtn,
                class: "dominapedia-close",
                text: "×",
                attrs: { type: "button", "aria-label": "Close the Dominapedia" },
                on: {
                    click() {
                        onSound?.();
                        close();
                    },
                },
            }),
        ]),

        el("div", { class: "dominapedia-body" }, [
            navColumn,
            el("div", { class: "dominapedia-reader" }, [
                contentPane,
                el("footer", { class: "dominapedia-footer" }, [
                    previousButton,
                    positionLabel,
                    nextButton,
                ]),
            ]),
        ]),
    ]);

    root = el("div", { id: ids.dominapediaContainer, class: "options-scrim" }, panel);
    // Clicking the scrim -- but never the panel -- closes, which is what the other
    // two modals opened from this menu already do.
    removers.push(
        on(root, "click", (event) => {
            if (event.target === root) close();
        })
    );

    root.style.display = "none";
    mount(document.body, root);

    currentTopicId = firstTopicId();
    showTopic(currentTopicId);
    return root;
}

/**
 * Escape closes, and the arrow keys turn the page.
 *
 * Installed only while the panel is open, and captured, so the map's own key
 * handling never sees a key meant for the manual. The arrows are ignored while the
 * focus is in a control that uses them itself, which today is nothing in this
 * panel and is exactly the kind of thing that stops being true quietly.
 */
function onKeyDown(event) {
    if (event.key === "Escape") {
        event.stopPropagation();
        close();
        return;
    }
    const tag = document.activeElement?.tagName;
    if (tag === "INPUT" || tag === "SELECT" || tag === "TEXTAREA") return;
    if (event.key === "ArrowRight") {
        event.stopPropagation();
        goNext();
    } else if (event.key === "ArrowLeft") {
        event.stopPropagation();
        goPrevious();
    }
}

export function open(topicId = null) {
    if (!root) create();
    showTopic(topicById(topicId) ? topicId : currentTopicId ?? firstTopicId());
    root.style.display = "flex";
    document.addEventListener("keydown", onKeyDown, true);
    // The pane, not the panel: the reader should be able to press Page Down the
    // moment it opens.
    contentPane?.focus({ preventScroll: true });
}

export function close() {
    if (!root) return;
    root.style.display = "none";
    document.removeEventListener("keydown", onKeyDown, true);
}

export function isOpen() {
    return Boolean(root) && root.style.display !== "none";
}

/** The sub-topic on screen. The e2e suite asks this; nothing in the app does. */
export function currentTopic() {
    return currentTopicId;
}

export function destroy() {
    document.removeEventListener("keydown", onKeyDown, true);
    for (const remove of removers) remove();
    removers = [];
    root?.remove();
    root = null;
    navColumn = null;
    contentPane = null;
    breadcrumb = null;
    contentTitle = null;
    contentSummary = null;
    contentBody = null;
    positionLabel = null;
    currentTopicId = null;
    openSections.clear();
    onSound = null;
}

export const dominapedia = { create, open, close, isOpen, showTopic, currentTopic, destroy };
