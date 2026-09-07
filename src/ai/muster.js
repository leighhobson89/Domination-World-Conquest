// Moving an army to where the war is.
//
// The capability the AI has never had, and the one the turn loop has carried a TODO for since
// before the refactor: "Based on threat, move available army around between available owned
// territories". Without it every attack in the game is fought by whichever single territory
// happens to border the enemy, with whatever that one territory could raise on its own -- and
// the twenty territories safe behind it contribute nothing to the war for the whole game.
//
// That is why the world stops changing. A country cannot take a defended neighbour with one
// province's garrison, so once the undefended neighbours are gone, nothing moves: measured
// over a hundred turns, the largest empire on the map went from 31 territories to 30 while
// two hundred countries sat and looked at each other. Massing is not an optimisation of that
// behaviour, it is the missing half of it.
//
// The mechanism is deliberately simple, because armies marching one province a turn is both
// easy to reason about and what actually happens:
//
//   DEMAND    a territory that wanted to attack and could not raise decisive odds says so,
//             and the country remembers where. That is the whole feedback loop -- the front
//             asks, the interior answers, and the attack that was impossible last turn is
//             possible this turn. Nothing else in the AI adapts across turns like this.
//   SUPPLY    a territory with a real surplus over its OWN worst threat, and no demand of its
//             own. An interior province with no enemy in range is pure supply.
//   ROUTE     one hop a turn, between neighbours, along a PULL FIELD -- a breadth-first
//             search outwards from the territories that asked, so every province in the
//             empire knows how far it is from a war and which of its neighbours is one hop
//             closer to one. Troops walk towards the front over several turns rather than
//             teleporting across an empire, which is both the honest model and the one that
//             cannot accidentally strip a border on the far side of the world.
//
// THE FIELD IS THE HALF THAT WAS MISSING, and it is worth saying what it replaced, because
// the old rule looked like the same thing. A source used to qualify only if it was a DIRECT
// NEIGHBOUR of a territory that had asked. So the pull reached exactly one hop: a province
// two back was never a source, because it bordered no demand, and never became a destination
// either, because it had no enemy to fail an attack against. The unit fixture below is
// literally `Interior -- Rear -- Front`, and the only move that rule could ever produce
// there was `Rear -> Front`; Interior sat out the whole game by construction.
//
// It is invisible on most of this map, which is why it survived: 85% of countries hold one
// territory and the surviving empires are mostly frontier, so almost every province is a
// border and one hop is the whole depth. It shows up on exactly the empire that is supposed
// to be able to fight a war at a distance. Measured over 100 headless turns
// (`node tools/muster-probe.mjs`), the United States held 68 territories with 17 on the
// front line and a FIFTH of its infantry standing two or more hops back -- army that could
// not move under any circumstance for the rest of the game -- while attacking with only
// what those 17 border provinces could raise on their own.
//
// The field subsumes the old rule exactly: a territory at distance 1 sending to distance 0
// IS the move the neighbour check used to make. Everything behind it is new.
//
// VEHICLES MARCH ALONG A FUELLED CORRIDOR, AND THE OIL GATE IS WHY THAT PHRASING MATTERS.
// This used to be infantry only, on the reasoning that vehicles are gated by the oil of
// whatever territory they stand in, so marching tanks into a province with no oil turns them
// into scenery. The reasoning is right and the conclusion was too strong: it is not that
// vehicles cannot move, it is that they may only move to somewhere that can fuel them.
//
// So a vehicle marches only when the destination has oil headroom -- `oilForCurrentTerritory`
// over `oilDemand` -- to spare for it, and that headroom is a BUDGET decremented as the turn
// is planned, because three provinces reinforcing one front would otherwise each be told the
// same barrel of oil was free. A vehicle that arrives is fuelled, so next turn it can take
// the next hop; the corridor advances at the pace the oil does, which is what logistics is.
//
// Only USEABLE vehicles march. A grounded one stays where it stands, deliberately: its
// territory's oil regenerates towards its capacity every turn, so a vehicle that cannot be
// fuelled here today very often can be tomorrow, and marching it away on the strength of one
// bad turn strips a garrison of the armour it was about to get back.
//
// Infantry is still the bulk of what moves and needs no fuel at all.
//
// Pure: numbers in, a list of moves out. `aiCalculations.js` carries them out.

import { musterDiscipline, oilRequirements, vehicleArmyPersonnelWorth } from "../config/balance.js";

/** country -> Map(territoryName -> { turn, shortfall }) -- who asked for reinforcement. */
const demands = new Map();

export function resetMusters() {
    demands.clear();
}

export function captureMusters() {
    return Object.fromEntries(
        [...demands].map(([country, byTerritory]) => [country, Object.fromEntries(byTerritory)])
    );
}

export function restoreMusters(data) {
    resetMusters();
    for (const [country, byTerritory] of Object.entries(data ?? {})) {
        demands.set(country, new Map(Object.entries(byTerritory ?? {})));
    }
}

/**
 * A front-line territory reports that it could not raise the odds it needed.
 *
 * `shortfall` is in percentage points of probability -- how far under the mark it came --
 * which is a better ordering than the raw army numbers: a territory eight points short is
 * one reinforcement away from a war, and one sixty points short is a wish.
 */
export function recordReinforcementDemand(country, territoryName, shortfall, turn) {
    if (!country || !territoryName) {
        return;
    }
    if (!demands.has(country)) {
        demands.set(country, new Map());
    }
    demands.get(country).set(territoryName, {
        turn: Number(turn) || 0,
        shortfall: Math.max(0, Number(shortfall) || 0)
    });
}

/** What this country's front asked for, most urgent first, dropping anything gone stale. */
export function reinforcementDemands(country, turn) {
    const byTerritory = demands.get(country);
    if (!byTerritory) {
        return [];
    }
    const live = [];
    for (const [territoryName, demand] of byTerritory) {
        if (turn - demand.turn > musterDiscipline.demandMemoryTurns) {
            byTerritory.delete(territoryName);
            continue;
        }
        live.push({ territoryName, ...demand });
    }
    //Least short first: the cheapest war to make possible is the one worth making possible.
    return live.sort((a, b) => a.shortfall - b.shortfall);
}

/** Forget one demand -- the attack it was for has happened, won or lost. */
export function clearReinforcementDemand(country, territoryName) {
    demands.get(country)?.delete(territoryName);
}

/**
 * Plan this country's troop movements for the turn.
 *
 * @param {{country: string, turn: number, territories: object[],
 *          localEnemyPowerFor: (territoryName: string) => number,
 *          neighboursOf: (territory: object) => string[],
 *          spearhead?: string|null}} input
 *        `localEnemyPowerFor` returns the army power of the strongest enemy that can reach
 *        that territory, or 0 when nothing can -- the same quantity the attack commitment
 *        reasons about, and an army rather than a comparison between two.
 * @returns {Array<{from: string, to: string, infantry: number, reason: string}>}
 */
export function planMusters(input) {
    const country = input?.country;
    const turn = Number(input?.turn) || 0;
    const territories = input?.territories ?? [];
    const localEnemyPowerFor = input?.localEnemyPowerFor ?? (() => 0);
    const neighboursOf = input?.neighboursOf ?? (() => []);

    const owned = new Map(territories.map(territory => [territory.territoryName, territory]));
    const wanted = new Map(reinforcementDemands(country, turn).map(demand => [demand.territoryName, demand]));

    //The spearhead is the front-line territory of the mid-term goal. It is treated as a
    //standing demand even when it did not ask this turn, because massing BEFORE the attack
    //is the point -- a country that only ever reinforces where it has already failed is
    //still reacting rather than planning.
    if (input?.spearhead && owned.has(input.spearhead) && !wanted.has(input.spearhead)) {
        wanted.set(input.spearhead, { territoryName: input.spearhead, shortfall: 0, turn });
    }
    if (wanted.size === 0) {
        return [];
    }

    //THE PULL FIELD. Breadth-first outwards from everything that asked, over OWNED territories
    //only, so a province learns how far it is from a war and which single neighbour is one hop
    //nearer one. A territory the search never reaches has no route to any front -- an island
    //with no crossing, or a pocket cut off by somebody else's conquest -- and stays home.
    const pull = pullField(wanted, owned, neighboursOf);

    //Oil headroom at each destination, as a BUDGET. Three provinces reinforcing one front
    //would otherwise each be told the same barrel of oil was free, and the arrivals would be
    //grounded on landing -- vehicles present in the count, absent from the fight.
    const fuel = new Map(territories.map(territory => [territory.territoryName, oilHeadroom(territory)]));

    const moves = [];

    //Nearest the front first. Two reasons, and both are about a chain rather than a move: it
    //is the province closest to the war that has the best claim on the fuel waiting one hop
    //ahead of it, and taking them in order makes the whole corridor advance exactly one hop
    //a turn instead of the far end jumping the queue.
    //`distance >= 1` is not enough on its own: a territory the search never reached has no
    //entry at all, and a missing distance read as Infinity passes that test rather than
    //failing it. An unreachable pocket would then be sorted to the far end of the queue and
    //asked for its step, which does not exist.
    const sources = territories
        .filter(territory => (pull.get(territory.territoryName)?.distance ?? 0) >= 1)
        .sort((a, b) => pull.get(a.territoryName).distance - pull.get(b.territoryName).distance);

    for (const source of sources) {
        //Distance 0 is a territory that asked, so this is also what enforces the older rule
        //that a territory needing help does not give it away.
        const destinationName = pull.get(source.territoryName).step;
        if (!owned.has(destinationName)) {
            continue;
        }

        const sending = spareGarrison(
            source,
            localEnemyPowerFor(source.territoryName),
            fuel.get(destinationName) ?? 0
        );
        if (!sending) {
            continue;
        }

        fuel.set(destinationName, (fuel.get(destinationName) ?? 0) - fuelCostOf(sending));
        //One move out of a territory per turn is a property of the loop now rather than a rule
        //enforced with a set: a source appears once in `sources` and has exactly one step
        //towards the war.
        moves.push({
            from: source.territoryName,
            to: destinationName,
            ...sending,
            reason: "reinforcing " + destinationName + " from " + source.territoryName +
                describeForce(sending)
        });
    }

    return moves;
}

/**
 * How far each owned territory is from the nearest place that asked, and which way is towards it.
 *
 * `step` is the neighbour the search arrived from, which is by construction one hop closer to a
 * demand -- the same "strictly closer" rule `src/ai/route.js` uses for an injected plan's
 * corridor, and for the same reason: a stored path goes stale the moment somebody else's
 * conquest cuts it, while a field re-derived every turn simply becomes a different field.
 *
 * The seeds are taken in the order `reinforcementDemands()` returned them -- least short
 * first -- so a province equidistant from two wars walks towards the cheaper one to make
 * possible.
 */
function pullField(wanted, owned, neighboursOf) {
    const field = new Map();
    const queue = [];

    for (const territoryName of wanted.keys()) {
        if (!owned.has(territoryName)) {
            continue;
        }
        field.set(territoryName, { distance: 0, step: null });
        queue.push(territoryName);
    }

    for (let index = 0; index < queue.length; index += 1) {
        const here = queue[index];
        const distance = field.get(here).distance;
        for (const neighbourName of neighboursOf(owned.get(here))) {
            if (!owned.has(neighbourName) || field.has(neighbourName)) {
                continue;
            }
            //Breadth-first, so the first arrival is the shortest route and nothing later can
            //improve on it. That is what makes one pass enough.
            field.set(neighbourName, { distance: distance + 1, step: here });
            queue.push(neighbourName);
        }
    }

    return field;
}

/** Oil a territory has spare once its own vehicles are fuelled. */
function oilHeadroom(territory) {
    const held = Number(territory?.oilForCurrentTerritory) || 0;
    const demand = Number(territory?.oilDemand) || 0;
    return Math.max(0, held - demand);
}

/** Oil per turn the vehicles in a move will demand once they arrive. */
export function fuelCostOf(sending) {
    return (oilRequirements.assault * (sending?.assault ?? 0)) +
        (oilRequirements.air * (sending?.air ?? 0)) +
        (oilRequirements.naval * (sending?.naval ?? 0));
}

/** The force a move carries, by the same definition `armyForCurrentTerritory` holds. */
export function forceOf(sending) {
    return (sending?.infantry ?? 0) +
        (vehicleArmyPersonnelWorth.assault * (sending?.assault ?? 0)) +
        (vehicleArmyPersonnelWorth.air * (sending?.air ?? 0)) +
        (vehicleArmyPersonnelWorth.naval * (sending?.naval ?? 0));
}

function describeForce(sending) {
    const parts = [];
    if (sending.infantry > 0) {
        parts.push(sending.infantry + " infantry");
    }
    if (sending.assault > 0) {
        parts.push(sending.assault + " assault");
    }
    if (sending.air > 0) {
        parts.push(sending.air + " air");
    }
    if (sending.naval > 0) {
        parts.push(sending.naval + " naval");
    }
    return ": " + parts.join(", ");
}

/**
 * What a territory marches out, as the four unit counts.
 *
 * The surplus is one budget in FORCE, spent on vehicles before infantry. That order is the
 * whole reason vehicles were worth adding: infantry is priced at a ten-thousandth of a siege
 * point, so a besieging army of foot soldiers scores nothing against a bare mountain and dies
 * in the arrest band -- and until now `muster.js` could move nothing but foot soldiers. An
 * assault gun at the front is what makes a siege possible at all.
 *
 * `fuelAvailable` is the destination's oil headroom. A vehicle that cannot be fuelled where it
 * is going does not go: it is worth more standing where it is than parked as scenery.
 *
 * @returns {{infantry: number, assault: number, air: number, naval: number}|null}
 */
export function spareGarrison(territory, localEnemyPower, fuelAvailable = 0) {
    let budget = spareForce(territory, localEnemyPower);
    if (budget <= 0) {
        return null;
    }

    let fuel = Math.max(0, Number(fuelAvailable) || 0);
    const sending = { infantry: 0, assault: 0, air: 0, naval: 0 };

    //Heaviest first: a warship is twenty thousand points of force the country does not have to
    //march there as people, and it is also the thirstiest -- so spending the fuel on it first
    //is what stops a column of assault guns eating a corridor's whole oil budget.
    for (const type of ["naval", "air", "assault"]) {
        const worth = vehicleArmyPersonnelWorth[type];
        const thirst = oilRequirements[type];
        const useable = Math.max(0, Number(territory?.["useable" + capitalise(type)]) || 0);
        const moving = Math.min(
            useable,
            Math.floor(budget / worth),
            Math.floor(fuel / thirst)
        );
        if (moving <= 0) {
            continue;
        }
        sending[type] = moving;
        budget -= moving * worth;
        fuel -= moving * thirst;
    }

    //Whatever force is left walks, capped by the stricter infantry rule -- which is the one
    //the border's own defence is sized by, and is deliberately tighter than the rule for an
    //assault out of the same territory.
    sending.infantry = Math.max(0, Math.min(
        spareInfantry(territory, localEnemyPower),
        Math.floor(budget)
    ));

    //The minimum is on the whole move rather than on the infantry in it, or a lone assault gun
    //-- a thousand points of force -- would be refused for not being twenty-five foot soldiers.
    return forceOf(sending) < musterDiscipline.minimumMove ? null : sending;
}

function capitalise(word) {
    return word.charAt(0).toUpperCase() + word.slice(1);
}

/**
 * The FORCE a territory can march out, before it is divided between soldiers and vehicles.
 *
 * The same rule `spareInfantry()` applies, read against the whole garrison rather than against
 * the foot soldiers in it, because a vehicle holds a border exactly as well as the personnel it
 * is worth. Kept as its own function rather than folded into that one, so the infantry rule
 * below stays the single readable statement of what a border keeps.
 */
export function spareForce(territory, localEnemyPower) {
    const army = Math.max(0, Number(territory?.armyForCurrentTerritory) || 0);
    if (army <= 0) {
        return 0;
    }

    const enemy = Number(localEnemyPower);
    if (!Number.isFinite(enemy) || enemy <= 0) {
        return Math.floor(army * musterDiscipline.share);
    }

    const keep = enemy * musterDiscipline.keepAgainstNeighbour + musterDiscipline.comfortMargin;
    const surplus = army - keep;
    return surplus <= 0 ? 0 : Math.floor(surplus * musterDiscipline.share);
}

/**
 * The infantry a territory can march out without giving up its own border.
 *
 * `localEnemyPower` is the army power of the strongest enemy that can reach this territory --
 * the same quantity the attack commitment reasons about, and for the same reason: it is an
 * army, so it can be compared with one. The garrison it implies is what stays; a share of
 * what is left marches.
 *
 * Deliberately stricter than the rule for an assault out of the same territory. Reinforcing
 * somewhere else is worth less than holding here, so a border that only just covers what
 * faces it sends nothing at all.
 */
export function spareInfantry(territory, localEnemyPower) {
    const infantry = Math.max(0, Number(territory?.infantryForCurrentTerritory) || 0);
    if (infantry <= 0) {
        return 0;
    }

    const enemy = Number(localEnemyPower);
    const army = Math.max(infantry, Number(territory?.armyForCurrentTerritory) || 0);

    //Nothing can reach this territory: it is interior, and interior provinces are where an
    //empire's spare army actually is. It still keeps a reserve, because a conquest elsewhere
    //can make an interior province a border overnight.
    if (!Number.isFinite(enemy) || enemy <= 0) {
        return Math.floor(infantry * musterDiscipline.share);
    }

    //The comfort margin is what makes this stricter than an assault: the border has to be
    //comfortably ahead of what faces it, not merely level, before any of it walks away.
    const keep = enemy * musterDiscipline.keepAgainstNeighbour + musterDiscipline.comfortMargin;
    const surplus = army - keep;
    if (surplus <= 0) {
        return 0;
    }

    return Math.floor(Math.min(infantry, surplus) * musterDiscipline.share);
}
