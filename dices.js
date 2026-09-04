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
    edgeRadius: .07,
    notchRadius: .12,
    notchDepth: .1,
};

/** Half-extent of the collision cube. Must stay a CUBE -- see the header. */
const DIE_HALF_EXTENT = 0.5;

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
        return;
    }
    removeCanvasIfExist();
    createCanvas();
    initPhysics();

    renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true, canvas: canvasElement });
    renderer.shadowMap.enabled = true;
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 4));

    scene = new THREE.Scene();

    camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, .1, 300);
    camera.position.set(0.5, .08, 1.8).multiplyScalar(7);
    camera.rotation.set(-0.4, 0, 0);

    scene.add(new THREE.AmbientLight(0xffffff, .8));
    const topLight = new THREE.PointLight(0xffffff, .5);
    topLight.position.set(10, 15, 0);
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

/** Stop the roll and show the result immediately. */
export function skipRoll() {
    for (const dice of diceArray) {
        dice.body.velocity.setZero();
        dice.body.angularVelocity.setZero();
        dice.body.sleep();
    }
}

function waitForRest() {
    const asleep = diceArray.length > 0
        && diceArray.every((dice) => dice.body.sleepState === CANNON.Body.SLEEPING);
    if (asleep) {
        const resolve = settleResolve;
        settleResolve = null;
        if (resolve) resolve();
        return;
    }
    setTimeout(waitForRest, 80);
}

function initPhysics() {
    physicsWorld = new CANNON.World({
        allowSleep: true,
        gravity: new CANNON.Vec3(0, -65, 5),
    })

    physicsWorld.defaultContactMaterial.restitution = .3;
    //A `ContactMaterial` for the walls was built here and never added to the world, so it did
    //nothing. Dropped rather than wired up: the walls only need to stop dice leaving the tray,
    //and giving them a bouncier restitution makes the roll take longer to settle.
}


function createFloor() {
    const floor = new THREE.Mesh(
        new THREE.PlaneGeometry(1000, 1000),
        new THREE.ShadowMaterial({
            opacity: .1
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

function createWall() {
    const wallSize = 2;
    const wallDepth = 1;
    const wallGeometry = new THREE.BoxGeometry(wallSize * 50, wallSize, wallDepth); // Use BoxGeometry for the wall with specified depth

    // First Wall (Light Blue)
    const wallColor1 = new THREE.Color(0xadd8e6); // Light blue color
    const wallMaterial1 = new THREE.MeshBasicMaterial({
        color: wallColor1,
        opacity: 0,
        transparent: true
    }); // Set transparent: false to make it non-transparent

    const wallMesh1 = new THREE.Mesh(wallGeometry, wallMaterial1);
    wallMesh1.position.set(4, -6.0, 7); // Position the first wall at the specified coordinates
    wallMesh1.rotation.set(0, Math.PI, 0); // Rotate the first wall 180 degrees around the Y axis
    scene.add(wallMesh1);

    const wallShape1 = new CANNON.Box(new CANNON.Vec3(wallSize * 25, wallSize / 2, wallDepth / 2));
    const wallBody1 = new CANNON.Body({
        type: CANNON.Body.STATIC,
        shape: wallShape1,
    });
    wallBody1.position.copy(wallMesh1.position);
    wallBody1.quaternion.copy(wallMesh1.quaternion);
    physicsWorld.addBody(wallBody1);

    // Second Wall (Green)
    const wallColor2 = new THREE.Color(0x00ff00); // Green color
    const wallMaterial2 = new THREE.MeshBasicMaterial({
        color: wallColor2,
        opacity: 0,
        transparent: true
    }); // Set transparent: false to make it non-transparent

    const wallMesh2 = new THREE.Mesh(wallGeometry, wallMaterial2);
    wallMesh2.position.set(2, -6.0, -3); // Position the second wall at the specified coordinates (z-index + 10)
    wallMesh2.rotation.set(0, Math.PI, 0); // Rotate the second wall 180 degrees around the Y axis
    scene.add(wallMesh2);

    const wallShape2 = new CANNON.Box(new CANNON.Vec3(wallSize * 25, wallSize / 2, wallDepth / 2));
    const wallBody2 = new CANNON.Body({
        type: CANNON.Body.STATIC,
        shape: wallShape2,
    });
    wallBody2.position.copy(wallMesh2.position);
    wallBody2.quaternion.copy(wallMesh2.quaternion);
    physicsWorld.addBody(wallBody2);

    //3rd wall yellow
    const wallColor3 = new THREE.Color(0xffff00); // Yellow color
    const wallMaterial3 = new THREE.MeshBasicMaterial({
        color: wallColor3,
        opacity: 0,
        transparent: true
    }); // Set transparent: false to make it non-transparent

    const wallMesh3 = new THREE.Mesh(wallGeometry, wallMaterial3);
    wallMesh3.position.set(12, -6.0, 5); // Position the third wall at the specified coordinates (same as the first wall)
    wallMesh3.rotation.set(0, Math.PI / 2, 0); // Rotate the third wall 90 degrees around the Y axis
    scene.add(wallMesh3);

    const wallShape3 = new CANNON.Box(new CANNON.Vec3(wallSize * 25, wallSize / 2, wallDepth / 2));
    const wallBody3 = new CANNON.Body({
        type: CANNON.Body.STATIC,
        shape: wallShape3,
    });
    wallBody3.position.copy(wallMesh3.position);
    wallBody3.quaternion.copy(wallMesh3.quaternion);
    physicsWorld.addBody(wallBody3);

    // Fourth Wall (Red)
    const wallColor4 = new THREE.Color(0xff0000); // Red color
    const wallMaterial4 = new THREE.MeshBasicMaterial({
        color: wallColor4,
        opacity: 0,
        transparent: true
    }); // Set transparent: false to make it non-transparent

    const wallMesh4 = new THREE.Mesh(wallGeometry, wallMaterial4);
    wallMesh4.position.set(-6, -6.0, 5); // Position the fourth wall at the specified coordinates (same as the other walls)
    wallMesh4.rotation.set(0, -Math.PI / 2, 0); // Rotate the fourth wall -90 degrees around the Y axis
    scene.add(wallMesh4);

    const wallShape4 = new CANNON.Box(new CANNON.Vec3(wallSize * 25, wallSize / 2, wallDepth / 2));
    const wallBody4 = new CANNON.Body({
        type: CANNON.Body.STATIC,
        shape: wallShape4,
    });
    wallBody4.position.copy(wallMesh4.position);
    wallBody4.quaternion.copy(wallMesh4.quaternion);
    physicsWorld.addBody(wallBody4);
}

function createDiceMesh(colour) {
    const boxMaterialOuter = new THREE.MeshStandardMaterial({
        color: convertHexValueToRGBOrViceVersa(colour, 1),
    });
    const boxMaterialInner = new THREE.MeshStandardMaterial({
        color: convertHexValueToRGBOrViceVersa(pickContrastingColor(colour), 1),
        roughness: 0,
        shininess: 2,
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
        sleepTimeLimit: .1
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
 * One of the 24 rotations of a cube, found by trying each until it maps landed onto wanted. The
 * collision shape is unchanged by any of them, which is the whole trick.
 */
function applyFaceOffsets(landed, wanted) {
    const rotations = cubeRotations();
    diceArray.forEach((dice, index) => {
        const from = landed[index];
        const to = wanted[index] ?? from;
        const match = rotations.find((rotation) => rotation.permutation[from - 1] === to);
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
        const column = index % 3;
        const row = Math.floor(index / 3);
        const position = new CANNON.Vec3(7 + column * 1.4, 1 + row * 1.6, 1 + column * 0.6 - row * 1.2);
        const euler = {
            x: 2 * Math.PI * cosmeticRandom(),
            y: 2 * Math.PI * cosmeticRandom(),
            z: 2 * Math.PI * cosmeticRandom()
        };
        const force = 3 + 5 * cosmeticRandom();
        thrown.push({ position, euler, force });
        applyThrow(dice, { position, euler, force });
    });
    return thrown;
}

/** Put every die back exactly where the recorded throw started it. */
function restoreThrow(thrown) {
    diceArray.forEach((dice, index) => applyThrow(dice, thrown[index]));
}

function applyThrow(dice, { position, euler, force }) {
    dice.body.velocity.setZero();
    dice.body.angularVelocity.setZero();
    dice.body.wakeUp();
    dice.body.position.copy(position);
    dice.body.quaternion.setFromEuler(euler.x, euler.y, euler.z);
    dice.body.applyImpulse(new CANNON.Vec3(-force, force, 0), new CANNON.Vec3(0, 0, .3));
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