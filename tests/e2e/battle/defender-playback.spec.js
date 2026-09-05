import { test, expect } from "../../support/fixtures.js";
import { battle as battleSelectors, ids } from "../../support/selectors.js";

// Watching a battle you DEFENDED.
//
// Battle overhaul B.8, and B.8.4 is this file. It was the one thing the overhaul shipped without
// an end-to-end test, and the reason is recorded in the checklist: playback needs an AI country to
// attack a PARTICULAR player territory on a PARTICULAR turn, which is a seed lottery rather than
// something a scenario can arrange.
//
// What CAN be arranged is the record. `recordDefence()` is exactly what `doAttack()` calls once it
// has fought the battle to its conclusion, and the record is the WHOLE input to the playback --
// nothing is read back off the world when it draws, deliberately, because by then the territory
// may have changed hands (known-issues AS). So `window.__game.queueDefence()` bypasses the AI turn
// and nothing else: the queue, the reversed sides, the ledger, the timer, the Skip control and the
// window's restoration afterwards are all the real path, and all of it was previously untested.
//
// THE SIDES ARE REVERSED, and that is the assertion that matters most here. In the record the
// "attacker" is the AI; the player is looking at their own garrison, so the ledger's YOU column is
// the record's DEFENDER. Getting this backwards would be worse than not building the feature at
// all -- a player watching their own defeat labelled as their attack would trust nothing else in
// the window.
//
// docs/archived/battle_overhaul.md section 4.11.

/**
 * A record of two rounds, shaped exactly as `doAttack()` builds one.
 *
 * The numbers are chosen so the two sides are impossible to confuse: the AI attacker rolls 5 dice
 * and holds 900,000 infantry, the player's garrison rolls 2 and holds 60,000. If the window ever
 * showed 5 dice in the YOU column, the sides are the wrong way round.
 */
function defenceRecord(territoryId, territoryName) {
    const round = (n, attackersAfter, defendersAfter) => ({
        round: n,
        share: 0.8,
        attackerDice: 5,
        defenderDice: 2,
        attackerFaces: [6, 5, 4, 3, 2],
        defenderFaces: [4, 1],
        modifiers: {
            attacker: { rows: [{ key: "air", label: "air superiority", face: 1 }], total: 1, diceChange: 0 },
            defender: { rows: [{ key: "fortification", label: "their fortifications and terrain", dice: -1 }], total: 0, diceChange: 0 }
        },
        //`pairings` is an ARRAY of pairing objects -- one per contested pairing plus one per
        //unmatched die -- and it used to be written here as `{ attacker: 1, defender: 4 }`,
        //which is the LOSS COUNTS wearing the name of the pairings. Nothing read it, so
        //nothing said so; the clash panel reads it now, and a panel handed an object finds no
        //pairings and stays down. A fixture that does not have the shape of the thing it
        //stands in for is a fixture that will pass while the feature is broken.
        //
        //Five attacker dice against two defenders: three contested, three unmatched, and the
        //ties go to the defender exactly as the rules have it.
        pairings: [
            { attackerFace: 6, defenderFace: 4, attackerValue: 7, defenderValue: 4,
                attackerWins: true, tied: false, unmatched: false },
            { attackerFace: 5, defenderFace: 1, attackerValue: 6, defenderValue: 1,
                attackerWins: true, tied: false, unmatched: false },
            { attackerFace: 4, defenderFace: null, attackerValue: 5, defenderValue: null,
                attackerWins: true, tied: false, unmatched: true },
            { attackerFace: 3, defenderFace: null, attackerValue: 4, defenderValue: null,
                attackerWins: true, tied: false, unmatched: true },
            { attackerFace: 2, defenderFace: null, attackerValue: 3, defenderValue: null,
                attackerWins: true, tied: false, unmatched: true }
        ],
        attackerLosses: 1,
        defenderLosses: 4,
        attackerDugIn: false,
        defenderDugIn: false,
        attackersBefore: n === 1 ? [900000, 0, 0, 0] : [810000, 0, 0, 0],
        defendersBefore: n === 1 ? [60000, 0, 0, 0] : [36000, 0, 0, 0],
        attackersAfter,
        defendersAfter,
        state: n === 2 ? "defender-routed" : "in-progress"
    });

    return {
        attackerCountry: "France",
        //Copied into the record when the battle was fought, so the AI's dice are thrown in its
        //own colour rather than in the neutral token -- and so that nothing has to ask the map
        //who owns the territory after the battle has changed hands.
        attackerColour: "rgb(200,60,60)",
        defenderCountry: "Germany",
        territoryId,
        territoryName,
        startingAttackers: [900000, 0, 0, 0],
        startingDefenders: [60000, 0, 0, 0],
        records: [
            round(1, [810000, 0, 0, 0], [36000, 0, 0, 0]),
            round(2, [729000, 0, 0, 0], [21600, 0, 0, 0])
        ],
        state: "defender-routed",
        tookTerritory: true
    };
}

/**
 * Turn the "always skip" preference off for this page.
 *
 * `tests/support/fixtures.js` sets it for EVERY spec, deliberately -- replaying an animation at
 * the end of every AI phase would add seconds to every spec that ends a turn. That is the
 * player's own setting rather than a harness-only path, which is what makes it safe to turn back
 * off here rather than reaching past it.
 */
async function watchPlaybacks(game) {
    await game.page.evaluate(() => window.__game.setAlwaysSkipPlayback(false));
}

test.describe("watching a battle you defended", () => {
    test.setTimeout(120_000);

    test("the queue drains without showing anything when the player has asked to skip", async ({
        game
    }) => {
        await game.start({ country: "Germany", seed: "playback-skipped" });
        const territory = await game.territory("Germany");

        // The fixture set this already; assert it rather than assuming, because the whole
        // behaviour under test hangs off it.
        expect(await game.page.evaluate(
            () => window.localStorage.getItem("battlePlayback.alwaysSkip")
        )).toBe("1");

        await game.page.evaluate(
            (record) => window.__game.queueDefence(record),
            defenceRecord(territory.uniqueId, territory.territoryName)
        );
        expect(await game.page.evaluate(() => window.__game.pendingDefences())).toBe(1);

        await game.page.evaluate(() => window.__game.playQueuedDefences());

        // Drained, not left for some later turn -- the battles have already been fought, and a
        // queue that survived would replay them at the start of a turn they had nothing to do
        // with.
        expect(await game.page.evaluate(() => window.__game.pendingDefences())).toBe(0);
        await expect(game.page.locator(battleSelectors.advance)).toBeHidden();
    });

    test("the window opens, names the attacker, and shows the player's own garrison as YOU", async ({
        game
    }) => {
        await game.start({ country: "Germany", seed: "playback-sides" });
        await watchPlaybacks(game);
        const territory = await game.territory("Germany");

        await game.page.evaluate(
            (record) => window.__game.queueDefence(record),
            defenceRecord(territory.uniqueId, territory.territoryName)
        );
        // Deliberately NOT awaited: the playback resolves only when it has finished or been
        // skipped, and the assertions below are about it while it is running.
        await game.page.evaluate(() => { window.__playback = window.__game.playQueuedDefences(); });

        await expect(game.page.locator(battleSelectors.ledger)).toBeVisible();
        await expect(game.page.locator("#battleUITitleTitleCenter")).toHaveText("attacks");
        await expect(game.page.locator("#battleUITitleTitleLeft")).toContainText("France");

        // The first round has to land before the ledger says anything -- it is redrawn per round.
        await expect
            .poll(async () => game.page.locator(battleSelectors.ledgerAttacker).innerText(),
                { timeout: 8000 })
            .toContain("dice");

        const you = await game.page.locator(battleSelectors.ledgerAttacker).innerText();
        const them = await game.page.locator(battleSelectors.ledgerDefender).innerText();

        // THE ASSERTION THIS FILE EXISTS FOR. The record's defender is the player, so the two
        // dice belong in YOU and the five in THEM.
        expect(you, "the player's own garrison rolled 2 dice, and it is the YOU column")
            .toContain("2 dice");
        expect(them, "the AI attacker rolled 5 dice, and it is the THEM column")
            .toContain("5 dice");

        // The modifiers are swapped with them. The record's DEFENDER row is the fortification,
        // which is the player's -- so it must appear on the player's side.
        expect(you).toContain("fortifications");
        expect(them).toContain("air superiority");
    });

    test("the bar is one Skip button, and pressing it ends the playback and restores the bar", async ({
        game
    }) => {
        await game.start({ country: "Germany", seed: "playback-skip-button" });
        await watchPlaybacks(game);
        const territory = await game.territory("Germany");

        await game.page.evaluate(
            (record) => window.__game.queueDefence(record),
            defenceRecord(territory.uniqueId, territory.territoryName)
        );
        await game.page.evaluate(() => { window.__playback = window.__game.playQueuedDefences(); });

        // A replay has no decisions in it, so everything except Skip is off the bar.
        await expect(game.page.locator(battleSelectors.advance)).toHaveText("Skip");
        await expect(game.page.locator(battleSelectors.retreat)).toBeHidden();
        await expect(game.page.locator(battleSelectors.digIn)).toBeHidden();
        await expect(game.page.locator(battleSelectors.reserves)).toBeHidden();
        await expect(game.page.locator(battleSelectors.lastPush)).toBeHidden();

        // Battle overhaul B.8.2 was drawn but never WIRED: the label was written straight onto
        // the advance button and the press fell through into the battle state machine, where it
        // did whatever the last real battle had left behind. This is the regression test for it.
        await game.battle.advanceRound();

        await expect.poll(
            async () => game.page.evaluate(() => window.__game.pendingDefences()),
            { timeout: 8000 }
        ).toBe(0);

        // And the window closes rather than leaving a one-button bar over the map.
        await expect(game.page.locator(battleSelectors.ledger)).toBeHidden();
    });

    test("two queued defences are shown one after the other", async ({ game }) => {
        await game.start({ country: "Germany", seed: "playback-two" });
        await watchPlaybacks(game);
        const territory = await game.territory("Germany");

        const pending = await game.page.evaluate((record) => {
            window.__game.queueDefence(record);
            return window.__game.queueDefence({ ...record, attackerCountry: "Poland" });
        }, defenceRecord(territory.uniqueId, territory.territoryName));
        expect(pending, "a turn can produce several -- it is a queue, not a slot").toBe(2);

        await game.page.evaluate(() => { window.__playback = window.__game.playQueuedDefences(); });

        await expect(game.page.locator("#battleUITitleTitleLeft")).toContainText("France");
        await game.battle.advanceRound(); // skip the first

        await expect.poll(
            async () => game.page.locator("#battleUITitleTitleLeft").innerText(),
            { timeout: 8000 }
        ).toContain("Poland");

        await game.battle.advanceRound(); // skip the second
        await expect.poll(
            async () => game.page.evaluate(() => window.__game.pendingDefences()),
            { timeout: 8000 }
        ).toBe(0);
    });

    test("the clash panel plays during a replay, exactly as it does for the player", async ({
        game
    }) => {
        // The complaint this closes, in the words it was made in: the AI attacking a player
        // territory "shows no clash ui at all and the rolls are much too fast". The panel was
        // simply never called from the playback path -- `drawRound()` wrote the armies and the
        // ledger and threw the dice, and nothing said what the dice MEANT. The one screen in the
        // game whose whole job is to make the rules legible was missing from the one battle the
        // player has no control over.
        await game.start({ country: "Germany", seed: "playback-clash" });
        await watchPlaybacks(game);
        const territory = await game.territory("Germany");

        await game.page.evaluate(
            (record) => window.__game.queueDefence(record),
            defenceRecord(territory.uniqueId, territory.territoryName)
        );
        await game.page.evaluate(() => { window.__playback = window.__game.playQueuedDefences(); });

        // The frame goes up at once and blank; the faces wait for the dice to come to rest.
        // Both, in that order, because the order is the feature -- a panel that filled itself in
        // on a timer would sometimes print the result while the dice were still in the air.
        await expect(game.page.locator(battleSelectors.clashPanel)).toBeVisible({ timeout: 20_000 });
        await expect(game.page.locator(`${battleSelectors.clashPanel}.is-revealed`))
            .toBeVisible({ timeout: 25_000 });

        const rows = game.page.locator(`${battleSelectors.clashPairs} .clashPair`);
        expect(await rows.count(), "one row per pairing -- five dice against two is five rows")
            .toBe(5);

        // NOT MIRRORED, and this is the assertion that pins the decision. The ledger's columns
        // are YOU and THEM and have to be swapped; the panel NAMES both sides, so there is
        // nothing to misread -- and mirroring it would make it state the rules wrongly, because
        // "tie -- defender holds" is the defender's advantage and the defender here is the
        // player. So the panel shows the round as it was fought: the AI attacks.
        const header = await game.page.locator(battleSelectors.clashPanel).innerText();
        expect(header).toContain("France");
        expect(header).toContain("Germany");
    });

    test("a replayed round is paced off the dice, not off a fixed interval", async ({ game }) => {
        // `ROUND_INTERVAL = 900` on a `setInterval` was the whole of the old pacing, and it was
        // faster than a throw takes to settle -- so round two's dice were thrown over round
        // one's, and the clash panel, which is chained to the dice coming to REST, never got a
        // chance to say anything. A round is a chain now: throw, settle, reveal, read, next.
        await game.start({ country: "Germany", seed: "playback-pacing" });
        await watchPlaybacks(game);
        const territory = await game.territory("Germany");

        await game.page.evaluate(
            (record) => window.__game.queueDefence(record),
            defenceRecord(territory.uniqueId, territory.territoryName)
        );

        const started = Date.now();
        await game.page.evaluate(() => window.__game.playQueuedDefences());
        const elapsed = Date.now() - started;

        // Two rounds, each of which has to wait for its dice and then leave the account of the
        // round up long enough to read. Under the old interval the whole replay was 1.8s.
        expect(elapsed, "two rounds must not flash past").toBeGreaterThan(4000);
        expect(await game.page.evaluate(() => window.__game.pendingDefences())).toBe(0);
    });

    test("a real battle opened after a playback has its whole bar back", async ({ game }) => {
        await game.start({ country: "Germany", seed: "playback-then-attack" });
        await watchPlaybacks(game);
        const territory = await game.territory("Germany");

        await game.page.evaluate(
            (record) => window.__game.queueDefence(record),
            defenceRecord(territory.uniqueId, territory.territoryName)
        );
        await game.page.evaluate(() => { window.__playback = window.__game.playQueuedDefences(); });
        await expect(game.page.locator(battleSelectors.advance)).toHaveText("Skip");
        await game.battle.advanceRound();
        await expect.poll(
            async () => game.page.evaluate(() => window.__game.pendingDefences()),
            { timeout: 8000 }
        ).toBe(0);

        // Hiding the other four buttons by hand at the call site -- which is what B.8 shipped --
        // left them hidden for the NEXT real battle until something happened to show them again.
        // Skip is a state of the bar's own machine now, so opening an attack resets it.
        await game.loadScenario("evenly-matched");
        await game.launchWholeGarrison({ from: "Germany", to: "France" });

        await expect(game.page.locator(battleSelectors.advance)).toHaveText("Begin War!");
        await expect(game.page.locator(battleSelectors.retreat)).toBeVisible();
        await expect(game.page.locator(battleSelectors.retreat)).toHaveText("Retreat!");
    });
});
