import { test, expect } from "../../support/fixtures.js";
import { DiplomaticState } from "../../../src/state/diplomacy.js";

// A WAR OPENED AGAINST THE PLAYER IS PUT TO THEM, NOT ONLY LOGGED.
//
// Reported by Leigh: a country declaring war on the player showed up in the activity feed and
// nowhere else. A war opened against you is the single most consequential thing that can happen
// on somebody else's turn, and it was the quietest thing in the game.
//
// IT IS A NOTICE AND NOT A QUESTION, which is the whole reason it needed new plumbing rather
// than a third `InboxKind` shaped like the other two. A declaration takes effect at once and
// cannot be refused -- Leigh's rule for the whole system -- so offering two buttons would ask
// the player to decide something that has already happened. `dismissOnly` hides the cancel
// button, and the assertion below is on exactly that.
//
// WHY IT RIDES THE INBOX. The declaration is made inside the AI turn, in the middle of a loop
// over two hundred countries; a modal raised there stops the turn dead. It is queued and
// drained by `showQueuedDiplomacy()` at the end of the turn, the same arrangement the call to
// arms and the unsolicited offer already have.
//
// THIS WAS FIRST WRITTEN AS A TEN-TURN GAME AND THAT VERSION IS NOT WORTH KEEPING, which is
// worth recording because the reasoning for it was sound. Letting a real AI declare is the most
// honest possible test, and it works: playing a ONE-TERRITORY country, three neighbours declare
// on turn 7 -- the first turn they may, since `PLAYER_GRACE_TURNS` is 5. (Germany is never
// declared on at all across fifteen turns, which is `opportunistWeakness` working correctly and
// makes a large country useless here.) But ten turns of a 207-country AI game is minutes of
// wall clock, and under four workers it exceeded `endTurn()`'s own 120-second budget and failed
// -- a spec that passes alone and fails in a suite is worse than no spec.
//
// So the declaration is written through the register instead, with the same `by` and `via`
// annotations the AI's own path writes. That is not a shortcut past the mechanism: the notice
// is DERIVED from `DIPLOMACY_CHANGED` precisely so that no route can miss it, and this exercises
// the derivation, the queue, the drain and the dialog. What it does not exercise is the AI's
// decision to declare, which `tests/unit/ai-diplomacy.spec.js` owns.

test.describe("being declared on", () => {
    /** The player's own country name, which is what the register is keyed by. */
    async function playerCountry(game) {
        return game.page.evaluate(
            () => window.__game.territoriesOwnedBy("Player")?.[0]?.dataName ?? null);
    }

    /** Record every dialog as it is written, before the driver answers it. */
    async function watchDialogs(game) {
        await game.page.evaluate(() => {
            window.__seenDialogs = [];
            const title = document.getElementById("confirm-dialog-title");
            new MutationObserver(() => {
                const box = document.getElementById("confirm-dialog-container");
                if (box && box.style.display !== "none") {
                    window.__seenDialogs.push({
                        title: title.textContent,
                        dismissOnly: document.getElementById("confirm-dialog-cancel").hidden,
                    });
                }
            }).observe(title, { childList: true, characterData: true, subtree: true });
        });
    }

    test("raises a notice with one button, and the turn still ends", async ({ game }) => {
        await game.start({ country: "Germany", seed: "declaration-notice" });
        await watchDialogs(game);

        const player = await playerCountry(game);
        expect(player).toBeTruthy();
        await game.diplomacy.setRelation("France", player, DiplomaticState.WAR, {
            by: "France",
            via: "declared",
        });

        //A WHOLE TURN, not `endTurn()`. The driver's `endTurn()` presses the phase button ONCE
        //and then waits for the counter; pressed from Buy/Upgrade that only reaches the
        //Military phase, so the counter never moves and the wait times out with the button
        //still offering END TURN. `playTurn()` is the complete cycle, and the queue is drained
        //at the end of it -- after the defences, because a call answered over a
        //battle-results screen would be answered through it.
        await game.playTurn();

        const seen = await game.page.evaluate(() => window.__seenDialogs);
        const declarations = seen.filter(entry => entry.title.includes("declares war on you"));

        expect(declarations, "the declaration never reached the player").toHaveLength(1);
        expect(declarations[0].title).toContain("France");
        //ONE BUTTON. A notice the player could "decline" would be a lie about what it is.
        expect(declarations[0].dismissOnly).toBe(true);

        //AND THE TURN STILL ENDS. The failure this rules out is the ugly one: a notice whose
        //only button the harness does not know how to press blocks the turn loop for the rest
        //of the run, and the symptom is a timeout somewhere else entirely.
        expect(await game.turn()).toBeGreaterThan(1);
    });

    test("says nothing when the PLAYER is the one who declared", async ({ game }) => {
        //A war the player opened is not news to them, and it is the commonest transition of
        //the three this listener sees.
        await game.start({ country: "Germany", seed: "declaration-notice-own" });
        await watchDialogs(game);

        await game.declareWarOn("France");
        await game.playTurn();

        const seen = await game.page.evaluate(() => window.__seenDialogs);
        expect(seen.filter(entry => entry.title.includes("declares war on you"))).toHaveLength(0);
    });

    test("says nothing when a ceasefire simply lapses", async ({ game }) => {
        //A pair arriving at WAR is not always something somebody DID, which is the whole
        //reason `via` is annotated. A clock running out is not an act -- and the player agreed
        //to the clock, which the ceasefire row states.
        await game.start({ country: "Germany", seed: "declaration-notice-lapse" });
        const player = await playerCountry(game);
        await watchDialogs(game);

        await game.diplomacy.setRelation("France", player, DiplomaticState.WAR, {
            by: null,
            via: "expired",
        });
        await game.playTurn();

        const seen = await game.page.evaluate(() => window.__seenDialogs);
        expect(seen.filter(entry => entry.title.includes("declares war on you"))).toHaveLength(0);
    });
});
