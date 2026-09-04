// Battles the player DEFENDED, waiting to be shown to them.
//
// Battle overhaul B.8. Until now an AI attack on a player territory resolved entirely inside
// `doAttack()` and the player was handed a results screen with no account of how it went. That is
// complaint five in docs/archived/battle_overhaul.md section 2 -- "the player never sees the world change"
// -- in its sharpest form: the one battle whose outcome the player cares most about is the one
// they are shown least about.
//
// WHY A QUEUE RATHER THAN PLAYING IT THERE AND THEN. The AI moves inside its own turn step, and
// a step that waited for an animation would stall the turn loop -- `TurnEngine` advances when a
// step RETURNS, and `waitsForPlayer` is the only sanctioned way to pause. So the battle is fought
// to its conclusion immediately, exactly as before, and the RECORD of it is queued. Playback is
// a rendering of something that has already happened, which is also why it is safe to skip.
//
// A turn can produce several of these -- an AI country may attack more than one player territory
// -- so it is a queue and not a slot. It is bounded by how many territories the player holds and
// is drained every turn, so it cannot grow without limit.
//
// This is deliberately NOT a save slice. A queued playback is a thing to show once; a save taken
// mid-turn that restored a pending animation would replay a battle the player had already seen,
// and one that did not would lose nothing that matters.

/** @type {object[]} */
let pending = [];

/**
 * Remember a battle the player defended, for showing afterwards.
 *
 * Everything needed to redraw it is copied in: the two countries, the territory, the armies as
 * they stood at the start, and every round. Nothing is read back off the world at playback time,
 * because by then the territory may have changed hands -- the same trap that made the Wars &
 * Sieges tab draw the winner's flag on both sides of a war (known-issues AS).
 *
 * @param {{attackerCountry: string, defenderCountry: string, territoryId: string,
 *          territoryName: string, startingAttackers: number[], startingDefenders: number[],
 *          records: object[], state: string, tookTerritory: boolean}} battle
 */
export function recordDefence(battle) {
    pending.push({
        attackerCountry: battle.attackerCountry,
        defenderCountry: battle.defenderCountry,
        territoryId: String(battle.territoryId),
        territoryName: battle.territoryName,
        startingAttackers: [...battle.startingAttackers],
        startingDefenders: [...battle.startingDefenders],
        records: battle.records,
        state: battle.state,
        tookTerritory: Boolean(battle.tookTerritory)
    });
}

/** How many are waiting. */
export function pendingDefences() {
    return pending.length;
}

/** Take the oldest, or null. */
export function takeNextDefence() {
    return pending.shift() ?? null;
}

/** Drop everything -- a new game, or a load. */
export function clearDefences() {
    pending = [];
}
