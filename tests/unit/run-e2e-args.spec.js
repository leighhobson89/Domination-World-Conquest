import { describe, expect, it } from "vitest";

import { ISOLATED_AREAS, isArea, planRun } from "../run-e2e.mjs";

// The runner's command line is the one part of the harness that cannot be checked
// by running the harness: a mistake here produces a run of the wrong specs, or of
// none, and Playwright reports that as a pass. These assert the argv -> Playwright
// argument translation without starting a browser.

describe("run-e2e argument handling", () => {
    it("treats a bare word as a folder under tests/e2e/", () => {
        const plan = planRun(["attack"], {});
        expect(plan.areas).toEqual(["attack"]);
        expect(plan.playwrightArgs).toEqual(["tests/e2e/attack"]);
        expect(plan.unknown).toEqual([]);
    });

    it("adds every extra word as a further folder, in the order given", () => {
        const plan = planRun(["attack", "turn-loop", "siege"], {});
        expect(plan.areas).toEqual(["attack", "turn-loop", "siege"]);
        expect(plan.playwrightArgs).toEqual([
            "tests/e2e/attack",
            "tests/e2e/turn-loop",
            "tests/e2e/siege",
        ]);
    });

    it("uses forward slashes, because Playwright reads a positional arg as a regex", () => {
        for (const arg of planRun(["attack", "siege"], {}).playwrightArgs) {
            expect(arg).not.toContain("\\");
        }
    });

    it("names the same area once however many times it is given", () => {
        expect(planRun(["attack", "attack"], {}).areas).toEqual(["attack"]);
    });

    it("runs the whole suite when no area is named", () => {
        const plan = planRun([], {});
        expect(plan.areas).toEqual([]);
        expect(plan.playwrightArgs).toEqual([]);
    });

    it("rejects a word that is not an area rather than running nothing", () => {
        const plan = planRun(["attack", "atack"], {});
        expect(plan.unknown).toEqual(["atack"]);
    });

    it("forwards a word that can only be a path or a regex", () => {
        const plan = planRun(["attack/multi-territory.spec.js:42"], {});
        expect(plan.unknown).toEqual([]);
        expect(plan.playwrightArgs).toEqual(["attack/multi-territory.spec.js:42"]);
    });

    it("still accepts the older --category form, inline or separated", () => {
        expect(planRun(["--category", "siege"], {}).areas).toEqual(["siege"]);
        expect(planRun(["--category=siege"], {}).areas).toEqual(["siege"]);
    });

    it("forwards Playwright's own flags untouched, with the folders last", () => {
        const plan = planRun(["--headed", "attack", "--repeat-each=2"], {});
        expect(plan.playwrightArgs).toEqual(["--headed", "--repeat-each=2", "tests/e2e/attack"]);
        expect(plan.isHeaded).toBe(true);
    });

    it("consumes --slow itself: it is slowMo for the config, not a Playwright flag", () => {
        expect(planRun(["--slow"], {}).slowMo).toBe(500);
        expect(planRun(["--slow=1000"], {}).slowMo).toBe(1000);
        expect(planRun(["--slow=1000"], {}).playwrightArgs).toEqual([]);
        expect(planRun([], {}).slowMo).toBe(0);
    });

    it("gives bootstrap the machine to itself, since it asserts wall-clock budgets", () => {
        expect(planRun(["bootstrap"], {}).perfOnly).toBe(true);
        expect(planRun(["bootstrap", "attack"], {}).perfOnly).toBe(false);
        expect(planRun([], {}).perfOnly).toBe(false);
    });

    it("reads an area straight off the filesystem, so a new folder needs no code change", () => {
        expect(isArea("attack")).toBe(true);
        expect(isArea("no-such-area")).toBe(false);
        expect(isArea("")).toBe(false);
    });
});

describe("areas that must have the machine to themselves", () => {
    // This was a convention for a long time -- "run the battle area alone, one worker" --
    // and a convention is the wrong shape for it, because the failures it prevents do not
    // look like load. They look like defects: a spec timing out, or a seeded-outcome spec
    // reporting that the same seed came out differently the second time. Both send whoever
    // reads the report hunting a game bug that is not there. So it is enforced by the
    // runner, and these are what stop it being quietly removed.

    it("holds every isolated area back into a phase of its own, on one worker", () => {
        for (const name of Object.keys(ISOLATED_AREAS)) {
            const phases = planRun([name], {}).phases;
            expect(phases).toHaveLength(1);
            expect(phases[0]).toMatchObject({ name, workers: "1" });
        }
    });

    it("never lets an isolated area share a phase with anything else", () => {
        const plan = planRun(["battle", "attack", "siege"], {});
        for (const phase of plan.phases) {
            const isolated = phase.areas.filter((name) => name in ISOLATED_AREAS);
            if (isolated.length) {
                expect(phase.areas).toEqual(isolated);
                expect(phase.workers).toBe("1");
            }
        }
        expect(plan.phases.some((phase) => phase.areas.includes("battle"))).toBe(true);
    });

    it("splits the WHOLE SUITE too, which is the run that used to get this wrong", () => {
        // `npm run test:e2e` names no area at all, so there was nothing to hold back:
        // battle ran at full parallelism alongside everything else, every single time.
        const plan = planRun([], {});
        expect(plan.phases.length).toBeGreaterThan(1);

        const battle = plan.phases.find((phase) => phase.name === "battle");
        expect(battle).toBeDefined();
        expect(battle.workers).toBe("1");
        expect(battle.playwrightArgs).toEqual(["tests/e2e/battle"]);

        const shared = plan.phases.find((phase) => phase.name === "shared");
        expect(shared.areas).not.toContain("battle");
        expect(shared.areas.length).toBeGreaterThan(1);
    });

    it("isolates a single spec path inside an isolated area as well as the area name", () => {
        const plan = planRun(["battle/rout.spec.js:42"], {});
        expect(plan.phases).toHaveLength(1);
        expect(plan.phases[0].workers).toBe("1");
        expect(plan.phases[0].playwrightArgs).toEqual(["battle/rout.spec.js:42"]);
    });

    it("leaves a run with nothing isolated in it as a single phase", () => {
        const plan = planRun(["attack", "siege"], {});
        expect(plan.phases).toHaveLength(1);
        expect(plan.phases[0].workers).toBe("");
        expect(plan.playwrightArgs).toEqual(["tests/e2e/attack", "tests/e2e/siege"]);
    });

    it("keeps headed mode one phase, because a person is watching it", () => {
        const plan = planRun(["battle", "attack", "--headed"], {});
        expect(plan.phases).toHaveLength(1);
        expect(plan.phases[0].workers).toBe("1");
    });

    it("still gives the bootstrap budgets the machine when they are the whole run", () => {
        expect(planRun(["bootstrap"], {}).phases[0].workers).toBe("1");
    });
});
