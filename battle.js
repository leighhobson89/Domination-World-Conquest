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
import {
    AdvanceMode,
    RetreatMode,
    VictoryKind,
    battleWindow
} from './src/ui/battle/BattleWindow.js';
import { roundLog } from './src/ui/battle/RoundLog.js';

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
    takeProbability
} from './src/rules/military/takeProbability.js';
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

export const playerSiegeWarsList = playerSieges();
export const aiSiegeWarsList = aiSieges();
export const historicWars = historicWarsList();
export const historicAiWars = historicAiWarsList();
let resolution;

let rout = false;
let massiveAssault = false;

export function calculateProbabilityPreBattle(attackArray, mainArrayOfTerritoriesAndResources, reCalculationWithinBattle, remainingDefendingArmy, defendingTerritoryId) {
    if (reCalculationWithinBattle) {
        const attackedTerritoryId = defendingTerritoryId;
        const defendingTerritory = mainArrayOfTerritoriesAndResources.find(
            ({ uniqueId }) => uniqueId === attackedTerritoryId);

        return winProbability(attackArray, remainingDefendingArmy, defendingTerritory, {
            attackingDevelopmentIndex: reusableAttackingAverageDevelopmentIndex,
            combatContinentModifier: reusableCombatContinentModifier
        });
    } else {
        finalAttackArray = [attackArray[0]];

        let nonZeroCount = 0;
        for (let i = 1; i < attackArray.length; i += 5) {
            const hasNonZeroUnits = attackArray.slice(i + 1, i + 5).some(unitCount => unitCount > 0);
            if (!hasNonZeroUnits) {
                nonZeroCount++;
            }
            if (hasNonZeroUnits) {
                finalAttackArray.push(...attackArray.slice(i, i + 5));
            }
        }

        if (nonZeroCount === (attackArray.length - 1) / 5) {
            lastPreBattleSetup = null;
            return 0;
        }

        const [
            attackedTerritoryId,
            ...attacks
        ] = finalAttackArray;

        const attackingTerritories = [];
        const infantryCounts = [];
        const assaultCounts = [];
        const airCounts = [];
        const navalCounts = [];

        const combatContinentModifier = calculateContinentModifier(attackedTerritoryId, mainArrayOfTerritoriesAndResources);
        reusableCombatContinentModifier = combatContinentModifier;

        for (let i = 0; i < attacks.length; i += 5) {
            const [
                attackingTerritory,
                infantry,
                assault,
                air,
                naval
            ] = attacks.slice(i, i + 5);

            attackingTerritories.push(attackingTerritory);
            infantryCounts.push(infantry);
            assaultCounts.push(assault);
            airCounts.push(air);
            navalCounts.push(naval);
        }

        const defendingTerritory = mainArrayOfTerritoriesAndResources.find(
            ({ uniqueId }) => uniqueId === attackedTerritoryId);

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

        reusableAttackingAverageDevelopmentIndex = attackingDevelopmentIndex(
            attackingTerritories.map(territoryUniqueId =>
                mainArrayOfTerritoriesAndResources.find(
                    ({ uniqueId }) => uniqueId === territoryUniqueId.toString())));

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

/**
 * The same battle, scored by the model that will actually fight it.
 *
 * Combat phase stage 1, closing known-issue C1. `calculateProbabilityPreBattle()` above
 * answers "what is the attacker's share of the two strengths" -- a ratio built over
 * `defenseMultiplierFor()`, which the dice model does not use, and blind to dice, bands, ties
 * and unmatched hits. Measured over the real map its error against the real outcome ran +95 to
 * -77 percentage points and CHANGED SIGN on fortification, so it over-rated an attack on
 * unfortified mountain and under-rated one on a fortress. Every AI odds floor, the commitment
 * sizing and the siege gate read it as though it were a probability. They read this instead.
 *
 * It deliberately BUILDS THE SETUP by calling the function above rather than repeating that
 * work. The setup construction is the bulk of it -- unpacking the attack array, summing four
 * unit types across several attacking territories, averaging their development indexes -- and
 * two copies of it would be two answers to "which battle are we talking about". One call, one
 * setup, and the only difference between the two functions is how the setup is SCORED. The
 * strength ratio it returns on the way past is discarded.
 *
 * @returns {number} 0..100, the attacker's chance of taking the territory
 */
export function calculateTakeProbabilityPreBattle(attackArray, mainArrayOfTerritoriesAndResources, reCalculationWithinBattle, remainingDefendingArmy, attackedTerritoryId) {
    if (reCalculationWithinBattle) {
        //Named apart from the module-level `defendingTerritory` / `defendingTerritoryId`
        //deliberately: the sibling function above shadows both and ESLint has flagged it for as
        //long as the baseline has existed. A new function should not add to that count.
        const territoryUnderAttack = mainArrayOfTerritoriesAndResources.find(
            ({ uniqueId }) => uniqueId === attackedTerritoryId);
        return takeProbability(attackArray, remainingDefendingArmy, territoryUnderAttack, {
            attackingDevelopmentIndex: reusableAttackingAverageDevelopmentIndex,
            combatContinentModifier: reusableCombatContinentModifier
        });
    }

    calculateProbabilityPreBattle(attackArray, mainArrayOfTerritoriesAndResources, false);
    const setup = preBattleSetup();
    //Null means every attacking territory allocated nothing, which the function above reports
    //as a probability of zero. There is no battle to forecast.
    if (!setup) {
        return 0;
    }
    return takeProbability(setup.attackers, setup.defenders, setup.territory, setup.context,
        { siegeTurns: setup.siegeTurns });
}

export function setupBattle(probability, arrayOfUniqueIdsAndAttackingUnits, mainArrayOfTerritoriesAndResources) {

    defendingTerritoryId = arrayOfUniqueIdsAndAttackingUnits[0];
    defendingTerritory = mainArrayOfTerritoriesAndResources.find(({
                                                                      uniqueId
                                                                  }) => uniqueId === defendingTerritoryId);

    defenseBonus = defendingTerritory.defenseBonus;
    proportionsOfAttackArray.length = 0;

    totalAttackingArmy = [0, 0, 0, 0];
    tempTotalAttackingArmy = [0, 0, 0, 0];
    totalDefendingArmy = [defendingTerritory.infantryForCurrentTerritory, defendingTerritory.useableAssault, defendingTerritory.useableAir, defendingTerritory.useableNaval];
    tempTotalDefendingArmy = [defendingTerritory.infantryForCurrentTerritory, defendingTerritory.useableAssault, defendingTerritory.useableAir, defendingTerritory.useableNaval];

    let totalInfantryCount = 0;
    let totalAssaultCount = 0;
    let totalAirCount = 0;
    let totalNavalCount = 0;

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

    for (let i = 0; i < proportionsOfAttackArray.length; i++) {
        const territoryData = proportionsOfAttackArray[i];
        const infantryPercentage = totalInfantryCount !== 0 ? (territoryData[1] / totalInfantryCount) * 100 : 0;
        const assaultPercentage = totalAssaultCount !== 0 ? (territoryData[2] / totalAssaultCount) * 100 : 0;
        const airPercentage = totalAirCount !== 0 ? (territoryData[3] / totalAirCount) * 100 : 0;
        const navalPercentage = totalNavalCount !== 0 ? (territoryData[4] / totalNavalCount) * 100 : 0;

        proportionsOfAttackArray[i] = [territoryData[0], infantryPercentage, assaultPercentage, airPercentage, navalPercentage];
    }


    unchangeableWarStartCombinedForceAttack = calculateCombinedForce(totalAttackingArmy);
    unchangeableWarStartCombinedForceDefend = calculateCombinedForce(totalDefendingArmy);

    initialCombinedForceAttack = calculateCombinedForce(totalAttackingArmy);
    initialCombinedForceDefend = calculateCombinedForce(totalDefendingArmy);
    let hasSiegedBefore = historicWars.some((siege) => siege.warId === getCurrentWarId());
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
        siegeTurns: hasSiegedBeforeWar?.turnsInSiege ?? 0
    });
    attackingArmyRemaining = battleAttackingArmy();
    defendingArmyRemaining = battleDefendingArmy();
    drawLedger();
    updatedProbability = calculateProbabilityPreBattle(totalAttackingArmy, mainArrayOfTerritoriesAndResources, true, totalDefendingArmy, arrayOfUniqueIdsAndAttackingUnits[0]);
}

function calculateContinentModifier(attackedTerritoryId, mainArrayOfTerritoriesAndResources) {
    return combatContinentModifierFor(
        mainArrayOfTerritoriesAndResources.find(({ uniqueId }) => uniqueId === attackedTerritoryId));
}

export function handleWarEndingsAndOptions(situation, contestedTerritory, attackingArmyRemaining, defendingArmyRemaining, routFromSiege, ai, siegeObject) {
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
    if (routFromSiege) {
        contestedTerritory = getTerritory(contestedTerritory.uniqueId) ?? contestedTerritory;
    }

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
            playerOwnedTerritories.push(contestedPath);
            setTerritoryOwner(contestedTerritory.uniqueId, "Player", playerCountryName());
            contestedTerritory.infantryForCurrentTerritory = attackingArmyRemaining[0];
            contestedTerritory.assaultForCurrentTerritory = attackingArmyRemaining[1];
            contestedTerritory.airForCurrentTerritory = attackingArmyRemaining[2];
            contestedTerritory.navalForCurrentTerritory = attackingArmyRemaining[3];
            contestedTerritory.armyForCurrentTerritory = contestedTerritory.infantryForCurrentTerritory + (contestedTerritory.assaultForCurrentTerritory * vehicleArmyPersonnelWorth.assault) + (contestedTerritory.airForCurrentTerritory * vehicleArmyPersonnelWorth.air) + (contestedTerritory.navalForCurrentTerritory * vehicleArmyPersonnelWorth.naval);
            battleWindow.setBattleButtons({
                advance: AdvanceMode.ACCEPT,
                victory: VictoryKind.CLEAN,
                siegeEnabled: false
            });
            break;
        case 1:
            setDefendingTerritoryCopyStart(contestedTerritory);
            setDefeatType("wiped");
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
                battleWindow.setBattleButtons({
                    advance: AdvanceMode.ACCEPT,
                    victory: VictoryKind.ROUT,
                    siegeEnabled: false
                });
            } else if (ai) {
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
                setTerritoryOwner(contestedTerritory.uniqueId, siegeObject.attackingCountry);
            }
            break;
        case 3:
            won = true;
            massiveAssault = true;
            setDefendingTerritoryCopyStart(contestedTerritory);
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
            setDefendingTerritoryCopyStart(contestedTerritory);
            setDefeatType("routed");
            battleWindow.setBattleButtons({
                retreat: RetreatMode.DEFEAT,
                siegeEnabled: false
            });
            break;
    }
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
        setTerritoryOwner(contestedTerritory.uniqueId, siegeObject.attackingCountry);
        deactivateTerritoryAi(contestedPath);
    } else {
    }
}

function deactivateTerritory(contestedPath) {
    const turnsToDeactivate = Math.floor(Math.random() * (conquestLockout.maxTurns - conquestLockout.minTurns + 1)) + conquestLockout.minTurns;
    playerTurnsDeactivatedArray.push([contestedPath.getAttribute("uniqueid"), turnsToDeactivate, 0]);

    moveButton.hideDestination();
    moveButton.setLabel("DEACTIVATED");
    moveButton.setEnabled(false);
    moveButton.setVariant("disabled");

    contestedPath.style.stroke = "red";
    contestedPath.style.strokeDasharray = "10, 5";
    contestedPath.setAttribute("stroke-width", "3");

    setTerritoryAboutToBeAttackedFromExternal(null);
    setTerritoryDeactivated(contestedPath.getAttribute("uniqueid"), true);
}

export function activateAiTerritoriesForNewTurn() {
    for (let i = aiTurnsDeactivatedArray.length - 1; i >= 0; i--) {
        if (aiTurnsDeactivatedArray[i][1] !== aiTurnsDeactivatedArray[i][2]) {
            aiTurnsDeactivatedArray[i][2]++;
        } else {
            setTerritoryDeactivated(aiTurnsDeactivatedArray[i][0], false);
            aiTurnsDeactivatedArray.splice(i, 1); //served its sentence, stop tracking it
        }
    }
}
export function activateAllPlayerTerritoriesForNewTurn() {
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
            playerTurnsDeactivatedArray.splice(i, 1);
        }
    }
}
export async function processRound(choices = {}) {
    const battleBefore = asModelState(defendingTerritory);
    if (!battleBefore) {
        console.warn("processRound: no battle is open");
        return;
    }
    const attackArmyRemaining = attackingArmyRemaining;
    const arrived = takeArrivedReserves(battleBefore.round + 1);
    if (arrived) {
        reinforceAttackers(arrived);
    }

    const { battle: next, record } = resolveBattleRound(battleBefore, Math.random, choices);
    commitRound(next, record);
    setCurrentRound(next.round);
    setArmyTextValues([...attackArmyRemaining, ...defendingArmyRemaining], 1, defendingTerritoryId);

    drawLedger(record);
    roundLog.update(currentBattleRecords());
    const rolled = diceStage.showRound(record, defendingTerritory.countryColor);
    clashPanel.play(record, {
        attacker: playerCountryName(),
        defender: defendingTerritory.dataName
    });
    rolled?.finally?.(() => clashPanel.reveal());
    updatedProbability = battleForecast(asModelState(defendingTerritory)).takeProbability * 100;
    setAttackProbabilityOnUI(updatedProbability, 1);

    if (next.state !== BattleState.LAST_PUSH_AVAILABLE) {
        withdrawLastPushOffer();
    }

    if (next.state === BattleState.LAST_PUSH_AVAILABLE) {
        offerLastPush();
        return;
    }

    if (isTerminal(next.state)) {
        handleWarEndingsAndOptions(
            legacySituationFor(next.state), defendingTerritory,
            attackArmyRemaining, defendingArmyRemaining, false, false, null);
    }
}

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

function offerLastPush() {
    battleWindow.setBattleButtons({ advance: AdvanceMode.ROUND });
    battleWindow.setLastPushOffered(true);
}

function withdrawLastPushOffer() {
    battleWindow.setLastPushOffered(false);
}

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
    if (addOrRemove === 0) {
        const siege = referenceDefendingTerritory({
            warId: warId,
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

        return siege.defendingTerritory;

    } else if (addOrRemove === 1) {
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

    if (addOrRemove === 0) {
        const siege = referenceDefendingTerritory({
            warId: warId,
            attackingCountry: attackingCountry,
            attackingTerritory: attackingTerritory,
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
    recordHistoricWar(referenceDefendingTerritory({
        warId: warId,
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
    return path ? path.style.stroke : "";
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

export function getDefendingArmyRemaining() {
    return defendingArmyRemaining;
}

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
            continueSiegeArray.push(true);
            continue;
        }

        if (result.arrested) {
            siege.arrested = true;
            continueSiegeArray.push(siege);
            continue;
        }

        const territory = siege.defendingTerritory;
        const patch = siegeDamageDeltas(territory, result.damage);
        if (typeof patch.foodCapacity === "number") {
            siege.foodCapacityDestroyed =
                (siege.foodCapacityDestroyed ?? 0) + (territory.foodCapacity - patch.foodCapacity);
        }
        patchTerritory(territory.uniqueId, patch);
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

    if (siege.arrested) {
        defendingTerritory = siege.defendingTerritory;
        defendingPath = defendingTerritory ? getPathByUniqueId(defendingTerritory.uniqueId) : null;
        if (!defendingTerritory || !defendingPath) {
            console.warn("Siege arrest for a territory that is no longer on the map; ignoring");
            return;
        }
        patchTerritory(defendingTerritory.uniqueId,
            arrestGarrisonFor(siege.defendingArmyRemaining, siege.attackingArmyRemaining));
        bottomTable.update({ army: formatNumbersToKMB(defendingTerritory.armyForCurrentTerritory, 0) });

        siege.attackingArmyRemaining = [0, 0, 0, 0];
        siege.resolution = "Arrested";
        recordSiegeLifted({
            territory: defendingTerritory.territoryName,
            defender: defendingTerritory.dataName,
            attacker: ai ? siege.attackingCountry : playerCountryName(),
            playerAttacking: !ai,
            playerDefending: defendingTerritory.owner === "Player"
        });
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
                populateWarResultPopup(1, siege.attackingCountry, defendingTerritory, "arrest", siege);
                addUpAllTerritoryResourcesForCountryAndWriteToTopTable(false);
            }
            recordHistoricAiWar(siege);
            removeSiege("ai", defendingTerritory.territoryName);
        }
        removeSiegeImageFromPath(ai, defendingPath);
    }
}

export function setValuesForBattleFromSiegeObject(path, routCheck) {
            let siegeObject;
            if (!routCheck) {
                siegeObject = getSiegeObjectFromPath(path);
    } else {
        siegeObject = path;
    }

    for (let i = 0; i < allTerritories().length; i++) {
        const mainElement = allTerritories()[i];
        if (mainElement.uniqueId === siegeObject.defendingTerritory.uniqueId) {
            siegeObject.defendingArmyRemaining = [mainElement.infantryForCurrentTerritory, mainElement.useableAssault, mainElement.useableAir, mainElement.useableNaval];
            break;
        }
    }
}

export function applySiegeSurvivorsToTerritory(siege) {
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
    retrievalArray.push([warId, array, turn, type]);
    return retrievalArray;
}

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
