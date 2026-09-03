// The last few AI countries' reasoning, kept so something can show it.
//
// `planLog.js` prints a country's plan to the console, which is fine when you already know
// which country you are asking about and are willing to scroll two hundred collapsed
// groups to find it. It is not fine for the question actually being asked of a strategic
// AI, which is "what is it THINKING?" -- and that question wants EVERY country side by
// side, with the reason each target was taken or left alone.
//
// So the same view `planLog.js` prints is also recorded here, in a bounded ring, and
// `src/ui/components/AiDebugPanel.js` renders it on demand.
//
// Three things keep this cheap enough to leave on permanently. The ring is bounded at a
// little over two full turns; each entry keeps only the fields the panel draws, so it does
// not pin whole territory objects or a live campaign; and the decisions are already computed
// -- `goals.js` produced them while planning, and this stores the trimmed result rather
// than deriving anything of its own.
//
// Pure and DOM-free, like the rest of `src/ai/`. The listener list is how the panel finds
// out something new has arrived without polling.

/**
 * How many country plans to keep.
 *
 * A turn is up to 206 countries and the panel shows every one of them, so this holds a
 * little over two full turns. It is still a bound rather than an unbounded list, because a
 * forty-turn session would otherwise keep eight thousand plans alive for no reason.
 */
const RING_SIZE = 512;

/** How many per-target decisions to keep per country. Enough to see the shape of a border. */
const DECISIONS_PER_COUNTRY = 24;

/** @type {Array<object>} newest last */
const ring = [];

/** @type {Set<() => void>} */
const listeners = new Set();

/**
 * Record one country's reasoning.
 *
 * @param {{country: string, turn: number, leader?: object, campaign?: object,
 *          shortTerm?: string[], mediumTerm?: object, longTerm?: object}} view
 */
export function recordPlan(view) {
    const campaign = view.campaign ?? null;

    ring.push({
        turn: view.turn ?? 0,
        country: view.country ?? "unknown",
        leaderName: view.leader?.name ?? "unknown",
        leaderType: view.leader?.leaderType ?? "unknown",
        traits: view.leader?.traits ? { ...view.leader.traits } : null,
        posture: campaign?.posture ?? view.mediumTerm?.posture ?? null,
        objective: campaign?.objective
            ? {
                kind: campaign.objective.kind,
                continents: [...campaign.objective.continents],
                banked: [...campaign.objective.banked]
            }
            : null,
        focusContinent: campaign?.focusContinent ?? null,
        //The mid-term goal, and the two things that judge it: what this country is trying to
        //absorb, who it has given up on, and where it is marching to make the next attempt
        //possible. Trimmed to the fields the panel draws, like everything else here.
        theatre: campaign?.theatre
            ? {
                rival: campaign.theatre.rival,
                continent: campaign.theatre.continent,
                reason: campaign.theatre.reason,
                takenFromRival: campaign.theatre.takenFromRival,
                failures: campaign.theatre.failures,
                committedOnTurn: campaign.theatre.committedOnTurn,
                changed: campaign.theatre.changed
            }
            : null,
        walls: [...(campaign?.walls ?? [])],
        development: campaign?.development ? { ...campaign.development } : null,
        //Written by the executor after the campaign is built, so it is absent on a plan
        //recorded before the country moved anything.
        musters: (campaign?.musters ?? []).map(move => ({ ...move })),
        progress: campaign?.progress
            ? { label: campaign.progress.label, fraction: campaign.progress.fraction }
            : null,
        budgets: campaign
            ? {
                attack: campaign.attackBudget,
                siege: campaign.siegeBudget,
                activeSieges: campaign.activeSieges,
                concurrentSiegeCap: campaign.concurrentSiegeCap,
                attackOddsFloor: Math.round(campaign.attackOddsFloor ?? 0),
                siegeOddsFloor: Math.round(campaign.siegeOddsFloor ?? 0)
            }
            : null,
        health: campaign?.health
            ? {
                territories: campaign.health.territories,
                besieged: campaign.health.besieged,
                development: campaign.health.development
            }
            : null,
        standings: (campaign?.standings ?? [])
            .filter(row => row.held > 0 || (campaign?.objective?.continents ?? []).includes(row.continent))
            .map(row => ({ continent: row.continent, held: row.held, total: row.total })),
        goals: [...(view.shortTerm ?? [])],
        //What this country decided about the sieges it was ALREADY running. Kept as its
        //own list rather than folded into `decisions`, because a decision is about a
        //target the country might act on and a review is about an army it has already
        //committed -- they answer different questions and the panel shows them apart.
        siegeReviews: (campaign?.siegeReviews ?? []).map(review => ({ ...review })),
        //The decisions are the interesting half: every pairing the country weighed, and
        //why it did or did not act on it. A skipped target with its reason is usually a
        //better answer to "why did nothing happen?" than the goal list is.
        decisions: (campaign?.decisions ?? []).slice(0, DECISIONS_PER_COUNTRY).map(decision => ({ ...decision }))
    });

    while (ring.length > RING_SIZE) {
        ring.shift();
    }
    notify();
}

/** The recorded plans, newest first. */
export function recentPlans(limit = RING_SIZE) {
    return ring.slice(-limit).reverse();
}

/** Drop everything. New Game calls this so a fresh world does not open on the old one's reasoning. */
export function clearPlans() {
    ring.length = 0;
    notify();
}

/** Subscribe to new plans. Returns the unsubscribe, as everything else in this codebase does. */
export function onPlanRecorded(listener) {
    listeners.add(listener);
    return () => listeners.delete(listener);
}

function notify() {
    for (const listener of listeners) {
        try {
            listener();
        } catch (error) {
            //A panel that throws while repainting must never take the AI turn with it.
            console.error("AI plan listener failed", error);
        }
    }
}
