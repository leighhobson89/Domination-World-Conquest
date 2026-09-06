// The screen a finished game ends on.
//
// The last item under "Missing" in the register. `checkForVictory()` decided the game
// correctly and `endTurn()` emitted `GAME_OVER` exactly once; the only listener was a
// `console.log`, so a player who had just won a fifty-turn game was left sitting on a map with
// nothing to tell them so. **This is a second subscriber and no change at all to the rule** --
// the whole point of the ending being an event is that the screen is a listener rather than a
// branch inside the turn loop.
//
// It has no opinion about the wording. Everything it draws comes from
// `src/ui/gameOver/describeEnding.js`, which is pure and unit-tested in Node -- the same
// arrangement `GoalSelect.js` has with `goalCatalogue.js` and `Dominapedia.js` has with
// `topics.js`. That matters more here than anywhere else, because an ending is by definition
// the state hardest to reach by clicking: a spec that had to play a whole game to see one
// would be the slowest and least reliable test in the suite.
//
// Four decisions worth stating.
//
// **IT DOES NOT CLOSE ON A SCRIM CLICK OR ON ESCAPE, BUT IT DOES OFFER A WAY OUT OF ITS OWN.**
// Every other modal in the game cancels on a stray click, and a stray click is exactly what a
// player produces at the moment a game ends -- they were mid-turn. So the three exits are all
// deliberate presses. The third one, View Final Map, exists because the alternative is worse
// than it looks: a finished game is the one board a player most wants to sit and look at, and
// a modal covering it with no way past would take that away to save a button. Nothing brings
// the panel back, which is the point of it being the quiet one -- Escape still opens the
// in-game menu, and that already has New Game and Main Menu on it.
//
// **IT ARRIVES BEHIND WHATEVER IS ALREADY ON SCREEN'S WAY, NOT ON TOP OF A BATTLE.** A game
// ends at `endTurn()`, which can be the same tick a battle-results screen went up in. `show()`
// is therefore called with the blockers already cleared by the caller, and the panel sits in
// the modal band above the floating windows so nothing can be left covering it.
//
// **THE STANDINGS ARE A SNAPSHOT TAKEN AT THE ENDING, NOT READ WHEN IT DRAWS.** The panel can
// outlive the store it describes -- New Game restores a pristine world underneath it -- so a
// table that read `worldStandings()` at render time would show the new world's figures under
// the old game's headline.
//
// **A DEFEAT IS STILL A RESULT.** Both buttons are offered on every outcome and nothing is
// disabled; there is no "you lost, so here is only a way out" path. The tone class is the only
// thing that differs, and it is a class rather than an inline colour for the reason the whole
// stylesheet follows: no colour literal outside `:root`.

import { ids } from "../core/registry.js";
import { el, mount } from "../core/dom.js";
import { describeEnding } from "../gameOver/describeEnding.js";

let root = null;
let panel = null;
let titleEl = null;
let subtitleEl = null;
let playedForEl = null;
let bodyEl = null;
let standingsEl = null;
let onNewGame = null;
let onMainMenu = null;
let onSound = null;

/** Render one description block. The vocabulary is `p` and `h`, and nothing else. */
function blockElement(block) {
    if (block.kind === "h") {
        return el("h3", { class: "game-over-heading", text: block.text });
    }
    return el("p", { class: "game-over-paragraph", text: block.text });
}

/** The final table, as rows. Empty standings render nothing rather than an empty table. */
function standingsTable(rows) {
    if (!rows || rows.length === 0) {
        return [];
    }
    return [
        el("h3", { class: "game-over-heading", text: "Final standings" }),
        el("table", { class: "game-over-standings" }, [
            el("tr", { class: "game-over-standings-head" }, [
                el("th", { text: "Country" }),
                el("th", { text: "Territories" }),
                el("th", { text: "Share" })
            ]),
            ...rows.map(row => el("tr", {}, [
                el("td", { text: row.country }),
                el("td", { text: String(row.territories) }),
                el("td", { text: Math.round(row.share * 100) + "%" })
            ]))
        ])
    ];
}

export function create({ onNewGame: newGameHandler, onMainMenu: mainMenuHandler,
    onSound: soundHandler } = {}) {
    if (root) return root;
    onNewGame = newGameHandler ?? null;
    onMainMenu = mainMenuHandler ?? null;
    onSound = soundHandler ?? null;

    titleEl = el("h2", { id: ids.gameOverTitle, class: "game-over-title" });
    subtitleEl = el("p", { id: ids.gameOverSubtitle, class: "game-over-subtitle" });
    playedForEl = el("p", { id: ids.gameOverPlayedFor, class: "game-over-played-for" });
    bodyEl = el("div", { id: ids.gameOverBody, class: "game-over-body" });
    standingsEl = el("div", { id: ids.gameOverStandings, class: "game-over-standings-pane" });

    panel = el("div", { id: ids.gameOverPanel, class: "game-over-panel" }, [
        el("div", { class: "game-over-header" }, [titleEl, subtitleEl, playedForEl]),
        el("div", { class: "game-over-columns" }, [bodyEl, standingsEl]),
        el("div", { class: "options-actions" }, [
            el("button", {
                id: ids.gameOverViewMapBtn,
                class: ["options-button", "options-button-ghost"],
                text: "View Final Map",
                on: { click: () => { onSound?.(); hide(); } }
            }),
            el("button", {
                id: ids.gameOverMenuBtn,
                class: ["options-button", "options-button-ghost"],
                text: "Main Menu",
                on: { click: () => { onSound?.(); hide(); onMainMenu?.(); } }
            }),
            el("button", {
                id: ids.gameOverNewGameBtn,
                class: ["options-button", "options-button-primary"],
                text: "New Game",
                on: { click: () => { onSound?.(); hide(); onNewGame?.(); } }
            })
        ])
    ]);

    root = el("div", { id: ids.gameOverContainer, class: "options-scrim" }, panel);
    //Deliberately NO scrim-click handler and NO Escape handler. See the note at the top:
    //there is nothing to dismiss to.
    root.style.display = "none";
    mount(document.body, root);
    return root;
}

/**
 * Draw one ending and raise the screen.
 *
 * @param {object} result   the `GAME_OVER` payload, verbatim
 * @param {{standings?: object, playerCountry?: string|null}} [context]
 *        `standings` is a snapshot taken AT the ending -- see the note at the top about why
 *        this is not read here.
 */
export function show(result, context = {}) {
    if (!root) create();
    const ending = describeEnding(result, context);

    titleEl.textContent = ending.title;
    subtitleEl.textContent = ending.subtitle;
    playedForEl.textContent = ending.playedFor;
    bodyEl.replaceChildren(...ending.body.map(blockElement));
    standingsEl.replaceChildren(...standingsTable(ending.standings));

    //The tone is a class and never an inline colour: `style.css` may carry no colour literal
    //outside `:root`, and a themed page has to be able to say what victory looks like.
    panel.setAttribute("data-tone", ending.tone);

    root.style.display = "flex";
    //Focus New Game so the keyboard works without a click and a screen reader lands on the
    //thing a player is most likely to want next.
    document.getElementById(ids.gameOverNewGameBtn)?.focus();
    return ending;
}

export function hide() {
    if (!root) return;
    root.style.display = "none";
}

export function isOpen() {
    return Boolean(root) && root.style.display !== "none";
}

export function destroy() {
    //No listener list to unwind: every handler here is declared inline on the element it
    //belongs to, so removing the root removes them with it. `on()` and a `removers` array are
    //what a component needs when it attaches to something it does not own -- `document`, or an
    //element built elsewhere -- and this one attaches to nothing outside itself.
    root?.remove();
    root = null;
    panel = titleEl = subtitleEl = playedForEl = bodyEl = standingsEl = null;
    onNewGame = onMainMenu = onSound = null;
}

export const gameOver = { create, show, hide, isOpen, destroy };
