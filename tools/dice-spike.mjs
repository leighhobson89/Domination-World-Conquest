// Battle overhaul B.0 -- the dice spike. THROWAWAY: this answers a question and is not
// shipped code. Nothing in src/ imports it.
//
//   node tools/dice-spike.mjs
//
// THE QUESTION
//
// The rules have to pick the dice faces (they must be seedable; the physics is not), but the
// player has to watch dice land on them. Plan section 4.12 offered three ways to reconcile
// that, and named "pre-solve the throw by searching for an impulse that lands on the target"
// as the preferred one. This spike was written to time that search.
//
// THE ANSWER: the search is unnecessary, and asking for it was a design mistake.
//
// A cube is invariant under the 24 rotations of its own symmetry group. So the physics does
// not have to be steered at all:
//
//   1. Throw the dice however you like -- from `cosmeticRandom()`, off the game's stream.
//   2. Step the world to rest HEADLESSLY and read which faces landed up.
//   3. For each die, apply the cube rotation that maps its landed face to the face the RULES
//      chose, to the MESH only, as a fixed offset from the body's quaternion.
//   4. Replay the identical throw with rendering on. The mesh offset makes it show the
//      required faces, and the physics is bit-for-bit the throw already simulated because
//      nothing about the body changed.
//
// No search, no rejection sampling, no visible swap, and the roll stays a real physical
// tumble rather than an animation. The cost is one headless run of the world per round.
//
// WHAT THIS SPIKE MEASURED  (400 throws of 9 dice, seed 0xC0FFEE)
//
//   1. Headless time to rest: ~6 ms for nine dice, ~138 steps at 1/60. One headless run per
//      round is comfortably inside a frame.
//
//   2. THE SHIPPED DICE ARE BADLY BIASED, and this is a real defect in dices.js today.
//      `createDice()` gives every die `new CANNON.Box(new CANNON.Vec3(.3, .3, .5))` -- a
//      0.6 x 0.6 x 1.0 CUBOID under a 1 x 1 x 1 cube mesh. A square prism rests on one of its
//      four long sides, so the two faces on the short axis almost never come up:
//
//          shipped Box(.3,.3,.5)   23.0  22.1   6.2   5.9  22.8  19.9   chi-square 738.5
//          cube    Box(.5,.5,.5)   17.8  15.8  16.6  16.8  17.5  15.7   chi-square   7.9
//
//      (5 degrees of freedom; 11.07 is the p=0.05 critical value, so the cube is uniform and
//      the shipped shape is not remotely.) Faces 3 and 4 come up a THIRD as often as they
//      should. Making the shape a cube fixes the bias and is also what unlocks the
//      relabelling in step 3 -- a cuboid has only 8 rotational symmetries and cannot carry an
//      arbitrary face onto an arbitrary target; a cube has all 24 and can.
//
//   3. Determinism: identical initial conditions give identical faces, which is what makes
//      the headless run in step 2 a valid prediction of the visible run in step 4.
//
//   4. The relabelling table: 24 distinct rotations enumerated, and every one of the 36
//      (landed, target) pairs has one. Applying it leaves the collision shape unchanged.
//
// A TRAP WORTH RECORDING. The first version of this spike stepped the world with
// `world.fixedStep()`, which is what `render()` in dices.js calls. `fixedStep()` derives its
// elapsed time from `performance.now()`; in a tight headless loop no wall-clock time passes
// between calls, so it runs zero substeps and the world never advances. It reported a
// confidently wrong answer -- a heavily biased distribution, IDENTICAL for both collision
// shapes, which was nothing but the initial random orientations being read straight back.
// Anything stepping this world outside a render loop must call `world.step(1/60)`.
//

import * as CANNON from "cannon-es";

const DICE_COUNT = 9;
const THROWS = 400;
const HALF = 0.5;

/** Local-space outward normal of each face, indexed by the face's pip value minus one. */
const FACE_NORMALS = [
    [0, 1, 0],   // 1 -- +Y
    [1, 0, 0],   // 2 -- +X
    [0, 0, 1],   // 3 -- +Z
    [0, 0, -1],  // 4 -- -Z
    [-1, 0, 0],  // 5 -- -X
    [0, -1, 0]   // 6 -- -Y
];

/** mulberry32 -- the same generator as src/platform/cosmeticRng.js, seeded for repeatability. */
function makeRng(seed) {
    let state = seed >>> 0;
    return function random() {
        state = (state + 0x6d2b79f5) | 0;
        let t = Math.imul(state ^ (state >>> 15), state | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

function buildWorld() {
    const world = new CANNON.World({ allowSleep: true, gravity: new CANNON.Vec3(0, -65, 5) });
    world.defaultContactMaterial.restitution = 0.3;

    // The floor, as dices.js has it.
    const floor = new CANNON.Body({ type: CANNON.Body.STATIC, shape: new CANNON.Plane() });
    floor.position.set(0, -7, 0);
    floor.quaternion.setFromAxisAngle(new CANNON.Vec3(-1, 0, 0), Math.PI * 0.5);
    world.addBody(floor);

    // The four walls of `createWall()`, reproduced by their EFFECT rather than their code:
    // two long thin boxes across z at z = 7 and z = -3, two across x at x = 12 and x = -6,
    // all 2 units tall centred on y = -6. It is a shallow tray, and it is what the dice
    // actually come to rest inside.
    const walls = [
        { position: [4, -6, 7], halfExtents: [50, 1, 0.5] },
        { position: [2, -6, -3], halfExtents: [50, 1, 0.5] },
        { position: [12, -6, 5], halfExtents: [0.5, 1, 50] },
        { position: [-6, -6, 5], halfExtents: [0.5, 1, 50] }
    ];
    for (const spec of walls) {
        const wall = new CANNON.Body({
            type: CANNON.Body.STATIC,
            shape: new CANNON.Box(new CANNON.Vec3(...spec.halfExtents))
        });
        wall.position.set(...spec.position);
        world.addBody(wall);
    }
    return world;
}

/**
 * @param {"cube"|"shipped"} shape  "shipped" is the 0.6 x 0.6 x 1.0 cuboid dices.js uses today
 */
function addDice(world, count, shape) {
    const halfExtents = shape === "cube"
        ? new CANNON.Vec3(HALF, HALF, HALF)
        : new CANNON.Vec3(0.3, 0.3, 0.5);
    const bodies = [];
    for (let i = 0; i < count; i++) {
        const body = new CANNON.Body({
            mass: 1,
            shape: new CANNON.Box(halfExtents),
            sleepTimeLimit: 0.1
        });
        world.addBody(body);
        bodies.push(body);
    }
    return bodies;
}

/**
 * Throw, as `throwDice()` does, but drawing from a seeded stream and spreading the dice
 * ACROSS the tray rather than stacking them.
 *
 * dices.js starts every die at `(6, index * 1.5, 0)` -- y is UP, so with the two dice it was
 * written for that is one die above the other, and with nine it would be a nine-high column
 * dropped from twelve units up. Spread along x and z instead, inside the pen.
 */
function throwDice(bodies, random) {
    bodies.forEach((body, index) => {
        body.velocity.setZero();
        body.angularVelocity.setZero();
        body.wakeUp();
        const column = index % 3;
        const row = Math.floor(index / 3);
        body.position.set(7 + column * 1.4, 1 + row * 1.6, 1 + column * 0.6 - row * 1.2);
        const euler = new CANNON.Vec3(2 * Math.PI * random(), 2 * Math.PI * random(), 2 * Math.PI * random());
        body.quaternion.setFromEuler(euler.x, euler.y, euler.z);
        const force = 3 + 5 * random();
        body.applyImpulse(new CANNON.Vec3(-force, force, 0), new CANNON.Vec3(0, 0, 0.3));
        body.allowSleep = true;
    });
}

/**
 * Which face is up, read from the body's orientation.
 *
 * Rotate each local face normal by the body quaternion and take whichever points most nearly
 * straight up. This replaces the euler-angle ladder in `addDiceEvents()`, which has to test
 * six angle windows with a 0.5 radian tolerance and gives up ("landed on edge") when none
 * matches. The dot product cannot fail to produce an answer.
 */
function faceUp(body) {
    let best = 0;
    let bestY = -Infinity;
    for (let face = 0; face < FACE_NORMALS.length; face++) {
        const [x, y, z] = FACE_NORMALS[face];
        const rotated = body.quaternion.vmult(new CANNON.Vec3(x, y, z));
        if (rotated.y > bestY) {
            bestY = rotated.y;
            best = face + 1;
        }
    }
    return { value: best, confidence: bestY };
}

/**
 * Step until everything is asleep, or the cap is hit. Returns the steps taken.
 *
 * `world.step(1/60)` and NOT `world.fixedStep()`. `fixedStep()` derives its elapsed time from
 * `performance.now()`, so in a tight headless loop no wall-clock time passes between calls, it
 * runs zero substeps, and the world never advances at all -- every die stays exactly where it
 * was thrown. That is not a hypothetical: the first run of this spike reported a wildly biased
 * face distribution, identical for two different collision shapes, which was nothing but the
 * initial random orientations being read back.
 */
function stepToRest(world, bodies, maxSteps = 2000) {
    for (let step = 1; step <= maxSteps; step++) {
        world.step(1 / 60);
        if (bodies.every((body) => body.sleepState === CANNON.Body.SLEEPING)) {
            return step;
        }
    }
    return maxSteps;
}

function runThrows({ shape, throws, seed }) {
    const world = buildWorld();
    const bodies = addDice(world, DICE_COUNT, shape);
    const random = makeRng(seed);

    const histogram = [0, 0, 0, 0, 0, 0];
    let totalSteps = 0;
    let worstConfidence = Infinity;
    const started = performance.now();

    for (let t = 0; t < throws; t++) {
        throwDice(bodies, random);
        totalSteps += stepToRest(world, bodies);
        for (const body of bodies) {
            const { value, confidence } = faceUp(body);
            histogram[value - 1]++;
            worstConfidence = Math.min(worstConfidence, confidence);
        }
    }

    const elapsed = performance.now() - started;
    return {
        histogram,
        elapsedMs: elapsed,
        msPerThrow: elapsed / throws,
        stepsPerThrow: totalSteps / throws,
        worstConfidence,
        rolls: throws * DICE_COUNT
    };
}

/** Chi-square against a uniform d6, so "biased" is a number rather than an impression. */
function chiSquare(histogram) {
    const total = histogram.reduce((sum, n) => sum + n, 0);
    const expected = total / 6;
    return histogram.reduce((sum, n) => sum + ((n - expected) ** 2) / expected, 0);
}

/**
 * The relabelling table: for every (landed, target) pair, a rotation of the cube that carries
 * the landed face onto the target face.
 *
 * Built by enumerating the 24 rotations as quaternions and recording, for each, which face it
 * sends to which. Applied to the MESH only -- the collision shape of a cube is unchanged by
 * any of them, which is the whole reason this works.
 */
function buildRelabelTable() {
    const axes = [
        new CANNON.Vec3(1, 0, 0),
        new CANNON.Vec3(0, 1, 0),
        new CANNON.Vec3(0, 0, 1)
    ];
    const rotations = [];
    // Every composition of two axis-aligned quarter turns covers all 24 orientations, with
    // duplicates that the dedupe below drops.
    for (const axisA of axes) {
        for (let a = 0; a < 4; a++) {
            for (const axisB of axes) {
                for (let b = 0; b < 4; b++) {
                    const qA = new CANNON.Quaternion().setFromAxisAngle(axisA, a * Math.PI / 2);
                    const qB = new CANNON.Quaternion().setFromAxisAngle(axisB, b * Math.PI / 2);
                    rotations.push(qA.mult(qB));
                }
            }
        }
    }

    /** Which face value ends up where a given face value started, under one rotation. */
    function permutationOf(quaternion) {
        return FACE_NORMALS.map(([x, y, z]) => {
            const rotated = quaternion.vmult(new CANNON.Vec3(x, y, z));
            let best = 0;
            let bestDot = -Infinity;
            for (let face = 0; face < FACE_NORMALS.length; face++) {
                const [nx, ny, nz] = FACE_NORMALS[face];
                const dot = rotated.x * nx + rotated.y * ny + rotated.z * nz;
                if (dot > bestDot) {
                    bestDot = dot;
                    best = face + 1;
                }
            }
            return best;
        });
    }

    const seen = new Set();
    const unique = [];
    for (const quaternion of rotations) {
        const permutation = permutationOf(quaternion);
        const key = permutation.join(",");
        if (!seen.has(key)) {
            seen.add(key);
            unique.push({ quaternion, permutation });
        }
    }

    // table[landed][target] -> a rotation that shows `target` where `landed` came up.
    const table = {};
    let complete = true;
    for (let landed = 1; landed <= 6; landed++) {
        table[landed] = {};
        for (let target = 1; target <= 6; target++) {
            const match = unique.find((entry) => entry.permutation[landed - 1] === target);
            if (match) {
                table[landed][target] = match.quaternion;
            } else {
                complete = false;
            }
        }
    }
    return { unique, table, complete };
}

// --- run -------------------------------------------------------------------

console.log("Battle overhaul B.0 -- dice spike\n");

const shipped = runThrows({ shape: "shipped", throws: THROWS, seed: 0xC0FFEE });
const cube = runThrows({ shape: "cube", throws: THROWS, seed: 0xC0FFEE });

function report(label, result) {
    const total = result.rolls;
    const percentages = result.histogram.map((n) => ((n / total) * 100).toFixed(1) + "%");
    console.log(`${label}`);
    console.log(`  faces 1-6      ${percentages.join("  ")}`);
    console.log(`  counts         ${result.histogram.join("  ")}`);
    console.log(`  chi-square     ${chiSquare(result.histogram).toFixed(1)}  (uniform ~5, 11.07 is p=0.05 for 5 df)`);
    console.log(`  steps to rest  ${result.stepsPerThrow.toFixed(0)} per throw of ${DICE_COUNT}`);
    console.log(`  time           ${result.msPerThrow.toFixed(2)} ms per throw of ${DICE_COUNT}`);
    console.log(`  worst face confidence ${result.worstConfidence.toFixed(3)}  (1.0 is dead flat)`);
    console.log("");
}

report(`SHIPPED collision shape -- Box(.3,.3,.5), ${THROWS} throws`, shipped);
report(`CUBE collision shape -- Box(.5,.5,.5), ${THROWS} throws`, cube);

// Determinism: the same seed, the same world, twice.
const first = runThrows({ shape: "cube", throws: 20, seed: 12345 });
const second = runThrows({ shape: "cube", throws: 20, seed: 12345 });
const deterministic = first.histogram.join(",") === second.histogram.join(",");
console.log(`Determinism      ${deterministic ? "PASS" : "FAIL"} -- identical seed gives identical faces`);

// The relabelling table.
const { unique, table, complete } = buildRelabelTable();
console.log(`Cube rotations   ${unique.length} distinct (expected 24)`);
console.log(`Relabel table    ${complete ? "COMPLETE" : "INCOMPLETE"} -- every landed face can be shown as any target face`);

// Prove one: land on 6, ask for 3, check the rotation really does it.
const check = table[6][3];
const rotatedNormal = check.vmult(new CANNON.Vec3(...FACE_NORMALS[5]));
console.log(`  spot check     landed 6 -> want 3: rotated +Y component ${rotatedNormal.y.toFixed(3)},`
    + ` face-3 normal alignment ${(rotatedNormal.z).toFixed(3)}`);

console.log(`
VERDICT
  Relabelling works and needs no search. One headless run per round costs
  ~${cube.msPerThrow.toFixed(1)} ms for ${DICE_COUNT} dice, which is well inside a frame.
  The collision shape MUST become a cube: as shipped it is a square prism and the
  face distribution above shows how badly that biases the roll.`);
