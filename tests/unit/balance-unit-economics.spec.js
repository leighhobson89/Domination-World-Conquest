// What a gold, a person and a barrel of oil buy in combat -- economy phase, stage 4.1 (audit D4).
//
// This file pins a SHAPE, not a set of numbers, and the distinction is the whole point. Before
// stage 4 the four unit types were economically identical: productive population cost exactly
// 1.00 per unit of force for every one of them, and upkeep cost exactly 0.050 gold per thousand
// force for every one of them. Nothing but the die modifiers and the siege score distinguished
// an infantryman from a battleship, so "which unit should I buy" was never an economic question
// and infantry strictly dominated naval in open battle -- same force per gold, same force per
// person, same upkeep, and no oil bill.
//
// What replaced it is a trade rather than a ranking: a vehicle buys force with far fewer PEOPLE
// and pays for it in gold, upkeep and oil. So a populous poor country and a rich thinly-peopled
// one field visibly different armies, which is what D4 asked for.
//
// The two constraints in audit section 5 -- "what is right and must not be broken" -- are
// asserted here as well, because they are what stop a future tuning pass from quietly undoing
// the one genuine economic decision the military layer already offers.

import { describe, expect, it } from "vitest";

import {
    INFANTRY_IN_A_TROOP,
    armyCostPerTurn,
    armyGoldPrices,
    armyProdPopPrices,
    armyTypeSiegeValues,
    oilRequirements,
    vehicleArmyPersonnelWorth
} from "../../src/config/balance.js";

const TYPES = ["infantry", "assault", "air", "naval"];
const VEHICLES = ["assault", "air", "naval"];

/** Force one unit of a type is worth in a battle -- what `combinedForce()` weighs. */
const forceOf = (type) => vehicleArmyPersonnelWorth[type];

/**
 * Gold, population and upkeep per unit of FORCE.
 *
 * Infantry is the awkward one and deliberately not special-cased away: one infantry "purchase"
 * is a troop of `INFANTRY_IN_A_TROOP` soldiers, so its gold price and its population price are
 * both per-troop while its personnel worth is per-soldier. Dividing by force is what puts all
 * four types in the same units.
 */
function perForce(type) {
    const unitsOfForce = type === "infantry" ? INFANTRY_IN_A_TROOP : forceOf(type);
    return {
        gold: armyGoldPrices[type] / unitsOfForce,
        prodPop: armyProdPopPrices[type] / unitsOfForce,
        upkeep: armyCostPerTurn[type] / unitsOfForce,
        siege: armyTypeSiegeValues[type] * (type === "infantry" ? INFANTRY_IN_A_TROOP : 1) /
            armyGoldPrices[type]
    };
}

describe("unit economics differentiate the four types (audit D4)", () => {
    it("no longer charges every type the same population per unit of force", () => {
        // This was 1.00 for all four, exactly, which is what made prod-pop a pure army-size cap
        // and never a reason to prefer one unit over another.
        const rates = TYPES.map((type) => perForce(type).prodPop);
        expect(new Set(rates).size).toBeGreaterThan(1);
    });

    it("no longer charges every type the same upkeep per unit of force", () => {
        // Likewise 0.050 gold per thousand force for all four.
        const rates = TYPES.map((type) => perForce(type).upkeep);
        expect(new Set(rates).size).toBeGreaterThan(1);
    });

    it("makes a vehicle cheap in PEOPLE and dear in gold, upkeep and oil", () => {
        const infantry = perForce("infantry");
        for (const type of VEHICLES) {
            const vehicle = perForce(type);
            expect(vehicle.prodPop).toBeLessThan(infantry.prodPop);
            expect(vehicle.upkeep).toBeGreaterThan(infantry.upkeep);
            expect(oilRequirements[type]).toBeGreaterThan(0);
        }
    });

    it("orders the vehicles: the heavier the platform, the fewer people and the more upkeep", () => {
        // Assault -> air -> naval is the order of both `vehicleArmyPersonnelWorth` and
        // `oilRequirements`, so the two new dials follow it rather than crossing it.
        const ordered = VEHICLES.map(perForce);
        for (let index = 1; index < ordered.length; index++) {
            expect(ordered[index].prodPop).toBeLessThan(ordered[index - 1].prodPop);
            expect(ordered[index].upkeep).toBeGreaterThan(ordered[index - 1].upkeep);
        }
    });

    it("leaves infantry the cheapest force per person a country can raise", () => {
        // The other half of the trade. A country with people and no money still has an army.
        expect(armyProdPopPrices.infantry).toBe(INFANTRY_IN_A_TROOP);
    });
});

describe("what stage 4 must not break (audit section 5)", () => {
    it("keeps vehicles five to six times better per gold in a SIEGE", () => {
        const infantry = perForce("infantry").siege;
        for (const type of VEHICLES) {
            const ratio = perForce(type).siege / infantry;
            expect(ratio).toBeGreaterThanOrEqual(5);
            expect(ratio).toBeLessThanOrEqual(6);
        }
    });

    it("keeps vehicles no better than infantry per gold in OPEN BATTLE", () => {
        // Siege-versus-battle is the one genuine economic decision the military layer offers,
        // and oil is what prices it. Stage 4 moved population and upkeep precisely so that it
        // could leave the gold prices -- and therefore both halves of this tension -- alone.
        const infantry = perForce("infantry").gold;
        for (const type of VEHICLES) {
            expect(perForce(type).gold).toBeGreaterThanOrEqual(infantry);
        }
    });

    it("keeps the oil gate on every vehicle and off infantry", () => {
        expect(oilRequirements.infantry).toBeUndefined();
        expect(oilRequirements.naval).toBeGreaterThan(oilRequirements.air);
        expect(oilRequirements.air).toBeGreaterThan(oilRequirements.assault);
    });
});
