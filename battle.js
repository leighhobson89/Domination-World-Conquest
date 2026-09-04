import {
    addUpAllTerritoryResourcesForCountryAndWriteToTopTable,
    formatNumbersToKMB,
    playerOwnedTerritories,
    setPlayerUseableNotUseableWeaponsDueToOilDemand, turnGainsArrayAi,
    turnGainsArrayPlayer
} from './resourceCalculations.js';
import {
    getOriginalDefendingTerritory,
    getSiegeObjectFromPath,
    mapMode,
    paths,
    populateWarResultPopup,
    removeSiegeImageFromPath,
    setArmyTextValues,
    setAttackProbabilityOnUI,
    setCurrentWarFlagString,
    setDefendingTerritoryCopyStart,
    setFlag,
    setTerritoryAboutToBeAttackedFromExternal,
    setUpResultsOfWarExternal
} from './ui.js';
//Battle overhaul B.6.6. Six imports came out of the list above -- `retreatButtonState`,
//`setAdvanceButtonState`, `setAdvanceButtonText`, `setRetreatButtonState`,
//`setRetreatButtonText` and `setLastPushButtonVisible`. Two of them wrote a NUMBER that decided
//behaviour and two wrote a DIFFERENT number that decided a label, and this file set both by hand
//at five sites. There is one state now and the labels are derived from it. Note that this import
//is NOT part of the ui.js cycle: BattleWindow imports only the registry and a pure module.
import {
    AdvanceMode,
    RetreatMode,
    VictoryKind,
    battleWindow
} from './src/ui/battle/BattleWindow.js';
import { roundLog } from './src/ui/battle/RoundLog.js';

// NOTE: `./ui.js` above is an import cycle -- ui.js imports this file too. The previous
// code worked around it with `setTimeout(..., 1000)` before a dynamic import(), which is
// a race: on a slow load the binding was still undefined when first used. A plain static
// import is correct because the imported symbols are hoisted function declarations, so
// they are initialised before any module body runs. See docs/archived/03-refactor-plan.md Phase 1.7.
//
// The `src/state/*` imports below are NOT in the cycle and must not be allowed to join it:
// the state layer imports nothing from the game.
import {
    oilRequirements,
    vehicleArmyPersonnelWorth,
    battleOutcomeEffects,
    conquestLockout
} from './src/config/balance.js';
import {
    oilDemandFor
} from './src/rules/economy/capacity.js';
import {
    combinedForce
} from './src/rules/military/units.js';
import {
    BattleState,
    isTerminal,
    modifiersFor,
    resolveBattleRound,
    resolveLastPush,
    shareFor
} from './src/rules/military/battleModel.js';
import {
    defenderDiceCountFor,
    diceCountFor
} from './src/rules/military/dice.js';
import {
    battleForecast
} from './src/rules/military/forecast.js';
import {
    winProbability,
    combatContinentModifierFor,
    attackingDevelopmentIndex
} from './src/rules/military/probability.js';
import {
    tickSiege,
    siegeScore,
    siegeDamageDeltas,
    arrestGarrisonFor
} from './src/rules/military/siege.js';
import {
    allTerritories,
    getTerritory,
    playerCountryName,
    playerColour,
    playerSieges,
    aiSieges,
    historicWarsList,
    historicAiWarsList,
    warIds
} from './src/state/selectors.js';
import {
    referenceDefendingTerritory
} from './src/state/sieges.js';
import {
    getPathByUniqueId
} from './src/state/indexes.js';
import {
    asModelState,
    attackingArmy as battleAttackingArmy,
    commitRound,
    currentBattle,
    defendingArmy as battleDefendingArmy,
    openBattle,
    reinforceAttackers,
    setDefeatType,
    takeArrivedReserves
} from './src/state/battleState.js';
import {
    addSiege,
    removeSiege,
    updateTerritory as patchTerritory,
    recordHistoricWar,
    recordHistoricAiWar,
    setTerritoryOwner,
    setTerritoryDeactivated,
    setCurrentWarId as storeCurrentWarId,
    setCurrentAiWarId as storeCurrentAiWarId,
    setNextWarId as storeNextWarId,
    setNextAiWarId as storeNextAiWarId
} from './src/state/mutations.js';
import {
    diceStage
} from './src/ui/battle/DiceStage.js';
import {
    clashPanel
} from './src/ui/battle/ClashPanel.js';
import {
    forceLedger
} from './src/ui/battle/ForceLedger.js';
import {
    bottomTable
} from './src/ui/components/BottomTable.js';
import {
    moveButton
} from './src/ui/components/MoveButton.js';
import {
    registerSaveSlice
} from './src/platform/saveSlices.js';
import {
    recordFailedAttack,
    recordSiegeLifted,
    recordSiegeResolved
} from './src/state/activityRecorder.js';

export let finalAttackArray = [];
export const proportionsOfAttackArray = [];
let reusableAttackingAverageDevelopmentIndex;
let reusableCombatContinentModifier;
export const playerTurnsDeactivatedArray = [];
export const aiTurnsDeactivatedArray = [];

/**
 * The setup the last pre-battle odds calculation was made from.
 *
 * Battle overhaul B.6.7. Read by the attack window's dice preview so that the itemised ledger and
 * the odds bar come from ONE aggregation of the allocation table. Null when nothing is committed.
 */
let lastPreBattleSetup = null;

/** @returns {object|null} see `lastPreBattleSetup`. */
export function preBattleSetup() {
    return lastPreBattleSetup;
}

export let currentRound = 1;
export let attackingArmyRemaining;
export let defendingArmyRemaining;
export let updatedProbability;
export let unchangeableWarStartCombinedForceAttack;
export let unchangeableWarStartCombinedForceDefend;
export let initialCombinedForceAttack;
export let initialCombinedForceDefend;
export let combinedForceAttack;
export let combinedForceDefend;
export let totalAttackingArmy;
export let totalDefendingArmy;
export let tempTotalAttackingArmy;
export let tempTotalDefendingArmy;
export let defendingTerritory;
export let defendingTerritoryId;
export let defenseBonus;
export const retrievalArray = [];

//Phase 4.8. These four were `export let`s, which meant every importer held a live
//binding to a module-level variable that only this file could reassign, and the AI,
//the UI and the economy all read them. They are now the store's, re-exported under
//their historical names: the objects and arrays themselves are the store's, with a
//stable identity, so the ~60 read sites are unchanged and only the writes moved to
//state/mutations.js.
export const playerSiegeWarsList = playerSieges();
export const aiSiegeWarsList = aiSieges();
export const historicWars = historicWarsList();
export const historicAiWars = historicAiWarsList();
let resolution;

let rout = false;
let massiveAssault = false;



//The unit matchup table and every other balance number in this file live in
//src/config/balance.js (Phase 5.1). UNIT_MATCHUP_EFFECTIVENESS carries the reasoning.

//The skirmish model that used to live here -- chooseDefendingUnitTypeIndex(),
//countPossibleSkirmishes(), resolveRound() and classifyOutcome() in
//src/rules/military/battle.js -- is no longer reached from the player's battle (overhaul B.4).
//It is still imported by the AI until B.5 deletes doAttack() and that file with it.


export function calculateProbabilityPreBattle(attackArray, mainArrayOfTerritoriesAndResources, reCalculationWithinBattle, remainingDefendingArmy, defendingTerritoryId) {
    if (reCalculationWithinBattle) {
        const attackedTerritoryId = defendingTerritoryId;

        //Phase 5.3: the strengths this branch used to build by hand are built inside
        //winProbability() in src/rules/military/probability.js, from the same territory and
        //the same two army arrays. Building them here as well is what let the mid-battle
        //recalculation and the pre-battle calculation below drift apart.
        const defendingTerritory = mainArrayOfTerritoriesAndResources.find(
            ({ uniqueId }) => uniqueId === attackedTerritoryId);

        return winProbability(attackArray, remainingDefendingArmy, defendingTerritory, {
            attackingDevelopmentIndex: reusableAttackingAverageDevelopmentIndex,
            combatContinentModifier: reusableCombatContinentModifier
        });
    } else {
        // Initialize the modifiedAttackArray with the first element
        finalAttackArray = [attackArray[0]];

        let nonZeroCount = 0;
        // Iterate through the attackArray, checking for territories with non-zero units
        for (let i = 1; i < attackArray.length; i += 5) {
            const hasNonZeroUnits = attackArray.slice(i + 1, i + 5).some(unitCount => unitCount > 0);
            if (!hasNonZeroUnits) {
                nonZeroCount++;
            }
            // If the territory has non-zero units or is the last territory, include it in the modifiedAttackArray
            if (hasNonZeroUnits) {
                finalAttackArray.push(...attackArray.slice(i, i + 5));
            }
        }

        if (nonZeroCount === (attackArray.length - 1) / 5) {
            //Nothing committed. B.6.7: forget the setup as well as returning zero, or the preview
            //keeps showing the dice of an allocation the player has just emptied.
            lastPreBattleSetup = null;
            return 0;
        }

        const [
            attackedTerritoryId,
            ...attacks // Rest operator (...) to capture the remaining elements as an array
        ] = finalAttackArray;

        const attackingTerritories = [];
        const infantryCounts = [];
        const assaultCounts = [];
        const airCounts = [];
        const navalCounts = [];

        const combatContinentModifier = calculateContinentModifier(attackedTerritoryId, mainArrayOfTerritoriesAndResources);
        reusableCombatContinentModifier = combatContinentModifier;

        // Loop through the attacks array and extract the values for each attacking territory
        for (let i = 0; i < attacks.length; i += 5) {
            const [
                attackingTerritory,
                infantry,
                assault,
                air,
                naval
            ] = attacks.slice(i, i + 5);

            // Push the extracted values to their respective arrays
            attackingTerritories.push(attackingTerritory);
            infantryCounts.push(infantry);
            assaultCounts.push(assault);
            airCounts.push(air);
            navalCounts.push(naval);
        }

        const defendingTerritory = mainArrayOfTerritoriesAndResources.find(
            ({ uniqueId }) => uniqueId === attackedTerritoryId);

        //The attack arrives as one array per unit type, one entry per attacking territory;
        //winProbability() wants one army array. Summing here is what turns a many-territory
        //attack into the single force that fights.
        const attackers = [
            infantryCounts.reduce((sum, count) => sum + count, 0),
            assaultCounts.reduce((sum, count) => sum + count, 0),
            airCounts.reduce((sum, count) => sum + count, 0),
            navalCounts.reduce((sum, count) => sum + count, 0)
        ];
        const defenders = [
            defendingTerritory.infantryForCurrentTerritory,
            defendingTerritory.useableAssault,
            defendingTerritory.useableAir,
            defendingTerritory.useableNaval
        ];

        //Cached for the mid-battle recalculation above, which has no attacking territories
        //left to average.
        reusableAttackingAverageDevelopmentIndex = attackingDevelopmentIndex(
            attackingTerritories.map(territoryUniqueId =>
                mainArrayOfTerritoriesAndResources.find(
                    ({ uniqueId }) => uniqueId === territoryUniqueId.toString())));

        //Battle overhaul B.6.7. The aggregation above -- many attacking territories folded into
        //one army, the defender's USEABLE units, the development index and the continent -- is
        //exactly the setup a battle is resolved from, and it is rebuilt here on every plus and
        //minus press. Keeping it means the attack window's dice preview is itemised from the
        //same numbers the odds bar is computed from, rather than from a second aggregation that
        //could drift. Cleared when nothing is committed, so a stale setup cannot be drawn.
        lastPreBattleSetup = {
            attackers,
            defenders,
            territory: defendingTerritory,
            context: {
                attackingDevelopmentIndex: reusableAttackingAverageDevelopmentIndex,
                combatContinentModifier: combatContinentModifier
            },
            siegeTurns: 0
        };

        return winProbability(attackers, defenders, defendingTerritory, {
            attackingDevelopmentIndex: reusableAttackingAverageDevelopmentIndex,
            combatContinentModifier: combatContinentModifier
        });
    }
}

export function setupBattle(probability, arrayOfUniqueIdsAndAttackingUnits, mainArrayOfTerritoriesAndResources) {


    // Extract defending territory data
    defendingTerritoryId = arrayOfUniqueIdsAndAttackingUnits[0];
    defendingTerritory = mainArrayOfTerritoriesAndResources.find(({
                                                                      uniqueId
                                                                  }) => uniqueId === defendingTerritoryId);

    //Battle overhaul B.10.2. `developmentIndex`, `areaWeightDefender` and `continentModifier`
    //were read here only to be printed. They are inputs to `shareFor()`, which reads them from
    //the territory itself, and they are on screen in the ledger -- so reading them a second time
    //to narrate them was a third copy of the same derivation.
    defenseBonus = defendingTerritory.defenseBonus;

    // Display defender's attributes

    //audit 5.2 L: proportionsOfAttackArray is module level and is only ever pushed to,
    //so without this every battle inherited the retrieval proportions of every battle
    //before it.
    proportionsOfAttackArray.length = 0;

    // Calculate total attacking army
    totalAttackingArmy = [0, 0, 0, 0];
    tempTotalAttackingArmy = [0, 0, 0, 0]; // copy for console output
    totalDefendingArmy = [defendingTerritory.infantryForCurrentTerritory, defendingTerritory.useableAssault, defendingTerritory.useableAir, defendingTerritory.useableNaval];
    tempTotalDefendingArmy = [defendingTerritory.infantryForCurrentTerritory, defendingTerritory.useableAssault, defendingTerritory.useableAir, defendingTerritory.useableNaval];

    // Initialize counts for each unit type
    let totalInfantryCount = 0;
    let totalAssaultCount = 0;
    let totalAirCount = 0;
    let totalNavalCount = 0;

    // Iterate through the attacking units and calculate the total army counts
    for (let i = 1; i < arrayOfUniqueIdsAndAttackingUnits.length; i += 5) {
        const territoryId = arrayOfUniqueIdsAndAttackingUnits[i];
        const infantryCount = arrayOfUniqueIdsAndAttackingUnits[i + 1];
        const assaultCount = arrayOfUniqueIdsAndAttackingUnits[i + 2];
        const airCount = arrayOfUniqueIdsAndAttackingUnits[i + 3];
        const navalCount = arrayOfUniqueIdsAndAttackingUnits[i + 4];

        totalAttackingArmy[0] += infantryCount;
        totalAttackingArmy[1] += assaultCount;
        totalAttackingArmy[2] += airCount;
        totalAttackingArmy[3] += navalCount;

        tempTotalAttackingArmy[0] += infantryCount;
        tempTotalAttackingArmy[1] += assaultCount;
        tempTotalAttackingArmy[2] += airCount;
        tempTotalAttackingArmy[3] += navalCount;

        totalInfantryCount += infantryCount;
        totalAssaultCount += assaultCount;
        totalAirCount += airCount;
        totalNavalCount += navalCount;

        proportionsOfAttackArray.push([territoryId, infantryCount, assaultCount, airCount, navalCount]);
    }

    // Calculate the proportions of attacking units per territory
    for (let i = 0; i < proportionsOfAttackArray.length; i++) {
        const territoryData = proportionsOfAttackArray[i];
        const infantryPercentage = totalInfantryCount !== 0 ? (territoryData[1] / totalInfantryCount) * 100 : 0;
        const assaultPercentage = totalAssaultCount !== 0 ? (territoryData[2] / totalAssaultCount) * 100 : 0;
        const airPercentage = totalAirCount !== 0 ? (territoryData[3] / totalAirCount) * 100 : 0;
        const navalPercentage = totalNavalCount !== 0 ? (territoryData[4] / totalNavalCount) * 100 : 0;

        proportionsOfAttackArray[i] = [territoryData[0], infantryPercentage, assaultPercentage, airPercentage, navalPercentage];
    }


    unchangeableWarStartCombinedForceAttack = calculateCombinedForce(totalAttackingArmy);
    //audit 5.1 E: this was calculated from totalAttackingArmy, so all three rout and
    //last-push thresholds in processRound compared the DEFENDER's remaining force against
    //the ATTACKER's starting force. Battles resolved at the wrong moment whenever the two
    //armies differed in size, which is almost always.
    unchangeableWarStartCombinedForceDefend = calculateCombinedForce(totalDefendingArmy);

    initialCombinedForceAttack = calculateCombinedForce(totalAttackingArmy);
    initialCombinedForceDefend = calculateCombinedForce(totalDefendingArmy);

    //Battle overhaul B.4. The skirmish budget is gone. `skirmishesPerType`, `totalSkirmishes`
    //and `skirmishesPerRound` divided the smaller army's HEAD COUNT into five rounds, which on
    //six-figure garrisons meant one click resolved up to two hundred thousand individual coin
    //flips and five clicks annihilated the smaller army whatever the outcome table said. A round
    //is a handful of dice now; see src/rules/military/dice.js.
    let hasSiegedBefore = historicWars.some((siege) => siege.warId === getCurrentWarId());

    //Battle overhaul B.3. The two armies live in `src/state/battleState.js` now. The arrays
    //handed over are exactly the ones this function used to build -- a fresh copy for a new
    //battle, and the SIEGE's own array when resuming one, which is what makes an assault out of
    //a siege write its casualties back into the siege record. `openBattle()` adopts rather than
    //copies precisely so that distinction survives the move.
    //
    //`attackingArmyRemaining` and `defendingArmyRemaining` stay as exported bindings pointing at
    //those same arrays: about sixty sites read them, `ui.js` imports `defendingArmyRemaining`
    //directly, and this phase is a move with no behaviour change.
    const hasSiegedBeforeWar = hasSiegedBefore
        ? historicWars.find((siege) => siege.warId === getCurrentWarId())
        : null;
    openBattle({
        attackers: [...totalAttackingArmy],
        defenders: hasSiegedBeforeWar ? hasSiegedBeforeWar.defendingArmyRemaining : [...totalDefendingArmy],
        territoryId: defendingTerritoryId,
        territory: defendingTerritory,
        context: {
            attackingDevelopmentIndex: reusableAttackingAverageDevelopmentIndex,
            combatContinentModifier: reusableCombatContinentModifier
        },
        startingAttackForce: unchangeableWarStartCombinedForceAttack,
        startingDefendForce: unchangeableWarStartCombinedForceDefend,
        //Battle overhaul B.9.2. Assaulting OUT of a siege carries the grinding with it: the
        //besieger has spent turns knocking the place down, and `modifiersFor()` turns that into a
        //die bonus (+1 per three turns, capped at +2). It is the reward for patience, and the
        //reason to lay a siege you intend to finish yourself rather than one you abandon.
        siegeTurns: hasSiegedBeforeWar?.turnsInSiege ?? 0
    });
    attackingArmyRemaining = battleAttackingArmy();
    defendingArmyRemaining = battleDefendingArmy();

    //The ledger before a die is thrown: how many each side WILL roll, and every modifier by name.
    //This is the number the player committed on, so it has to be on screen before they advance.
    drawLedger();
    updatedProbability = calculateProbabilityPreBattle(totalAttackingArmy, mainArrayOfTerritoriesAndResources, true, totalDefendingArmy, arrayOfUniqueIdsAndAttackingUnits[0]);
}

//areaBonusFor() and combatContinentModifierFor() are in src/rules/military/probability.js
//(Phase 5.3); imported above.

function calculateContinentModifier(attackedTerritoryId, mainArrayOfTerritoriesAndResources) {
    return combatContinentModifierFor(
        mainArrayOfTerritoriesAndResources.find(({ uniqueId }) => uniqueId === attackedTerritoryId));
}

export function handleWarEndingsAndOptions(situation, contestedTerritory, attackingArmyRemaining, defendingArmyRemaining, routFromSiege, ai, siegeObject) {
    //Battle overhaul B.6.6. Three `getElementById` lookups stood here so that five branches below
    //could write labels, `disabled` flags and background colours onto the bar by hand. The bar is
    //derived from one state now, so this function no longer knows that the buttons are elements.
    if (!ai) {
        let attackArrayText = [...attackingArmyRemaining, ...defendingArmyRemaining];
        setArmyTextValues(attackArrayText, 1, contestedTerritory.uniqueId);
    }

    let contestedPath;
    let won = false;
    for (let i = 0; i < paths.length; i++) {
        if (paths[i].getAttribute("uniqueid") === contestedTerritory.uniqueId) {
            contestedPath = paths[i];
            break;
        }
    }
    if (routFromSiege) { //assure correct data updated
        contestedTerritory = getTerritory(contestedTerritory.uniqueId) ?? contestedTerritory;
    }

    //Phase 7.4. Read here, used after the switch. Three of the five branches below
    //hand the territory to the attacker, so `contestedTerritory.dataName` is the
    //ATTACKER by the time the outcome is known -- the same trap that made the Wars &
    //Sieges tab draw the winner's flag on both sides of a war (known-issues AS). A
    //record of something that happened names who it happened to; it does not read it
    //back off the world afterwards.
    const feedDefender = contestedTerritory.dataName;
    const feedAttacker = ai
        ? (siegeObject?.attackingCountry ?? siegeObject?.dataName ?? "")
        : playerCountryName();
    const feedPlayerAttacking = !ai;
    const feedPlayerDefending = contestedTerritory.owner === "Player";

    switch (situation) {
        case 0:
            won = true;
            setDefendingTerritoryCopyStart(contestedTerritory);
            turnGainsArrayPlayer.changeOilDemand += (attackingArmyRemaining[1] * oilRequirements.assault);
            turnGainsArrayPlayer.changeOilDemand += (attackingArmyRemaining[2] * oilRequirements.air);
            turnGainsArrayPlayer.changeOilDemand += (attackingArmyRemaining[3] * oilRequirements.naval);
            //Set territory to owner player, replace army values with remaining attackers in main array, change colors, deactivate territory until next turn
            playerOwnedTerritories.push(contestedPath);
            setTerritoryOwner(contestedTerritory.uniqueId, "Player", playerCountryName());
            contestedTerritory.infantryForCurrentTerritory = attackingArmyRemaining[0];
            contestedTerritory.assaultForCurrentTerritory = attackingArmyRemaining[1];
            contestedTerritory.airForCurrentTerritory = attackingArmyRemaining[2];
            contestedTerritory.navalForCurrentTerritory = attackingArmyRemaining[3];
            contestedTerritory.armyForCurrentTerritory = contestedTerritory.infantryForCurrentTerritory + (contestedTerritory.assaultForCurrentTerritory * vehicleArmyPersonnelWorth.assault) + (contestedTerritory.airForCurrentTerritory * vehicleArmyPersonnelWorth.air) + (contestedTerritory.navalForCurrentTerritory * vehicleArmyPersonnelWorth.naval);
            //Battle overhaul B.10.2 / B.6.6. Seven statements -- two button numbers that had
            //to agree, two colour literals meaning "inert", and `retreatButton.disabled = true`
            //immediately undone on the next line -- are one write. Withdrawing is still
            //available; the siege button is not, because the battle is over.
            battleWindow.setBattleButtons({
                advance: AdvanceMode.ACCEPT,
                victory: VictoryKind.CLEAN,
                siegeEnabled: false
            });
            break;
        case 1:
            setDefendingTerritoryCopyStart(contestedTerritory);
            //Battle overhaul B.4.5. `defendingArmyRemaining.push(0)` stood here, appending a
            //DEFEAT TYPE as a fifth element of a four-slot army array, read back in the retreat
            //handler as `defendingArmyRemaining[4]`. An army array that is sometimes five long is
            //a trap for everything that iterates one -- and this one is aliased by any siege
            //created from the battle. The outcome is state now, on the battle in the store.
            setDefeatType("wiped");
            //The attack is lost. The red button is the only way out, so the other two go
            //inert -- as a class, not as a colour.
            battleWindow.setBattleButtons({
                retreat: RetreatMode.DEFEAT,
                siegeEnabled: false
            });
            break;
        case 2:
            won = true;
            rout = true;
            if (!ai) {
                setDefendingTerritoryCopyStart(contestedTerritory);
                turnGainsArrayPlayer.changeOilDemand += (attackingArmyRemaining[1] * oilRequirements.assault) + (Math.floor(defendingArmyRemaining[1] * battleOutcomeEffects.routCaptureShare) * oilRequirements.assault);
                turnGainsArrayPlayer.changeOilDemand += (attackingArmyRemaining[2] * oilRequirements.air) + (Math.floor(defendingArmyRemaining[2] * battleOutcomeEffects.routCaptureShare) * oilRequirements.air);
                turnGainsArrayPlayer.changeOilDemand += (attackingArmyRemaining[3] * oilRequirements.naval) + (Math.floor(defendingArmyRemaining[3] * battleOutcomeEffects.routCaptureShare) * oilRequirements.naval);
                playerOwnedTerritories.push(contestedPath);
                setTerritoryOwner(contestedTerritory.uniqueId, "Player", playerCountryName());
                turnGainsArrayPlayer.changeInfantry += Math.floor(defendingArmyRemaining[0] * battleOutcomeEffects.routCaptureShare);
                turnGainsArrayPlayer.changeAssault += Math.floor(defendingArmyRemaining[1] * battleOutcomeEffects.routCaptureShare);
                turnGainsArrayPlayer.changeAir += Math.floor(defendingArmyRemaining[2] * battleOutcomeEffects.routCaptureShare);
                turnGainsArrayPlayer.changeNaval += Math.floor(defendingArmyRemaining[3] * battleOutcomeEffects.routCaptureShare);
                contestedTerritory.infantryForCurrentTerritory = attackingArmyRemaining[0] + (Math.floor(defendingArmyRemaining[0] * battleOutcomeEffects.routCaptureShare));
                contestedTerritory.assaultForCurrentTerritory = attackingArmyRemaining[1] + (Math.floor(defendingArmyRemaining[1] * battleOutcomeEffects.routCaptureShare));
                contestedTerritory.airForCurrentTerritory = attackingArmyRemaining[2] + (Math.floor(defendingArmyRemaining[2] * battleOutcomeEffects.routCaptureShare));
                contestedTerritory.navalForCurrentTerritory = attackingArmyRemaining[3] + (Math.floor(defendingArmyRemaining[3] * battleOutcomeEffects.routCaptureShare));
                contestedTerritory.armyForCurrentTerritory = contestedTerritory.infantryForCurrentTerritory + (contestedTerritory.assaultForCurrentTerritory * vehicleArmyPersonnelWorth.assault) + (contestedTerritory.airForCurrentTerritory * vehicleArmyPersonnelWorth.air) + (contestedTerritory.navalForCurrentTerritory * vehicleArmyPersonnelWorth.naval);
                //The FLAVOUR of the win changes the word on the button and nothing else,
                //which is exactly why it is a separate field rather than a fourth advance state.
                battleWindow.setBattleButtons({
                    advance: AdvanceMode.ACCEPT,
                    victory: VictoryKind.ROUT,
                    siegeEnabled: false
                });
            } else if (ai) {
                //audit 5.1 H: this was `for (country of turnGainsArrayAi)` -- an implicit
                //global (a ReferenceError under a module's strict mode) over a plain object
                //that is not iterable. It threw every time an AI rout resolved here. The
                //country NAME is the key; the entry is the value.
                for (const [countryName, country] of Object.entries(turnGainsArrayAi)) {
                    if (countryName === siegeObject.attackingCountry) {
                        country.changeOilDemand += (siegeObject.attackingArmyRemaining[1] * oilRequirements.assault) + (Math.floor(defendingArmyRemaining[1] * battleOutcomeEffects.routCaptureShare) * oilRequirements.assault);
                        country.changeOilDemand += (siegeObject.attackingArmyRemaining[2] * oilRequirements.air) + (Math.floor(defendingArmyRemaining[2] * battleOutcomeEffects.routCaptureShare) * oilRequirements.air);
                        country.changeOilDemand += (siegeObject.attackingArmyRemaining[3] * oilRequirements.naval) + (Math.floor(defendingArmyRemaining[3] * battleOutcomeEffects.routCaptureShare) * oilRequirements.naval);
                        country.changeInfantry += Math.floor(siegeObject.defendingArmyRemaining[0] * battleOutcomeEffects.routCaptureShare);
                        country.changeAssault += Math.floor(siegeObject.defendingArmyRemaining[1] * battleOutcomeEffects.routCaptureShare);
                        country.changeAir += Math.floor(siegeObject.defendingArmyRemaining[2] * battleOutcomeEffects.routCaptureShare);
                        country.changeNaval += Math.floor(siegeObject.defendingArmyRemaining[3] * battleOutcomeEffects.routCaptureShare);
                        break;
                    }
                }
                contestedTerritory.infantryForCurrentTerritory = siegeObject.attackingArmyRemaining[0];
                contestedTerritory.assaultForCurrentTerritory = siegeObject.attackingArmyRemaining[1];
                contestedTerritory.airForCurrentTerritory = siegeObject.attackingArmyRemaining[2];
                contestedTerritory.navalForCurrentTerritory = siegeObject.attackingArmyRemaining[3];
                contestedTerritory.armyForCurrentTerritory = contestedTerritory.infantryForCurrentTerritory + (contestedTerritory.assaultForCurrentTerritory * vehicleArmyPersonnelWorth.assault) + (contestedTerritory.airForCurrentTerritory * vehicleArmyPersonnelWorth.air) + (contestedTerritory.navalForCurrentTerritory * vehicleArmyPersonnelWorth.naval);
                //A siege object has no `dataName` -- that is a TERRITORY's field. The
                //besieger is `attackingCountry`, set when the siege was laid. Reading
                //`dataName` here handed `setTerritoryOwner()` `undefined` for both the owner
                //and the country, which is what an AI-versus-AI starve-out conquest did on
                //the rare turn it reached this branch at all.
                setTerritoryOwner(contestedTerritory.uniqueId, siegeObject.attackingCountry);
            }
            break;
        case 3:
            won = true;
            massiveAssault = true;
            //Set territory to owner player, replace army values with remaining attackers - 20% in main array, change colors, deactivate territory until next turn
            setDefendingTerritoryCopyStart(contestedTerritory);
            //Battle overhaul B.7. The cost of the push is NOT applied here any more.
            //`resolveLastPush()` in src/rules/military/battleModel.js already took
            //`lastPushSurvivorShare` off the attackers before this was called, so charging it
            //again here billed the player twice -- measured as 600 survivors becoming 384 instead
            //of 480. The model owns the arithmetic; this branch garrisons what survived.
            //
            //Situation 3 is reached from `takeLastPush()` and nowhere else, so there is no other
            //caller relying on the old behaviour: `legacySituationFor()` never returns 3, and the
            //siege starve-out in resourceCalculations.js uses 2.
            turnGainsArrayPlayer.changeOilDemand += (attackingArmyRemaining[1] * oilRequirements.assault);
            turnGainsArrayPlayer.changeOilDemand += (attackingArmyRemaining[2] * oilRequirements.air);
            turnGainsArrayPlayer.changeOilDemand += (attackingArmyRemaining[3] * oilRequirements.naval);
            playerOwnedTerritories.push(contestedPath);
            setTerritoryOwner(contestedTerritory.uniqueId, "Player", playerCountryName());
            contestedTerritory.infantryForCurrentTerritory = attackingArmyRemaining[0];
            contestedTerritory.assaultForCurrentTerritory = attackingArmyRemaining[1];
            contestedTerritory.airForCurrentTerritory = attackingArmyRemaining[2];
            contestedTerritory.navalForCurrentTerritory = attackingArmyRemaining[3];
            contestedTerritory.armyForCurrentTerritory = contestedTerritory.infantryForCurrentTerritory + (contestedTerritory.assaultForCurrentTerritory * vehicleArmyPersonnelWorth.assault) + (contestedTerritory.airForCurrentTerritory * vehicleArmyPersonnelWorth.air) + (contestedTerritory.navalForCurrentTerritory * vehicleArmyPersonnelWorth.naval);
            battleWindow.setBattleButtons({
                advance: AdvanceMode.ACCEPT,
                victory: VictoryKind.ASSAULT,
                siegeEnabled: false
            });
            break;
        case 4:
            //remove attacking numbers from initial territories in main array, add half of attack remaining to defender in main array
            setDefendingTerritoryCopyStart(contestedTerritory);
            setDefeatType("routed"); //B.4.5, as above
            battleWindow.setBattleButtons({
                retreat: RetreatMode.DEFEAT,
                siegeEnabled: false
            });
            break;
    }
    //Phase 7.4. What the activity feed is told, and what it is deliberately NOT told.
    //
    //A CONQUEST is derived from the ownership change (`state/activityRecorder.js`), so
    //there is nothing to report for a win that was a straight attack -- reporting it
    //here as well would double every conquest in the feed.
    //
    //What has to be said explicitly is everything the store cannot answer afterwards.
    //A failed attack changes nothing about who owns what. And a battle that came out
    //of a SIEGE is worth its own line either way, because a siege ending is one state
    //change with three possible meanings and the player wants to know which.
    if (routFromSiege) {
        recordSiegeResolved({
            besiegerWon: won,
            territory: contestedTerritory.territoryName,
            defender: feedDefender,
            attacker: feedAttacker,
            playerAttacking: feedPlayerAttacking,
            playerDefending: feedPlayerDefending
        });
    }
    if (!won) {
        recordFailedAttack({
            territory: contestedTerritory.territoryName,
            defender: feedDefender,
            attacker: feedAttacker,
            playerAttacking: feedPlayerAttacking,
            playerDefending: feedPlayerDefending
        });
    }

    contestedTerritory.oilDemand = oilDemandFor(contestedTerritory);
    setPlayerUseableNotUseableWeaponsDueToOilDemand(allTerritories(), contestedTerritory);

    if (won && !ai) {
        setFlag(playerCountryName(), 2);
        setTerritoryOwner(contestedTerritory.uniqueId, "Player", playerCountryName());
        deactivateTerritory(contestedPath);
        if (mapMode === 2) {
            contestedPath.style.stroke = "white";
        }
    } else if (won && ai) {
        //As above: the besieger is `attackingCountry`, not `dataName`.
        setTerritoryOwner(contestedTerritory.uniqueId, siegeObject.attackingCountry);
        deactivateTerritoryAi(contestedPath);
    } else {
        //Nothing to do: the path renders the owner from the store (Phase 4.4), and
        //nothing above this point changed it in the branch that lands here.
    }
}

function deactivateTerritory(contestedPath) { //cant use a territory if just conquered it til this function decides
    const turnsToDeactivate = Math.floor(Math.random() * (conquestLockout.maxTurns - conquestLockout.minTurns + 1)) + conquestLockout.minTurns;
    playerTurnsDeactivatedArray.push([contestedPath.getAttribute("uniqueid"), turnsToDeactivate, 0]);

    //Phase 6.7. A patch of the colour SNAPSHOT stood here, forcing this territory's
    //entry to [uniqueId, playerColour(), 3] so a later restore would paint the newly
    //conquered land in the player's colour. There is no snapshot: repaintMap() asks
    //the store who owns the territory, and setTerritoryOwner() below is what makes
    //that answer "the player".

    moveButton.hideDestination();
    moveButton.setLabel("DEACTIVATED");
    moveButton.setEnabled(false);
    moveButton.setVariant("disabled");

    contestedPath.style.stroke = "red";
    contestedPath.style.strokeDasharray = "10, 5";
    contestedPath.setAttribute("stroke-width", "3");

    setTerritoryAboutToBeAttackedFromExternal(null); //also clears the attack marker

    //One write, one render. The `deactivated` attribute and this flag used to be set
    //separately -- the attribute here, the flag in a scan of the whole territory list a
    //few lines below -- and either could be reached without the other. The attribute is
    //rendered from the flag now (Phase 4.4).
    setTerritoryDeactivated(contestedPath.getAttribute("uniqueid"), true);
}

export function activateAiTerritoriesForNewTurn() {
    //Each entry is [uniqueId, turnsToDeactivate, turnsServed]. Walk backwards so the
    //splice below cannot shift an entry past the cursor.
    //
    //audit 5.2 N: the lookup compared a territory's uniqueId against the ARRAY
    //`aiTurnsDeactivatedArray[0]` rather than against `aiTurnsDeactivatedArray[i][0]`, so
    //it was never true and AI territories were never reactivated after a conquest.
    //audit 5.2 O: the entry was then left in the array forever, so once the counter did
    //match it re-fired on every subsequent turn for the rest of the game.
    for (let i = aiTurnsDeactivatedArray.length - 1; i >= 0; i--) {
        if (aiTurnsDeactivatedArray[i][1] !== aiTurnsDeactivatedArray[i][2]) {
            aiTurnsDeactivatedArray[i][2]++;
        } else {
            setTerritoryDeactivated(aiTurnsDeactivatedArray[i][0], false);
            aiTurnsDeactivatedArray.splice(i, 1); //served its sentence, stop tracking it
        }
    }
}
export function activateAllPlayerTerritoriesForNewTurn() { //reactivate all territories at start of turn
    //audit 5.2 O -- see activateAiTerritoriesForNewTurn. Walk backwards, and splice a
    //reactivated entry out so it cannot re-fire every turn thereafter.
    for (let i = playerTurnsDeactivatedArray.length - 1; i >= 0; i--) {
        if (playerTurnsDeactivatedArray[i][1] !== playerTurnsDeactivatedArray[i][2]) {
            playerTurnsDeactivatedArray[i][2]++;
        } else {
            for (let j = 0; j < paths.length; j++) {
                if (paths[j].getAttribute("uniqueid") === playerTurnsDeactivatedArray[i][0]) {
                    if (mapMode === 1) {
                        paths[j].style.stroke = "black";
                    } else if (mapMode === 2) {
                        paths[j].style.stroke = "white";
                    }
                    paths[j].style.strokeDasharray = "none";
                    paths[j].setAttribute("stroke-width", "1");
                    setTerritoryDeactivated(paths[j].getAttribute("uniqueid"), false);
                    break;
                }
            }
            playerTurnsDeactivatedArray.splice(i, 1); //served its sentence, stop tracking it
        }
    }
}
export async function processRound(choices = {}) {
    //Battle overhaul B.4. One click is one ROUND of dice, and the whole of a round is
    //`resolveBattleRound()` in src/rules/military/battleModel.js. What used to be here -- five
    //rounds of up to two hundred thousand per-unit coin flips, a war-weariness pass and a second
    //set of five -- is gone. See docs/archived/battle_overhaul.md sections 4.5 to 4.7.
    //
    //Three things follow that are worth knowing before changing anything here.
    //
    //THE ARRAYS ARE THE STORE'S. `asModelState()` hands the model the live arrays from
    //`battleState.js`, and `commitRound()` writes the survivors back into those same arrays --
    //so `attackArmyRemaining` and `defendingArmyRemaining`, which the caller passed in and which
    //a standing siege may alias, are correct the moment this returns. Nothing is copied back by
    //hand any more.
    //
    //THE RNG IS `Math.random` ON PURPOSE. That is the game's seeded stream, so a battle is
    //reproducible under `?seed=`. The model takes it as a parameter precisely so the unit suite
    //and `tools/battle-lab.mjs` can pass their own.
    //
    //THERE IS NO ROUND LIMIT. Rounds run until one side breaks. `BATTLE_ROUNDS` no longer bounds
    //a battle and `firstSetOfRounds` is gone with it -- it was a one-way latch that was set false
    //at the first battle to go long and never set back, so every later battle in the session took
    //the wrong branch in ui.js.
    //No arguments. The four this used to take -- the round number, the attack array, and the two
    //armies -- were all already module state or derivable from it, and the attack array was
    //passed in only so that its first element could name the defending territory. The caller had
    //to rebuild a synthetic one from the siege record to do that, which is the `siegeAttackArray`
    //dance that used to sit in ui.js twice.
    const battleBefore = asModelState(defendingTerritory);
    if (!battleBefore) {
        console.warn("processRound: no battle is open");
        return;
    }
    const attackArmyRemaining = attackingArmyRemaining;

    //Battle overhaul B.7. Reserves join at the START of the round they are due, so they fight in
    //it. They were debited from their source when they were committed, a round ago.
    const arrived = takeArrivedReserves(battleBefore.round + 1);
    if (arrived) {
        reinforceAttackers(arrived);
    }

    const { battle: next, record } = resolveBattleRound(battleBefore, Math.random, choices);
    commitRound(next, record);
    setCurrentRound(next.round);

    //Battle overhaul B.10.2. Nine console lines per round stood here -- the two armies unit by
    //unit, the dice counts, the pairings lost and the state. Every one of them is now ON SCREEN:
    //the ledger says what was rolled and why, and the round log (B.6.4) keeps the history. A
    //battle narrated only to the console is a battle the player cannot read.
    setArmyTextValues([...attackArmyRemaining, ...defendingArmyRemaining], 1, defendingTerritoryId);

    drawLedger(record);
    //B.6.4. The round joins the log, newest first.
    roundLog.update(currentBattleRecords());

    //The dice the rules just rolled, thrown for real on top of the window. Deliberately NOT
    //awaited -- see the header of src/ui/battle/DiceStage.js.
    //The defender's own colour, so the two sets of dice read as the two countries. `countryColor`
    //and not the path's stroke: the stroke is selection chrome and is black most of the time.
    //`countryColor` and not the path's stroke: the stroke is selection chrome and is black most
    //of the time. When the defender has no colour, DiceStage resolves a theme token itself -- a
    //literal here would be a colour decision made outside the layer that draws.
    const rolled = diceStage.showRound(record, defendingTerritory.countryColor);

    //And then what the dice MEANT -- but only once they have landed on it.
    //
    //The panel goes up EMPTY straight away: both countries, their dice counts, one row per
    //pairing, every face blank. `reveal()` fills the faces in and plays the comparison out, and it
    //is chained to the dice coming to REST rather than to a timer. A fixed lead was tried and is
    //wrong in both directions -- too short and the account covers the roll, too long and the
    //player watches a settled pile do nothing -- and worse, either way it can print the result
    //while the dice are still in the air, which makes the roll look like an animation played over
    //an answer the game had already given.
    //
    //This is NOT the round waiting on a render loop. Nothing above this line is deferred; the
    //battle window's numbers, the ledger, the round log and the outcome are all already correct.
    //`showRound()` resolves immediately when the dice cannot be drawn at all -- no GPU, a lost
    //context -- so the reveal still happens, just at once.
    clashPanel.play(record, {
        attacker: playerCountryName(),
        defender: defendingTerritory.dataName
    });
    rolled?.finally?.(() => clashPanel.reveal());

    //The odds shown are now the honest question -- "will I take it" -- measured by playing the
    //rest of the battle out five hundred times on a stream of its own. The old number was the
    //attacker's share of the two strengths, which was simultaneously the per-skirmish coin-flip
    //odds and the figure on the bar, and was not an honest answer to either question.
    updatedProbability = battleForecast(asModelState(defendingTerritory)).takeProbability * 100;
    setAttackProbabilityOnUI(updatedProbability, 1);

    if (next.state !== BattleState.LAST_PUSH_AVAILABLE) {
        //The defender rallied above the band, or the battle is over. Either way the offer goes.
        withdrawLastPushOffer();
    }

    if (next.state === BattleState.LAST_PUSH_AVAILABLE) {
        //An OFFER, not an outcome. The legacy "massive assault" awarded the territory by itself
        //the moment the defender fell below the threshold; here the attacker chooses whether to
        //buy certainty with a fifth of what is left, or keep rolling.
        offerLastPush();
        return;
    }

    if (isTerminal(next.state)) {
        handleWarEndingsAndOptions(
            legacySituationFor(next.state), defendingTerritory,
            attackArmyRemaining, defendingArmyRemaining, false, false, null);
    }
}

/**
 * Draw the ledger from the battle as it stands, optionally showing a round's rolled faces.
 *
 * The dice counts are re-derived rather than taken from the record, so the ledger drawn BEFORE
 * the first round and the one drawn after a round come from the same two calls. `record` only
 * ever adds the faces.
 */
/**
 * The rounds fought in the battle currently open, oldest first.
 *
 * A local reader rather than an import of `currentBattle()` from every call site, so that the
 * round log is fed one thing and there is one place to change if a battle ever holds its records
 * somewhere else.
 */
function currentBattleRecords() {
    return currentBattle()?.records ?? [];
}

function drawLedger(record) {
    const state = asModelState(defendingTerritory);
    if (!state) {
        return;
    }
    const share = shareFor(state.attackers, state.defenders, state.territory, state.context);
    const modifiers = modifiersFor(state.attackers, state.defenders, state.territory, {
        attackerDugIn: state.attackerDugIn,
        defenderDugIn: state.defenderDugIn,
        siegeTurns: state.siegeTurns
    });
    forceLedger.update({
        attackerDice: Math.max(1, diceCountFor(share) + modifiers.attacker.diceChange),
        defenderDice: Math.max(1, defenderDiceCountFor(1 - share) + modifiers.defender.diceChange),
        attackerFaces: record?.attackerFaces,
        defenderFaces: record?.defenderFaces,
        modifiers
    });
}

/**
 * The `situation` number `handleWarEndingsAndOptions()` has always switched on.
 *
 * A translation table rather than a renumbering, because that function is also reached from
 * `resourceCalculations.js` when a siege starves out, and from the AI path -- so its vocabulary
 * is not this file's to change. It goes when `handleWarEndingsAndOptions()` itself is rewritten.
 *
 * STALEMATE has no legacy equivalent and should never occur: every round costs the loser of at
 * least one pairing a tenth of its force, so `MAX_BATTLE_ROUNDS` is a bug detector. It is
 * reported as a failed attack, and loudly, rather than silently resolving as something else.
 */
function legacySituationFor(state) {
    switch (state) {
        case BattleState.DEFENDER_WIPED:
            return 0;
        case BattleState.ATTACKER_WIPED:
            return 1;
        case BattleState.DEFENDER_ROUTED:
            return 2;
        case BattleState.ATTACKER_BROKEN:
            return 4;
        case BattleState.STALEMATE:
            console.error("processRound: a battle reached MAX_BATTLE_ROUNDS. "
                + "That means a round killed nobody -- see applyCasualties()'s floor.");
            return 1;
        default:
            return 1;
    }
}

/**
 * Offer the decisive final round, WITHOUT taking it.
 *
 * The offer goes on the assault button, so the bottom bar reads Retreat / Next Round / Last
 * Push! -- the three choices docs/archived/battle_overhaul.md section 4.8 describes. Putting it on the
 * ADVANCE button, which was the first attempt, made it compulsory: advance was the only way
 * forward, so "offering" a last push meant taking one. That matters more than it sounds, because
 * the last-push band sits ABOVE the break threshold and is therefore crossed on the way to
 * almost every rout -- so a mandatory push would delete the rout ending from the game.
 *
 * Declining is the interesting half of the decision. The push buys the territory now for a fifth
 * of the survivors; rolling on may rout them instead, which absorbs half the surviving garrison
 * rather than paying for it -- or may cost another round's casualties for nothing.
 */
function offerLastPush() {
    battleWindow.setBattleButtons({ advance: AdvanceMode.ROUND });
    battleWindow.setLastPushOffered(true);
}

/** Take the offer down again -- the defender rallied, or the battle ended. */
function withdrawLastPushOffer() {
    battleWindow.setLastPushOffered(false);
}

/**
 * Take the last push: buy the territory outright for a fifth of the surviving attackers.
 *
 * Called from the advance button when the offer above is showing. It is a transaction rather
 * than a round -- no dice -- which is the only reason to prefer it to rolling again.
 */
export function takeLastPush() {
    const state = asModelState(defendingTerritory);
    if (!state) {
        return;
    }
    withdrawLastPushOffer();
    const { battle: next, record } = resolveLastPush(state);
    commitRound(next, record);
    setCurrentRound(next.round);
    setArmyTextValues([...attackingArmyRemaining, ...defendingArmyRemaining], 1, defendingTerritoryId);
    handleWarEndingsAndOptions(3, defendingTerritory,
        attackingArmyRemaining, defendingArmyRemaining, false, false, null);
}


//Phase 5.3: combinedForce() is in src/rules/military/units.js. This wrapper stays because
//ui.js, transferAndAttack.js and aiCalculations.js all import it from here; the call sites
//move to the rules path as those files move into src/.
export function calculateCombinedForce(army) {
    return combinedForce(army);
}


export function getCurrentRound() {
    return currentRound;
}

export function setCurrentRound(value) {
    return currentRound = value;
}

export function getUpdatedProbability() {
    return updatedProbability;
}

export function getRoutStatus() {
    return rout;
}

export function setRoutStatus(value) {
    return rout = value;
}

export function getMassiveAssaultStatus() {
    return massiveAssault;
}

export function setMassiveAssaultStatus(value) {
    return massiveAssault = value;
}

//The four war-id counters. They were `export let`s here; the accessors already
//existed for most of them, so Phase 4.8 only had to move where the number is kept.
export function getCurrentWarId() {
    return warIds().currentWarId;
}

export function getCurrentAiWarId() {
    return warIds().currentAiWarId;
}

export function getNextAiWarId() {
    return warIds().nextAiWarId;
}

export function getNextWarId() {
    return warIds().nextWarId;
}

export function setNextAiWarId(value) {
    return storeNextAiWarId(value);
}

export function setCurrentAiWarId(value) {
    return storeCurrentAiWarId(value);
}

export function setCurrentWarId(value) {
    return storeCurrentWarId(value);
}

export function setNextWarId(value) {
    return storeNextWarId(value);
}

export function addRemoveWarSiegeObject(addOrRemove, warId, battleStart) {
    let defendingTerritoryCopy = getOriginalDefendingTerritory();
    if (!defendingTerritoryCopy) {
        console.warn("No player-initiated battle to turn into a siege object"); //audit 5.2 AH
        return;
    }
    let proportionsAttackers = proportionsOfAttackArray;
    const strokeColor = getStrokeColorOfDefendingTerritory(defendingTerritoryCopy);
    let startingDefenseBonus = defendingTerritoryCopy.defenseBonus;
    let startingFoodCapacity = defendingTerritoryCopy.foodCapacity;
    let startingProdPop = defendingTerritoryCopy.productiveTerritoryPop;
    let startingTerritoryPop = defendingTerritoryCopy.territoryPopulation;
    if (addOrRemove === 0) { // add war to siege object
        //Phase 4.7: the siege references the territory by id and resolves it live. It
        //used to hold `defendingTerritoryCopy` -- a shallow copy taken here -- which is
        //why the forts and food a siege destroyed had to be copied back into the model
        //when the siege ended, and why a siege could damage a territory the map never
        //heard about. The `startingX` fields below are still snapshots, deliberately:
        //they are what the siege panel compares the live values against.
        const siege = referenceDefendingTerritory({
            warId: warId,
            //BUG FIX. Who was DEFENDING, recorded now rather than derived later. The
            //Wars & Sieges tab used to read `defendingTerritory.dataName` for this
            //column, and `dataName` is the CURRENT owner: the moment the attacker won
            //and took the territory, the defending-country column started showing the
            //attacker's own flag. `defendingTerritoryCopy` is the snapshot taken when
            //the battle opened (see originalDefendingTerritory in ui.js), so this is
            //the defender as they were, and it cannot drift afterwards.
            defendingCountry: defendingTerritoryCopy.dataName,
            proportionsAttackers: proportionsAttackers,
            defendingArmyRemaining: defendingArmyRemaining,
            attackingArmyRemaining: attackingArmyRemaining,
            turnsInSiege: 0,
            strokeColor: strokeColor,
            startingAtt: totalAttackingArmy,
            startingDef: totalDefendingArmy,
            startingDefenseBonus: startingDefenseBonus,
            startingFoodCapacity: startingFoodCapacity,
            startingProdPop: startingProdPop,
            startingTerritoryPop: startingTerritoryPop,
        }, defendingTerritoryCopy.uniqueId);

        addSiege("player", defendingTerritoryCopy.territoryName, siege);

        //The source territories were debited when INVADE! was pressed (audit 5.1 AD),
        //so converting that battle into a siege must not debit them again.

        return siege.defendingTerritory;

    } else if (addOrRemove === 1) {
        //The buildings copy-back that used to sit here has gone with Phase 4.7: the siege
        //damaged a COPY of the territory, so its farms, forests, oil wells and forts had
        //to be written back into the model by hand when the siege ended. It references
        //the real territory now, so there is nothing to copy.
        for (const key of Object.keys(playerSiegeWarsList)) {
            if (playerSiegeWarsList[key].warId === warId) {
                recordHistoricWar(playerSiegeWarsList[key]);
                removeSiege("player", key);
                break;
            }
        }
    }
}

export function addRemoveWarSiegeObjectAi(addOrRemove, warId, defender, attacker) {
    let startingDefenseBonus = defender.defenseBonus;
    let startingFoodCapacity = defender.foodCapacity;
    let startingProdPop = defender.productiveTerritoryPop;
    let startingTerritoryPop = defender.territoryPopulation;
    let startingAtt = [attacker.infantryForCurrentTerritory, attacker.useableAssault, attacker.useableAir, attacker.useableNaval];
    let startingDef = [defender.infantryForCurrentTerritory, defender.useableAssault, defender.useableAir, defender.useableNaval];
    let attackingCountry = attacker.dataName;
    let attackingTerritory = attacker.territoryName;

    if (addOrRemove === 0) { // add war to siege object
        const siege = referenceDefendingTerritory({
            warId: warId,
            attackingCountry: attackingCountry,
            attackingTerritory: attackingTerritory,
            //As above: `defender` is the live territory and this siege is created
            //before any conquest, so its country is the defender's. Recorded rather
            //than read back later, when it may have changed hands.
            defendingCountry: defender.dataName,
            defendingArmyRemaining: startingDef,
            attackingArmyRemaining: startingAtt,
            turnsInSiege: 0,
            startingAtt: startingAtt,
            startingDef: startingDef,
            startingDefenseBonus: startingDefenseBonus,
            startingFoodCapacity: startingFoodCapacity,
            startingProdPop: startingProdPop,
            startingTerritoryPop: startingTerritoryPop
        }, defender.uniqueId);

        addSiege("ai", defender.territoryName, siege);
    } else if (addOrRemove === 1) {
        //As above: no copy, so no copy-back.
        for (const key of Object.keys(aiSiegeWarsList)) {
            if (aiSiegeWarsList[key].warId === warId) {
                recordHistoricAiWar(aiSiegeWarsList[key]);
                removeSiege("ai", key);
                break;
            }
        }
    }
}

export function addWarToHistoricWarArray(warResolution, warId, retreatBeforeStart) {
    let proportionsAttackers;
    let defendingTerritoryCopy = getOriginalDefendingTerritory();

    //audit 5.2 AH. `originalDefendingTerritory` is set only when the PLAYER opens a battle
    //against a territory. The battle-results screen is shared: a siege arrest and an AI
    //attack on the player both raise it, and its Accept button runs this same handler -- so
    //on the first such result of a session there is no open battle to describe and every
    //read below threw on undefined. The war those results describe has already been recorded
    //by whoever raised the screen, so there is nothing to add here.
    if (!defendingTerritoryCopy) {
        console.warn("No player-initiated battle to record -- the results screen is showing someone else\u2019s war");
        return;
    }

    let strokeColor = getStrokeColorOfDefendingTerritory(defendingTerritoryCopy);
    let startingDefenseBonus = defendingTerritoryCopy.defenseBonus;
    let startingFoodCapacity = defendingTerritoryCopy.foodCapacity;
    let startingProdPop = defendingTerritoryCopy.productiveTerritoryPop;
    let startingTerritoryPop = defendingTerritoryCopy.territoryPopulation;

    if (retreatBeforeStart) {
            warId = getCurrentWarId();
        proportionsAttackers = [0, 0, 0, 0];
        defendingArmyRemaining = [defendingTerritoryCopy.infantryForCurrentTerritory, defendingTerritoryCopy.assaultForCurrentTerritory, defendingTerritoryCopy.airForCurrentTerritory, defendingTerritoryCopy.navalForCurrentTerritory];
        attackingArmyRemaining = ["All", "All", "All", "All"];
        totalAttackingArmy = ["All", "All", "All", "All"];
        totalDefendingArmy = [defendingTerritoryCopy.infantryForCurrentTerritory, defendingTerritoryCopy.assaultForCurrentTerritory, defendingTerritoryCopy.airForCurrentTerritory, defendingTerritoryCopy.navalForCurrentTerritory];
        defenseBonus = defendingTerritoryCopy.defenseBonus;
    } else {
        proportionsAttackers = proportionsOfAttackArray;
        strokeColor = getStrokeColorOfDefendingTerritory(defendingTerritoryCopy);
    }
    //Phase 4.7: the last territory copy in the file. A historic war references the
    //territory like a siege does; the values it needs frozen are the `startingX` fields
    //and the two army arrays, which are already snapshots.
    recordHistoricWar(referenceDefendingTerritory({
        warId: warId,
        //The one-battle path, and the one the bug was most visible on: a war won
        //outright records straight into the historic list, by which time the store
        //already says the ATTACKER owns the territory.
        defendingCountry: defendingTerritoryCopy.dataName,
        proportionsAttackers: proportionsAttackers,
        defendingArmyRemaining: defendingArmyRemaining,
        attackingArmyRemaining: attackingArmyRemaining,
        turnsInSiege: null,
        strokeColor: strokeColor,
        resolution: warResolution,
        startingAtt: totalAttackingArmy,
        startingDef: totalDefendingArmy,
        startingDefenseBonus: startingDefenseBonus,
        startingFoodCapacity: startingFoodCapacity,
        startingProdPop: startingProdPop,
        startingTerritoryPop: startingTerritoryPop,
    }, defendingTerritoryCopy.uniqueId));

}

function getStrokeColorOfDefendingTerritory(defendingTerritory) {
    const path = getPathByUniqueId(defendingTerritory.uniqueId);
    return path ? path.style.stroke : ""; //no path for that territory: an absent stroke, not undefined
}

export function incrementSiegeTurns(ai) {
    if (ai) {
        for (const territory in aiSiegeWarsList) {
            if (aiSiegeWarsList.hasOwnProperty(territory)) {
                aiSiegeWarsList[territory].turnsInSiege += 1;
            }
        }
    } else {
        for (const territory in playerSiegeWarsList) {
            if (playerSiegeWarsList.hasOwnProperty(territory)) {
                playerSiegeWarsList[territory].turnsInSiege += 1;
            }
        }
    }
}

export function setBattleResolutionOnHistoricWarArrayAfterSiege(warResolution, id, ai) {
    if (ai) {
        for (const siege of historicWars) {
            const {
                warId
            } = siege;
            if (warId === id) {
                siege.resolution = warResolution;
            }
        }
    } else if (!ai) {
        for (const siege of historicAiWars) {
            const {
                warId
            } = siege;
            if (warId === id) {
                siege.resolution = warResolution;
            }
        }
    } else {
        return "Error - Siege not found in either array in setBattleResolutionOnHistoricWarArrayAfterSiege()";
    }
}

export function getResolution() {
    return resolution;
}

export function setResolution(value) {
    return resolution = value;
}

export function getFinalAttackArray() {
    return finalAttackArray;
}

export function setFinalAttackArray(array) {
    return finalAttackArray = array;
}

export function getAttackingArmyRemaining() {
    return attackingArmyRemaining;
}

/** The defending army of the battle currently on screen, for the ?e2e=1 harness. */
export function getDefendingArmyRemaining() {
    return defendingArmyRemaining;
}

/**
 * One turn of every siege on one side.
 *
 * Phase 5.4: the roll, the damage and the arrest decision are `rules/military/siege.js`,
 * which is pure; this is the part that knows about the store, the console and the two
 * parallel siege lists. The two copies of this function -- one for the player, one for the
 * AI, differing only in which list they walked and what they logged -- are one function
 * taking a side.
 *
 * Returns the array `gameTurnsLoop` expects: `true` for a siege that continues, and the
 * siege object itself for one that ended in an arrest.
 *
 * @param {"player"|"ai"} side
 */
function runSiegeTurnFor(side) {
    const sieges = side === "ai" ? aiSiegeWarsList : playerSiegeWarsList;
    const continueSiegeArray = [];

    if (!sieges || Object.keys(sieges).length === 0) {
        return continueSiegeArray;
    }

    for (const key in sieges) {
        const siege = sieges[key];
        const result = tickSiege(siege);

        if (!result.hit) {
            //audit 5.1 D: this used to `return`, which abandoned the whole loop and handed
            //gameTurnsLoop `undefined` -- so one siege missing its hit roll silently
            //cancelled every other siege's turn processing. A miss is just a quiet turn for
            //that one siege; it continues.
            continueSiegeArray.push(true);
            continue;
        }

        if (result.arrested) {
            //Battle overhaul B.4.5, second half. This used to be
            //`siege.defendingArmyRemaining.push(1)` -- the SECOND place a boolean was smuggled
            //into slot 4 of a four-slot army array, and a worse one than the battle's, because a
            //siege's `defendingArmyRemaining` is a live array that outlives the turn and is read
            //back by the siege panel. A flag on the siege says the same thing and cannot be
            //mistaken for a unit count by anything iterating the army.
            siege.arrested = true;
            continueSiegeArray.push(siege);
            continue;
        }

        const territory = siege.defendingTerritory;
        patchTerritory(territory.uniqueId, siegeDamageDeltas(territory, result.damage));
        continueSiegeArray.push(true);
    }

    return continueSiegeArray;
}

export function calculatePlayerInitiatedSiegePerTurn() {
    return runSiegeTurnFor("player");
}

export function calculateAiInitiatedSiegePerTurn() {
    return runSiegeTurnFor("ai");
}

export function handleEndSiegeDueArrest(ai, siege) {
    let defendingTerritory;
    let defendingPath;

    if (siege.arrested) { //B.4.5: a flag on the siege, not a fifth element of its army array
        //The siege already references the live territory (Phase 4.7), so the 359x359
        //scan that used to find it here -- and then find its path -- is two lookups.
        defendingTerritory = siege.defendingTerritory;
        defendingPath = defendingTerritory ? getPathByUniqueId(defendingTerritory.uniqueId) : null;
        if (!defendingTerritory || !defendingPath) {
            console.warn("Siege arrest for a territory that is no longer on the map; ignoring");
            return;
        }

        //Phase 5.4: the four lines that used to build this garrison by hand are
        //arrestGarrisonFor() in src/rules/military/siege.js, applied in one write. One of
        //them read `defendingArmyRemaining[1 + Math.floor(...)]` -- indexing a four-element
        //array by half the attacker's assault count instead of adding the two -- which set
        //the territory's army to NaN, permanently, on any arrest against an attacker with
        //two or more assault units (defect AL). The rule computes the total from its own
        //four counts, so the total can no longer disagree with its parts.
        patchTerritory(defendingTerritory.uniqueId,
            arrestGarrisonFor(siege.defendingArmyRemaining, siege.attackingArmyRemaining));
        bottomTable.update({ army: formatNumbersToKMB(defendingTerritory.armyForCurrentTerritory, 0) });

        siege.attackingArmyRemaining = [0, 0, 0, 0];
        siege.resolution = "Arrested";

        //Phase 7.4. The third way a siege can end, and the only one with no battle:
        //the besieging army starved or was taken. `SIEGE_CHANGED` fires for the
        //removal below, but a removal alone cannot say WHICH of the three endings
        //this was, which is why the feed is told here rather than deriving it.
        recordSiegeLifted({
            territory: defendingTerritory.territoryName,
            defender: defendingTerritory.dataName,
            attacker: ai ? siege.attackingCountry : playerCountryName(),
            playerAttacking: !ai,
            playerDefending: defendingTerritory.owner === "Player"
        });

        //Phase 5.8. `setUpResultsOfWarExternal(true)` used to run for EVERY arrest, and only
        //the `!ai` branch below ever filled the screen in. The AI runs dozens of concurrent
        //sieges against each OTHER (see docs/04-known-issues.md section 6), so at least one
        //was arrested on nearly every turn -- and the player was shown an EMPTY battle
        //results screen, on top of the phase button, at the start of almost every turn. An
        //arrest is only the player's business if they were besieging, or being besieged.
        const playerWasBesieging = !ai;
        const playerWasBesieged = ai && defendingTerritory.owner === "Player";

        if (playerWasBesieging || playerWasBesieged) {
            setUpResultsOfWarExternal(true);
            setCurrentWarFlagString(defendingTerritory.dataName);
        }

        if (!ai) {
            populateWarResultPopup(1, playerCountryName(), defendingTerritory, "arrest", siege);
            addUpAllTerritoryResourcesForCountryAndWriteToTopTable(false);
            recordHistoricWar(siege);
            removeSiege("player", defendingTerritory.territoryName);
        } else {
            if (playerWasBesieged) {
                //The player's garrison broke a siege AGAINST them, which is worth being told.
                //The attacker on this screen is the besieging country, not the player.
                populateWarResultPopup(1, siege.attackingCountry, defendingTerritory, "arrest", siege);
                addUpAllTerritoryResourcesForCountryAndWriteToTopTable(false);
            }
            recordHistoricAiWar(siege);
            removeSiege("ai", defendingTerritory.territoryName);
        }

        //`underSiege` is no longer written here. Phase 4.4/4.5: it is derived from the
        //siege lists and rendered by src/ui/mapAttributeSync.js, so removing the siege
        //above is what clears it -- there is no second fact to keep in step.
        removeSiegeImageFromPath(ai, defendingPath);
    }
}

//changeDefendingTerritoryStatsBasedOnSiege() is siegeDamageDeltas() in
//src/rules/military/siege.js (Phase 5.4), applied through mutations.js by runSiegeTurnFor().

export function setValuesForBattleFromSiegeObject(path, routCheck) { //when clicking view siege
            let siegeObject;
            if (!routCheck) {
                siegeObject = getSiegeObjectFromPath(path);
    } else {
        siegeObject = path; //confusing but if checking for rout from siege, we pass the object directly
    }

    for (let i = 0; i < allTerritories().length; i++) {
        const mainElement = allTerritories()[i];
        if (mainElement.uniqueId === siegeObject.defendingTerritory.uniqueId) {
            siegeObject.defendingArmyRemaining = [mainElement.infantryForCurrentTerritory, mainElement.useableAssault, mainElement.useableAir, mainElement.useableNaval];
            break;
        }
    }
}

//Phase 4.7: this was `setMainArrayToArmyRemaining()`, one of the manual sync-backs the
//copy-holding siege objects needed. It scanned all 359 territories to write the siege
//survivors into the model, and then wrote the very same numbers a second time into the
//siege object's own copy of that territory -- and it read that copy from
//`getSiegeObjectFromPath(lastClickedPath)`, a DIFFERENT siege from the one passed in, so
//a click on the wrong path wrote one siege's survivors onto another.
//
//The siege references the live territory now, so this is one write and no copy.
export function applySiegeSurvivorsToTerritory(siege) { //when clicking siege button
    const territory = siege?.defendingTerritory;
    if (!territory) {
        return null;
    }
    territory.infantryForCurrentTerritory = siege.defendingArmyRemaining[0];
    territory.assaultForCurrentTerritory = siege.defendingArmyRemaining[1];
    territory.airForCurrentTerritory = siege.defendingArmyRemaining[2];
    territory.navalForCurrentTerritory = siege.defendingArmyRemaining[3];
    territory.armyForCurrentTerritory = territory.infantryForCurrentTerritory + (territory.assaultForCurrentTerritory * vehicleArmyPersonnelWorth.assault) + (territory.airForCurrentTerritory * vehicleArmyPersonnelWorth.air) + (territory.navalForCurrentTerritory * vehicleArmyPersonnelWorth.naval);
    return territory;
}

export function calculateSiegeScore(siegeObjectElement) {
    return siegeScore(siegeObjectElement.attackingArmyRemaining);
}
export function addAttackingArmyToRetrievalArray(attackingArmyRemaining, proportionsArray) {
    let returnArray = [];

    for (let i = 0; i < proportionsArray.length; i += 5) {
        const uniqueId = proportionsArray[i];
        const values = proportionsArray.slice(i + 1, i + 5);
        const newArray = [uniqueId, ...values];
        returnArray.push(newArray);
    }

    for (let i = 0; i < returnArray.length; i++) {
        for (let j = 0; j < returnArray[i].length; j++) {
            returnArray[i][j].push(...attackingArmyRemaining);
        }
    }


    return returnArray;
}

export function getRetrievalArray() {
    return retrievalArray;
}

export function setNewWarOnRetrievalArray(warId, array, turn, type) {
    //The empty case used to REPLACE the array rather than push into it, which meant the
    //binding had to stay a `let` and any module holding the old array kept the old one.
    //A push does the same thing to an empty array.
    retrievalArray.push([warId, array, turn, type]);
    return retrievalArray;
}

//BUG FIX, found while doing Phase 4.4. Two callers, two different argument types:
//aiCalculations.updateTerritory() passes a TERRITORY, and handleWarEndingsAndOptions()
//passes an SVG PATH. A path has no `uniqueId` property (its id is the `uniqueid`
//attribute), so for every AI conquest of a player territory this pushed
//[undefined, n, 0] onto the deactivation list and matched no territory at all -- the
//territory was never deactivated, and the entry sat in the list forever. Accepting
//either and resolving one id is what makes the two call sites agree.
export function deactivateTerritoryAi(territoryOrPath) {
    const uniqueId = territoryOrPath?.uniqueId ?? territoryOrPath?.getAttribute?.("uniqueid") ?? null;
    if (uniqueId === null) {
        console.warn("deactivateTerritoryAi: no territory to deactivate");
        return;
    }
    const turnsToDeactivate = Math.floor(Math.random() * (conquestLockout.maxTurns - conquestLockout.minTurns + 1)) + conquestLockout.minTurns;
    aiTurnsDeactivatedArray.push([String(uniqueId), turnsToDeactivate, 0]);
    setTerritoryDeactivated(uniqueId, true);
}

export function getSiegeObjectFromPlayerSiegeList(territory) {
    if (territory.territoryName in playerSiegeWarsList) {
        return playerSiegeWarsList[territory.territoryName];
    } else {
        return false;
    }
}

export function getSiegeObjectFromAiSiegeList(territory) {
    if (territory.territoryName in aiSiegeWarsList) {
        return aiSiegeWarsList[territory.territoryName];
    } else {
        return false;
    }
}

//--- save/load ------------------------------------------------------------
//
//Phase 7.3. Three of the arrays above outlive the turn that created them and are
//not in the store, so a save that omitted them would load a world that is subtly
//wrong rather than obviously broken:
//
//  * `retrievalArray` is the credit half of audit 5.1 AD -- army debited from a
//    source territory on INVADE! and due back a turn later. Drop it and the army
//    is simply destroyed by loading.
//  * the two deactivated arrays are the conquest lockout mid-sentence. Drop them
//    and the territory stays deactivated for the rest of the game, because the
//    only thing that reactivates it is its own entry counting up.
//
//All three are `export const` and are imported by reference elsewhere, so restore
//refills them IN PLACE. Reassigning would leave every importer on the old array.
registerSaveSlice("battle", {
    capture: () => ({
        retrievals: retrievalArray.map(entry => [entry[0], entry[1], entry[2], entry[3]]),
        playerDeactivated: playerTurnsDeactivatedArray.map(entry => [...entry]),
        aiDeactivated: aiTurnsDeactivatedArray.map(entry => [...entry])
    }),
    restore: (data) => {
        refillInPlace(retrievalArray, data?.retrievals);
        refillInPlace(playerTurnsDeactivatedArray, data?.playerDeactivated);
        refillInPlace(aiTurnsDeactivatedArray, data?.aiDeactivated);
    }
});

function refillInPlace(target, source) {
    target.length = 0;
    for (const entry of source ?? []) {
        target.push(entry);
    }
}
