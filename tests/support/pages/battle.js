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

    /**
     * The attack window's probability bar, before INVADE! is pressed.
     *
     * Since combat checklist item 1.9 this is `takeProbability()` -- the chance of actually
     * taking the territory, the same quantity `siegeGateOdds()` returns and the AI decides on.
     * It is NOT `probability()` above, which is the battle UI's live strength ratio. Two specs
     * in `attack/` used to read that one while the attack window was open, where it is empty:
     * `Number("")` is 0, and every assertion on it passed against a number nobody had written.
     */
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

    /**
     * Take the clash panel down if it is up, and leave everything else alone.
     *
     * THE CLASH PANEL IS MODAL NOW. It used to carry `pointer-events: none`, so a click aimed
     * at the advance button went straight through it; it raises a full-screen scrim instead,
     * and a click aimed at any battle-window button lands on that. The harness has to know,
     * the same way it had to learn about the ending screen -- and the failure has the same
     * shape, a click that "intercepts pointer events" reading exactly like a game defect.
     *
     * TWO PRESSES, because that is what the control does: the first finishes the animation,
     * the second takes the panel down. Driven by dispatching a click on the scrim rather than
     * by reaching into the module, so the spec exercises the listener a player would.
     */
    async dismissClashPanel() {
        await this.page.evaluate((scrimId) => {
            for (let press = 0; press < 2; press += 1) {
                const scrim = document.getElementById(scrimId);
                if (!scrim || getComputedStyle(scrim).display === "none") {
                    return;
                }
                scrim.click();
            }
        }, battle.clashScrimId);
    }

    async advanceRound() {
        //The clash panel from the PREVIOUS round is modal and sits over this button.
        await this.dismissClashPanel();
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

    /**
     * Retreat, with the clash panel out of the way first.
     *
     * `retreat` is a bare locator and four specs click it directly. Since the clash panel
     * became modal a forced click at those coordinates lands on the SCRIM instead -- and
     * because the panel takes itself down after its seven-second linger, the specs went on
     * passing while testing nothing. That is the worst outcome available, so the retreat has
     * a method now and the locator is kept only for assertions.
     */
    async retreatFromBattle() {
        await this.dismissClashPanel();
        await this.retreat.click({ force: true });
    }

    /** The bottom bar's third button while it carries the "Last Push!" offer (overhaul B.7). */
    get lastPush() {
        return this.page.locator(battle.lastPush);
    }

    async takeLastPush() {
        await this.dismissClashPanel();
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
        await this.dismissClashPanel();
        await this.page.locator(battle.digIn).click({ force: true });
    }

    async digInArmed() {
        return this.page.evaluate((id) => !!document.getElementById(id)?.classList.contains("is-armed"),
            battle.digInId);
    }

    async commitReserves() {
        await this.dismissClashPanel();
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
        //The results screen sits UNDER the clash panel: a battle that ends on its last round
        //leaves the account of that round up on top of the button this is aiming at.
        await this.dismissClashPanel();
        await this.page.locator(`${containers.battleResults} button`).first().click();
    }
}
