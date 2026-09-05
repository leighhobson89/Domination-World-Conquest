// What a territory starts with: the two area-driven commodity capacities, at world creation.
//
// Economy phase, stage 3.2. Pure -- it takes plain numbers and returns numbers, imports only
// `config/balance.js`, and therefore runs in Node like the rest of `src/rules/economy/`. That
// last point is the reason it exists as a module at all: this arithmetic lived inside
// `assignArmyAndResourcesToPaths()` in `resourceCalculations.js`, which imports the UI, so
// `tools/econ-lab.mjs` carried its own copy of it in order to measure anything -- and a
// measuring instrument holding its own copy of the thing it measures will eventually measure
// the copy. There is one definition now and the harness imports it.
//
// audit E7 moved the two continent tables out of here into `balance.js`; audit D7 is what the
// cons-mats half of this file is now about.

import {
    CONS_MATS_POPULATION_SCALE,
    MIN_CONS_MATS_CAPACITY,
    startingConsMatsContinentModifiers,
    startingOilContinentModifiers
} from "../../config/balance.js";

/**
 * The three-term area shape both commodities have always been seeded from.
 *
 * `term2` and `term3` are both `sqrt(area)`, and `term1` is `area^1.5` scaled by how far the
 * continent modifier is from 1. AREA dominates all three, by orders of magnitude -- which is
 * the whole of audit D7 and the reason the cons-mats seed below no longer stops here.
 */
function areaTerms(area, devIndex, continentModifier) {
    const scaledArea = Math.max(0, area) / 1000;
    const term1 = Math.abs(Math.pow(scaledArea, 1.5) * devIndex * (continentModifier - 1) * 0.1);
    const term2 = Math.pow(scaledArea, 0.5) * devIndex * 50;
    const term3 = Math.pow(scaledArea, 0.5) * continentModifier * 10;
    return term1 + term2 + term3;
}

/**
 * A territory's starting oil stock, which is also its oil capacity.
 *
 * Unchanged by stage 3: oil is a thing the ground either has or has not, so a ceiling set by
 * area is the right shape for it, and the oil gate is in audit section 5's list of what must not
 * be broken. The nudge for a small territory arrives through the oil WELL instead --
 * `upgradeFlatCapacityGain.oil`, five of which fuel one warship anywhere on the map.
 *
 * @param {{area: number, devIndex: number|string, continent: string}} seed
 * @returns {number}
 */
export function initialOilCapacityFor(seed) {
    return areaTerms(
        seed.area,
        parseFloat(seed.devIndex),
        startingOilContinentModifiers[seed.continent]);
}

/**
 * A territory's starting construction materials, which is also its cons-mats capacity.
 *
 * **Economy stage 3.2, and it closes audit D7 -- the larger half of stage 3.** Construction
 * materials buy upgrades and nothing else, so this ceiling decides who is allowed into the
 * upgrade tree at all, and until this stage it was `f(area)` almost entirely. Measured, before:
 * Germany -- rich, developed, the highest income in Europe -- needed **eighty turns** of its own
 * regeneration to fill one territory's twenty upgrade slots, where China needed **one**. That is
 * a small developed country locked out of its own economy at any price, and it is exactly the
 * case the whole stage exists for: NO change to an upgrade's benefit or its price can reach a
 * player who cannot buy the thing at all.
 *
 * Two terms are added, and they are different in kind on purpose.
 *
 * **A population term.** Construction materials are made by people and industry, not by land, so
 * `sqrt(population) * devIndex` is the honest reading as well as the useful one. It is a square
 * root for the same reason the area terms are: it must lift Germany by an order of magnitude
 * without lifting China by one. Measured: Germany 1,244 -> 14,893 (x12), China 64,316 -> 110,509
 * (x1.7). The large are not taxed -- their ceiling goes UP too, just by much less.
 *
 * **A floor.** `MIN_CONS_MATS_CAPACITY` is the same instrument as `TERRITORY_BASE_INCOME` and is
 * there for the same reason: the population term does nothing for Vatican City, whose population
 * is 800, and an island with neither land nor people is the case the previous 500 floor left at
 * 171 turns of regeneration. It is what carries the very bottom of the map.
 *
 * Together, `node tools/econ-lab.mjs consmats`: the turns of regeneration needed to fill one
 * territory's upgrade slots go from a spread of 1 to 203 to a spread of 1 to 40, with the median
 * falling from 108 turns to 19. It does not flatten -- China still fills its slots in one turn
 * and an island still needs thirty -- because a flat curve would mean size had stopped paying.
 *
 * @param {{area: number, devIndex: number|string, continent: string, population: number}} seed
 * @returns {number}
 */
export function initialConsMatsCapacityFor(seed) {
    const devIndex = parseFloat(seed.devIndex);
    const fromArea = areaTerms(
        seed.area, devIndex, startingConsMatsContinentModifiers[seed.continent]);
    const fromPeople =
        Math.pow(Math.max(0, seed.population) / 1000, 0.5) * devIndex * CONS_MATS_POPULATION_SCALE;
    return Math.max(fromArea + fromPeople, MIN_CONS_MATS_CAPACITY);
}
