// src/state/battleState.js -- battle overhaul B.3.
//
// The battle in progress, as state. Most of this file is about ARRAY IDENTITY, because that is
// the property `battle.js` depends on in two opposite directions at once: a siege laid during a
// battle aliases the army arrays, so they must be stable within a battle and fresh between two.

import { beforeEach, describe, expect, it } from "vitest";

import {
    __resetBattleState,
    asModelState,
    attackingArmy,
    closeBattle,
    commitRound,
    currentBattle,
    defendingArmy,
    hasBattle,
    lastPushIsOffered,
    lastRound,
    openBattle,
    pendingReserves,
    queueReserves,
    reinforceAttackers,
    roundsFought,
    takeArrivedReserves
} from "../../src/state/battleState.js";
import { captureSlices, restoreSlices } from "../../src/platform/saveSlices.js";

const territory = { uniqueId: "42", territoryName: "Testland", area: 350000 };

function open(overrides = {}) {
    return openBattle({
        attackers: [1000, 0, 0, 0],
        defenders: [800, 0, 0, 0],
        territoryId: "42",
        territory,
        startingAttackForce: 1000,
        startingDefendForce: 800,
        ...overrides
    });
}

beforeEach(() => {
    __resetBattleState();
});

describe("opening and closing", () => {
    it("has no battle until one is opened", () => {
        expect(hasBattle()).toBe(false);
        expect(currentBattle()).toBeNull();
    });

    it("records each side's force at the start", () => {
        const battle = open();
        expect(battle.startingAttackForce).toBe(1000);
        expect(battle.startingDefendForce).toBe(800);
        expect(battle.round).toBe(0);
        expect(battle.records).toEqual([]);
    });

    it("closes without clearing the armies", () => {
        open();
        const armies = attackingArmy();
        closeBattle();
        expect(hasBattle()).toBe(false);
        // A withdrawing army is read back after the window has gone, and a siege created from
        // this battle is still holding this array.
        expect(attackingArmy()).toBe(armies);
    });
});

describe("array identity", () => {
    it("adopts the arrays it is given rather than copying them", () => {
        // `battle.js` resumes a battle from a siege by handing over the SIEGE's own
        // defendingArmyRemaining, so that the fighting writes through to the siege record.
        // Copying here would leave the siege's garrison frozen however many assaults it took.
        const siegeArmy = [500, 0, 0, 0];
        open({ defenders: siegeArmy });
        expect(defendingArmy()).toBe(siegeArmy);
    });

    it("keeps the same arrays across rounds of one battle", () => {
        open();
        const attackers = attackingArmy();
        const defenders = defendingArmy();
        commitRound({
            attackers: [900, 0, 0, 0],
            defenders: [700, 0, 0, 0],
            round: 1,
            state: "in-progress",
            attackerDugIn: false,
            defenderDugIn: false
        }, null);
        expect(attackingArmy()).toBe(attackers);
        expect(defendingArmy()).toBe(defenders);
        expect(attackers).toEqual([900, 0, 0, 0]);
    });

    it("gives a NEW battle new arrays, so a standing siege is not rewritten", () => {
        // The bug this prevents: one reused pair of arrays for the life of the page means the
        // next battle silently overwrites the armies of every siege still on the map.
        open();
        const firstBattlesArmies = attackingArmy();
        firstBattlesArmies[0] = 123;

        open({ attackers: [2000, 0, 0, 0] });
        expect(attackingArmy()).not.toBe(firstBattlesArmies);
        expect(firstBattlesArmies[0]).toBe(123);
    });
});

describe("rounds", () => {
    it("counts rounds and keeps the record of each", () => {
        open();
        expect(roundsFought()).toBe(0);
        expect(lastRound()).toBeNull();

        commitRound({
            attackers: [900, 0, 0, 0], defenders: [700, 0, 0, 0],
            round: 1, state: "in-progress", attackerDugIn: false, defenderDugIn: false
        }, { round: 1, attackerLosses: 1, defenderLosses: 1 });

        expect(roundsFought()).toBe(1);
        expect(lastRound().round).toBe(1);
        expect(currentBattle().round).toBe(1);
    });

    it("carries the state the model classified", () => {
        open();
        commitRound({
            attackers: [10, 0, 0, 0], defenders: [0, 0, 0, 0],
            round: 1, state: "defender-wiped", attackerDugIn: false, defenderDugIn: false
        }, { round: 1 });
        expect(currentBattle().state).toBe("defender-wiped");
    });

    it("does nothing when there is no battle", () => {
        expect(commitRound({ attackers: [1, 0, 0, 0], defenders: [1, 0, 0, 0], round: 1 }, null))
            .toBeNull();
    });
});

describe("asModelState", () => {
    it("hands the model the LIVE arrays, not copies", () => {
        open();
        const state = asModelState(territory);
        expect(state.attackers).toBe(attackingArmy());
        expect(state.defenders).toBe(defendingArmy());
        expect(state.territory).toBe(territory);
    });

    it("is null when no battle is open", () => {
        expect(asModelState(territory)).toBeNull();
    });
});

describe("the save slice", () => {
    it("captures null when no battle is in flight", () => {
        const captured = captureSlices();
        expect(captured.battleInProgress).toBeNull();
    });

    it("round-trips a battle", () => {
        open();
        commitRound({
            attackers: [900, 0, 0, 0], defenders: [700, 0, 0, 0],
            round: 1, state: "in-progress", attackerDugIn: false, defenderDugIn: false
        }, { round: 1 });

        const captured = captureSlices();
        __resetBattleState();
        expect(hasBattle()).toBe(false);

        restoreSlices({ battleInProgress: captured.battleInProgress });
        expect(hasBattle()).toBe(true);
        expect(currentBattle().round).toBe(1);
        expect(attackingArmy()).toEqual([900, 0, 0, 0]);
    });

    it("captures a snapshot, not the live arrays", () => {
        open();
        const captured = captureSlices();
        attackingArmy()[0] = 7;
        expect(captured.battleInProgress.attackers[0]).toBe(1000);
    });

    it("restoring nothing leaves no battle", () => {
        open();
        restoreSlices({ battleInProgress: null });
        expect(hasBattle()).toBe(false);
    });
});

describe("reserves", () => {
    it("holds committed force until the round it is due", () => {
        open();
        queueReserves([500, 0, 0, 0], 3);
        expect(pendingReserves()).toHaveLength(1);
        expect(takeArrivedReserves(1)).toBeNull();
        expect(takeArrivedReserves(2)).toBeNull();
        expect(takeArrivedReserves(3)).toEqual([500, 0, 0, 0]);
    });

    it("delivers a reserve exactly once", () => {
        open();
        queueReserves([500, 0, 0, 0], 2);
        expect(takeArrivedReserves(2)).toEqual([500, 0, 0, 0]);
        expect(takeArrivedReserves(3)).toBeNull();
        expect(pendingReserves()).toHaveLength(0);
    });

    it("merges several sets due at the same time", () => {
        open();
        queueReserves([100, 1, 0, 0], 2);
        queueReserves([200, 0, 3, 0], 2);
        expect(takeArrivedReserves(2)).toEqual([300, 1, 3, 0]);
    });

    it("copies the army it is given, so the caller cannot change it afterwards", () => {
        open();
        const army = [100, 0, 0, 0];
        queueReserves(army, 2);
        army[0] = 999;
        expect(takeArrivedReserves(2)).toEqual([100, 0, 0, 0]);
    });

    it("reinforces the attackers IN PLACE, so every existing reference sees it", () => {
        open();
        const attackers = attackingArmy();
        reinforceAttackers([500, 2, 0, 0]);
        expect(attackingArmy()).toBe(attackers);
        expect(attackers).toEqual([1500, 2, 0, 0]);
    });

    it("starts a new battle with no reserves carried over", () => {
        open();
        queueReserves([500, 0, 0, 0], 2);
        open();
        expect(pendingReserves()).toHaveLength(0);
    });
});

describe("the last push offer", () => {
    it("is off until the model says otherwise", () => {
        open();
        expect(lastPushIsOffered()).toBe(false);
    });

    it("is on exactly while the battle is in that state", () => {
        open();
        commitRound({
            attackers: [900, 0, 0, 0], defenders: [200, 0, 0, 0],
            round: 1, state: "last-push-available", attackerDugIn: false, defenderDugIn: false
        }, { round: 1 });
        expect(lastPushIsOffered()).toBe(true);

        commitRound({
            attackers: [800, 0, 0, 0], defenders: [400, 0, 0, 0],
            round: 2, state: "in-progress", attackerDugIn: false, defenderDugIn: false
        }, { round: 2 });
        expect(lastPushIsOffered()).toBe(false);
    });

    it("is off when there is no battle", () => {
        expect(lastPushIsOffered()).toBe(false);
    });
});
