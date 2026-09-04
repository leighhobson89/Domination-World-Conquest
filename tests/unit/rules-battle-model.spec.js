// src/rules/military/battleModel.js -- battle overhaul B.1.
//
// The model on top of the dice: share, modifiers, casualties, and what the state of the two
// armies means. Pure with an injected rng, so every outcome here is exact rather than
// statistical -- which is the property the whole overhaul is built to have and which the
// current five-round skirmish model never had.

import { describe, expect, it } from "vitest";

import {
    BattleState,
    applyCasualties,
    attackerTookIt,
    beginBattle,
    classifyBattleState,
    isTerminal,
    modifiersFor,
    occupyingArmyFor,
    resolveBattle,
    resolveBattleRound,
    resolveLastPush,
    shareFor
} from "../../src/rules/military/battleModel.js";
import { combinedForce } from "../../src/rules/military/units.js";
import {
    BREAK_THRESHOLD,
    DICE_ATTACK_ADVANTAGE,
    DIE_MODIFIERS,
    MAX_BATTLE_ROUNDS,
    MODIFIER_CLAMP,
    PAIRING_CASUALTY_SHARE,
    battleOutcomeEffects
} from "../../src/config/balance.js";

/** A plain territory with no forts, no mountains, no coast and a neutral continent. */
function territory(overrides = {}) {
    return {
        uniqueId: "t1",
        territoryName: "Testland",
        area: 350000,
        defenseBonus: 0,
        mountainDefenseBonus: 0,
        isCoastal: false,
        continent: "Nowhere",
        ...overrides
    };
}

/** mulberry32, so a test can name its own stream. */
function seededRng(seed) {
    let state = seed >>> 0;
    return () => {
        state = (state + 0x6d2b79f5) | 0;
        let t = Math.imul(state ^ (state >>> 15), state | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

/** Always rolls the maximum -- for driving a battle to a known end. */
const alwaysSix = () => 0.999999;
/** Always rolls the minimum. */
const alwaysOne = () => 0;

describe("shareFor", () => {
    it("is the attacker's slice of the two strengths", () => {
        // Equal head counts, no other modifier: the share is decided by the dice model's dial
        // alone. It is DICE_ATTACK_ADVANTAGE and not ATTACK_ADVANTAGE -- see the note on it in
        // balance.js for the measurement that forced the two apart.
        const share = shareFor([1000, 0, 0, 0], [1000, 0, 0, 0], territory(), {
            attackingDevelopmentIndex: 1,
            combatContinentModifier: 1
        });
        expect(share).toBeCloseTo(DICE_ATTACK_ADVANTAGE / (DICE_ATTACK_ADVANTAGE + 1), 10);
    });

    it("weighs vehicles by personnel, not by head count", () => {
        // One naval unit is 20,000 personnel, so it outweighs 10,000 infantry.
        const withNaval = shareFor([0, 0, 0, 1], [10000, 0, 0, 0], territory(), {});
        expect(withNaval).toBeGreaterThan(0.5);
    });

    it("does NOT read the fortification multiplier -- that is a die modifier now", () => {
        // The one mistake this design makes easy is counting forts twice. A heavily fortified
        // territory must produce exactly the same SHARE as a bare one; the difference shows up
        // in modifiersFor() and nowhere else.
        const bare = shareFor([1000, 0, 0, 0], [1000, 0, 0, 0], territory(), {});
        const fortified = shareFor([1000, 0, 0, 0], [1000, 0, 0, 0],
            territory({ defenseBonus: 300, mountainDefenseBonus: 200 }), {});
        expect(fortified).toBe(bare);
    });

    it("does read the territory's area", () => {
        const small = shareFor([1000, 0, 0, 0], [1000, 0, 0, 0], territory({ area: 1000 }), {});
        const large = shareFor([1000, 0, 0, 0], [1000, 0, 0, 0], territory({ area: 900000 }), {});
        expect(small).not.toBe(large);
    });

    it("is zero when both sides are empty rather than NaN", () => {
        expect(shareFor([0, 0, 0, 0], [0, 0, 0, 0], territory(), {})).toBe(0);
    });

    it("is one when the defender is empty", () => {
        expect(shareFor([100, 0, 0, 0], [0, 0, 0, 0], territory(), {})).toBe(1);
    });
});

describe("modifiersFor", () => {
    const plainAttack = [1000, 10, 0, 0];
    const plainDefence = [1000, 10, 0, 0];

    it("gives a bare territory no modifiers at all", () => {
        const result = modifiersFor(plainAttack, plainDefence, territory());
        expect(result.attacker.rows).toEqual([]);
        expect(result.defender.rows).toEqual([]);
        expect(result.attacker.total).toBe(0);
        expect(result.defender.total).toBe(0);
    });

    it("takes dice off the ATTACKER for fortifications, banded on the raw bonus", () => {
        // Fortification is a dice penalty, not a face bonus, because only a dice change can
        // answer unmatched dice -- see the note on `row()` in battleModel.js. And it bands on
        // the raw `defenseBonus + mountainDefenseBonus` rather than going through
        // `defenseMultiplierFor()`, whose ceiling makes a SINGLE fort "double" a territory's
        // defence: fort defence is forts * (forts + 1) * 10 * devIndex, so one fort is 20 and
        // two are 60, and reusing that ceiling charged an attacker a die for one fort and two
        // dice for two.
        const oneFort = modifiersFor(plainAttack, plainDefence, territory({ defenseBonus: 20 }));
        expect(oneFort.attacker.diceChange).toBe(0);

        const twoForts = modifiersFor(plainAttack, plainDefence, territory({ defenseBonus: 60 }));
        expect(twoForts.attacker.diceChange).toBe(-1);
        expect(twoForts.attacker.rows).toContainEqual(
            expect.objectContaining({ key: "fortification" }));

        const fortress = modifiersFor(plainAttack, plainDefence, territory({ defenseBonus: 120 }));
        expect(fortress.attacker.diceChange).toBe(-2);
    });

    it("counts mountains towards fortification alongside forts", () => {
        const result = modifiersFor(plainAttack, plainDefence,
            territory({ defenseBonus: 20, mountainDefenseBonus: 20 }));
        expect(result.attacker.diceChange).toBe(-1);
    });

    it("keeps a die bonus and a dice change as different things", () => {
        // A face bonus and a dice change must never be summed into one number: they do
        // different jobs and only one of them can answer an unmatched die.
        const result = modifiersFor([1000, 0, 5, 0], [1000, 0, 0, 0], territory({ defenseBonus: 120 }));
        expect(result.attacker.total).toBe(1);        // air superiority, a face bonus
        expect(result.attacker.diceChange).toBe(-2);  // the fortress, a dice penalty
    });

    it("gives air superiority to a side with air against a side with none", () => {
        const result = modifiersFor([1000, 10, 5, 0], plainDefence, territory());
        expect(result.attacker.rows).toContainEqual(
            expect.objectContaining({ key: "airSuperiority" }));
        expect(result.defender.rows).not.toContainEqual(
            expect.objectContaining({ key: "airSuperiority" }));
    });

    it("needs a clear margin when both sides hold air", () => {
        const narrow = modifiersFor([1000, 10, 3, 0], [1000, 10, 2, 0], territory());
        expect(narrow.attacker.rows).not.toContainEqual(
            expect.objectContaining({ key: "airSuperiority" }));

        const clear = modifiersFor([1000, 10, 9, 0], [1000, 10, 2, 0], territory());
        expect(clear.attacker.rows).toContainEqual(
            expect.objectContaining({ key: "airSuperiority" }));
    });

    it("penalises a side fielding no armour against armour", () => {
        const result = modifiersFor([1000, 0, 0, 0], [1000, 5, 0, 0], territory());
        expect(result.attacker.rows).toContainEqual(
            expect.objectContaining({ key: "noArmour", value: DIE_MODIFIERS.noArmourAgainstArmour }));
    });

    it("rewards a naval-led landing, but only on a coast", () => {
        // One naval unit is 20,000 personnel against 1,000 infantry -- comfortably past the share.
        const inland = modifiersFor([1000, 0, 0, 1], plainDefence, territory({ isCoastal: false }));
        expect(inland.attacker.rows).not.toContainEqual(
            expect.objectContaining({ key: "coastalAssault" }));

        const coastal = modifiersFor([1000, 0, 0, 1], plainDefence, territory({ isCoastal: true }));
        expect(coastal.attacker.rows).toContainEqual(
            expect.objectContaining({ key: "coastalAssault" }));
    });

    it("does not reward a token naval escort", () => {
        const result = modifiersFor([1000000, 0, 0, 1], plainDefence, territory({ isCoastal: true }));
        expect(result.attacker.rows).not.toContainEqual(
            expect.objectContaining({ key: "coastalAssault" }));
    });

    it("gives the attacker up to +2 for a long siege, and no more", () => {
        expect(modifiersFor(plainAttack, plainDefence, territory(), { siegeTurns: 2 })
            .attacker.rows).toEqual([]);
        expect(modifiersFor(plainAttack, plainDefence, territory(), { siegeTurns: 3 })
            .attacker.total).toBe(1);
        expect(modifiersFor(plainAttack, plainDefence, territory(), { siegeTurns: 60 })
            .attacker.total).toBe(DIE_MODIFIERS.siegeGrindingCap);
    });

    it("clamps a stacked total", () => {
        const result = modifiersFor([1000, 10, 9, 1], [1000, 0, 0, 0],
            territory({ isCoastal: true }), { siegeTurns: 60, attackerDugIn: true });
        // Air superiority + naval landing + two siege steps + dug in is well past the ceiling.
        expect(result.attacker.total).toBe(MODIFIER_CLAMP);
    });
});

describe("applyCasualties", () => {
    it("takes nothing when nothing was lost", () => {
        expect(applyCasualties([100, 5, 2, 1], 0)).toEqual([100, 5, 2, 1]);
    });

    it("compounds across the pairings lost in a round", () => {
        const survivors = applyCasualties([1000000, 0, 0, 0], 3);
        const expected = Math.floor(1000000 * Math.pow(1 - PAIRING_CASUALTY_SHARE, 3));
        expect(survivors[0]).toBe(expected);
    });

    it("keeps composition proportional", () => {
        const survivors = applyCasualties([100000, 1000, 100, 10], 1);
        const ratioBefore = 100000 / 1000;
        const ratioAfter = survivors[0] / survivors[1];
        expect(ratioAfter).toBeCloseTo(ratioBefore, 1);
    });

    it("always kills at least one unit, so a round can never be free", () => {
        // A large army where flooring alone could leave the combined force unchanged.
        const army = [3, 0, 0, 0];
        const survivors = applyCasualties(army, 1, { share: 0.0000001 });
        expect(combinedForce(survivors)).toBeLessThan(combinedForce(army));
    });

    it("never goes below zero", () => {
        expect(applyCasualties([1, 0, 0, 0], 50)).toEqual([0, 0, 0, 0]);
    });

    it("leaves an already empty army alone", () => {
        expect(applyCasualties([0, 0, 0, 0], 4)).toEqual([0, 0, 0, 0]);
    });

    it("does not mutate its argument", () => {
        const army = [1000, 10, 1, 0];
        applyCasualties(army, 2);
        expect(army).toEqual([1000, 10, 1, 0]);
    });
});

describe("classifyBattleState", () => {
    function battleWith(attackers, defenders, extra = {}) {
        return {
            attackers,
            defenders,
            startingAttackForce: 100000,
            startingDefendForce: 100000,
            round: 1,
            ...extra
        };
    }

    it("reports a wiped defender before anything else", () => {
        expect(classifyBattleState(battleWith([10, 0, 0, 0], [0, 0, 0, 0])))
            .toBe(BattleState.DEFENDER_WIPED);
    });

    it("reports a wiped attacker", () => {
        expect(classifyBattleState(battleWith([0, 0, 0, 0], [10, 0, 0, 0])))
            .toBe(BattleState.ATTACKER_WIPED);
    });

    it("routs a defender below the break threshold", () => {
        const justUnder = Math.floor(100000 * BREAK_THRESHOLD) - 1;
        expect(classifyBattleState(battleWith([100000, 0, 0, 0], [justUnder, 0, 0, 0])))
            .toBe(BattleState.DEFENDER_ROUTED);
    });

    it("breaks an attacker below the break threshold", () => {
        const justUnder = Math.floor(100000 * BREAK_THRESHOLD) - 1;
        expect(classifyBattleState(battleWith([justUnder, 0, 0, 0], [100000, 0, 0, 0])))
            .toBe(BattleState.ATTACKER_BROKEN);
    });

    it("measures each side against its OWN starting force", () => {
        // audit 5.1 E: all three thresholds used to compare against the ATTACKER's starting
        // force, so a battle between armies of different sizes resolved at the wrong moment.
        // Here the defender started small and is still healthy; a shared denominator would
        // call it routed.
        const battle = {
            attackers: [1000000, 0, 0, 0],
            defenders: [9000, 0, 0, 0],
            startingAttackForce: 1000000,
            startingDefendForce: 10000,
            round: 1
        };
        expect(classifyBattleState(battle)).toBe(BattleState.IN_PROGRESS);
    });

    it("offers a last push while the defender is close to breaking", () => {
        // Between 20% and 30% of its starting force.
        expect(classifyBattleState(battleWith([100000, 0, 0, 0], [25000, 0, 0, 0])))
            .toBe(BattleState.LAST_PUSH_AVAILABLE);
    });

    it("calls a stalemate at the round cap", () => {
        expect(classifyBattleState(battleWith([100000, 0, 0, 0], [100000, 0, 0, 0],
            { round: MAX_BATTLE_ROUNDS }))).toBe(BattleState.STALEMATE);
    });

    it("knows which states end the battle and which take the territory", () => {
        expect(isTerminal(BattleState.IN_PROGRESS)).toBe(false);
        expect(isTerminal(BattleState.LAST_PUSH_AVAILABLE)).toBe(false);
        expect(isTerminal(BattleState.DEFENDER_ROUTED)).toBe(true);
        expect(attackerTookIt(BattleState.DEFENDER_ROUTED)).toBe(true);
        expect(attackerTookIt(BattleState.DEFENDER_WIPED)).toBe(true);
        expect(attackerTookIt(BattleState.ATTACKER_BROKEN)).toBe(false);
        expect(attackerTookIt(BattleState.STALEMATE)).toBe(false);
    });
});

describe("resolveBattleRound", () => {
    const setup = () => ({
        attackers: [400000, 0, 0, 0],
        defenders: [400000, 0, 0, 0],
        territory: territory(),
        context: { attackingDevelopmentIndex: 1, combatContinentModifier: 1 }
    });

    it("does not mutate the state it is given", () => {
        const battle = beginBattle(setup());
        const before = [...battle.attackers];
        resolveBattleRound(battle, seededRng(1));
        expect(battle.attackers).toEqual(before);
        expect(battle.round).toBe(0);
    });

    it("advances the round and records both sides before and after", () => {
        const { battle, record } = resolveBattleRound(beginBattle(setup()), seededRng(7));
        expect(battle.round).toBe(1);
        expect(record.round).toBe(1);
        expect(record.attackersBefore).toEqual([400000, 0, 0, 0]);
        expect(record.attackersAfter).toEqual(battle.attackers);
    });

    it("resolves every die into a pairing, and every pairing into a casualty", () => {
        const { record } = resolveBattleRound(beginBattle(setup()), seededRng(3));
        expect(record.pairings).toHaveLength(Math.max(record.attackerDice, record.defenderDice));
        expect(record.attackerLosses + record.defenderLosses).toBe(record.pairings.length);
    });

    it("costs somebody something every round", () => {
        let battle = beginBattle(setup());
        const rng = seededRng(99);
        for (let round = 0; round < 5; round++) {
            const before = combinedForce(battle.attackers) + combinedForce(battle.defenders);
            battle = resolveBattleRound(battle, rng).battle;
            const after = combinedForce(battle.attackers) + combinedForce(battle.defenders);
            expect(after).toBeLessThan(before);
        }
    });

    it("gives an overwhelming attacker five dice against one", () => {
        const { record } = resolveBattleRound(beginBattle({
            ...setup(),
            attackers: [5000000, 0, 0, 0],
            defenders: [100000, 0, 0, 0]
        }), seededRng(5));
        expect(record.attackerDice).toBe(5);
        expect(record.defenderDice).toBe(1);
    });

    it("digging in forfeits the offence and halves the cost", () => {
        const battle = beginBattle(setup());

        const pressed = resolveBattleRound(battle, seededRng(11), {});
        const dugIn = resolveBattleRound(battle, seededRng(11), { attackerDigsIn: true });

        // Same stream, same dice -- the only difference is the choice.
        expect(dugIn.record.attackerFaces).toEqual(pressed.record.attackerFaces);
        expect(dugIn.record.defenderLosses).toBe(0);
        expect(combinedForce(dugIn.battle.defenders)).toBe(combinedForce(battle.defenders));
        // And it costs the attacker less than pressing would have.
        expect(combinedForce(dugIn.battle.attackers))
            .toBeGreaterThanOrEqual(combinedForce(pressed.battle.attackers));
    });

    it("carries a dig-in into next round's modifiers", () => {
        const first = resolveBattleRound(beginBattle(setup()), seededRng(2), { defenderDigsIn: true });
        expect(first.battle.defenderDugIn).toBe(true);
        const second = resolveBattleRound(first.battle, seededRng(2));
        expect(second.record.modifiers.defender.rows).toContainEqual(
            expect.objectContaining({ key: "dugIn" }));
    });
});

describe("resolveLastPush", () => {
    it("takes the territory outright at a fixed cost", () => {
        const battle = beginBattle({
            attackers: [100000, 0, 0, 0],
            defenders: [20000, 0, 0, 0],
            territory: territory()
        });
        const { battle: after } = resolveLastPush(battle);
        expect(after.state).toBe(BattleState.DEFENDER_WIPED);
        expect(after.attackers[0]).toBe(
            Math.floor(100000 * battleOutcomeEffects.lastPushSurvivorShare));
    });
});

describe("occupyingArmyFor", () => {
    it("keeps everything that survived a wipeout", () => {
        expect(occupyingArmyFor(BattleState.DEFENDER_WIPED, [50, 2, 1, 0], [0, 0, 0, 0]))
            .toEqual([50, 2, 1, 0]);
    });

    it("absorbs half of a routed defender", () => {
        expect(occupyingArmyFor(BattleState.DEFENDER_ROUTED, [50, 2, 0, 0], [10, 4, 0, 0]))
            .toEqual([55, 4, 0, 0]);
    });

    it("gives nothing to an attacker who did not take it", () => {
        expect(occupyingArmyFor(BattleState.ATTACKER_BROKEN, [50, 0, 0, 0], [10, 0, 0, 0]))
            .toBeNull();
    });
});

describe("resolveBattle", () => {
    it("always terminates", () => {
        for (let seed = 1; seed <= 40; seed++) {
            const result = resolveBattle({
                attackers: [400000, 0, 0, 0],
                defenders: [400000, 0, 0, 0],
                territory: territory(),
                context: { attackingDevelopmentIndex: 1, combatContinentModifier: 1 }
            }, seededRng(seed));
            expect(isTerminal(result.state)).toBe(true);
            expect(result.records.length).toBeLessThanOrEqual(MAX_BATTLE_ROUNDS);
        }
    });

    it("never reaches the stalemate cap in an ordinary fight", () => {
        // The cap is a safety valve, not a balance number. If this ever fails, a round killed
        // nobody -- which is a bug in the casualty floor.
        for (let seed = 1; seed <= 40; seed++) {
            const result = resolveBattle({
                attackers: [400000, 0, 0, 0],
                defenders: [400000, 0, 0, 0],
                territory: territory()
            }, seededRng(seed));
            expect(result.state).not.toBe(BattleState.STALEMATE);
        }
    });

    it("is deterministic for a given stream", () => {
        const setup = {
            attackers: [300000, 20, 5, 1],
            defenders: [280000, 15, 4, 2],
            territory: territory({ defenseBonus: 10 })
        };
        const first = resolveBattle(setup, seededRng(4242));
        const second = resolveBattle(setup, seededRng(4242));
        expect(second.state).toBe(first.state);
        expect(second.battle.attackers).toEqual(first.battle.attackers);
        expect(second.records.length).toBe(first.records.length);
    });

    it("lets an overwhelming attacker through quickly", () => {
        const result = resolveBattle({
            attackers: [5000000, 0, 0, 0],
            defenders: [200000, 0, 0, 0],
            territory: territory()
        }, seededRng(8));
        expect(result.tookTerritory).toBe(true);
        expect(result.records.length).toBeLessThanOrEqual(5);
        expect(result.occupying).not.toBeNull();
    });

    it("turns back a hopeless attacker", () => {
        const result = resolveBattle({
            attackers: [50000, 0, 0, 0],
            defenders: [2000000, 0, 0, 0],
            territory: territory({ defenseBonus: 40 })
        }, seededRng(9));
        expect(result.tookTerritory).toBe(false);
        expect(result.occupying).toBeNull();
    });

    it("gives every tied pairing to the defender, which decides an even fight on its own", () => {
        // Both sides draw from the SAME stream, so a constant rng gives them identical faces
        // and every contested pairing is a tie. Ties go to the defender, so the attacker loses
        // all four pairings every round and is broken -- and it makes no difference whether the
        // constant is a six or a one.
        //
        // This is the defender's whole built-in advantage, stated as a test: at even strength,
        // with no terrain and no composition edge, attacking is a losing proposition. That is
        // deliberate (docs/archived/battle_overhaul.md section 4.3) and it is what ATTACK_ADVANTAGE has
        // to overcome by moving the share into a higher dice band.
        const evenFight = () => ({
            attackers: [400000, 0, 0, 0],
            defenders: [400000, 0, 0, 0],
            territory: territory()
        });

        for (const rng of [alwaysSix, alwaysOne]) {
            const result = resolveBattle(evenFight(), rng);
            expect(attackerTookIt(result.state)).toBe(false);
            expect(result.state).toBe(BattleState.ATTACKER_BROKEN);
        }
    });

    it("lets a modifier flip every one of those ties", () => {
        // The same constant rng, so both sides again roll identical faces -- but a naval
        // landing on a coast gives the attacker +1, which turns every 6-against-6 tie into a
        // 7-against-6 win. It is the cleanest possible demonstration that the modifiers are
        // what the dice are FOR: same force, same rolls, opposite result.
        //
        // An alternating high/low rng was tried here first and is worth not repeating: the
        // attacker's dice are drawn before the defender's, but both sides draw the same NUMBER
        // of dice from the same alternating stream, so both get 6,1,6,1 and every pairing ties
        // all over again.
        const result = resolveBattle({
            attackers: [0, 0, 0, 20],
            defenders: [400000, 0, 0, 0],
            territory: territory({ isCoastal: true })
        }, alwaysSix);

        expect(attackerTookIt(result.state)).toBe(true);
        expect(result.records[0].modifiers.attacker.total).toBe(1);
        expect(result.records[0].defenderLosses).toBeGreaterThan(0);
        expect(result.records[0].attackerLosses).toBe(0);
    });
});
