import { activityPanel } from "../selectors.js";

/**
 * The military activity feed (Phase 7.4).
 *
 * Note what this page object deliberately does NOT offer: a way to assert the
 * TEXT of an entry. The wording is derived when a row is drawn and is pinned by
 * `tests/unit/ui-activity-feed.spec.js`; an e2e spec matching on the sentence
 * would test the phrasing twice and the behaviour not at all. What is here is
 * everything the wording hides -- which turn a row is filed under, whether the
 * player is a party to it, and what tone it took.
 */
export class ActivityPanelPage {
    constructor(page) {
        this.page = page;
        this.container = page.locator(activityPanel.container);
        this.panel = page.locator(activityPanel.panel);
        this.button = page.locator(activityPanel.button);
        this.closeButton = page.locator(activityPanel.close);
        this.startOfTurnToggle = page.locator(activityPanel.appearsAtStartOfTurn);
    }

    async isOpen() {
        return (
            (await this.container.evaluate((el) => getComputedStyle(el).display)) !== "none"
        );
    }

    async buttonVisible() {
        return (
            (await this.page
                .locator(activityPanel.buttonContainer)
                .evaluate((el) => getComputedStyle(el).display)) !== "none"
        );
    }

    async open() {
        if (await this.isOpen()) return;
        await this.button.click();
    }

    async close() {
        if (!(await this.isOpen())) return;
        await this.closeButton.click();
    }

    /** Every turn section, newest first: its number, whether it is open, its size. */
    async turnSections() {
        return this.page.locator(activityPanel.turnGroup).evaluateAll((nodes) =>
            nodes.map((node) => ({
                turn: Number(node.getAttribute("data-turn")),
                open: node.classList.contains("is-open"),
                entries: node.querySelectorAll(".activity-entry").length,
            }))
        );
    }

    section(turn) {
        return this.page.locator(`${activityPanel.turnGroup}[data-turn="${turn}"]`);
    }

    async toggleSection(turn) {
        await this.section(turn).locator(activityPanel.turnHeader).click();
    }

    /**
     * The rows currently on screen, as their PROPERTIES.
     *
     * `kind` comes from `data-kind`, `tone` from the class, and `fontSize` is read
     * computed because the player-involvement rule is expressed as a size and
     * asserting the class alone would not catch a stylesheet that stopped applying
     * it.
     */
    async visibleEntries() {
        return this.page
            .locator(`${activityPanel.turnGroup}.is-open ${activityPanel.entry}`)
            .evaluateAll((nodes) =>
                nodes.map((node) => ({
                    kind: node.getAttribute("data-kind"),
                    player: node.classList.contains("is-player"),
                    tone: ["tone-victory", "tone-loss", "tone-siege"].find((t) =>
                        node.classList.contains(t)
                    ),
                    fontSize: parseFloat(getComputedStyle(node).fontSize),
                    hasIcon: node.querySelector("svg") !== null,
                }))
            );
    }

    /** Write one entry through the real recorder. See the note in testHooks.js. */
    async record(entry) {
        return this.page.evaluate((one) => window.__game.recordActivity(one), entry);
    }

    /** The log as data, straight from the store side. */
    async log() {
        return this.page.evaluate(() => window.__game.activity());
    }

    async startOfTurnEnabled() {
        return (await this.startOfTurnToggle.getAttribute("aria-pressed")) === "true";
    }

    async toggleStartOfTurn() {
        await this.startOfTurnToggle.click();
    }
}
