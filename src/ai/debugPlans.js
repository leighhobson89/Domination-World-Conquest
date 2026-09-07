// AN INJECTED PLAN: a country told, from outside, what to go after.
//
// Every other horizon in `src/ai/` is DERIVED. The objective comes from the victory
// condition (`victory.js` -> `doctrine.js` -> `strategy.js`), the theatre is chosen from the
// frontier (`theatre.js`), and this turn's goals are rated from the world (`targeting.js`).
// That is right for the game and it is exactly wrong for debugging one: the question a
// person actually has is "what happens if THIS country goes for THAT ground", and the only
// way to ask it was to play until the derivation happened to produce it, which for a
// specific pairing on a 207-country map is never.
//
// So this is the one place a plan is ASSERTED rather than reasoned to. It is reachable only
// from the spectator mode's debug window; nothing in an ordinary game writes here, and an
// empty table costs one `Map.get` per country per turn.
//
// FIVE THINGS ABOUT IT, all of which are decisions rather than details.
//
// **A plan survives a succession.** `clearPlansFor()` wipes a country's theatre, walls,
// setbacks and posture when its leader dies, because those are judgements reached by
// somebody no longer in charge. An injected plan is not a judgement at all -- it is the
// operator's instruction, and a debug instruction that quietly evaporated every fifteen to
// twenty turns would be worse than no debug instruction. It is cleared by setting another
// one for the same country, by cancelling it, or by leaving spectator mode. Nothing else.
//
// **It is ONE plan per country.** Confirming a second replaces the first. A queue would
// need a policy for which one wins on a turn where both are reachable, and there is no
// answer to that which is more useful than "the last thing you asked for".
//
// **The priority is a whole ROW of dials, not a multiplier.** "Push harder" means different
// things to the four gates a target has to pass -- the weight it is ranked by, the odds
// floor it has to clear, the force the border will release, the budget the country has left
// -- and turning one of them up while the others stay put produces a country that ranks the
// target first and then declines to attack it, which reads as the tool not working. The
// table below moves all of them together, and only the top tier moves them all the way.
//
// **The top tier deliberately breaks rules the other tiers respect.** `ALL_OUT` is "throw
// caution to the wind": it ignores the setback memory, the posture refusals, the 8% floor
// the game applies to everybody, and the smallest-force-that-clears sizing. It is the tier
// for finding out what a war between two named countries looks like, and it will happily
// feed an army into a fortress. That is the point of it. The one invariant it does NOT
// break is `minimumHomeShare` -- a border held by nobody is a territory given away, and a
// debug tool that could delete a country's own provinces would be measuring itself.
//
// **The dials are here and not in `balance.js`.** Nothing in this file is a balance
// decision: no ordinary game reaches it, `tools/ai-sim.mjs` never writes to it, and a row
// in `balance.js` is a statement about how the game is tuned. Keeping it here is also what
// lets the table be read as a whole, which is how it has to be read.
//
// Pure and dependency-free, so it runs in Node and is unit-tested there. It holds a Map and
// a listener set; it reads no store, draws no randomness and touches no DOM.

/** What a plan points at. A country (all of its ground) or one named territory. */
export const DebugPlanKind = Object.freeze({
    COUNTRY: "country",
    TERRITORY: "territory"
});

/** How hard to push. Ordered weakest first -- the UI renders them in this order. */
export const DebugPlanPriority = Object.freeze({
    NUDGE: "nudge",
    PUSH: "push",
    PRESS: "press",
    ALL_OUT: "all-out"
});

/**
 * What each priority actually does, in one row per tier.
 *
 * `targetWeight`      multiplies the target's worth in `campaignWeightForTarget()`, which is
 *                     what `calculatePriorityScore()` ranks military goals by. This is how a
 *                     plan reaches the top of the list rather than the middle of it.
 * `floorScale`        multiplies both odds floors on the campaign. 1 leaves the leader's own
 *                     appetite for risk exactly as it was.
 * `minAttackBudget`   the country gets at least this many attacks and sieges, whatever its
 * `minSiegeBudget`    posture would have rationed it -- a plan the budget cut before the odds
 *                     were ever looked at is a plan that did nothing for no stated reason.
 *                     THE TOP TIER STOPS AT THE GAME'S OWN CEILING and does not go past it:
 *                     `attackDiscipline.maxPerTurn` is 5 and `siegeDiscipline
 *                     .maxOpenedPerTurn` is 2, and those two are what every other clamp in
 *                     `deriveBudgets()` is written against. A number above them is not a
 *                     harder push, it is a budget that means something different from every
 *                     other budget in the game, and the executor spends it without noticing.
 * `appetite`          the share of a border's SURPLUS that will march out, as a floor under
 *                     the leader's own appetite. Null leaves the leader's alone.
 * `keepScale`         multiplies the garrison kept back against the strongest reachable
 *                     enemy. 0 means "keep nothing against anybody", bounded below by
 *                     `minimumHomeShare` in `commitment.js`.
 * `commitAll`         send the whole disposable force instead of the smallest slice that
 *                     clears the floor. "Throw everything it has."
 * `pressOnBelowAim`   attack at odds under the aim but over the floor, the way a country
 *                     already does inside a theatre it has committed to.
 * `ignoreSetbacks`    forget that this border has beaten us before.
 * `ignorePosture`     attack off-objective while CONSOLIDATEing or DEFENDing.
 * `ignoreHardFloor`   bypass `PROBABILITY_THRESHOLD_FOR_SIEGE`, the 8% below which the game
 *                     offers nobody an interaction. Top tier only, and it is the dial that
 *                     turns a hopeless assault from "declined" into "watched".
 */
export const debugPlanPriorities = Object.freeze([
    Object.freeze({
        id: DebugPlanPriority.NUDGE,
        label: "Nudge",
        description: "Ranks the target above its neighbours and changes nothing else. " +
            "The country still has to want the fight.",
        targetWeight: 3,
        floorScale: 1,
        minAttackBudget: 1,
        minSiegeBudget: 1,
        appetite: null,
        keepScale: 1,
        commitAll: false,
        pressOnBelowAim: false,
        ignoreSetbacks: false,
        ignorePosture: false,
        ignoreHardFloor: false
    }),
    Object.freeze({
        id: DebugPlanPriority.PUSH,
        label: "Push",
        description: "Ranks it far above everything else, lowers both odds floors a quarter, " +
            "and presses attacks it would otherwise wait to reinforce.",
        targetWeight: 12,
        floorScale: 0.75,
        minAttackBudget: 2,
        minSiegeBudget: 1,
        appetite: 0.8,
        keepScale: 0.8,
        commitAll: false,
        pressOnBelowAim: true,
        ignoreSetbacks: false,
        ignorePosture: false,
        ignoreHardFloor: false
    }),
    Object.freeze({
        id: DebugPlanPriority.PRESS,
        label: "Press hard",
        description: "Halves both odds floors, forgets previous defeats here, and attacks " +
            "even while consolidating or defending elsewhere.",
        targetWeight: 60,
        floorScale: 0.5,
        minAttackBudget: 4,
        minSiegeBudget: 2,
        appetite: 0.95,
        keepScale: 0.5,
        commitAll: false,
        pressOnBelowAim: true,
        ignoreSetbacks: true,
        ignorePosture: true,
        ignoreHardFloor: false
    }),
    Object.freeze({
        id: DebugPlanPriority.ALL_OUT,
        label: "All out",
        description: "Caution to the wind: every floor down to the minimum, every border " +
            "stripped to its last tenth, and the whole disposable force sent at once.",
        targetWeight: 5000,
        floorScale: 0,
        minAttackBudget: 5,
        minSiegeBudget: 2,
        appetite: 1,
        keepScale: 0,
        commitAll: true,
        pressOnBelowAim: true,
        ignoreSetbacks: true,
        ignorePosture: true,
        ignoreHardFloor: true
    })
]);

const PRIORITY_BY_ID = new Map(debugPlanPriorities.map(row => [row.id, row]));

/** The tier a plan is set at, falling back to the weakest so a bad id cannot throw. */
export function debugPlanStrength(plan) {
    return PRIORITY_BY_ID.get(plan?.priority) ?? debugPlanPriorities[0];
}

/**
 * country -> {country, kind, target, priority, setOnTurn}
 *
 * The whole of the durable state. Deliberately NOT a save slice: an injected plan is a
 * thing an operator is doing right now, and a saved game that came back still pushing a war
 * with no visible instruction behind it would be a mystery rather than a feature.
 */
const plans = new Map();

/** @type {Set<(plans: Array<object>) => void>} */
const listeners = new Set();

/** Subscribe to the table changing. Returns the unsubscribe, as everything else here does. */
export function onDebugPlansChanged(listener) {
    listeners.add(listener);
    return () => listeners.delete(listener);
}

function notify() {
    const snapshot = activeDebugPlans();
    for (const listener of listeners) {
        try {
            listener(snapshot);
        } catch (error) {
            //A panel that throws while repainting must never take the AI turn with it --
            //the same contract `aiGameMode.js` has with its own listeners.
            console.error("Debug plan listener failed", error);
        }
    }
}

/**
 * Point a country at something.
 *
 * @param {{country: string, kind: string, target: string, priority: string, turn?: number}} input
 * @returns {object|null} the plan as stored, or null if it was not usable
 */
export function setDebugPlan({ country, kind, target, priority, turn = 0 } = {}) {
    if (!country || !target) {
        return null;
    }
    const resolvedKind = kind === DebugPlanKind.TERRITORY
        ? DebugPlanKind.TERRITORY
        : DebugPlanKind.COUNTRY;
    const plan = Object.freeze({
        country,
        kind: resolvedKind,
        target,
        priority: PRIORITY_BY_ID.has(priority) ? priority : debugPlanPriorities[0].id,
        setOnTurn: Number(turn) || 0
    });
    plans.set(country, plan);
    notify();
    return plan;
}

/** Drop one country's plan. */
export function clearDebugPlan(country) {
    if (!plans.delete(country)) {
        return false;
    }
    notify();
    return true;
}

/** Drop every plan. The window's "Cancel all" button, and leaving spectator mode. */
export function clearAllDebugPlans() {
    if (plans.size === 0) {
        return 0;
    }
    const cleared = plans.size;
    plans.clear();
    notify();
    return cleared;
}

/** The plan in force for one country, or null. */
export function debugPlanFor(country) {
    return plans.get(country) ?? null;
}

/** Every plan in force, in the order they were set. */
export function activeDebugPlans() {
    return [...plans.values()];
}

/** Is anything injected at all? One boolean test for the callers that only need that. */
export function anyDebugPlans() {
    return plans.size > 0;
}

/**
 * Does this plan point at this territory?
 *
 * `dataName` is the CURRENT owner, which is what a country-wide plan has to read: a plan
 * against France means the ground France holds now, so a territory France takes during the
 * war joins the plan and one it loses leaves it. `territoryName` is the stable identity,
 * which is what a territory-wide plan means -- that hill, whoever ends up on it.
 *
 * @param {object|null} plan
 * @param {{territoryName?: string, dataName?: string}} target
 */
export function debugPlanTargets(plan, target) {
    if (!plan || !target) {
        return false;
    }
    return plan.kind === DebugPlanKind.TERRITORY
        ? target.territoryName === plan.target
        : target.dataName === plan.target;
}

/**
 * How much of a plan's weight this territory carries, per step of the journey.
 *
 * A corridor step is worth less than the objective and much more than an ordinary target, and
 * it has to decay with distance for a reason that is not aesthetic: without the decay every
 * territory on a fifteen-hop route to the Falklands would be worth exactly as much as the
 * Falklands, and the country would have no reason to prefer the step that shortens the
 * journey to the one that does not. With it, the ranking within the corridor is still the
 * campaign's own -- see the note in `campaignWeightForTarget()`.
 *
 * 0.55 is chosen so that the corridor stays overwhelming for the handful of hops a country
 * can see and fades to nothing well before the far end of a long route. At ALL OUT's weight
 * of 5,000 the next step is worth 2,750 and the fifth step 251 -- both still far above any
 * ordinary target, which is the point.
 */
const CORRIDOR_DECAY = 0.55;

/**
 * What an injected plan makes of this territory: the objective, a step on the way, or nothing.
 *
 * THE ONE QUESTION EVERY CALL SITE ASKS. `targeting.js`, `goals.js` and `aiCalculations.js`
 * all go through this rather than testing the plan themselves, because they have to agree --
 * a country that ranks a corridor step first and then declines to commit to it, because the
 * commitment site tested for the final target alone, is the exact failure this feature is
 * prone to and the one that looks like the tool not working.
 *
 * The route is read off the campaign and may be absent (adjacency is not loaded in Node, and
 * a plan set this instant has not been routed yet). The objective itself is matched WITHOUT
 * it, so a plan against a neighbour behaves correctly even with no routing at all -- which is
 * what the feature did before routing existed, and is still the common case.
 *
 * @param {object|null} campaign  carries `debugPlan` and, once routed, `debugRoute`
 * @param {{territoryName?: string, dataName?: string}} target
 * @returns {{strength: object, distance: number, weight: number, objective: boolean}|null}
 */
export function debugPlanReach(campaign, target) {
    const plan = campaign?.debugPlan;
    if (!plan || !target) {
        return null;
    }
    const strength = debugPlanStrength(plan);

    if (debugPlanTargets(plan, target)) {
        return { strength, distance: 0, weight: strength.targetWeight, objective: true };
    }

    const route = campaign.debugRoute;
    if (!route || !Number.isFinite(route.ourBest)) {
        return null;
    }
    const distance = route.distances?.get(target.territoryName);
    //STRICTLY closer, not merely close. A territory the same distance away as the ground we
    //already hold is a sideways move and gets nothing; see `stepsRemainingOnRoute()`.
    if (!Number.isFinite(distance) || distance >= route.ourBest) {
        return null;
    }
    return {
        strength,
        distance,
        weight: 1 + (strength.targetWeight - 1) * Math.pow(CORRIDOR_DECAY, distance),
        objective: false
    };
}

/**
 * Drop the plans that have come true.
 *
 * The predicate is INJECTED because this module reads no store -- the caller knows how to ask
 * the world who holds what, and keeping that here would cost the file its only real property,
 * which is that it imports nothing. `strategy.js` supplies it.
 *
 * A plan is realised when there is nothing left to take: a territory plan when the injecting
 * country holds the territory, a country plan when the target country holds no ground at all.
 * The second is deliberately not "we took all of it" -- if a third party finished the target
 * off first, the objective is equally gone, and a plan pointing at a country that no longer
 * exists would keep a corridor open towards nowhere for the rest of the game.
 *
 * @param {(plan: object) => boolean} isRealised
 * @returns {Array<object>} the plans that were retired
 */
export function retireRealisedDebugPlans(isRealised) {
    if (typeof isRealised !== "function" || plans.size === 0) {
        return [];
    }
    const retired = [];
    for (const plan of [...plans.values()]) {
        if (isRealised(plan)) {
            plans.delete(plan.country);
            retired.push(plan);
        }
    }
    if (retired.length > 0) {
        notify();
    }
    return retired;
}

/**
 * The commitment overrides a plan asks for, or null when it wants the leader's own.
 *
 * Shaped for `commitment.js`, which is pure and knows nothing about this module: it takes a
 * `push` object and does not care where it came from.
 */
export function debugPlanPush(plan) {
    if (!plan) {
        return null;
    }
    const strength = debugPlanStrength(plan);
    return {
        appetite: strength.appetite,
        keepScale: strength.keepScale,
        commitAll: strength.commitAll,
        pressOnBelowAim: strength.pressOnBelowAim
    };
}

/** One line saying what a plan is, for the log and the panel. */
export function describeDebugPlan(plan) {
    if (!plan) {
        return "";
    }
    const strength = debugPlanStrength(plan);
    const what = plan.kind === DebugPlanKind.TERRITORY ? "the territory of " : "";
    return "INJECTED: take " + what + plan.target + " -- " + strength.label.toLowerCase() +
        " (set on turn " + plan.setOnTurn + ")";
}

/** Wipe the table without telling anybody. Tests only. */
export function __resetDebugPlansForTests() {
    plans.clear();
    listeners.clear();
}
