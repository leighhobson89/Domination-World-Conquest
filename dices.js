// The 3D dice: a physical roll that shows numbers the RULES already chose.
//
// Battle overhaul B.6.5. The order is the whole design and it is not negotiable:
//
//   1. `src/rules/military/dice.js` rolls the faces, on the game's seeded stream.
//   2. This file throws real dice, from the COSMETIC stream, and lets them tumble.
//   3. Before they are shown, each die's MESH is rotated by one of the 24 rotations of a cube
//      so that the face landing upwards is the face the rules chose.
//
// A cube is invariant under those 24 rotations, so step 3 changes nothing physical -- the
// collision shape, the trajectory and the resting pose are identical. The player watches a
// genuine tumble; the result was decided before it started. Anything else is unseedable, and
// `tests/e2e` asserts exact combat outcomes.
//
// This is not the design the plan started with. `tools/dice-spike.mjs` was written to time a
// SEARCH for a throw that lands on the required faces, and found the search unnecessary. Its
// header carries the measurements.
//
// THREE THINGS THE SPIKE FOUND THAT ARE FIXED HERE.
//
//  * The dice were BADLY BIASED. `createDice()` gave every die `Box(new Vec3(.3, .3, .5))` -- a
//    0.6 x 0.6 x 1.0 cuboid under a 1 x 1 x 1 cube mesh. A square prism rests on one of its four
//    long sides, so over 3,600 rolls faces 3 and 4 came up 6% each against 17% for the others
//    (chi-square 738 against 7.9 for a cube). A cuboid also has only 8 rotational symmetries, so
//    it could not carry an arbitrary face onto an arbitrary target -- the relabelling in step 3
//    REQUIRES a cube.
//  * `throwDice()` drew from `Math.random`, which is the game's stream. Cosmetic randomness must
//    never touch it (CLAUDE.md; audit 5.3 Y), so the throw draws from `cosmeticRandom()`.
//  * `world.fixedStep()` derives its elapsed time from `performance.now()`, so in a headless loop
//    it runs zero substeps and the world never advances. The pre-run in step 3 must call
//    `world.step(1/60)`.
//
// FACE NUMBERING is dictated by the pips carved in `createBoxGeometry()`:
//   +Y = 1, +X = 2, +Z = 3, -Z = 4, -X = 5, -Y = 6.  Opposite faces sum to 7.

import {
    convertHexValueToRGBOrViceVersa
} from './src/ui/map/colouring.js';
import {
    playerColour
} from './src/state/selectors.js';
import {
    cosmeticRandom
} from './src/platform/cosmeticRng.js';
import {
    ids
} from './src/ui/core/registry.js';
//Battle overhaul B.10.3. THREE and CANNON are no longer loaded by `index.html`; they arrive the
//first time a die is rolled. See the header of that file for why they are still classic scripts
//setting globals rather than imports.
import {
    loadDiceRuntime
} from './src/platform/vendor/diceRuntime.js';

let canvasElement = null;

const params = {
    segments: 40,
    //ROUNDED, not sharp. At .07 the bevel was a hairline that read as a hard-edged box at the
    //size these are drawn; this is a casino die's radius and is what makes the silhouette read
    //as a die. The bevel is geometry rather than a shader, so it costs nothing per frame.
    //
    //It is BOUNDED by the pips, and the bound is why this is .13 and not more. `createBoxGeometry()`
    //bevels any vertex outside `subCubeHalfSize = .5 - edgeRadius` and only then carves a notch
    //into vertices still sitting exactly on a face, so a bevel that reaches the pip ring silently
    //deletes the corner pips of the 5 and the 6. The outermost pip sits at `offset` (.23) plus
    //`notchRadius` (.12) = .35, so `edgeRadius` must stay below .15.
    edgeRadius: .13,
    notchRadius: .12,
    notchDepth: .1,
};

/**
 * The stage's drawing size, in CSS pixels.
 *
 * It matches `#threeCanvasForDice` in style.css and must keep matching it. The renderer is told
 * this explicitly because `WebGLRenderer` does NOT infer a size from the canvas element: with no
 * `setSize()` call the drawing buffer stays at its 300x150 default and the browser scales it up
 * to the 800x600 the stylesheet asks for. That is a 2.7x upscale of a low-resolution image, which
 * is exactly what "blurred, like low-res and scaled up" describes -- and no amount of antialiasing
 * or pixel ratio fixes it, because the pixels were never rendered.
 */
const STAGE_WIDTH = 900;
const STAGE_HEIGHT = 680;

/** Half-extent of the collision cube. Must stay a CUBE -- see the header. */
const DIE_HALF_EXTENT = 0.5;

/**
 * The playable floor, derived from what the camera can see.
 *
 * A die outside this is a die the player cannot read, which is the whole reason the tray exists.
 * The numbers come from projecting the frustum onto the floor plane rather than from taste, and
 * they are recorded here so that a future camera change is visibly a change to these too:
 *
 *   camera at (5, 4, 14), pitched -0.74 rad, 45 degree vertical field, 900x680.
 *   The view axis meets the floor (y = -7) at about (5, 1.9), 16.3 units out.
 *   The NEAR edge of the visible floor is z = 8.8, and it is the narrowest part of the shot:
 *   x runs from -1.7 to 11.7 there. Further back the frame widens.
 *
 * So the safe rectangle is the near edge's width, held all the way back. Pulled in by a die's
 * width so a die resting against a wall is still wholly in frame.
 */
const TRAY = Object.freeze({
    floorY: -7,
    minX: -1,
    maxX: 11,
    minZ: -4,
    maxZ: 8
});

/** Local outward normal of each face, indexed by pip value minus one. */
const FACE_NORMALS = [
    [0, 1, 0],   // 1
    [1, 0, 0],   // 2
    [0, 0, 1],   // 3
    [0, 0, -1],  // 4
    [-1, 0, 0],  // 5
    [0, -1, 0]   // 6
];

const diceArray = [];

let renderer, scene, camera, physicsWorld;
let animationHandle = null;
let settleResolve = null;

/**
 * The faces this roll is supposed to end on, kept for the correction at rest.
 *
 * THE DICE MUST SHOW WHAT THE RULES CHOSE, AND THE PRE-RUN ALONE DOES NOT GUARANTEE IT. The mesh
 * offset is computed from a headless replay of the throw, which reproduces the visible one only
 * as long as the visible one runs the same sequence of steps. Two things break that. A dropped
 * frame longer than `maxSubSteps` allows for makes `fixedStep()` skip physics the pre-run did
 * not. And `skipRoll()` used to stop the dice dead wherever they were -- so a die frozen in a
 * pose it never would have reached showed a face nobody chose, and mid-air at that.
 *
 * So the offsets are recomputed from the dice's ACTUAL orientation the moment they come to rest,
 * by whichever route. In the ordinary case that is the same answer and nothing moves; in the
 * cases above it is a correction, and a correction landing at the instant the dice stop is very
 * much better than a wrong number sitting there for the rest of the round. It is also what makes
 * the clash panel's reveal honest, because the panel reveals off the same settle.
 */
let wantedFaces = [];

/**
 * Roll dice on screen that land showing `faces`.
 *
 * @param {number[]} faces        the pip values the rules chose, attacker's first
 * @param {number} attackerCount  how many of `faces` belong to the attacker
 * @param {string} enemyColour    the defender's colour, as an rgb() string
 * @returns {Promise<void>} resolves when the dice have settled or the roll was skipped
 */
export async function rollDiceOnScreen(faces, attackerCount, enemyColour) {
    //Battle overhaul B.10.3. The ~785 KB of physics and rendering runtime is fetched HERE, on the
    //first roll of the session, rather than on every page view. It resolves immediately
    //afterwards, so only the first battle pays -- and the round has already been decided by the
    //time this is called, so waiting for it delays an animation and nothing else.
    await loadDiceRuntime();
    ensureStage();
    clearDice();

    for (let index = 0; index < faces.length; index++) {
        diceArray.push(createDice(index < attackerCount ? playerColour() : enemyColour));
    }

    //Throw, then run the WHOLE roll headlessly to see where it lands. Only then is the mesh
    //offset known, and only then is anything drawn -- so the first frame the player sees is
    //already showing the right numbers.
    wantedFaces = [...faces];
    const throwState = throwDice();
    const landed = simulateToRest();
    applyFaceOffsets(landed, faces);

    //Replay the identical throw. Same bodies, same impulses, same order of operations, so the
    //physics repeats exactly and the dice come to rest in the pose just measured.
    restoreThrow(throwState);

    startRendering();

    return new Promise((resolve) => {
        settleResolve = resolve;
        waitForRest();
    });
}

/**
 * Build the renderer, scene and world ONCE.
 *
 * A fresh `WebGLRenderer` per roll leaks a GL context, and browsers cap those at around sixteen
 * -- a battle is five to eight rounds, so two battles would exhaust them and the canvas would go
 * blank with a console warning rather than an error. The stage is permanent; only the dice come
 * and go.
 */
function ensureStage() {
    if (renderer) {
        //The renderer is kept, but the canvas it draws into has to still be in the DOCUMENT.
        //A detached canvas renders perfectly and shows nothing, so this failure is silent: the
        //dice roll, the faces are right, `facesShowing()` answers correctly and the player sees
        //an empty stage. It happened for real -- `ui.js` removed the canvas when a battle
        //opened -- so the guard stays even though that call site has gone. RE-ATTACHING is the
        //fix rather than rebuilding: a new `WebGLRenderer` would leak the old context, and
        //browsers cap those at around sixteen.
        if (canvasElement && !canvasElement.isConnected) {
            document.getElementById(ids.threeCanvasForDice)?.appendChild(canvasElement);
        }
        return;
    }
    removeCanvasIfExist();
    createCanvas();
    initPhysics();

    renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true, canvas: canvasElement });
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    //THE SIZE IS THE WHOLE OF THE BLUR FIX. `setSize()` was never called, so the drawing buffer
    //sat at the WebGL default of 300x150 while the stylesheet stretched the canvas to 800x600 --
    //a 2.7x upscale of a low-resolution image. `setPixelRatio` alone could not help: it
    //multiplies a size that was never set. `false` keeps the stylesheet in charge of the CSS
    //size, so the two cannot drift apart.
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setSize(STAGE_WIDTH, STAGE_HEIGHT, false);

    scene = new THREE.Scene();

    //The aspect is the CANVAS's, not the window's. Reading `window.innerWidth / innerHeight` for
    //a fixed canvas stretches every die horizontally on a wide monitor and vertically on a tall
    //one -- so the dice were not only soft, they were the wrong shape, and by a different amount
    //on every machine.
    //
    //And the camera is AIMED at where the dice come to rest, rather than being left pointing at
    //the horizon. The old position and pitch put the resting pile low in the frame at about
    //forty pixels a die, with the far half of the shot spent on empty floor; a narrower field
    //from closer in, angled down onto the landing zone, spends the frame on the dice. A die is
    //not readable at forty pixels, which is the other half of why the roll looked poor.
    camera = new THREE.PerspectiveCamera(45, STAGE_WIDTH / STAGE_HEIGHT, .1, 300);
    camera.position.set(5, 4, 14);
    camera.rotation.set(-0.74, 0, 0);

    //Flat ambient plus one weak point light gave every die the same brightness on all six faces,
    //which removes the shading that tells the eye a cube is a cube. Less ambient and a stronger
    //key, placed over the middle of the tray rather than off its corner, is what puts a bright
    //face, a mid face and a dark face on each die -- and a die whose faces differ is a die whose
    //rotation is visible while it tumbles.
    scene.add(new THREE.AmbientLight(0xffffff, .62));
    const topLight = new THREE.PointLight(0xffffff, .95);
    topLight.position.set(4, 13, 7);
    topLight.castShadow = true;
    topLight.shadow.mapSize.width = 2048;
    topLight.shadow.mapSize.height = 2048;
    topLight.shadow.camera.near = 5;
    topLight.shadow.camera.far = 400;
    scene.add(topLight);

    createFloor();
    createWall();
}

/** Take the previous round's dice out of both the scene and the physics world. */
function clearDice() {
    for (const dice of diceArray) {
        scene.remove(dice.pivot);
        physicsWorld.removeBody(dice.body);
        dice.mesh.traverse((node) => {
            if (node.geometry) node.geometry.dispose();
            if (node.material) node.material.dispose();
        });
    }
    diceArray.length = 0;
    settleResolve = null;
}

/** Tear the whole stage down -- when the battle window closes. */
export function disposeDiceStage() {
    if (animationHandle !== null) {
        cancelAnimationFrame(animationHandle);
        animationHandle = null;
    }
    if (scene) {
        clearDice();
    }
    if (renderer) {
        renderer.dispose();
        renderer = null;
    }
    scene = null;
    camera = null;
    physicsWorld = null;
    removeCanvasIfExist();
}

function startRendering() {
    if (animationHandle === null) {
        render();
    }
}

/**
 * The face each die on screen is actually SHOWING, after the mesh offset.
 *
 * This exists because the header's promise -- "the dice show numbers the RULES chose" -- was
 * quietly false and nothing could see it. `applyFaceOffsets()` searched for its rotation in the
 * wrong direction, so a die showed the right number only when the rotation the search happened to
 * pick was its own inverse for that pair: measured over four rounds, one matched. It is the kind
 * of defect that has no textual signature at all. Nothing throws, every test passes, the numbers
 * in the battle window are right, and the only witness is a person looking at the table and
 * noticing that the dice do not say what the game says they said.
 *
 * So the invariant is asserted now, by `tests/e2e/battle/clash.spec.js`, and this is what it
 * reads. It is a rendering question -- what is drawn, after a physics pose and a mesh rotation --
 * so it cannot be answered anywhere but in a browser with a roll on screen.
 *
 * @returns {number[]} one face per die, in the order they were rolled; empty before any roll.
 */
export function facesShowing() {
    if (diceArray.length === 0 || typeof THREE === "undefined") {
        return [];
    }
    return diceArray.map((dice) => {
        let best = 1;
        let bestY = -Infinity;
        for (let face = 0; face < FACE_NORMALS.length; face++) {
            const [x, y, z] = FACE_NORMALS[face];
            const v = new THREE.Vector3(x, y, z)
                .applyQuaternion(dice.mesh.quaternion)
                .applyQuaternion(dice.pivot.quaternion);
            if (v.y > bestY) {
                bestY = v.y;
                best = face + 1;
            }
        }
        return best;
    });
}

/**
 * Stop the roll and show the result immediately.
 *
 * It RUNS THE WORLD FORWARD rather than freezing it. Zeroing every velocity and calling `sleep()`
 * stopped the dice exactly where they were -- which, on a skip taken early, is in mid-air: dice
 * hanging above the tray showing whatever face happened to be up at that instant, which is not
 * the face the rules chose. Stepping to rest instead lands them in the pose they were going to
 * land in anyway, so a skip shows the same result a wait would have, just sooner.
 */
export function skipRoll() {
    if (diceArray.length === 0) {
        return;
    }
    //Step the world to rest, then MAKE it rest. `simulateToRest()` gives up after its step budget
    //and reports whatever the faces are at that point, which is right for measuring a throw and
    //not enough for stopping one: a die wedged against a wall or jittering between two contacts
    //never satisfies the sleep test, so the roll's promise never resolves and everything chained
    //to it -- the fade, and the clash panel's reveal -- never happens. Measured at five seconds on
    //a roll that was supposed to be capped at two.
    //
    //Forcing sleep AFTER stepping is what keeps both properties: the dice are in the pose they
    //were going to reach, and the roll always ends.
    const landed = simulateToRest();
    for (const dice of diceArray) {
        dice.body.velocity.setZero();
        dice.body.angularVelocity.setZero();
        dice.body.sleep();
    }
    applyFaceOffsets(landed, wantedFaces);
}

function waitForRest() {
    const asleep = diceArray.length > 0
        && diceArray.every((dice) => dice.body.sleepState === CANNON.Body.SLEEPING);
    if (asleep) {
        //Re-derive the offsets from where the dice ACTUALLY came to rest. See `wantedFaces`.
        applyFaceOffsets(diceArray.map((dice) => faceUp(dice.body)), wantedFaces);
        const resolve = settleResolve;
        settleResolve = null;
        if (resolve) resolve();
        return;
    }
    //50ms, not 80. This poll is the last thing between the dice stopping and everything that is
    //timed off them, and at 80 it was adding most of a frame-and-a-half of dead air to a
    //sequence that is already the slowest thing in a battle.
    setTimeout(waitForRest, 50);
}

function initPhysics() {
    //Gravity is straight DOWN. It used to carry a +5 on z as well, which is a constant sideways
    //acceleration toward the camera -- a way of nudging the dice into shot that the new throw
    //does properly, by throwing them into it. Leaving it in would have pushed every die out of
    //the tray on the z side over a flight three times as long as the old one.
    //
    //And it is 42 rather than 65. The dice cross the tray now instead of falling into it, so the
    //flight has to last long enough to be a throw: at 65 the whole roll was over in about a
    //third of a second, which is why it read as a drop no matter what spin was on it.
    physicsWorld = new CANNON.World({
        allowSleep: true,
        gravity: new CANNON.Vec3(0, -42, 0),
    })

    //Bouncy enough to skip off the floor once, not enough to rattle around the tray.
    physicsWorld.defaultContactMaterial.restitution = .28;
    //FRICTION IS WHAT MAKES IT A ROLL. With a near-frictionless floor a spinning die slides
    //across the tray with the spin unaffected -- the two motions never couple, and the result
    //looks like a spinning object being dragged. Friction is what converts forward speed into
    //tumbling and tumbling back into forward speed, which is the whole visual difference
    //between a die that is rolling and one that is being moved.
    physicsWorld.defaultContactMaterial.friction = .38;
    //A `ContactMaterial` for the walls was built here and never added to the world, so it did
    //nothing. Dropped rather than wired up: the walls only need to stop dice leaving the tray,
    //and giving them a bouncier restitution makes the roll take longer to settle.
}


function createFloor() {
    const floor = new THREE.Mesh(
        new THREE.PlaneGeometry(1000, 1000),
        new THREE.ShadowMaterial({
            //Was .1, which is a shadow you have to be told is there. A die needs a shadow to sit
            //on the floor rather than float over it, and the contact shadow is most of what
            //sells the bounce.
            opacity: .28
        })
    )
    floor.receiveShadow = true;
    floor.position.y = -7;
    floor.quaternion.setFromAxisAngle(new THREE.Vector3(-1, 0, 0), Math.PI * .5);
    scene.add(floor);

    const floorBody = new CANNON.Body({
        type: CANNON.Body.STATIC,
        shape: new CANNON.Plane(),
    });
    floorBody.position.copy(floor.position);
    floorBody.quaternion.copy(floor.quaternion);
    physicsWorld.addBody(floorBody);
}

/**
 * The tray the dice are thrown into: four invisible static walls.
 *
 * THE WALLS ARE THE POINT, AND THEY ARE SIZED TO THE CAMERA. A die that leaves the tray leaves
 * the SHOT, and a roll whose result cannot be seen is worse than no roll at all -- so these
 * bounds are not chosen by taste, they are the floor area the camera can actually see, brought
 * in by a margin. `TRAY` below carries the arithmetic. Anything that changes the camera's
 * position, pitch, field of view or the canvas aspect changes what is visible and therefore
 * changes these numbers; they are not independent.
 *
 * They are also TALL. The original four were two units high on a floor at y = -7 -- a one-unit
 * lip, which was enough for a die dropped straight down inside them and is nothing to a die
 * delivered across the tray. And a die that leaves the world never comes to rest, so it never
 * sleeps, so the promise this roll returns never resolves: the symptom is not a die that
 * disappears, it is a round whose animation never finishes.
 *
 * WHAT THIS REPLACES. Four near-identical forty-line blocks, each building a visible coloured
 * `MeshBasicMaterial` (light blue, green, yellow, red) and then setting `opacity: 0` on it -- so
 * four meshes were being built, uploaded and drawn every frame in order to be invisible. They
 * are physics bodies and nothing else now, and the colours went with the meshes.
 */
function createWall() {
    const HEIGHT = 14;
    const THICKNESS = 1;
    const centreY = TRAY.floorY + HEIGHT / 2;
    const halfSpanX = (TRAY.maxX - TRAY.minX) / 2 + THICKNESS;
    const halfSpanZ = (TRAY.maxZ - TRAY.minZ) / 2 + THICKNESS;
    const midX = (TRAY.minX + TRAY.maxX) / 2;
    const midZ = (TRAY.minZ + TRAY.maxZ) / 2;

    const walls = [
        { position: [midX, centreY, TRAY.minZ - THICKNESS / 2], half: [halfSpanX, HEIGHT / 2, THICKNESS / 2] },
        { position: [midX, centreY, TRAY.maxZ + THICKNESS / 2], half: [halfSpanX, HEIGHT / 2, THICKNESS / 2] },
        { position: [TRAY.maxX + THICKNESS / 2, centreY, midZ], half: [THICKNESS / 2, HEIGHT / 2, halfSpanZ] },
        { position: [TRAY.minX - THICKNESS / 2, centreY, midZ], half: [THICKNESS / 2, HEIGHT / 2, halfSpanZ] }
    ];

    for (const wall of walls) {
        const body = new CANNON.Body({
            type: CANNON.Body.STATIC,
            shape: new CANNON.Box(new CANNON.Vec3(...wall.half))
        });
        body.position.set(...wall.position);
        physicsWorld.addBody(body);
    }
}

function createDiceMesh(colour) {
    //A little roughness and no metalness: the key light then reads as a soft highlight rolling
    //across the bevel as the die turns, which is the second half of making the tumble visible.
    //A fully matte body under flat ambient light has no highlight to roll.
    const boxMaterialOuter = new THREE.MeshStandardMaterial({
        color: convertHexValueToRGBOrViceVersa(colour, 1),
        roughness: .38,
        metalness: 0
    });
    //The pips. `shininess` was set here and is a `MeshPhongMaterial` property -- it has never
    //meant anything on a standard material and is dropped rather than translated, because a
    //perfectly smooth pip catches the key light and washes out to the body colour at exactly the
    //angle a player is trying to read the number at.
    const boxMaterialInner = new THREE.MeshStandardMaterial({
        color: convertHexValueToRGBOrViceVersa(pickContrastingColor(colour), 1),
        roughness: .5,
        metalness: 0,
        side: THREE.DoubleSide
    });

    const diceMesh = new THREE.Group();
    const innerMesh = new THREE.Mesh(createInnerGeometry(), boxMaterialInner);
    const outerMesh = new THREE.Mesh(createBoxGeometry(), boxMaterialOuter);
    outerMesh.castShadow = true;
    diceMesh.add(innerMesh, outerMesh);

    return diceMesh;
}

/**
 * One die: a body, and a mesh held inside a PIVOT.
 *
 * The pivot is what makes the relabelling possible. The body's orientation is copied onto the
 * pivot every frame; the mesh sits inside it carrying a fixed extra rotation. So the die tumbles
 * exactly as the physics says while showing whichever face it has been told to show.
 */
function createDice(colour) {
    const pivot = new THREE.Group();
    const mesh = createDiceMesh(colour);
    pivot.add(mesh);
    scene.add(pivot);

    const body = new CANNON.Body({
        mass: 1,
        //A CUBE. See the header: the shipped 0.6 x 0.6 x 1.0 cuboid biased the roll badly and
        //has only 8 rotational symmetries, which is too few to relabel an arbitrary face.
        shape: new CANNON.Box(new CANNON.Vec3(DIE_HALF_EXTENT, DIE_HALF_EXTENT, DIE_HALF_EXTENT)),
        //A die that is nearly still for a tenth of a second was declared asleep, which froze it
        //mid-topple: the last quarter-turn onto its resting face -- the part a player actually
        //watches -- was cut off every time. Long enough to let it fall over, short enough that
        //the round does not wait on a die rocking in a corner.
        //
        //The damping is what bounds the ROLL-OUT, and it is set against the clock rather than by
        //eye. The whole sequence a player watches is: throw, settle, read the faces for two
        //seconds, dice fade, read the clash panel. At the undamped values a roll took about three
        //and a half seconds to come to rest, which pushed the fade past the point where the panel
        //was still up -- so the dice got out of the way just as the thing they were getting out
        //of the way of disappeared. A die that skids for a second and a half looks no better than
        //one that skids for half of it.
        sleepTimeLimit: .25,
        linearDamping: .12,
        angularDamping: .15
    });
    physicsWorld.addBody(body);

    return { pivot, mesh, body };
}

/**
 * Which face is up, from the body's orientation.
 *
 * Rotate each local face normal and take whichever points most nearly upwards. This replaces the
 * euler-angle ladder the file used to carry, which tested six angle windows on a 0.5 radian
 * tolerance and gave up ("landed on edge") when none matched -- which happens routinely, because
 * dice come to rest leaning on each other. A dot product always has an answer.
 */
function faceUp(body) {
    let best = 1;
    let bestY = -Infinity;
    for (let face = 0; face < FACE_NORMALS.length; face++) {
        const [x, y, z] = FACE_NORMALS[face];
        const rotated = body.quaternion.vmult(new CANNON.Vec3(x, y, z));
        if (rotated.y > bestY) {
            bestY = rotated.y;
            best = face + 1;
        }
    }
    return best;
}

/** Run the world forward until every die is asleep, and report the faces. Nothing is drawn. */
function simulateToRest(maxSteps = 2000) {
    for (let step = 0; step < maxSteps; step++) {
        //`world.step(1/60)`, NOT `fixedStep()`: fixedStep reads the wall clock, so in this loop
        //it would run zero substeps and the world would never move. See the header.
        physicsWorld.step(1 / 60);
        if (diceArray.every((dice) => dice.body.sleepState === CANNON.Body.SLEEPING)) {
            break;
        }
    }
    return diceArray.map((dice) => faceUp(dice.body));
}

/**
 * Rotate each die's MESH so the face that landed shows the face the rules chose.
 *
 * One of the 24 rotations of a cube, found by trying each until it carries the WANTED face onto
 * the axis the LANDED face is currently occupying. The collision shape is unchanged by any of
 * them, which is the whole trick.
 *
 * THE DIRECTION OF THE SEARCH IS THE WHOLE OF IT, AND IT WAS BACKWARDS. This read
 * `permutation[from - 1] === to` -- a rotation carrying the landed face onto the wanted one --
 * for as long as the relabelling has existed. Work it through: the mesh sits inside the pivot, so
 * a local normal `n` is drawn at `Q_body * R * n`. The physics has put `n_landed` upwards under
 * `Q_body`. For the player to SEE `wanted`, the mesh rotation must send `n_wanted` to where
 * `n_landed` is -- that is `permutation[to - 1] === from`. The old search found the INVERSE, so
 * the die showed `permutation⁻¹(landed)`, which is the right answer only when the rotation the
 * search happened to pick first is its own inverse for that pair.
 *
 * That is why it was intermittently right rather than always wrong, and why it survived: measured
 * over four rounds, one matched. The symptom is the one thing this whole arrangement exists to
 * prevent -- dice showing numbers the battle was not fought with.
 */
function applyFaceOffsets(landed, wanted) {
    const rotations = cubeRotations();
    diceArray.forEach((dice, index) => {
        const from = landed[index];
        const to = wanted[index] ?? from;
        const match = rotations.find((rotation) => rotation.permutation[to - 1] === from);
        dice.mesh.quaternion.copy(match ? match.quaternion : new THREE.Quaternion());
    });
}

/** The 24 rotations of a cube, each with the face permutation it produces. */
function cubeRotations() {
    const axes = [
        new THREE.Vector3(1, 0, 0),
        new THREE.Vector3(0, 1, 0),
        new THREE.Vector3(0, 0, 1)
    ];
    const seen = new Set();
    const unique = [];
    for (const axisA of axes) {
        for (let a = 0; a < 4; a++) {
            for (const axisB of axes) {
                for (let b = 0; b < 4; b++) {
                    const quaternion = new THREE.Quaternion()
                        .setFromAxisAngle(axisA, a * Math.PI / 2)
                        .multiply(new THREE.Quaternion().setFromAxisAngle(axisB, b * Math.PI / 2));
                    const permutation = FACE_NORMALS.map(([x, y, z]) => {
                        const rotated = new THREE.Vector3(x, y, z).applyQuaternion(quaternion);
                        let best = 1;
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
                    const key = permutation.join(",");
                    if (!seen.has(key)) {
                        seen.add(key);
                        unique.push({ quaternion, permutation });
                    }
                }
            }
        }
    }
    return unique;
}

function createBoxGeometry() {

    let boxGeometry = new THREE.BoxGeometry(1, 1, 1, params.segments, params.segments, params.segments);

    const positionAttr = boxGeometry.attributes.position;
    const subCubeHalfSize = .5 - params.edgeRadius;


    for (let i = 0; i < positionAttr.count; i++) {

        let position = new THREE.Vector3().fromBufferAttribute(positionAttr, i);

        const subCube = new THREE.Vector3(Math.sign(position.x), Math.sign(position.y), Math.sign(position.z)).multiplyScalar(subCubeHalfSize);
        const addition = new THREE.Vector3().subVectors(position, subCube);

        if (Math.abs(position.x) > subCubeHalfSize && Math.abs(position.y) > subCubeHalfSize && Math.abs(position.z) > subCubeHalfSize) {
            addition.normalize().multiplyScalar(params.edgeRadius);
            position = subCube.add(addition);
        } else if (Math.abs(position.x) > subCubeHalfSize && Math.abs(position.y) > subCubeHalfSize) {
            addition.z = 0;
            addition.normalize().multiplyScalar(params.edgeRadius);
            position.x = subCube.x + addition.x;
            position.y = subCube.y + addition.y;
        } else if (Math.abs(position.x) > subCubeHalfSize && Math.abs(position.z) > subCubeHalfSize) {
            addition.y = 0;
            addition.normalize().multiplyScalar(params.edgeRadius);
            position.x = subCube.x + addition.x;
            position.z = subCube.z + addition.z;
        } else if (Math.abs(position.y) > subCubeHalfSize && Math.abs(position.z) > subCubeHalfSize) {
            addition.x = 0;
            addition.normalize().multiplyScalar(params.edgeRadius);
            position.y = subCube.y + addition.y;
            position.z = subCube.z + addition.z;
        }

        const notchWave = (v) => {
            v = (1 / params.notchRadius) * v;
            v = Math.PI * Math.max(-1, Math.min(1, v));
            return params.notchDepth * (Math.cos(v) + 1.);
        }
        const notch = (pos) => notchWave(pos[0]) * notchWave(pos[1]);

        const offset = .23;

        if (position.y === .5) {
            position.y -= notch([position.x, position.z]);
        } else if (position.x === .5) {
            position.x -= notch([position.y + offset, position.z + offset]);
            position.x -= notch([position.y - offset, position.z - offset]);
        } else if (position.z === .5) {
            position.z -= notch([position.x - offset, position.y + offset]);
            position.z -= notch([position.x, position.y]);
            position.z -= notch([position.x + offset, position.y - offset]);
        } else if (position.z === -.5) {
            position.z += notch([position.x + offset, position.y + offset]);
            position.z += notch([position.x + offset, position.y - offset]);
            position.z += notch([position.x - offset, position.y + offset]);
            position.z += notch([position.x - offset, position.y - offset]);
        } else if (position.x === -.5) {
            position.x += notch([position.y + offset, position.z + offset]);
            position.x += notch([position.y + offset, position.z - offset]);
            position.x += notch([position.y, position.z]);
            position.x += notch([position.y - offset, position.z + offset]);
            position.x += notch([position.y - offset, position.z - offset]);
        } else if (position.y === -.5) {
            position.y += notch([position.x + offset, position.z + offset]);
            position.y += notch([position.x + offset, position.z]);
            position.y += notch([position.x + offset, position.z - offset]);
            position.y += notch([position.x - offset, position.z + offset]);
            position.y += notch([position.x - offset, position.z]);
            position.y += notch([position.x - offset, position.z - offset]);
        }

        positionAttr.setXYZ(i, position.x, position.y, position.z);
    }


    boxGeometry.deleteAttribute('normal');
    boxGeometry.deleteAttribute('uv');
    boxGeometry = BufferGeometryUtils.mergeVertices(boxGeometry);

    boxGeometry.computeVertexNormals();

    return boxGeometry;
}

function createInnerGeometry() {
    const baseGeometry = new THREE.PlaneGeometry(1 - 2 * params.edgeRadius, 1 - 2 * params.edgeRadius);
    const offset = .48;
    return BufferGeometryUtils.mergeBufferGeometries([
        baseGeometry.clone().translate(0, 0, offset),
        baseGeometry.clone().translate(0, 0, -offset),
        baseGeometry.clone().rotateX(.5 * Math.PI).translate(0, -offset, 0),
        baseGeometry.clone().rotateX(.5 * Math.PI).translate(0, offset, 0),
        baseGeometry.clone().rotateY(.5 * Math.PI).translate(-offset, 0, 0),
        baseGeometry.clone().rotateY(.5 * Math.PI).translate(offset, 0, 0),
    ], false);
}

function render() {
    physicsWorld.fixedStep();

    for (const dice of diceArray) {
        //The PIVOT follows the body. The mesh inside it keeps the fixed rotation applied by
        //`applyFaceOffsets()`, which is what makes the die show the face the rules chose while
        //tumbling exactly as the physics dictates.
        dice.pivot.position.copy(dice.body.position);
        dice.pivot.quaternion.copy(dice.body.quaternion);
    }

    renderer.render(scene, camera);
    animationHandle = requestAnimationFrame(render);
}

/**
 * Throw every die, and return enough to repeat the throw exactly.
 *
 * Draws from `cosmeticRandom()`, never `Math.random`. A draw per die on the game's stream would
 * make the battle depend on how many dice were on screen, which is audit 5.3 Y all over again.
 *
 * The dice are spread ACROSS the tray. The original started every die at `(6, index * 1.5, 0)` --
 * y is up, so with the two dice it was written for that is one above the other, and with nine it
 * is a nine-high column dropped from twelve units.
 */
function throwDice() {
    const thrown = [];
    diceArray.forEach((dice, index) => {
        const lane = index % 3;
        const rank = Math.floor(index / 3);

        //Just INSIDE the right-hand wall and only a little above the floor, so the die enters
        //the shot already travelling rather than appearing above the middle of it. `rank`
        //staggers the later dice back and up, which spreads the arrivals over about a third of a
        //second instead of releasing nine dice in one wall.
        //
        //It starts inside the tray and not outside it, and that is a fix rather than a
        //preference: dice used to be launched from x = 13 to 16.6 against a wall whose inner
        //face was at 16.5, so the last of nine dice spawned INTERSECTING it. A physics engine
        //resolves an overlap by pushing the bodies apart, hard, and the die was fired out of the
        //tray -- which is the "sometimes the dice go out of visibility" this fixes. A spawn must
        //always be a clear one.
        //EVERY SPAWN GAP MUST EXCEED A DIE'S WIDTH. The collision shape is a unit cube, so two
        //dice overlap unless they are more than 1.0 apart on at least one axis -- and an overlap
        //at spawn is not a small error, it is two solid bodies interpenetrating, which the solver
        //resolves by firing them apart at whatever speed it takes to separate them in one step.
        //Dice leaving the tray and rolls that never came to rest were both this: a stagger of 0.5
        //in x against 0.7 in y clears neither axis, so every fourth die spawned inside the first.
        //1.7 and 2.1 are the two gaps, and neither may go below 1.0.
        const position = new CANNON.Vec3(
            TRAY.maxX - 1.2 - rank * 1.7,
            TRAY.floorY + 2.4 + rank * 0.6,
            1 + lane * 2.1);

        const euler = {
            x: 2 * Math.PI * cosmeticRandom(),
            y: 2 * Math.PI * cosmeticRandom(),
            z: 2 * Math.PI * cosmeticRandom()
        };

        //ACROSS the tray, not down into it. The old throw launched from above the tray with an
        //impulse of (-force, +force, 0) against a gravity of 65: the die rose about half a unit
        //and then fell eight, which is a drop with a flick on it and reads as exactly that. This
        //is a flat, fast delivery down the -x axis with a little lift on it, so the die spends
        //its flight crossing the shot and lands with enough forward speed left to roll.
        //
        //The speed is chosen against the stopping distance, not by eye: friction and damping
        //decelerate a die at roughly mu*g = 0.38 * 42 = 16 units a second squared, so a delivery
        //at 9-11 crosses about three units in the air and rolls another three or four before it
        //settles -- which, from a launch just inside the right-hand wall, puts the pile in the
        //middle of the tray and in shot every time. It was 12-15 while the launch was off the
        //edge of the tray; from inside it, that overshoots into the left-hand wall.
        const velocity = new CANNON.Vec3(
            -(9 + 2 * cosmeticRandom()),
            2.5 + 1.5 * cosmeticRandom(),
            -1.1 + 2.2 * cosmeticRandom());

        //Spin is now STATED rather than being a side effect of applying the impulse off-centre.
        //That is what makes the tumble legible: an off-centre impulse on a one-kilogram cube
        //produced a spin the throw's strength happened to determine, around whichever two axes
        //the offset happened to select. A die that is thrown tumbles about all three, fast
        //enough that the faces are a blur in flight and slow enough that the last half-turn
        //before it settles is readable.
        const spin = new CANNON.Vec3(
            18 * (cosmeticRandom() - 0.5),
            18 * (cosmeticRandom() - 0.5),
            18 * (cosmeticRandom() - 0.5));
        //A guaranteed component about the axis of travel, so every die ROLLS forward as well as
        //tumbling. Without it a die can be thrown spinning almost entirely about x and slide.
        spin.z += cosmeticRandom() < 0.5 ? -9 : 9;

        thrown.push({ position, euler, velocity, spin });
        applyThrow(dice, { position, euler, velocity, spin });
    });
    return thrown;
}

/** Put every die back exactly where the recorded throw started it. */
function restoreThrow(thrown) {
    diceArray.forEach((dice, index) => applyThrow(dice, thrown[index]));
}

/**
 * Set one die's whole initial condition.
 *
 * Velocity and angular velocity are SET, not applied as an impulse. The pre-run in
 * `rollDiceOnScreen()` replays this call to reproduce the throw it measured, and an impulse is
 * accumulated into whatever the body is already carrying -- so it has to start from a cleared
 * state to repeat, which is a fragile way to say "put it back". Two assignments cannot drift.
 */
function applyThrow(dice, { position, euler, velocity, spin }) {
    dice.body.wakeUp();
    dice.body.position.copy(position);
    dice.body.quaternion.setFromEuler(euler.x, euler.y, euler.z);
    dice.body.velocity.set(velocity.x, velocity.y, velocity.z);
    dice.body.angularVelocity.set(spin.x, spin.y, spin.z);
    dice.body.allowSleep = true;
}

export function pickContrastingColor(rgbColor) {
    // Extract the red, green, and blue values from the RGB color string
    const rgb = rgbColor.slice(4, -1).split(",");
    const red = parseInt(rgb[0]);
    const green = parseInt(rgb[1]);
    const blue = parseInt(rgb[2]);

    // Calculate the perceived brightness of the color
    const brightness = (red * 299 + green * 587 + blue * 114) / 1000;

    // Return black or white based on the brightness
    return brightness > 128 ? "rgb(0,0,0)" : "rgb(255,255,255)";
}

export function removeCanvasIfExist() {
    const canvasContainer = document.getElementById(ids.threeCanvasForDice);
    const existing = document.getElementById(ids.canvas);
    if (existing && canvasContainer) {
        canvasContainer.removeChild(existing);
    }
}

function createCanvas() {
    const canvasContainer = document.getElementById(ids.threeCanvasForDice);
    const newCanvas = document.createElement("canvas");
    newCanvas.id = ids.canvas;
    canvasContainer.appendChild(newCanvas);
    canvasElement = newCanvas;
}