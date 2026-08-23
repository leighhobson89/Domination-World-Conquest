import { battle, containers } from "../selectors.js";

/**
 * The battle UI and its results screen.
 *
 * Every numeric assertion here is coarse-grained on purpose: seeding
 * Math.random does NOT make combat reproducible while addSparklesRegularly()
 * shares the global stream (docs/04-e2e-test-plan.md section 2.2), so specs
 * assert invariants -- totals only decrease, ownership transfers, the right
 * screen appears -- not exact survivor counts. That changes at refactor Phase 5.
 */
export class BattlePage {
    constructor(page) {
        this.page = page;
        this.container = page.locator(containers.battle);
        this.results = page.locator(containers.battleResults);
        this.advance = page.locator(battle.advance);
        this.retreat = page.locator(battle.retreat);
        this.siege = page.locator(battle.siege);
        this.percentage = page.locator(battle.percentage);
    }

    async isOpen() {
        return (await this.container.evaluate((el) => getComputedStyle(el).display)) !== "none";
    }

    async resultsShown() {
        return (await this.results.evaluate((el) => getComputedStyle(el).display)) !== "none";
    }

    /** The win probability as a number, e.g. "63%" -> 63. */
    async probability() {
        const text = await this.percentage.innerText();
        return Number(text.replace(/[^0-9.-]/g, ""));
    }

    /**
     * Per-unit-type counts for one side.
     *
     * There is only ONE row of quantities in the battle UI -- `armyRowRow1*` are
     * the icons, `armyRowRow2Quantity1..8` are the numbers, with 1-4 the attacker
     * (infantry, assault, air, naval) and 5-8 the defender. The defender's cells
     * can read "12 / 30" (remaining / starting) during a siege, hence the split
     * on "/". Refactor Phase 6.8 replaces these numeric ids with semantic ones.
     */
    async armyRow(side) {
        return this.page.evaluate((which) => {
            const first = which === 1 ? 1 : 5;
            const values = [];
            for (let i = first; i < first + 4; i += 1) {
                const cell = document.getElementById(`armyRowRow2Quantity${i}`);
                values.push(cell ? cell.innerText.trim().split("/")[0].trim() : null);
            }
            return values;
        }, side);
    }

    async advanceRound() {
        await this.advance.click();
    }

    async resultsSummary() {
        return this.page.evaluate(() => {
            const read = (id) => document.getElementById(id)?.innerText.trim() ?? null;
            return {
                kills: read("battleResultsRow2Row3Kills"),
                losses: read("battleResultsRow2Row3Losses"),
                captured: read("battleResultsRow3Row2Captured"),
                survived: read("battleResultsRow3Row2Survived"),
                rounds: read("battleResultsRow3Row3RoundsCount"),
                siegeStats: read("battleResultsRow3Row3SiegeStats"),
            };
        });
    }

    /** The results screen's single button: "Accept Victory!" / "Accept Defeat!". */
    async acceptResult() {
        await this.page.locator(`${containers.battleResults} button`).first().click();
    }
}
