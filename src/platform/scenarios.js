// The scenario loader: put the world into a named state that clicking cannot reach.
//
// Several things the suite needs to assert are impractical to set up through the UI --
// a rout, an all-naval defender, two concurrent sieges, a territory at zero food. Every
// one of them is one line of state and a great many clicks, and hoping the live map
// produces one is a seed lottery, not a test.
//
// docs/04-e2e-test-plan.md section 3.7 specifies this as a Phase 4 deliverable, because
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
                    startingTerritoryPop: defender.territoryPopulation,
                    defenseBonusColor: "rgb(0,255,0)",
                    foodCapacityColor: "rgb(0,255,0)",
                    productiveTerritoryPopColor: "rgb(0,255,0)"
                },
                defender.uniqueId
            )
        );
        report.sieges.push({ side, territory: defender.territoryName });
    }

    return report;
}
