import { test, expect } from "../../support/fixtures.js";

// The register itself: that it exists, that it is sparse, that a pair is ONE record, and that
// it survives a save.
//
// Diplomacy stage 6, and the deferred half of stage 0. A relation is the kind of thing a spec
// cannot reach by clicking -- 207 countries make 21,321 pairs, a pair with no record is at no
// contact, and the whole register is derived from a walk of the map. `window.__game.relations()`
// is the only way to see it, which is exactly why the hook exists.
//
// What is NOT asserted here is any wording. `describeState()` and the panel's reasons are pure
// and are pinned in `tests/unit/state-diplomacy.spec.js` and
// `tests/unit/ui-diplomacy-panel.spec.js`.

test.describe("the register is sparse and shared", () => {
    test("holds a record only for pairs whose borders have met", async ({
        startedGame: game,
    }) => {
        const relations = await game.diplomacy.relations();
        // 21,321 pairs exist; a fraction of one per cent of them have touched. The number
        // that matters is not the exact count -- it moves with the seed -- but that the
        // register is a small fraction of the possible pairs rather than all of them.
        expect(relations.length).toBeGreaterThan(0);
        expect(relations.length).toBeLessThan(21321 / 2);
    });

    test("answers the same for a pair whichever way round it is asked", async ({
        startedGame: game,
    }) => {
        // ONE RECORD PER UNORDERED PAIR. This is known-issue BS designed out rather than
        // asserted after the fact: five straits in `manualAdjacencyExceptions.js` were listed
        // on one side only for the life of the project, and a one-way relation would be worse
        // -- the country on the wrong side of it would plan a war its opponent did not know
        // it was in.
        const relations = await game.diplomacy.relations();
        const sample = relations.slice(0, 12);
        expect(sample.length).toBeGreaterThan(0);

        for (const row of sample) {
            const forwards = await game.diplomacy.between(row.a, row.b);
            const backwards = await game.diplomacy.between(row.b, row.a);
            expect(backwards.state, `${row.a} / ${row.b}`).toBe(forwards.state);
        }
    });

    test("refuses to put a pair back to no contact", async ({ startedGame: game }) => {
        // Contact is a thing that has HAPPENED, and un-happening it is what a "we have never
        // met" bug would look like. A border that closes up again never undoes a
        // relationship.
        const [row] = await game.diplomacy.relations();
        test.skip(!row, "no relations at this seed");

        await game.diplomacy.setRelation(row.a, row.b, "war");
        // `setRelationState()` warns rather than throwing, and a console.error would fail the
        // spec -- so what is asserted is the state, which must not have moved.
        await game.diplomacy.setRelation(row.a, row.b, "noContact");
        expect((await game.diplomacy.between(row.a, row.b)).state).toBe("war");
    });
});

test.describe("a ceasefire carries its clock", () => {
    test("is written with an expiry and reverts to what it was signed out of", async ({
        startedGame: game,
    }) => {
        // Q2's answer: the agreement REMEMBERS. A rule that guessed at expiry cannot work,
        // because with NEUTRAL as first contact "back to war" and "back to neutral" are
        // genuinely different outcomes and the register keeps no history to reconstruct the
        // right one from.
        const [row] = await game.diplomacy.relations();
        test.skip(!row, "no relations at this seed");

        await game.diplomacy.setRelation(row.a, row.b, "war");
        await game.diplomacy.setRelation(row.a, row.b, "ceasefire");

        const stored = (await game.diplomacy.relations()).find(
            (one) => (one.a === row.a && one.b === row.b) || (one.a === row.b && one.b === row.a)
        );
        expect(stored.state).toBe("ceasefire");
        expect(stored.until).toBeGreaterThan(await game.turn());
        expect(stored.revertsTo).toBe("war");
    });
});

test.describe("the register survives a save", () => {
    test("comes back with the same states after a load", async ({
        startedGame: game,
        page,
    }) => {
        const [row] = await game.diplomacy.relations();
        test.skip(!row, "no relations at this seed");

        await game.diplomacy.setRelation(row.a, row.b, "peace");
        const before = await game.diplomacy.relations();

        await page.evaluate(() => window.__game.saveNow());
        const code = await page.evaluate(() => window.__game.saveCode());

        await game.diplomacy.setRelation(row.a, row.b, "war");
        expect((await game.diplomacy.between(row.a, row.b)).state).toBe("war");

        await page.evaluate((one) => window.__game.loadCode(one), code);
        await page.waitForTimeout(1500);

        const after = await game.diplomacy.relations();
        expect(after.length).toBe(before.length);
        expect((await game.diplomacy.between(row.a, row.b)).state).toBe("peace");
    });
});
