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
//   ROUTE     one hop, between neighbours. Troops walk towards the front over several turns
//             rather than teleporting across an empire, which is both the honest model and
//             the one that cannot accidentally strip a border on the far side of the world.
//
// Infantry only, and that is a decision rather than a simplification: vehicles are gated by
// the oil capacity of the territory they sit in, so marching tanks into a province with no
// oil turns them into scenery. Infantry is the bulk of every army and the part that can
// actually be concentrated.
//
// Pure: numbers in, a list of moves out. `aiCalculations.js` carries them out.

import { musterDiscipline } from "../config/balance.js";

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

    const moves = [];
    const sent = new Set();

    for (const [destinationName] of wanted) {
        const destination = owned.get(destinationName);
        if (!destination) {
            continue;
        }

        for (const source of territories) {
            if (source.territoryName === destinationName || sent.has(source.territoryName)) {
                continue;
            }
            //A territory that has asked for help does not give it away.
            if (wanted.has(source.territoryName)) {
                continue;
            }
            if (!neighboursOf(source).includes(destinationName)) {
                continue;
            }

            const spare = spareInfantry(source, localEnemyPowerFor(source.territoryName));
            if (spare < musterDiscipline.minimumMove) {
                continue;
            }

            moves.push({
                from: source.territoryName,
                to: destinationName,
                infantry: spare,
                reason: "reinforcing " + destinationName + " from " + source.territoryName
            });
            //One move out of a territory per turn: an army marches, it does not divide
            //itself between three fronts in an afternoon.
            sent.add(source.territoryName);
        }
    }

    return moves;
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
