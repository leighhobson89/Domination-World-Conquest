import { test, expect } from "../../support/fixtures.js";

// A territory besieged by one AI from another AI keeps ITS OWN country's colour.
//
// The regression this guards: `endPlayerTurn()` re-asserts the fill on every path
// that is under siege or freshly conquered, because those paths keep their stroke
// decoration rather than the plain black reset the others get. It used to paint
// `playerColour()` on all of them, whoever owned them -- so every AI territory
// besieged by another AI took the player's colour, with the player nowhere near
// the war. With the colour picker left on its default white that showed up as a
// growing patch of blank territories (45 after four turns, 55 after eight, never
// shrinking); with any other colour picked it painted AI land as though the player
// held it.
//
// It compounded, which is why it never washed out: `saveMapColorState()` runs three
// lines later and captures the wrong fill, so every subsequent
// `restoreMapColorState()` replayed it.
//
// The AI besieges heavily and unprompted (docs/04-known-issues.md section 6), so a
// handful of turns is enough to produce dozens of AI-vs-AI sieges without the
// player doing anything but end turns.

/** Every path whose fill disagrees with the colour its owning country should paint it. */
function misPaintedTerritories(page) {
    return page.evaluate(() => {
        const doc = document.getElementById("svg-map").contentDocument;
        const normalise = (colour) => (colour ?? "").replace(/\s+/g, "").toLowerCase();
        const wrong = [];
        let besieged = 0;

        for (const path of doc.querySelectorAll("path[uniqueid]")) {
            if (path.getAttribute("underSiege") === "true") besieged += 1;

            const territory = window.__game.territory(path.getAttribute("territory-name"));
            // The player's own territories are painted the player's colour by design.
            if (!territory || territory.owner === "Player" || !territory.countryColor) continue;

            if (normalise(territory.countryColor) !== normalise(path.getAttribute("fill"))) {
                wrong.push({
                    name: territory.territoryName,
                    owner: territory.owner,
                    fill: path.getAttribute("fill"),
                    expected: territory.countryColor,
                    underSiege: path.getAttribute("underSiege") === "true",
                });
            }
        }
        return { wrong, besieged };
    });
}

test.describe("the colour of a besieged AI territory", () => {
    test("stays its own country's, through several turns of AI-vs-AI sieges", async ({ game, page }) => {
        await game.start({ country: "Ireland", seed: "besieged-colouring" });

        await game.playTurns(4);

        const { wrong, besieged } = await misPaintedTerritories(page);

        // Guard the guard: if the AI stopped besieging, this spec would pass without
        // testing anything.
        expect(besieged, "the AI should have laid sieges by turn 5").toBeGreaterThan(0);
        expect(
            wrong,
            `AI territories painted a colour that is not their country's: ${JSON.stringify(wrong.slice(0, 5), null, 2)}`
        ).toEqual([]);
    });
});
