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
import {
    loadDiceRuntime
} from './src/platform/vendor/diceRuntime.js';

let canvasElement = null;

const params = {
    segments: 40,
    edgeRadius: .13,
    notchRadius: .12,
    notchDepth: .1,
};

const STAGE_WIDTH = 900;
const STAGE_HEIGHT = 680;
const DIE_HALF_EXTENT = 0.5;
const TRAY = Object.freeze({
    floorY: -7,
    minX: -1,
    maxX: 11,
    minZ: -4,
    maxZ: 8
});

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
let wantedFaces = [];

export async function rollDiceOnScreen(faces, attackerCount, enemyColour) {
    await loadDiceRuntime();
    ensureStage();
    clearDice();

    for (let index = 0; index < faces.length; index++) {
        diceArray.push(createDice(index < attackerCount ? playerColour() : enemyColour));
    }

    wantedFaces = [...faces];
    const throwState = throwDice();
    const landed = simulateToRest();
    applyFaceOffsets(landed, faces);
    restoreThrow(throwState);

    startRendering();

    return new Promise((resolve) => {
        settleResolve = resolve;
        waitForRest();
    });
}

function ensureStage() {
    if (renderer) {
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
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setSize(STAGE_WIDTH, STAGE_HEIGHT, false);

    scene = new THREE.Scene();

    camera = new THREE.PerspectiveCamera(45, STAGE_WIDTH / STAGE_HEIGHT, .1, 300);
    camera.position.set(5, 4, 14);
    camera.rotation.set(-0.74, 0, 0);

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

export function skipRoll() {
    if (diceArray.length === 0) {
        return;
    }
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
        applyFaceOffsets(diceArray.map((dice) => faceUp(dice.body)), wantedFaces);
        const resolve = settleResolve;
        settleResolve = null;
        if (resolve) resolve();
        return;
    }
    setTimeout(waitForRest, 50);
}

function initPhysics() {
    physicsWorld = new CANNON.World({
        allowSleep: true,
        gravity: new CANNON.Vec3(0, -42, 0),
    })

    physicsWorld.defaultContactMaterial.restitution = .28;
    physicsWorld.defaultContactMaterial.friction = .38;
}


function createFloor() {
    const floor = new THREE.Mesh(
        new THREE.PlaneGeometry(1000, 1000),
        new THREE.ShadowMaterial({
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
    const boxMaterialOuter = new THREE.MeshStandardMaterial({
        color: convertHexValueToRGBOrViceVersa(colour, 1),
        roughness: .38,
        metalness: 0
    });
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

function createDice(colour) {
    const pivot = new THREE.Group();
    const mesh = createDiceMesh(colour);
    pivot.add(mesh);
    scene.add(pivot);

    const body = new CANNON.Body({
        mass: 1,
        shape: new CANNON.Box(new CANNON.Vec3(DIE_HALF_EXTENT, DIE_HALF_EXTENT, DIE_HALF_EXTENT)),
        sleepTimeLimit: .25,
        linearDamping: .12,
        angularDamping: .15
    });
    physicsWorld.addBody(body);

    return { pivot, mesh, body };
}

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

function simulateToRest(maxSteps = 2000) {
    for (let step = 0; step < maxSteps; step++) {
        physicsWorld.step(1 / 60);
        if (diceArray.every((dice) => dice.body.sleepState === CANNON.Body.SLEEPING)) {
            break;
        }
    }
    return diceArray.map((dice) => faceUp(dice.body));
}

function applyFaceOffsets(landed, wanted) {
    const rotations = cubeRotations();
    diceArray.forEach((dice, index) => {
        const from = landed[index];
        const to = wanted[index] ?? from;
        const match = rotations.find((rotation) => rotation.permutation[to - 1] === from);
        dice.mesh.quaternion.copy(match ? match.quaternion : new THREE.Quaternion());
    });
}

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
        dice.pivot.position.copy(dice.body.position);
        dice.pivot.quaternion.copy(dice.body.quaternion);
    }

    renderer.render(scene, camera);
    animationHandle = requestAnimationFrame(render);
}

function throwDice() {
    const thrown = [];
    diceArray.forEach((dice, index) => {
        const lane = index % 3;
        const rank = Math.floor(index / 3);
        const position = new CANNON.Vec3(
            TRAY.maxX - 1.2 - rank * 1.7,
            TRAY.floorY + 2.4 + rank * 0.6,
            1 + lane * 2.1);

        const euler = {
            x: 2 * Math.PI * cosmeticRandom(),
            y: 2 * Math.PI * cosmeticRandom(),
            z: 2 * Math.PI * cosmeticRandom()
        };

        const velocity = new CANNON.Vec3(
            -(9 + 2 * cosmeticRandom()),
            2.5 + 1.5 * cosmeticRandom(),
            -1.1 + 2.2 * cosmeticRandom());

        const spin = new CANNON.Vec3(
            18 * (cosmeticRandom() - 0.5),
            18 * (cosmeticRandom() - 0.5),
            18 * (cosmeticRandom() - 0.5));

        spin.z += cosmeticRandom() < 0.5 ? -9 : 9;

        thrown.push({ position, euler, velocity, spin });
        applyThrow(dice, { position, euler, velocity, spin });
    });
    return thrown;
}

function restoreThrow(thrown) {
    diceArray.forEach((dice, index) => applyThrow(dice, thrown[index]));
}

function applyThrow(dice, { position, euler, velocity, spin }) {
    dice.body.wakeUp();
    dice.body.position.copy(position);
    dice.body.quaternion.setFromEuler(euler.x, euler.y, euler.z);
    dice.body.velocity.set(velocity.x, velocity.y, velocity.z);
    dice.body.angularVelocity.set(spin.x, spin.y, spin.z);
    dice.body.allowSleep = true;
}

export function pickContrastingColor(rgbColor) {
    const rgb = rgbColor.slice(4, -1).split(",");
    const red = parseInt(rgb[0]);
    const green = parseInt(rgb[1]);
    const blue = parseInt(rgb[2]);

    const brightness = (red * 299 + green * 587 + blue * 114) / 1000;

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