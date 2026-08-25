import { test, expect } from "../../support/fixtures.js";
import { cls, tables } from "../../support/selectors.js";

// The Wars and Sieges tab, for a war that is OVER.
//
// The ongoing-siege case is covered in `tabs.spec.js`. This file is about the rows
// that describe a finished war, and it exists because of one bug:
//
//   The "Defending Country" column read `war.defendingTerritory.dataName`, and
//   `dataName` is the CURRENT owner of a territory -- it changes on conquest. So for
//   any war the attacker WON, the defending-country column showed the ATTACKER's own
//   flag, because by the time the row was drawn the attacker owned the place.
//
// What made it survive is that it looked right everywhere else: an ongoing siege has
// not changed hands, and a war the attacker lost has not either. The only rows it was
// ever wrong on were the ones where the territory changed hands -- which is also the
// only outcome worth looking back at.
//
// So the spec below deliberately CONQUERS rather than besieging or losing. Asserting
// the flag on any other outcome would have passed against the bug.

/** The flag `src` filenames in a war row: [attacking, defending]. */
async function warRowFlags(page) {
    return page.evaluate((rowClass) => {
        const row = document.querySelector(rowClass);
        if (!row) return null;
        return [...row.querySelectorAll("img.flag-war")].map((img) => {
            const parts = img.getAttribute("src").split("/");
            return decodeURIComponent(parts[parts.length - 1]).replace(/\.png$/, "");
        });
    }, cls.uiTableRowWar);
}

test.describe("the Wars and Sieges tab after a war ends", () => {
    test.setTimeout(300_000);

    test("names the country that was DEFENDING, not the one that now owns the territory",
        async ({ game, page }) => {
            await game.start({ country: "Germany", seed: "wars-tab-flags" });

            await game.loadScenario("outright-conquest");
            await game.launchWholeGarrison({ from: "Germany", to: "France" });
            // The exact terminal label is seed-dependent -- an overwhelming attack
            // ends as "Victory!" or as a rout depending on how the rounds fall, and
            // both take the territory. What this spec needs is the conquest, so that
            // is what it waits for rather than pinning one of the two.
            await game.fightToResolution();
            await expect.poll(async () => game.battle.resultsShown()).toBe(true);
            await game.battle.acceptResult();

            // The premise of the bug: the territory has changed hands, so `dataName`
            // now says Germany. Pinned here so a failure below is unambiguous about
            // which of the two facts moved.
            await expect.poll(async () => (await game.territory("France")).owner).toBe("Player");
            expect((await game.territory("France")).dataName).toBe("Germany");

            await game.infoTable.open();
            await game.infoTable.showWarsAndSieges();

            const text = await page.locator(tables.ui).innerText();
            expect(text, "the finished war should be listed").toContain("France");

            const flags = await warRowFlags(page);
            expect(flags, "a war row carries an attacking and a defending flag").toHaveLength(2);
            expect(flags[0], "the attacker was the player").toBe("Germany");
            expect(flags[1], "the defender was France, and still was when it lost").toBe("France");
        });
});
