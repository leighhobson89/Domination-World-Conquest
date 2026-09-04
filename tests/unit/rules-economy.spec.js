// rules/economy/* and rules/events/randomEvents.js -- Phase 5.2/5.6.
//
// The economy is where the NaNs came from. Several of the defects below made a territory
// permanently wrong rather than wrong for one turn, because every later turn recomputes from
// the value the last one left -- so a single NaN or a single negative never washes out.
// Those cases have a test each, named for the defect.

import { describe, expect, it } from "vitest";

import {
    armyTotalFor,
    defenseBonusFor,
    oilDemandFor,
    totalCapacities,
    totalDemands,
    useableUnitsFor
} from "../../src/rules/economy/capacity.js";
import {
    QUIET_TURN,
    consMatsChangeFor,
    foodChangeFor,
    goldChangeFor,
    oilChangeFor,
    regenerationTowardsCapacity
} from "../../src/rules/economy/income.js";
import {
    armyMaintenanceFor,
    initialArmyAdjustmentCost
} from "../../src/rules/economy/maintenance.js";
import {
    armyStarvesInstead,
    fedPopulationOf,
    foodConsumptionOf,
    isStarving,
    planArmyStarvation,
    populationChangeFor,
    productivePopulationFor,
    productivePopulationOf,
    siegeArmyStarvationChange
} from "../../src/rules/economy/population.js";
import {
    randomEventDamageFor,
    rollRandomEventLikelihood,
    selectRandomEvent
} from "../../src/rules/events/randomEvents.js";
import {
    FOOD_UNIT_SCALE,
    INITIAL_ARMY_ADJUSTMENT_COST_PER_UNIT,
    PRODUCTIVE_POP_PERCENT,
    RANDOM_EVENTS,
    armyCostPerTurn,
    goldIncome,
    oilRequirements,
    randomEventLikelihood,
    randomEventSeverity,
    resourceRegeneration,
    vehicleArmyPersonnelWorth
} from "../../src/config/balance.js";

function constantRng(value) {
    return () => value;
}

function territory(overrides = {}) {
    return {
        uniqueId: "1",
        continent: "Europe",
        area: 100000,
        devIndex: "0.8",
        territoryPopulation: 1000000,
        productiveTerritoryPop: 300000,
        infantryForCurrentTerritory: 0,
        assaultForCurrentTerritory: 0,
        airForCurrentTerritory: 0,
        navalForCurrentTerritory: 0,
        useableAssault: 0,
        useableAir: 0,
        useableNaval: 0,
        armyForCurrentTerritory: 0,
        goldForCurrentTerritory: 1000,
        oilForCurrentTerritory: 100,
        foodForCurrentTerritory: 500,
        consMatsForCurrentTerritory: 50,
        oilCapacity: 200,
        foodCapacity: 2000000,
        consMatsCapacity: 100,
        oilDemand: 0,
        fortsBuilt: 0,
        farmsBuilt: 0,
        forestsBuilt: 0,
        oilWellsBuilt: 0,
        isLandLockedBonus: 0,
        mountainDefenseBonus: 0,
        defenseBonus: 0,
        ...overrides
    };
}

describe("regenerationTowardsCapacity", () => {
    it("recovers a share of the shortfall when below capacity", () => {
        const rates = { growth: 0.5, decay: 0.5 };
        expect(regenerationTowardsCapacity(0, 100, rates, QUIET_TURN)).toBe(50);
    });

    it("loses a share of the excess when above capacity", () => {
        const rates = { growth: 0.5, decay: 0.5 };
        expect(regenerationTowardsCapacity(200, 100, rates, QUIET_TURN)).toBe(-50);
    });

    it("does nothing at capacity", () => {
        expect(regenerationTowardsCapacity(100, 100, { growth: 1, decay: 1 }, QUIET_TURN)).toBe(0);
    });

    it("is suppressed entirely on a disaster turn", () => {
        //The player gets a turn to look at the damage before regeneration papers over it.
        const disaster = { randomEventHappening: true, randomEvent: "Oil Well Fire" };
        expect(regenerationTowardsCapacity(0, 100, { growth: 1, decay: 1 }, disaster)).toBe(0);
    });
});

describe("commodity income", () => {
    it("moves oil and construction materials towards their capacities", () => {
        const land = territory({ oilForCurrentTerritory: 0, oilCapacity: 100 });
        expect(oilChangeFor(land))
            .toBe(Math.ceil(100 * resourceRegeneration.oil.growth));

        const stocked = territory({ consMatsForCurrentTerritory: 0, consMatsCapacity: 100 });
        expect(consMatsChangeFor(stocked))
            .toBe(Math.ceil(100 * resourceRegeneration.consMats.growth));
    });

    it("compares food in people and answers in stored units", () => {
        //Food is the one resource stored scaled: one unit feeds FOOD_UNIT_SCALE people.
        const land = territory({ foodForCurrentTerritory: 0, foodCapacity: FOOD_UNIT_SCALE * 100 });
        const expected =
            Math.ceil(FOOD_UNIT_SCALE * 100 * resourceRegeneration.food.growth) / FOOD_UNIT_SCALE;
        expect(foodChangeFor(land)).toBe(expected);
    });

    it("defaults to a quiet turn when no context is given", () => {
        expect(oilChangeFor(territory({ oilForCurrentTerritory: 0, oilCapacity: 100 })))
            .toBeGreaterThan(0);
    });
});

describe("goldChangeFor", () => {
    it("earns nothing during a mutiny", () => {
        expect(goldChangeFor(territory(), { randomEventHappening: true, randomEvent: "Mutiny" }))
            .toBe(0);
    });

    it("still earns during a disaster that is not a mutiny", () => {
        const gold = goldChangeFor(
            territory(), { randomEventHappening: true, randomEvent: "Oil Well Fire" });
        expect(Number.isFinite(gold)).toBe(true);
    });

    it("produces the window floor, not NaN, from an emptied territory -- audit 5.2 AJ", () => {
        //`log10(0)` is -Infinity and `log10` of a negative is NaN; `log10(1)` is 0, so the
        //division below it was a division by zero. One NaN in a gold balance never recovers.
        //The RAW figure for an emptied territory is 0; the normalisation window then maps 0
        //onto its floor, which is the deliberate "lift small countries" behaviour and applies
        //to every territory equally.
        const empty = territory({ productiveTerritoryPop: 0, area: 0 });
        const windowFloor = (0 - goldIncome.normaliseMin) /
            (goldIncome.normaliseMax - goldIncome.normaliseMin) * 100;
        expect(goldChangeFor(empty)).toBe(windowFloor);
    });

    it("survives a negative productive population without producing NaN", () => {
        const broken = territory({ productiveTerritoryPop: -50000 });
        expect(Number.isNaN(goldChangeFor(broken))).toBe(false);
    });

    it("lets territory area matter -- audit 5.2 P", () => {
        //The area term read `Math.max(territory.area / 10000000), 1`: Math.max of one
        //argument returns that argument, and the comma operator then discarded it and
        //yielded 1. Territory area had no effect on gold income at all.
        const small = goldChangeFor(territory({ area: 1000 }));
        const large = goldChangeFor(territory({ area: 100000000 }));
        expect(large).not.toBe(small);
    });
});

describe("maintenance", () => {
    it("bills infantry on the full count and vehicles on the useable ones", () => {
        //A vehicle grounded for want of oil is not also billed for.
        const garrison = territory({
            infantryForCurrentTerritory: 100,
            assaultForCurrentTerritory: 10,
            useableAssault: 4,
            airForCurrentTerritory: 2,
            useableAir: 0,
            navalForCurrentTerritory: 0,
            useableNaval: 0
        });
        expect(armyMaintenanceFor(garrison))
            .toBe((100 * armyCostPerTurn.infantry) + (4 * armyCostPerTurn.assault));
    });

    it("costs nothing for an empty territory", () => {
        expect(armyMaintenanceFor(territory())).toBe(0);
    });

    it("prices an opening army on a single head count", () => {
        expect(initialArmyAdjustmentCost(1000))
            .toBe(1000 * INITIAL_ARMY_ADJUSTMENT_COST_PER_UNIT);
    });
});

describe("capacity and the oil gate", () => {
    it("charges oil for vehicles and nothing for infantry", () => {
        expect(oilDemandFor(territory({ infantryForCurrentTerritory: 100000 }))).toBe(0);
        expect(oilDemandFor(territory({ navalForCurrentTerritory: 3 })))
            .toBe(3 * oilRequirements.naval);
    });

    it("weighs an army from its USEABLE units", () => {
        expect(armyTotalFor({
            infantryForCurrentTerritory: 10,
            useableAssault: 1,
            useableAir: 0,
            useableNaval: 0
        })).toBe(10 + vehicleArmyPersonnelWorth.assault);
    });

    it("leaves everything useable when the territory has the oil", () => {
        const fuelled = territory({
            assaultForCurrentTerritory: 2,
            airForCurrentTerritory: 2,
            navalForCurrentTerritory: 2,
            oilForCurrentTerritory: 100000,
            oilDemand: 0
        });
        const useable = useableUnitsFor(fuelled);
        expect(useable).toMatchObject({ useableAssault: 2, useableAir: 2, useableNaval: 2 });
    });

    it("grounds units in rotation so a shortfall does not wipe out one whole arm", () => {
        const short = territory({
            assaultForCurrentTerritory: 5,
            airForCurrentTerritory: 5,
            navalForCurrentTerritory: 5,
            oilForCurrentTerritory: 0
        });
        short.oilDemand = oilDemandFor(short);
        //Only enough oil for part of the fleet: naval leads the rotation because it is the
        //thirstiest, so the shortfall closes fastest -- but air and assault lose units too.
        short.oilForCurrentTerritory = Math.floor(short.oilDemand / 2);
        const useable = useableUnitsFor(short);
        expect(useable.useableNaval).toBeLessThan(5);
        expect(useable.useableAssault + useable.useableAir + useable.useableNaval)
            .toBeGreaterThan(0);
    });

    it("terminates when the demand outlives the vehicles", () => {
        //Without the guard this spins forever -- reachable through a scenario, and through a
        //disaster that empties the oil in the same turn a fleet is bought.
        const impossible = territory({ oilDemand: 1000000, oilForCurrentTerritory: 0 });
        const useable = useableUnitsFor(impossible);
        expect(useable).toMatchObject({ useableAssault: 0, useableAir: 0, useableNaval: 0 });
    });

    it("makes the defence bonus quadratic in the fort count", () => {
        const one = defenseBonusFor(territory({ fortsBuilt: 1 }));
        const two = defenseBonusFor(territory({ fortsBuilt: 2 }));
        const three = defenseBonusFor(territory({ fortsBuilt: 3 }));
        expect(two - one).toBeLessThan(three - two);
    });

    it("adds the land-locked bonus on top", () => {
        expect(defenseBonusFor(territory({ fortsBuilt: 0, isLandLockedBonus: 7 }))).toBe(7);
    });

    it("sums capacities and demands over a set of territories", () => {
        const set = [
            territory({ oilCapacity: 1, foodCapacity: 2, consMatsCapacity: 3,
                oilDemand: 4, foodConsumption: 5 }),
            territory({ oilCapacity: 10, foodCapacity: 20, consMatsCapacity: 30,
                oilDemand: 40, foodConsumption: 50 })
        ];
        expect(totalCapacities(set)).toEqual({
            totalOilCapacity: 11,
            totalFoodCapacity: 22,
            totalConsMatsCapacity: 33
        });
        expect(totalDemands(set)).toEqual({ totalOilDemand: 44, totalFoodConsumption: 55 });
    });
});

describe("population", () => {
    it("takes the working-age share and scales it by the development index", () => {
        expect(productivePopulationFor(1000, "0.5"))
            .toBe(((1000 / 100) * PRODUCTIVE_POP_PERCENT) * 0.5);
        expect(productivePopulationOf(territory({ territoryPopulation: 1000, devIndex: "0.5" })))
            .toBe(productivePopulationFor(1000, "0.5"));
    });

    it("counts a vehicle's crew among the mouths to feed, useable or not", () => {
        //A grounded aircraft still has a crew that eats.
        const land = territory({
            territoryPopulation: 100,
            infantryForCurrentTerritory: 10,
            airForCurrentTerritory: 2,
            useableAir: 0
        });
        expect(fedPopulationOf(land)).toBe(100 + 10 + (2 * vehicleArmyPersonnelWorth.air));
    });

    it("consumes the civilians plus the army total", () => {
        expect(foodConsumptionOf(territory({
            territoryPopulation: 100,
            armyForCurrentTerritory: 25
        }))).toBe(125);
    });

    it("is starving when the stored food cannot cover everyone", () => {
        expect(isStarving(territory({
            territoryPopulation: 1000000,
            foodForCurrentTerritory: 1
        }))).toBe(true);
        expect(isStarving(territory({
            territoryPopulation: 100,
            foodForCurrentTerritory: 1000
        }))).toBe(false);
    });

    it("caps a famine at the civilian population -- audit 5.2 AJ", () => {
        //Without the third cap a famine could kill more civilians than the territory had and
        //drive the count negative, permanently.
        const starving = territory({
            territoryPopulation: 100,
            foodForCurrentTerritory: 0,
            infantryForCurrentTerritory: 5000000
        });
        const change = populationChangeFor(starving);
        expect(change).toBeLessThan(0);
        expect(starving.territoryPopulation + change).toBeGreaterThanOrEqual(0);
    });

    it("caps growth at what the surplus can feed", () => {
        const fed = territory({
            territoryPopulation: 100,
            foodForCurrentTerritory: (100 + 5) / FOOD_UNIT_SCALE
        });
        expect(populationChangeFor(fed)).toBeLessThanOrEqual(5);
    });

    it("starves the army when the workforce can no longer support it -- audit 5.1 F", () => {
        //The simulation used to SUBTRACT the population change, which is negative during a
        //famine, so the simulated population went up exactly when it should have gone down:
        //the branch never fired during a famine and fired spuriously during growth.
        const overArmed = territory({
            territoryPopulation: 1000,
            devIndex: "0.5",
            armyForCurrentTerritory: 1000000
        });
        expect(armyStarvesInstead(overArmed, -100)).toBe(true);

        const healthy = territory({ territoryPopulation: 10000000, armyForCurrentTerritory: 10 });
        expect(armyStarvesInstead(healthy, 100)).toBe(false);
    });

    it("amplifies a besieged garrison's share of the famine", () => {
        const besieged = territory({ territoryPopulation: 1000, armyForCurrentTerritory: 500 });
        expect(siegeArmyStarvationChange(besieged, -100)).toBeLessThan(-100);
    });
});

describe("planArmyStarvation", () => {
    it("takes infantry first and leaves the vehicles alone", () => {
        const garrison = territory({
            infantryForCurrentTerritory: 1000,
            useableAssault: 3,
            useableAir: 2,
            useableNaval: 1,
            armyForCurrentTerritory: 99999
        });
        const survivors = planArmyStarvation(garrison, -100);
        expect(survivors.infantryForCurrentTerritory).toBe(900);
        expect(survivors.useableAssault).toBe(3);
        expect(survivors.useableAir).toBe(2);
        expect(survivors.useableNaval).toBe(1);
    });

    it("keeps the army total equal to what is left of it -- audit 5.2 AJ", () => {
        //The legacy version zeroed the infantry and ate into the vehicles but never touched
        //`armyForCurrentTerritory`, so the total drifted away from the units it summarises --
        //observed at -32,263 on a territory still holding 549,615 infantry.
        const garrison = territory({
            infantryForCurrentTerritory: 100,
            useableAssault: 5,
            useableAir: 5,
            useableNaval: 5,
            armyForCurrentTerritory: 1
        });
        const survivors = planArmyStarvation(garrison, -100000);
        const recomputed = survivors.infantryForCurrentTerritory +
            (survivors.useableAssault * vehicleArmyPersonnelWorth.assault) +
            (survivors.useableAir * vehicleArmyPersonnelWorth.air) +
            (survivors.useableNaval * vehicleArmyPersonnelWorth.naval);
        expect(survivors.armyForCurrentTerritory).toBe(recomputed);
        expect(survivors.armyForCurrentTerritory).toBeGreaterThanOrEqual(0);
    });

    it("never leaves a negative count anywhere", () => {
        const survivors = planArmyStarvation(
            territory({ infantryForCurrentTerritory: 10, armyForCurrentTerritory: 10 }), -999999);
        for (const value of Object.values(survivors)) {
            expect(value).toBeGreaterThanOrEqual(0);
        }
    });

    it("wipes out every vehicle when the losses exactly match the infantry", () => {
        //KNOWN DEFECT, preserved deliberately (docs/04-known-issues.md, the Phase 5.2 note):
        //`remaining === 0` falls into the else branch, so a famine that exactly matches the
        //infantry destroys the whole fleet as well. Fixing it is a balance change.
        const garrison = territory({
            infantryForCurrentTerritory: 100,
            useableAssault: 4,
            useableAir: 4,
            useableNaval: 4,
            armyForCurrentTerritory: 5000
        });
        const survivors = planArmyStarvation(garrison, -100);
        expect(survivors).toMatchObject({
            infantryForCurrentTerritory: 0,
            useableAssault: 0,
            useableAir: 0,
            useableNaval: 0
        });
    });
});

describe("random events", () => {
    const disaster = (name) => ({ randomEventHappening: true, randomEvent: name });

    it("does nothing on a quiet turn", () => {
        expect(randomEventDamageFor(territory(), QUIET_TURN, constantRng(1))).toBeNull();
    });

    it("does nothing while costing a hypothetical purchase", () => {
        expect(randomEventDamageFor(
            territory(),
            { ...disaster("Mutiny"), isSimulation: true },
            constantRng(1))).toBeNull();
    });

    it("lets a territory escape harm on a low roll", () => {
        expect(randomEventDamageFor(territory(), disaster("Mutiny"), constantRng(0))).toBeNull();
    });

    it("damages the right stock for each of the four disasters -- audit 5.2 Q", () => {
        //The construction-materials branch used to test for "Forest Fire", a name nothing
        //produces, so one of the four disasters did nothing at all -- and worse than nothing,
        //because the turn's regeneration and population change were suppressed anyway.
        const land = territory();
        const fields = {
            "Warehouse Fire": "consMatsForCurrentTerritory",
            "Oil Well Fire": "oilForCurrentTerritory",
            "Food Disaster": "foodForCurrentTerritory",
            Mutiny: "goldForCurrentTerritory"
        };
        for (const event of RANDOM_EVENTS) {
            const damage = randomEventDamageFor(land, disaster(event), constantRng(1));
            expect(damage, event).not.toBeNull();
            expect(damage.field, event).toBe(fields[event]);
            expect(damage.to, event).toBeLessThan(damage.from);
        }
    });

    it("every name selectRandomEvent produces is a name that does damage", () => {
        const drawn = RANDOM_EVENTS.map((_event, index) =>
            selectRandomEvent(constantRng((index + 0.5) / RANDOM_EVENTS.length)));
        expect(drawn).toEqual(RANDOM_EVENTS);
        for (const event of drawn) {
            expect(randomEventDamageFor(territory(), disaster(event), constantRng(1))).not.toBeNull();
        }
    });

    it("ignores an event name nothing knows about", () => {
        expect(randomEventDamageFor(territory(), disaster("Plague of Frogs"), constantRng(1)))
            .toBeNull();
    });

    it("takes the mutiny's share of the gold", () => {
        const damage = randomEventDamageFor(
            territory({ goldForCurrentTerritory: 1000 }), disaster("Mutiny"), constantRng(1));
        expect(damage.to).toBe(Math.floor(1000 * randomEventSeverity.mutinyGoldMultiplier));
    });
});

describe("rollRandomEventLikelihood", () => {
    it("climbs a point per quiet turn", () => {
        const result = rollRandomEventLikelihood(0, constantRng(1));
        expect(result.happening).toBe(false);
        expect(result.nextProbabilityPercent).toBe(randomEventLikelihood.incrementPerQuietTurn);
    });

    it("fires and resets the counter when the mean falls under the chance", () => {
        const result = rollRandomEventLikelihood(100, constantRng(0));
        expect(result.happening).toBe(true);
        expect(result.nextProbabilityPercent)
            .toBe(randomEventLikelihood.startingProbabilityPercent);
    });

    it("never fires at zero probability, however low the draws", () => {
        //Averaging is what keeps a disaster off the first turns; a single draw would let one
        //land on turn 2 at a one-in-a-hundred chance.
        expect(rollRandomEventLikelihood(0, constantRng(0)).happening).toBe(true);
        expect(rollRandomEventLikelihood(0, constantRng(0.0001)).happening).toBe(false);
    });

    it("draws its full sample rather than a single number", () => {
        let draws = 0;
        rollRandomEventLikelihood(50, () => {
            draws++;
            return 0.9;
        });
        expect(draws).toBe(randomEventLikelihood.samples);
    });
});
