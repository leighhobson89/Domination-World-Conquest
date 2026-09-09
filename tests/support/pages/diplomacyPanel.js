import { diplomacyPanel, tooltipOpinion, tooltipRelations } from "../selectors.js";

/**
 * The diplomacy panel, and the register drawn on the map's tooltip.
 *
 * What this page object deliberately does NOT offer is a way to assert what a refusal SAYS.
 * The reasons are built by `proposalOutcomeFor()` and `countryDetail()`, both pure, and
 * `tests/unit/ai-negotiation.spec.js` and `tests/unit/ui-diplomacy-panel.spec.js` own every
 * sentence between them -- the same division the activity feed keeps. What is here is
 * everything the wording hides: whether a control is offered at all, whether it is enabled,
 * what the register actually holds afterwards, and whether the panel and the store agree.
 */
export class DiplomacyPanelPage {
    constructor(page) {
        this.page = page;
        this.container = page.locator(diplomacyPanel.container);
        this.panel = page.locator(diplomacyPanel.panel);
        this.button = page.locator(diplomacyPanel.button);
        this.closeButton = page.locator(diplomacyPanel.close);
        this.summary = page.locator(diplomacyPanel.summary);
        this.list = page.locator(diplomacyPanel.list);
        this.detail = page.locator(diplomacyPanel.detail);
        this.answer = page.locator(diplomacyPanel.answer);
        this.search = page.locator(diplomacyPanel.search);
    }

    async isOpen() {
        return (
            (await this.container.evaluate((el) => getComputedStyle(el).display)) !== "none"
        );
    }

    async buttonVisible() {
        return (
            (await this.page
                .locator(diplomacyPanel.buttonContainer)
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

    /** Every country in the list, with the tone class the register gave it. */
    async rows() {
        return this.list.locator("[data-country]").evaluateAll((nodes) =>
            nodes.map((node) => ({
                country: node.getAttribute("data-country"),
                selected: node.getAttribute("aria-pressed") === "true",
                tone: ["is-hostile", "is-caution", "is-friendly", "is-muted"].find((t) =>
                    node.classList.contains(t)
                ),
            }))
        );
    }

    async select(country) {
        await this.list.locator(`[data-country="${country}"]`).click();
    }

    /**
     * The five actions as the panel is offering them right now.
     *
     * `enabled` is read from `aria-disabled` and NOT from the `disabled` property, which is
     * the rule the battle bar and the steppers both record: a disabled control that cannot
     * be hovered cannot explain itself, and the whole argument for this panel is that it has
     * room for the sentence saying what would change the answer.
     */
    async actions() {
        return this.detail.locator("[data-action]").evaluateAll((nodes) =>
            nodes.map((node) => ({
                kind: node.getAttribute("data-action"),
                enabled: node.getAttribute("aria-disabled") !== "true",
                label: node.textContent.trim(),
                reason: node.getAttribute("title") ?? "",
            }))
        );
    }

    /** Press one of the five. `force`, because they are disabled by class and not property. */
    async act(kind) {
        await this.detail.locator(`[data-action="${kind}"]`).click({ force: true });
    }

    /** What the other side said, or null when nothing has been asked yet. */
    async lastAnswer() {
        if ((await this.answer.count()) === 0) return null;
        return {
            text: (await this.answer.textContent()) ?? "",
            accepted: await this.answer.evaluate((el) =>
                el.classList.contains("is-friendly")),
        };
    }

    // --- the register itself ------------------------------------------------
    //
    // A relation is exactly the kind of thing a spec cannot reach by clicking: the register
    // is sparse, derived from a walk of the map, and carried by no DOM anywhere except the
    // rows above and the tooltip below.

    async relations() {
        return this.page.evaluate(() => window.__game.relations());
    }

    async between(a, b) {
        return this.page.evaluate(
            ([one, two]) => window.__game.relationBetween(one, two), [a, b]);
    }

    async setRelation(a, b, state, options = null) {
        return this.page.evaluate(
            ([one, two, value, opts]) => window.__game.setRelation(one, two, value, opts),
            [a, b, state, options]
        );
    }

    /** The tooltip's relation rows for whatever is under the pointer. */
    async tooltipRows() {
        return this.page.locator(`${tooltipRelations.row}`).evaluateAll((nodes) =>
            nodes.map((node) => ({
                text: node.textContent.trim(),
                tone: ["is-hostile", "is-caution", "is-friendly", "is-muted"].find((t) =>
                    node.classList.contains(t)
                ),
            }))
        );
    }

    async tooltipHasRelations() {
        return (await this.page.locator(tooltipRelations.heading).count()) > 0;
    }

    /**
     * The opinion bars on the tooltip, in the order they are drawn.
     *
     * The WIDTH is read as well as the words, because the geometry is the half a unit test
     * cannot see: `opinionBar.js` returns an offset and a width as percentages and `ui.js`
     * writes them onto an inline style, so a bar that computes correctly and is drawn at zero
     * width is a passing unit suite and an invisible control.
     */
    async tooltipOpinionBars() {
        return this.page.locator(tooltipOpinion.row).evaluateAll((nodes, classes) =>
            nodes.map((node) => ({
                text: node.querySelector("." + classes.label)?.textContent.trim() ?? "",
                width: node.querySelector("." + classes.fill)?.style.width ?? "",
                left: node.querySelector("." + classes.fill)?.style.left ?? "",
                tone: ["is-hostile", "is-caution", "is-friendly", "is-muted"].find((t) =>
                    node.classList.contains(t)
                ),
            })),
        { label: tooltipOpinion.label.slice(1), fill: tooltipOpinion.fill.slice(1) });
    }
}
