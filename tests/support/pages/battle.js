import { battle, containers, ids, indexedIds } from "../selectors.js";

/**
 * The battle UI and its results screen.
 *
 * Numeric assertions here were coarse-grained because seeding Math.random did not make
 * combat reproducible while addSparklesRegularly() shared the global stream (audit 5.3 Y).
 * That is closed: cosmetic randomness moved to src/platform/cosmeticRng.js in Phase 5.8, so
 * `?seed=` now makes a run repeat exactly. Exact-outcome assertions are legitimate; the
 * invariant style is kept where the invariant is the more useful thing to state.
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
        this.attackWindowPercentage = page.locator(battle.attackWindowPercentage);
    }

    async isOpen() {
        return (await this.container.evaluate((el) => getComputedStyle(el).display)) !== "none";
    }

    async resultsShown() {
        return (await this.results.evaluate((el) => getComputedStyle(el).display)) !== "none";
    }

    /**
     * The battle UI's win probability as a number, e.g. "63%" -> 63.
     *
     * NOT `#percentageAttack`: that is the ATTACK WINDOW's bar. `setAttackProbabilityOnUI()`
     * writes one or the other depending on its `situation` argument, and the attack window's
     * element keeps whatever it last showed after the window closes -- so reading it during a
     * battle reported a stale figure, usually 0, and any assertion on it was vacuous.
     */
    async probability() {
        const text = await this.percentage.innerText();
        return Number(text.replace(/[^0-9.-]/g, ""));
    }

    /** The attack window's probability bar, before INVADE! is pressed. */
    async attackProbability() {
        const text = await this.attackWindowPercentage.innerText();
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
        const first = side === 1 ? 1 : 5;
        const cellIds = [0, 1, 2, 3].map((offset) => indexedIds.armyRowQuantity(first + offset));
        return this.page.evaluate(
            (idList) =>
                idList.map((id) => {
                    const cell = document.getElementById(id);
                    return cell ? cell.innerText.trim().split("/")[0].trim() : null;
                }),
            cellIds
        );
    }

    async advanceRound() {
        //`force: true` for the reason CLAUDE.md records for the steppers, and which battle
        //overhaul B.6.6 brought to the battle bar: "inert" is `aria-disabled` plus the
        //`is-disabled` class, never the `disabled` PROPERTY. The property would swallow the
        //click, and the battle container's capture listener has to see every click over the
        //window in order to settle the dice. Playwright treats `aria-disabled="true"` as not
        //actionable, so a spec that means to press an inert button has to say so.
        await this.advance.click({ force: true });
    }

    /**
     * Is a bottom-bar button accepting presses?
     *
     * The one honest question, and it is asked of `aria-disabled` rather than of `.disabled`.
     * `GameDriver.fightToResolution()` used to read the property to decide that an attack had
     * been destroyed, which stopped being true the moment the state moved off the DOM.
     */
    async buttonEnabled(id) {
        return this.page.evaluate((elementId) => {
            const button = document.getElementById(elementId);
            return !!button && button.getAttribute("aria-disabled") !== "true"
                && getComputedStyle(button).display !== "none";
        }, id);
    }

    /** The bottom bar's third button while it carries the "Last Push!" offer (overhaul B.7). */
    get lastPush() {
        return this.page.locator(battle.lastPush);
    }

    async takeLastPush() {
        await this.lastPush.click({ force: true });
    }

    /** Whether the decisive-round offer is on the bar. */
    async lastPushOffered() {
        return this.page.evaluate((id) => {
            const button = document.getElementById(id);
            return !!button && getComputedStyle(button).display !== "none"
                && button.innerText.trim() === "Last Push!";
        }, battle.lastPushId);
    }

    /** Arm or read the two mid-battle decisions (overhaul B.7). */
    async digIn() {
        await this.page.locator(battle.digIn).click({ force: true });
    }

    async digInArmed() {
        return this.page.evaluate((id) => !!document.getElementById(id)?.classList.contains("is-armed"),
            battle.digInId);
    }

    async commitReserves() {
        await this.page.locator(battle.reserves).click({ force: true });
    }

    async resultsSummary() {
        return this.page.evaluate((cellIds) => {
            const read = (id) => document.getElementById(id)?.innerText.trim() ?? null;
            return {
                kills: read(cellIds.kills),
                losses: read(cellIds.losses),
                captured: read(cellIds.captured),
                survived: read(cellIds.survived),
                rounds: read(cellIds.rounds),
                siegeStats: read(cellIds.siegeStats),
            };
        }, {
            kills: ids.battleResultsRow2Row3Kills,
            losses: ids.battleResultsRow2Row3Losses,
            captured: ids.battleResultsRow3Row2Captured,
            survived: ids.battleResultsRow3Row2Survived,
            rounds: ids.battleResultsRow3Row3RoundsCount,
            siegeStats: ids.battleResultsRow3Row3SiegeStats,
        });
    }

    /** The results screen's single button: "Accept Victory!" / "Accept Defeat!". */
    async acceptResult() {
        await this.page.locator(`${containers.battleResults} button`).first().click();
    }
}
