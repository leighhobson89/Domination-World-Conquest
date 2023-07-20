import { convertHexValueToRGBOrViceVersa } from './ui.js';
import { playerColour } from "./ui.js";

let canvasEl = document.querySelector('#canvas');
const scoreResult = document.querySelector('#score-result');
let scoreResultArray = [];

const params = {
    numberOfDice: 2,
    segments: 40,
    edgeRadius: .07,
    notchRadius: .12,
    notchDepth: .1,
};

const diceArray = [];

let renderer, scene, camera, diceMesh, physicsWorld;
let diceAnimationFinished = false;
const wallBodyMaterial = new CANNON.Material("wallMaterial");

export function callDice(enemyColor) {

    document.getElementById("battleContainer").style.pointerEvents = "none"; //disable all UI until dice run

    removeCanvasIfExist();
    createCanvas();

    diceAnimationFinished = false;
    scoreResultArray = [0,0];
    return new Promise((resolve) => {
        initPhysics();
        initScene();

        function initScene() {
            renderer = new THREE.WebGLRenderer({
                alpha: true,
                antialias: true,
                canvas: canvasEl
            });
            renderer.shadowMap.enabled = true
            renderer.setPixelRatio(Math.min(window.devicePixelRatio, 4));

            scene = new THREE.Scene();

            camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, .1, 300)
            camera.position.set(0.5, .08, 1.8).multiplyScalar(7);
            camera.rotation.set(-0.4, 0, 0);

            const ambientLight = new THREE.AmbientLight(0xffffff, .8);
            scene.add(ambientLight);
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

            for (let i = 0; i < params.numberOfDice; i++) {
                diceMesh = createDiceMesh(i, enemyColor);
                diceArray.push(createDice());
                addDiceEvents(diceArray[i], i);
            }

            throwDice();

            render();
        }

        const checkAnimationComplete = () => {
            if (diceAnimationFinished) {
                diceArray.length = 0;
                document.getElementById("battleContainer").style.pointerEvents = "auto";
                resolve(scoreResultArray);
            } else {
                setTimeout(checkAnimationComplete, 100);
            }
        };
        checkAnimationComplete();
    });
}


function initPhysics() {
    physicsWorld = new CANNON.World({
        allowSleep: true,
        gravity: new CANNON.Vec3(0, -65, 5),
    })

    physicsWorld.defaultContactMaterial.restitution = .3
    const wallContactMaterial = new CANNON.ContactMaterial(wallBodyMaterial, {
        restitution: .8
    });
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
    const wallMaterial1 = new THREE.MeshBasicMaterial({ color: wallColor1, opacity: 0, transparent: true }); // Set transparent: false to make it non-transparent

    const wallMesh1 = new THREE.Mesh(wallGeometry, wallMaterial1);
    wallMesh1.position.set(4, -6.0, 7); // Position the first wall at the specified coordinates
    wallMesh1.rotation.set(0, Math.PI, 0); // Rotate the first wall 180 degrees around the Y axis
    scene.add(wallMesh1);

    const wallShape1 = new CANNON.Box(new CANNON.Vec3(wallSize * 25, wallSize / 2, wallDepth / 2));
    const wallBody1 = new CANNON.Body({
        type: CANNON.Body.STATIC,
        shape: wallShape1,
        material: wallBodyMaterial,
    });
    wallBody1.position.copy(wallMesh1.position);
    wallBody1.quaternion.copy(wallMesh1.quaternion);
    physicsWorld.addBody(wallBody1);

    // Second Wall (Green)
    const wallColor2 = new THREE.Color(0x00ff00); // Green color
    const wallMaterial2 = new THREE.MeshBasicMaterial({ color: wallColor2, opacity: 0, transparent: true }); // Set transparent: false to make it non-transparent

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
    const wallMaterial3 = new THREE.MeshBasicMaterial({ color: wallColor3, opacity: 0, transparent: true }); // Set transparent: false to make it non-transparent

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
    const wallMaterial4 = new THREE.MeshBasicMaterial({ color: wallColor4, opacity: 0, transparent: true }); // Set transparent: false to make it non-transparent

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

function createDiceMesh(diceNumber, enemyColor) {
    let boxMaterialOuter;
    let boxMaterialInner;
    if (diceNumber === 0) {
        boxMaterialOuter = new THREE.MeshStandardMaterial({
            color: convertHexValueToRGBOrViceVersa(playerColour, 1),
        })
        boxMaterialInner = new THREE.MeshStandardMaterial({
            color: convertHexValueToRGBOrViceVersa(pickContrastingColor(playerColour), 1),
            roughness: 0,
            shininess: 2,
            side: THREE.DoubleSide
        })
    } else if (diceNumber === 1) {
        boxMaterialOuter = new THREE.MeshStandardMaterial({
            color: convertHexValueToRGBOrViceVersa(enemyColor, 1),
        })
        boxMaterialInner = new THREE.MeshStandardMaterial({
            color: convertHexValueToRGBOrViceVersa(pickContrastingColor(enemyColor), 1),
            roughness: 0,
            shininess: 2,
            side: THREE.DoubleSide
        })
    }

    const diceMesh = new THREE.Group();
    const innerMesh = new THREE.Mesh(createInnerGeometry(), boxMaterialInner);
    const outerMesh = new THREE.Mesh(createBoxGeometry(), boxMaterialOuter);
    outerMesh.castShadow = true;
    diceMesh.add(innerMesh, outerMesh);

    return diceMesh;
}

function createDice() {
    const mesh = diceMesh.clone();
    scene.add(mesh);

    const body = new CANNON.Body({
        mass: 1,
        shape: new CANNON.Box(new CANNON.Vec3(.3, .3, .5)),
        sleepTimeLimit: .1
    });
    physicsWorld.addBody(body);

    return {mesh, body};
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

function addDiceEvents(dice, id) {
    dice.body.addEventListener('sleep', (e) => {

        dice.body.allowSleep = false;

        const euler = new CANNON.Vec3();
        e.target.quaternion.toEuler(euler);

        const eps = .5;
        let isZero = (angle) => Math.abs(angle) < eps;
        let isHalfPi = (angle) => Math.abs(angle - .5 * Math.PI) < eps;
        let isMinusHalfPi = (angle) => Math.abs(.5 * Math.PI + angle) < eps;
        let isPiOrMinusPi = (angle) => (Math.abs(Math.PI - angle) < eps || Math.abs(Math.PI + angle) < eps);


        if (isZero(euler.z)) {
            if (isZero(euler.x)) {
                showRollResults(1, id);
            } else if (isHalfPi(euler.x)) {
                showRollResults(4, id);
            } else if (isMinusHalfPi(euler.x)) {
                showRollResults(3, id);
            } else if (isPiOrMinusPi(euler.x)) {
                showRollResults(6, id);
            } else {
                // landed on edge => wait to fall on side and fire the event again
                dice.body.allowSleep = true;
            }
        } else if (isHalfPi(euler.z)) {
            showRollResults(2, id);
        } else if (isMinusHalfPi(euler.z)) {
            showRollResults(5, id);
        } else {
            // landed on edge => wait to fall on side and fire the event again
            dice.body.allowSleep = true;
        }
    });
}

function showRollResults(score, id) {
    if (scoreResultArray[0] === 0 && scoreResultArray[1] === 0) {
        id === 0 ? scoreResultArray[0] = score : scoreResultArray[1] = score;
    } else {
        if (id === 0 && scoreResultArray[0] === 0) {
            scoreResultArray[0] = score;
        }
        if (id === 1 && scoreResultArray[1] === 0) {
            scoreResultArray[1] = score;
        }
        diceAnimationFinished = true;
    }
}

function render() {
    physicsWorld.fixedStep();

    for (const dice of diceArray) {
        dice.mesh.position.copy(dice.body.position)
        dice.mesh.quaternion.copy(dice.body.quaternion)
    }

    renderer.render(scene, camera);
    requestAnimationFrame(render);
}

function throwDice() {
    scoreResult.innerHTML = '';

    diceArray.forEach((d, dIdx) => {

        d.body.velocity.setZero();
        d.body.angularVelocity.setZero();

        d.body.position = new CANNON.Vec3(6, dIdx * 1.5, 0);
        d.mesh.position.copy(d.body.position);

        d.mesh.rotation.set(2 * Math.PI * Math.random(), 0, 2 * Math.PI * Math.random())
        d.body.quaternion.copy(d.mesh.quaternion);

        const force = 3 + 5 * Math.random();
        d.body.applyImpulse(
            new CANNON.Vec3(-force, force, 0),
            new CANNON.Vec3(0, 0, .3)
        );

        d.body.allowSleep = true;
    });
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
    const canvasContainer = document.getElementById("threeCanvasForDice");
    const canvasElement = document.getElementById("canvas");
    if (canvasElement) {
        canvasContainer.removeChild(canvasElement);
    }
}

function createCanvas() {
    const canvasContainer = document.getElementById("threeCanvasForDice");
    const newCanvas = document.createElement("canvas");
    newCanvas.id = "canvas";
    canvasContainer.appendChild(newCanvas);
    canvasEl = newCanvas;
}