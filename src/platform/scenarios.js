// The scenario loader: put the world into a named state that clicking cannot reach.
//
// Several things the suite needs to assert are impractical to set up through the UI --
// a rout, an all-naval defender, two concurrent sieges, a territory at zero food. Every
// one of them is one line of state and a great many clicks, and hoping the live map
// produces one is a seed lottery, not a test.
//
// docs/03-e2e-test-plan.md section 3.7 specifies this as a Phase 4 deliverable, because
// it is only safe once there is a single state layer to write through. There is now:
// everything here goes through `state/mutations.js`, the same path the game itself uses,
// so a scenario cannot produce a world the game could not have produced.
//
// **One deviation from the plan.** It specifies `?e2e=1&scenario=besieged-fort`, with the
// scenarios read from `tests/support/scenarios/*.json`. The preview server serves `build/`,
// not the repository, so the page cannot fetch those files. The primitive is therefore
// `window.__game.applyScenario(scenarioObject)` and the spec-side helper
// (`GameDriver.loadScenario`) reads the JSON in Node and passes it in. The scenarios stay
// where the plan puts them and the specs read the same, which is what actually mattered.
//
// Active ONLY with ?e2e=1, like everything else in this directory.

/**
 * @typedef {object} Scenario
 * @property {string} [name]
 * @property {string} [description]
 * @property {Array<{ territory: string, patch: object }>} [territories]
 * @property {Array<object>} [sieges]
 * @property {Array<{ a: string, b: string, state: string, since?: number,
 *                   until?: number }>} [relations]
 */

/**
 * Apply a scenario. Returns a report of what it did, so a spec can assert the setup
 * took rather than discovering three assertions later that it did not.
 *
 * @param {Scenario} scenario
 * @param {object} api  supplied by the caller so this module imports no game code
 */
export function applyScenario(scenario, api) {
    const report = {
        name: scenario?.name ?? null,
        territories: [],
        sieges: [],
        relations: [],
        errors: []
    };

    if (!scenario || typeof scenario !== "object") {
        report.errors.push("scenario must be an object");
        return report;
    }

    for (const entry of scenario.territories ?? []) {
        const territory = api.getTerritoryByName(entry.territory);
        if (!territory) {
            report.errors.push(`no territory named "${entry.territory}"`);
            continue;
        }
        // Straight through updateTerritory, so the map re-renders and the write guard
        // stays quiet -- a scenario is a legitimate write, not a back door.
        api.updateTerritory(territory.uniqueId, entry.patch ?? {});
        report.territories.push(entry.territory);
    }

    //THE DIPLOMACY REGISTER. A relation is exactly the kind of fact this loader exists for:
    //it is a state of the world with no route to it through the UI at all until Stage 5 of
    //the diplomacy phase ships a negotiation panel, and even then "these two have been allied
    //since turn 12" would be a long game rather than a test.
    //
    //It is applied BEFORE the sieges below, because a scenario that puts two countries at
    //peace and then stands a siege between them is describing a siege that outlived the war
    //it belongs to -- which is a real case worth testing (see Q1 in the plan) and has to be
    //set up in that order to mean anything.
    for (const entry of scenario.relations ?? []) {
        const written = api.setRelationState?.(entry.a, entry.b, entry.state, {
            since: entry.since ?? null,
            until: entry.until ?? null
        });
        if (!written) {
            //`setRelationState()` refuses an unknown state, a country paired with itself and
            //any attempt to go back to no contact, and it warns as it does. A scenario that
            //silently did not take is the failure this report exists to prevent.
            report.errors.push(
                `could not set ${entry.a} / ${entry.b} to "${entry.state}"`);
            continue;
        }
        report.relations.push({ a: entry.a, b: entry.b, state: written.state });
    }

    for (const entry of scenario.sieges ?? []) {
        const defender = api.getTerritoryByName(entry.territory);
        if (!defender) {
            report.errors.push(`no territory named "${entry.territory}" to besiege`);
            continue;
        }
        const side = entry.side === "player" ? "player" : "ai";
        const attacker = entry.attackingTerritory
            ? api.getTerritoryByName(entry.attackingTerritory)
            : null;

        const defendingArmy = entry.defendingArmy ?? [
            defender.infantryForCurrentTerritory,
            defender.useableAssault,
            defender.useableAir,
            defender.useableNaval
        ];
        const attackingArmy = entry.attackingArmy ?? [0, 0, 0, 0];

        api.addSiege(
            side,
            defender.territoryName,
            api.referenceDefendingTerritory(
                {
                    warId: entry.warId ?? api.nextWarId(side),
                    attackingCountry: entry.attackingCountry ?? attacker?.dataName ?? "Scenario",
                    attackingTerritory: entry.attackingTerritory ?? null,
                    proportionsAttackers: entry.proportionsAttackers ?? [[0, 0, 0, 0]],
                    defendingArmyRemaining: [...defendingArmy],
                    attackingArmyRemaining: [...attackingArmy],
                    turnsInSiege: entry.turnsInSiege ?? 0,
                    strokeColor: entry.strokeColor ?? "rgb(0,0,0)",
                    startingAtt: [...attackingArmy],
                    startingDef: [...defendingArmy],
                    startingDefenseBonus: defender.defenseBonus,
                    startingFoodCapacity: defender.foodCapacity,
                    startingProdPop: defender.productiveTerritoryPop,
                    startingTerritoryPop: defender.territoryPopulation
                    //Battle overhaul B.10.2. Three `"rgb(0,255,0)"` fields stood here, mirroring
                    //three on the real siege object in battle.js. Nothing ever read any of the
                    //six: the siege panel writes the colour onto the TERRITORY and reads it back
                    //from there. A colour stored on a save-able record is a presentation decision
                    //baked into a save file, which is the mistake the activity feed records.
                },
                defender.uniqueId
            )
        );
        report.sieges.push({ side, territory: defender.territoryName });
    }

    return report;
}
