import { test, expect } from "../../support/fixtures.js";
import { battle as battleSelectors } from "../../support/selectors.js";

// The three panels the overhaul added to make the mechanic visible.
//
// Complaint two and complaint three in docs/battle_overhaul.md section 2 are "the mechanic is
// invisible" and "the modifiers are hidden". Three panels answer them, and all three are pure
// renders of what the model already computed -- so what these specs really assert is that the
// explanation and the battle cannot disagree:
//
//   * the FORCE LEDGER (B.6.3) -- how many dice each side rolls this round, and why;
//   * the ROUND LOG (B.6.4) -- every round fought, newest first;
//   * the ATTACK PREVIEW (B.6.7) -- the same itemisation BEFORE INVADE!, live as units are
//     allocated, with an honest forecast underneath it.
//
// The preview is the one worth being careful about. The bar above it shows `winProbability()`,
// which is the attacker's share of the two strengths and decides how many DICE each side rolls;
// it is not the chance of taking the territory. `battleForecast()` answers that by playing the
// battle out five hundred times on a stream of its own. Both are on screen and they are allowed
// to differ -- what must not happen is the preview quietly showing one and calling it the other.

test.describe("the attack window's dice preview", () => {
    test.setTimeout(180_000);

    test("itemises the dice, and appears only once force is committed", async ({ game }) => {
        await game.start({ country: "Germany", seed: "preview-itemised" });
        await game.loadScenario("evenly-matched");

        await game.openAttackWindow({ from: "Germany", to: "France" });

        // Nothing allocated: there is no fight to itemise, and "1 die against 4" for an empty
        // army would read as advice.
        await expect(game.page.locator(battleSelectors.attackPreview)).toBeHidden();

        // The multiplier starts on "All", so one press commits the whole garrison of that type.
        await game.transferAttack.plus("Germany", "naval", 1);

        await expect(game.page.locator(battleSelectors.attackPreview)).toBeVisible();
        const you = await game.page.locator(battleSelectors.attackPreviewAttacker).innerText();
        const them = await game.page.locator(battleSelectors.attackPreviewDefender).innerText();

        expect(you).toMatch(/\d+ (die|dice)/);
        expect(them).toMatch(/\d+ (die|dice)/);
        expect(you).toContain("YOU");
        expect(them).toContain("THEM");

        // The defender's tie advantage is worth about seventeen points a pairing -- more than
        // anything in the modifier list -- so it is stated even though it is not a modifier.
        expect(them, "ties are the defender's real advantage and must be said")
            .toContain("ties go to them");
    });

    test("forecasts the take probability, the rounds and the survivors", async ({ game }) => {
        await game.start({ country: "Germany", seed: "preview-forecast" });
        await game.loadScenario("evenly-matched");
        await game.openAttackWindow({ from: "Germany", to: "France" });
        await game.transferAttack.plus("Germany", "naval", 1);

        const forecast = await game.page.locator(battleSelectors.attackPreviewForecast).innerText();
        expect(forecast).toMatch(/\d+% to take it/);
        expect(forecast).toMatch(/\d+(–\d+)? rounds/);
        expect(forecast).toContain("survivors");
    });

    test("is stable: the same allocation forecasts the same figure twice", async ({ game }) => {
        // The forecast rng is seeded from a stable hash of the SETUP, not from the clock. A
        // figure that flickered between 66% and 69% while the plus button was held would be
        // indistinguishable from the effect of the units being added.
        await game.start({ country: "Germany", seed: "preview-stable" });
        await game.loadScenario("evenly-matched");
        await game.openAttackWindow({ from: "Germany", to: "France" });
        await game.transferAttack.plus("Germany", "naval", 1);

        const first = await game.page.locator(battleSelectors.attackPreviewForecast).innerText();

        // Close the window and build the identical allocation again. That is a full re-render
        // from a cleared preview, so an equal figure is a statement about the SEED rather than
        // about nothing having happened.
        await game.transferAttack.close();
        await expect(game.page.locator(battleSelectors.attackPreview)).toBeHidden();

        await game.openAttackWindow({ from: "Germany", to: "France" });
        await game.transferAttack.plus("Germany", "naval", 1);

        const second = await game.page.locator(battleSelectors.attackPreviewForecast).innerText();
        expect(second).toBe(first);
    });

    test("is cleared when the window closes, so the next attack does not inherit it", async ({
        game
    }) => {
        await game.start({ country: "Germany", seed: "preview-cleared" });
        await game.loadScenario("evenly-matched");
        await game.openAttackWindow({ from: "Germany", to: "France" });
        await game.transferAttack.plus("Germany", "naval", 1);
        await expect(game.page.locator(battleSelectors.attackPreview)).toBeVisible();

        await game.transferAttack.close();
        await expect(game.page.locator(battleSelectors.attackPreview)).toBeHidden();
    });
});

test.describe("the battle window's ledger and round log", () => {
    test.setTimeout(180_000);

    async function openAndFightOne(game, seed) {
        await game.start({ country: "Germany", seed });
        await game.loadScenario("evenly-matched");
        await game.launchWholeGarrison({ from: "Germany", to: "France" });
        await game.battle.advanceRound(); // "Begin War!" -- starts the battle, fights no round
        await game.page.waitForTimeout(80);
        await game.battle.advanceRound(); // one round
        await game.page.waitForTimeout(160);
    }

    test("the ledger names both sides' dice once a round has been rolled", async ({ game }) => {
        await openAndFightOne(game, "ledger-rows");

        await expect(game.page.locator(battleSelectors.ledger)).toBeVisible();
        const you = await game.page.locator(battleSelectors.ledgerAttacker).innerText();
        const them = await game.page.locator(battleSelectors.ledgerDefender).innerText();
        expect(you).toMatch(/\d+ (die|dice)/);
        expect(them).toMatch(/\d+ (die|dice)/);
    });

    test("the round log starts collapsed, counts the rounds, and opens on demand", async ({
        game
    }) => {
        await openAndFightOne(game, "round-log");

        const toggle = game.page.locator(battleSelectors.roundLogToggle);
        const list = game.page.locator(battleSelectors.roundLogList);

        // Collapsed by default: it is the detail behind a decision already made, and a window
        // that opened with a wall of history in it would bury the two controls that matter.
        await expect(list).toBeHidden();
        await expect(toggle).toContainText("(1)");

        await toggle.click();
        await expect(list).toBeVisible();
        // R1 -- and the row carries the dice counts and what the round cost both sides.
        await expect(list).toContainText("R1");
        await expect(list).toContainText("won");

        await game.battle.advanceRound();
        await game.page.waitForTimeout(160);
        await expect(toggle).toContainText("(2)");
        // Newest FIRST: a battle can run to thirty rounds and the one wanted is always the last.
        const rows = await list.locator(".battleRoundLogRow").allInnerTexts();
        expect(rows.length).toBe(2);
        expect(rows[0]).toContain("R2");
        expect(rows[1]).toContain("R1");
    });

    test("the log is empty again when the next battle opens", async ({ game }) => {
        await openAndFightOne(game, "round-log-reset");
        await expect(game.page.locator(battleSelectors.roundLogToggle)).toContainText("(1)");

        await game.battle.retreat.click({ force: true });
        await game.page.waitForTimeout(300);
        await game.dismissBlockingPanels();

        await game.loadScenario("evenly-matched");
        await game.launchWholeGarrison({ from: "Germany", to: "France" });
        await expect(game.page.locator(battleSelectors.roundLogToggle)).toContainText("(0)");
        await expect(game.page.locator(battleSelectors.roundLogList)).toBeHidden();
    });
});
