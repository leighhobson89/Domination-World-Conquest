// Weather over the world.
//
// Leigh's brief, and it has two halves that are two different pictures: *"white and silver
// clouds that drift across the map, looking half like puffy white clouds if zoomed in and half
// like satellite image cloud blankets if zoomed out ... when puffy it should be animating their
// movement with little shadows on the ground; when zoomed out it should be less obvious that
// they are moving, storm systems slowly evolving. Zoomed in, cartoony single clouds drifting all
// in one direction, but that direction can change per minute or so."*
//
// So there are TWO LAYERS and the zoom cross-fades between them, rather than one layer that
// tries to be both. Below zoom ~2 the sky is weather systems -- big soft masses that barely
// move and slowly change shape. Above zoom ~4 it is individual cartoon clouds with shadows on
// the ground beneath them. Between the two they are both present at part strength, which is the
// "half and half" the brief asks for and also the only way to make the change of scale
// invisible: a hard switch at one zoom notch would read as a rendering fault.
//
// **THE CLOUDS ARE THE ONE THING ON THIS MAP MEASURED IN USER UNITS, AND THAT IS DELIBERATE.**
// Every other overlay -- the force figures, the flags, the threatened borders, every stroke --
// is sized in SCREEN pixels and re-applied on a zoom, because a label is a piece of chrome and
// should not be magnified with the land. A cloud is the opposite: it is an object sitting over
// the world, so it MUST magnify with the world, or zooming in would fly you toward the ground
// while the sky stayed the same size. Nothing here subscribes to the zoom in order to resize.
//
// **THE PER-FRAME WORK IS CSS AND THE SHARED STATE IS JAVASCRIPT**, which is the split Leigh
// asked for (*"css is a good option for the clouds and anims too"*). The cycles -- a mass
// swelling and fading, a puff bobbing and breathing -- are `@keyframes`, so they run off the
// main thread, need no frame budget, and stay in step with nothing. The DRIFT is JavaScript,
// because it is not a cycle: it wraps around the edges of the world, it is shared by every
// cloud, and its heading changes every minute or so and has to ease from the old one to the new.
// Expressing that in CSS would mean rewriting keyframes at runtime and losing each cloud's
// position every time the wind changed.
//
// The two never fight over one attribute: **JavaScript owns the outer group's `transform` and
// CSS owns the inner element's.** That is why every cloud is a group inside a group.
//
// **A `<style>` INJECTED INTO THE MAP DOCUMENT IS ALLOWED HERE, AND `attackArrows.js` REFUSED
// IT FOR A REASON THAT DOES NOT APPLY.** The arrows' objection was that a band's travel is a
// per-arrow distance -- every arrow is a different length -- so it could not have been one
// keyframes rule anyway, and a stylesheet in a foreign document would have been a second place
// to look for one arrow's timing. Clouds are the opposite case: a handful of cycles shared by
// every cloud on the map, which is precisely what a keyframes rule is for. The whole of it is
// the one string below, so there is still exactly one place to look.
//
// **NOTHING HERE MAY DRAW FROM `Math.random`.** Clouds are decoration, and a decorative draw on
// the game's seeded stream makes two runs of one seed diverge -- the lesson
// `addSparklesRegularly()` left behind. Everything random here comes from `cosmeticRandom()`.

import { attachOverlayLayers, overlayGroup, removeOverlayGroup } from "./overlayLayers.js";
import { cloudTextureUrl } from "./cloudTexture.js";
import { cosmeticRandom } from "../../platform/cosmeticRng.js";
import { currentZoomLevel, onZoomChanged, worldBounds } from "./camera.js";
import { ids } from "../core/registry.js";

const SVG_NS = "http://www.w3.org/2000/svg";

/** The three states the button walks: full, half strength, gone. Default is full. */
export const CLOUD_MODES = Object.freeze({ FULL: "full", HALF: "half", OFF: "off" });

const CLOUD_MODE_CYCLE = Object.freeze([CLOUD_MODES.FULL, CLOUD_MODES.HALF, CLOUD_MODES.OFF]);

/** What each mode is worth as an opacity on the whole sky. */
const MODE_OPACITY = Object.freeze({
    [CLOUD_MODES.FULL]: 1,
    [CLOUD_MODES.HALF]: 0.45,
    [CLOUD_MODES.OFF]: 0
});

/** How many weather systems the world carries at once. */
const WEATHER_COUNT = 13;

/**
 * How many individual clouds.
 *
 * **THE NUMBER IS SET BY THE ZOOM, NOT BY THE WORLD.** The puffs are only on screen from about
 * zoom 3 upwards, where the camera shows between a ninth and a thirty-sixth of the map -- so a
 * count that looks generous spread over the whole world puts UNDER ONE cloud in front of the
 * player. Measured with 26: a zoomed-in view of West Africa had exactly one cloud in it. At 120
 * a zoomed-in view carries three to eight, which is a sky rather than a curiosity.
 *
 * The cost is bounded by what happens per frame, and that is one `transform` per cloud and per
 * shadow -- the lobes inside never move, because their bob is a CSS keyframe. The band is also
 * taken out of the document entirely while it is invisible, so the zoomed-out map pays nothing
 * at all for them.
 *
 * The arithmetic, since it will need redoing if the zoom range changes: the puffs are spread
 * over the world plus their own margin, about 2.6 million square units; zoom 6 shows 389 x 208,
 * which is 3% of it. Two hundred clouds therefore put six or so in front of the player at full
 * zoom and about twenty at zoom 4, where each is a third of the size on screen.
 */
const PUFF_COUNT = 200;

/** A weather system's width, in map user units. The world is 1947 across. */
const WEATHER_MIN_SIZE = 320;
const WEATHER_MAX_SIZE = 760;

/** A single cloud's width, in user units. At zoom 4-6 this is a comfortable puff on screen. */
const PUFF_MIN_SIZE = 26;
const PUFF_MAX_SIZE = 68;

/** User units a second. A weather system barely moves; a cloud is visibly travelling. */
const WEATHER_SPEED = 0.9;
const PUFF_SPEED = 5.5;

/**
 * The zoom range each layer lives in.
 *
 * They OVERLAP, between 2.4 and 3.4, which is what makes the transition a cross-fade rather
 * than a switch. Outside the overlap exactly one of the two is on screen.
 */
const WEATHER_FADE = { full: 2.4, gone: 3.4 };
const PUFF_FADE = { gone: 2.4, full: 3.4 };

/** How often the wind picks a new heading, in milliseconds -- "per minute or so". */
const WIND_CHANGE_MS = 62_000;
const WIND_CHANGE_JITTER_MS = 26_000;

/** How fast the heading eases toward a new one, in radians a second. Roughly ten seconds a turn. */
const WIND_TURN_RATE = 0.08;

/** The frame budget. Sixty writes of a transform is nothing; doing it 120 times a second is waste. */
const FRAME_MS = 33;

/**
 * How far past the edge of the world a cloud travels before it wraps back.
 *
 * One per kind, and the difference matters for a reason that is not about looks: the margin is
 * dead space as far as density goes, so a margin sized for a 760-unit weather system spreads the
 * 68-unit puffs over half again as much sky as they need and thins them out everywhere. Each is
 * a little over the largest cloud of its kind, which is all that is needed to keep the wrap
 * itself off screen.
 */
const WEATHER_WRAP_MARGIN = 420;
const PUFF_WRAP_MARGIN = 90;

/**
 * The stylesheet, injected into the map's own document.
 *
 * Every cycle in the sky is here and nowhere else. `transform-box: fill-box` is what makes
 * `transform-origin: center` mean the element's own middle in an SVG -- without it the origin is
 * the user-space origin, which is off the top-left corner of the world, and a scale becomes a
 * fling across the map.
 */
const CLOUD_CSS = `
.cloud-sky { transition: opacity 420ms ease; }
.cloud-band { transition: opacity 320ms ease; }
.cloud-art { transform-box: fill-box; transform-origin: center; will-change: transform, opacity; }

.cloud-mass .cloud-art {
    animation: cloud-evolve var(--cycle) ease-in-out var(--phase) infinite alternate;
}
@keyframes cloud-evolve {
    from { transform: scale(1) rotate(0deg); opacity: 0.78; }
    to   { transform: scale(1.16) rotate(4deg); opacity: 1; }
}

.cloud-puff .cloud-art, .cloud-shadow .cloud-art {
    animation: cloud-bob var(--cycle) ease-in-out var(--phase) infinite alternate;
}
@keyframes cloud-bob {
    from { transform: translateY(0) scale(1); }
    to   { transform: translateY(-3px) scale(1.05); }
}
`;

let mapDocument = null;
let mode = CLOUD_MODES.FULL;
let sky = null;
let weatherBand = null;
let puffBand = null;
let shadowBand = null;
let clouds = [];
let frameHandle = null;
let lastFrameAt = 0;
let stopZoom = null;
const wind = { angle: 0, target: 0, changeAt: 0 };
let textures = [];

/** Point the overlay at the map's contentDocument. Called from `svgMapLoaded()`. */
export function attachCloudOverlay(svgDocument) {
    mapDocument = svgDocument;
    attachOverlayLayers(svgDocument);
}

export function cloudMode() {
    return mode;
}

const between = (low, high) => low + cosmeticRandom() * (high - low);

/** An `<ellipse>` in a puff, or the same shape in a shadow. */
function ellipse(cx, cy, rx, ry, fill) {
    const node = mapDocument.createElementNS(SVG_NS, "ellipse");
    node.setAttribute("cx", String(cx));
    node.setAttribute("cy", String(cy));
    node.setAttribute("rx", String(rx));
    node.setAttribute("ry", String(ry));
    node.setAttribute("fill", fill);
    return node;
}

/**
 * The lobes one cloud is made of: a flat base with overlapping domes rising from it.
 *
 * Decided once and drawn twice -- once for the cloud and once for its shadow -- so the shadow is
 * the same shape as the thing casting it rather than a second cloud that happens to be beneath
 * it. That is why this is separate from `buildPuff()` and returns numbers rather than elements.
 *
 * The base sits on `y = 0` and the lobes rise above it, which is what makes it read as a cloud
 * rather than as a cluster of circles: real cumulus has a flat bottom where the air stops
 * rising, and cartoon clouds keep that.
 */
function puffLobes(size) {
    const lobes = [{ cx: 0, cy: 0, rx: size / 2 * 0.98, ry: size * 0.16, base: true }];
    const count = 4 + Math.floor(cosmeticRandom() * 3);

    for (let index = 0; index < count; index++) {
        //Spread across the base, biggest in the middle -- a cloud with its tallest lobe at one
        //end reads as a wave rather than as weather.
        const position = (index + 0.5) / count;
        const fromCentre = Math.abs(position - 0.5) * 2;
        const lobeSize = size * (0.30 - fromCentre * 0.13) * between(0.85, 1.15);
        lobes.push({
            cx: (position - 0.5) * size * 0.86,
            cy: -lobeSize * between(0.35, 0.75),
            rx: lobeSize,
            ry: lobeSize * between(0.72, 0.95),
            base: false
        });
    }
    return lobes;
}

/**
 * A cartoon cloud, in two passes.
 *
 * **ONE PASS WAS NOT ENOUGH, and the reason is worth keeping.** Drawing every lobe with the
 * soft radial gradient gives each lobe its own faded rim -- so where two lobes overlap, and they
 * all overlap, the rim of the one behind shows THROUGH the one in front as a bright arc across
 * its middle. A cloud came out looking like a stack of discs. The halo is drawn first at a
 * little over full size to give the whole silhouette a soft edge, and then the same lobes are
 * drawn SOLID on top, which covers every internal arc: one shape with one rim.
 *
 * The base lobe is silver rather than white on the solid pass -- the underside of a cloud is in
 * its own shade, and it is the cheapest thing that stops a puff reading as a paper cut-out.
 *
 * No blur anywhere: a Gaussian blur is a filter, and a filter on two hundred moving groups is
 * exactly the cost this module exists to avoid.
 */
function buildPuff(lobes, { solid }) {
    const art = mapDocument.createElementNS(SVG_NS, "g");
    art.setAttribute("class", "cloud-art");

    //THE HALO: the same shapes a little larger, in the soft gradient, giving the outer rim.
    for (const lobe of lobes) {
        art.appendChild(ellipse(
            lobe.cx, lobe.cy, lobe.rx * 1.13, lobe.ry * 1.13, "url(#cloudBodyGradient)"
        ));
    }

    //THE BODY: flat fills on top, which is what makes it one shape rather than several.
    if (solid) {
        for (const lobe of lobes) {
            art.appendChild(ellipse(
                lobe.cx, lobe.cy, lobe.rx, lobe.ry,
                lobe.base ? "rgb(228, 234, 244)" : "rgb(255, 255, 255)"
            ));
        }
    }
    return art;
}

/** The gradients both cloud forms are painted with. One `<defs>` for the whole sky. */
function buildDefs() {
    const defs = mapDocument.createElementNS(SVG_NS, "defs");

    //THE CLOUD ITSELF: opaque white through most of the lobe, falling away at the rim. The
    //stop at 62% is what gives a cartoon cloud its body -- a gradient that starts fading at the
    //centre is fog, not a cloud.
    const body = mapDocument.createElementNS(SVG_NS, "radialGradient");
    body.setAttribute("id", "cloudBodyGradient");
    for (const [offset, colour, opacity] of [
        ["0%", "rgb(255, 255, 255)", "1"],
        //THE CORE HAS TO BE BIG FOR A CARTOON CLOUD. At 62% the lobes came out airbrushed --
        //soft all the way through, which is what a fog bank looks like. Holding full white to
        //four fifths of the radius and spending the last fifth on the rim gives the crisp,
        //solid, slightly soft-edged shape the brief asks for.
        ["80%", "rgb(252, 253, 255)", "1"],
        ["92%", "rgb(230, 236, 245)", "0.82"],
        ["100%", "rgb(206, 214, 228)", "0"]
    ]) {
        const stop = mapDocument.createElementNS(SVG_NS, "stop");
        stop.setAttribute("offset", offset);
        stop.setAttribute("stop-color", colour);
        stop.setAttribute("stop-opacity", opacity);
        body.appendChild(stop);
    }
    defs.appendChild(body);

    //THE SHADOW ON THE GROUND: soft to the edge, and never black. A black shadow over ocean
    //reads as a hole in the map; a desaturated blue-grey reads as shade.
    const shadow = mapDocument.createElementNS(SVG_NS, "radialGradient");
    shadow.setAttribute("id", "cloudShadowGradient");
    for (const [offset, opacity] of [["0%", "0.20"], ["55%", "0.13"], ["100%", "0"]]) {
        const stop = mapDocument.createElementNS(SVG_NS, "stop");
        stop.setAttribute("offset", offset);
        stop.setAttribute("stop-color", "rgb(38, 48, 66)");
        stop.setAttribute("stop-opacity", opacity);
        shadow.appendChild(stop);
    }
    defs.appendChild(shadow);

    return defs;
}

/** A band is one of the three groups the sky is made of, so each can be faded on its own. */
function band(className) {
    const group = mapDocument.createElementNS(SVG_NS, "g");
    group.setAttribute("class", `cloud-band ${className}`);
    return group;
}

/**
 * Build the sky.
 *
 * Everything is created once and then only ever moved. The textures are generated once for the
 * life of the page and shared between the masses -- three variants is enough that no two
 * neighbouring systems look like the same picture, and each is placed at its own scale and
 * rotation on top of that.
 */
function buildSky() {
    const layer = overlayGroup("clouds", ids.cloudLayer);
    if (!layer) {
        return false;
    }
    layer.textContent = "";
    layer.setAttribute("class", "cloud-sky");

    const style = mapDocument.createElementNS(SVG_NS, "style");
    style.textContent = CLOUD_CSS;
    layer.appendChild(style);
    layer.appendChild(buildDefs());

    if (textures.length === 0) {
        textures = [
            cloudTextureUrl(cosmeticRandom, { stretch: 1.9, softness: 0.1 }),
            cloudTextureUrl(cosmeticRandom, { stretch: 2.6, softness: 0.35 }),
            cloudTextureUrl(cosmeticRandom, { stretch: 1.4, softness: 0 })
        ].filter(Boolean);
    }

    weatherBand = band("cloud-weather");
    shadowBand = band("cloud-shadows");
    puffBand = band("cloud-puffs");
    //SHADOWS UNDER THE CLOUDS, and the weather masses under both: a mass is the sky seen from
    //orbit and a puff is a cloud seen from below, so where they overlap during the cross-fade
    //the nearer thing belongs on top.
    layer.appendChild(weatherBand);
    layer.appendChild(shadowBand);
    layer.appendChild(puffBand);

    const world = worldBounds();
    clouds = [];

    for (let index = 0; index < WEATHER_COUNT && textures.length > 0; index++) {
        const size = between(WEATHER_MIN_SIZE, WEATHER_MAX_SIZE);
        const group = mapDocument.createElementNS(SVG_NS, "g");
        group.setAttribute("class", "cloud-mass");

        const art = mapDocument.createElementNS(SVG_NS, "image");
        art.setAttribute("class", "cloud-art");
        art.setAttribute("href", textures[index % textures.length]);
        art.setAttribute("x", String(-size / 2));
        art.setAttribute("y", String(-size / 2 / 1.7));
        art.setAttribute("width", String(size));
        //Squashed vertically: weather systems on a world map are wider than they are tall,
        //because that is what a band of latitude does to them.
        art.setAttribute("height", String(size / 1.7));
        art.setAttribute("preserveAspectRatio", "none");
        //A long cycle and a random phase, so eight masses never breathe together.
        art.setAttribute("style",
            `--cycle: ${between(34, 62).toFixed(1)}s; --phase: -${between(0, 40).toFixed(1)}s`);
        group.appendChild(art);
        weatherBand.appendChild(group);

        clouds.push(place({
            group,
            margin: WEATHER_WRAP_MARGIN,
            //Each system drifts a little off the prevailing wind, so the sky does not move as
            //one rigid sheet -- which is the single thing that most makes weather look fake.
            drift: between(-0.5, 0.5),
            speed: WEATHER_SPEED * between(0.6, 1.4),
            shadow: null,
            offsetX: 0,
            offsetY: 0
        }, world));
    }

    for (let index = 0; index < PUFF_COUNT; index++) {
        const size = between(PUFF_MIN_SIZE, PUFF_MAX_SIZE);
        const cycle = between(7, 14).toFixed(1);
        const phase = between(0, 12).toFixed(1);

        //THE SHAPE IS DRAWN ONCE AND USED TWICE. `puffLobes()` makes its choices with
        //`cosmeticRandom()`, so calling it a second time for the shadow would give the cloud a
        //shadow of a DIFFERENT cloud -- which is exactly the sort of thing nobody spots as a
        //fault and everybody feels as wrongness.
        const lobes = puffLobes(size);

        const group = mapDocument.createElementNS(SVG_NS, "g");
        group.setAttribute("class", "cloud-puff");
        const art = buildPuff(lobes, { solid: true });
        art.setAttribute("style", `--cycle: ${cycle}s; --phase: -${phase}s`);
        group.appendChild(art);
        puffBand.appendChild(group);

        //THE SHADOW IS ITS OWN GROUP IN ITS OWN BAND, not a child of the cloud: it belongs on
        //the ground, so it must be under every cloud rather than under its own one only. It is
        //rebuilt from the same numbers rather than cloned, because a clone would carry the
        //body gradient with it.
        const shadowGroup = mapDocument.createElementNS(SVG_NS, "g");
        shadowGroup.setAttribute("class", "cloud-shadow");
        //A SHADOW IS SOFT ALL THE WAY THROUGH, so it gets the halo pass and no solid body: an
        //edge that sharp on the ground would read as a second object rather than as shade.
        const shadowArt = buildPuff(lobes, { solid: false });
        shadowArt.querySelectorAll("ellipse").forEach(
            node => node.setAttribute("fill", "url(#cloudShadowGradient)"));
        shadowArt.setAttribute("style", `--cycle: ${cycle}s; --phase: -${phase}s`);
        shadowGroup.appendChild(shadowArt);
        shadowBand.appendChild(shadowGroup);

        clouds.push(place({
            group,
            shadow: shadowGroup,
            margin: PUFF_WRAP_MARGIN,
            drift: between(-0.12, 0.12),
            //PARALLAX. A bigger cloud is nearer, so it crosses the view faster -- the cheapest
            //possible suggestion that the sky has depth in it.
            speed: PUFF_SPEED * (0.55 + (size - PUFF_MIN_SIZE) / (PUFF_MAX_SIZE - PUFF_MIN_SIZE)),
            //The sun is up and to the left, so shade falls down and to the right of everything.
            offsetX: size * 0.30,
            offsetY: size * 0.42
        }, world));
    }

    sky = layer;
    return true;
}

/**
 * Scatter one cloud over the world and write its first transform.
 *
 * **THE FIRST TRANSFORM IS WRITTEN HERE AND NOT LEFT TO THE LOOP.** The drift skips any band
 * that is not being drawn, so a puff built while the map is zoomed out would sit at the user-space
 * origin until the frame after the band became visible -- a flicker of two hundred clouds stacked
 * in one place, at the one moment the player is looking for them.
 */
function place(cloud, world) {
    const margin = cloud.margin;
    cloud.x = between(world.x - margin, world.x + world.width + margin);
    cloud.y = between(world.y - margin / 2, world.y + world.height + margin / 2);
    cloud.group.setAttribute("transform", `translate(${cloud.x.toFixed(1)} ${cloud.y.toFixed(1)})`);
    cloud.shadow?.setAttribute("transform",
        `translate(${(cloud.x + cloud.offsetX).toFixed(1)} ${(cloud.y + cloud.offsetY).toFixed(1)})`);
    return cloud;
}

const clamp01 = (value) => Math.min(1, Math.max(0, value));

/**
 * A band's opacity, and `display: none` once it reaches nothing.
 *
 * **THE DISPLAY TOGGLE IS THE POINT.** There are a hundred and twenty puffs and as many
 * shadows, and at zoom 1 not one of them is visible -- but an `opacity: 0` group is still a
 * group the renderer walks, and the drift loop was still writing a transform to every one of
 * them. Taking the band out of the layout entirely is what makes the zoomed-out map cost
 * nothing for a layer it is not showing.
 */
function setBandOpacity(group, value) {
    if (!group) {
        return;
    }
    group.setAttribute("opacity", String(value));
    group.style.display = value <= 0.001 ? "none" : "";
}

/** Fade the two forms in and out of one another as the camera comes down. */
function applyZoomBlend() {
    if (!weatherBand) {
        return;
    }
    const zoom = currentZoomLevel();
    const weather = clamp01((WEATHER_FADE.gone - zoom) / (WEATHER_FADE.gone - WEATHER_FADE.full));
    const puff = clamp01((zoom - PUFF_FADE.gone) / (PUFF_FADE.full - PUFF_FADE.gone));
    setBandOpacity(weatherBand, weather);
    setBandOpacity(puffBand, puff);
    //The shadow is fainter than the cloud that casts it, always.
    setBandOpacity(shadowBand, puff * 0.85);
}

/** Move everything, once. `elapsed` is in seconds. */
function drift(elapsed) {
    const now = Date.now();
    if (now >= wind.changeAt) {
        //A NEW HEADING, not a new wind: the angle eases toward it over several seconds in the
        //loop below, so the sky turns rather than jumping.
        wind.target = cosmeticRandom() * Math.PI * 2;
        wind.changeAt = now + WIND_CHANGE_MS + cosmeticRandom() * WIND_CHANGE_JITTER_MS;
    }
    //Turn the short way round, which is what stops a heading of 350 degrees taking the long
    //route to 10 degrees and sweeping the whole sky backwards on the way.
    let delta = wind.target - wind.angle;
    while (delta > Math.PI) {
        delta -= Math.PI * 2;
    }
    while (delta < -Math.PI) {
        delta += Math.PI * 2;
    }
    wind.angle += Math.max(-WIND_TURN_RATE * elapsed, Math.min(WIND_TURN_RATE * elapsed, delta));

    const world = worldBounds();
    const puffsHidden = puffBand?.style.display === "none";
    const weatherHidden = weatherBand?.style.display === "none";

    for (const cloud of clouds) {
        //A cloud in a band that is not being drawn still needs its POSITION advanced -- it must
        //be where it would have been when the band fades back in -- but writing the transform
        //is pure waste, and at 120 puffs it is the bulk of the frame.
        const hidden = cloud.shadow ? puffsHidden : weatherHidden;
        const angle = wind.angle + cloud.drift;
        cloud.x += Math.cos(angle) * cloud.speed * elapsed;
        cloud.y += Math.sin(angle) * cloud.speed * elapsed;

        //Wrap rather than respawn: a cloud that vanished and reappeared elsewhere would be seen
        //doing it at the edges of a zoomed-out view, where the whole world is on screen.
        const minX = world.x - cloud.margin;
        const spanX = world.width + cloud.margin * 2;
        const minY = world.y - cloud.margin / 2;
        const spanY = world.height + cloud.margin;
        cloud.x = minX + (((cloud.x - minX) % spanX) + spanX) % spanX;
        cloud.y = minY + (((cloud.y - minY) % spanY) + spanY) % spanY;

        if (hidden) {
            continue;
        }
        cloud.group.setAttribute("transform",
            `translate(${cloud.x.toFixed(1)} ${cloud.y.toFixed(1)})`);
        cloud.shadow?.setAttribute("transform",
            `translate(${(cloud.x + cloud.offsetX).toFixed(1)} ` +
            `${(cloud.y + cloud.offsetY).toFixed(1)})`);
    }
}

function frame(timestamp) {
    frameHandle = null;
    if (mode === CLOUD_MODES.OFF || !sky) {
        return;
    }
    const elapsed = lastFrameAt ? (timestamp - lastFrameAt) / 1000 : 0;
    //A TAB LEFT IN THE BACKGROUND comes back with an enormous delta, which would teleport every
    //cloud. A ceiling on the step is the whole fix.
    if (elapsed > 0) {
        drift(Math.min(elapsed, 0.5));
    }
    lastFrameAt = timestamp;
    schedule();
}

function schedule() {
    if (frameHandle !== null || mode === CLOUD_MODES.OFF || typeof window === "undefined") {
        return;
    }
    if (typeof document !== "undefined" && document.hidden) {
        return;
    }
    frameHandle = window.setTimeout(
        () => window.requestAnimationFrame(frame),
        FRAME_MS
    );
}

function stopLoop() {
    if (frameHandle !== null) {
        window.clearTimeout(frameHandle);
        frameHandle = null;
    }
    lastFrameAt = 0;
}

/**
 * Turn the sky on, halve it, or take it away.
 *
 * OFF removes the whole group rather than hiding it: an overlay that is merely transparent is
 * still an overlay the renderer walks on every frame, and the loop is stopped with it.
 */
export function setCloudMode(next) {
    if (!CLOUD_MODE_CYCLE.includes(next)) {
        return;
    }
    mode = next;

    if (mode === CLOUD_MODES.OFF) {
        stopLoop();
        removeOverlayGroup(ids.cloudLayer);
        sky = weatherBand = puffBand = shadowBand = null;
        clouds = [];
        stopZoom?.();
        stopZoom = null;
        return;
    }

    if (!sky && !buildSky()) {
        return;
    }
    sky.setAttribute("opacity", String(MODE_OPACITY[mode]));
    applyZoomBlend();
    if (!stopZoom) {
        stopZoom = onZoomChanged(applyZoomBlend);
    }
    lastFrameAt = 0;
    schedule();
}

/** One press of the button: full, then half, then off, then back. */
export function cycleCloudMode() {
    const next = CLOUD_MODE_CYCLE[(CLOUD_MODE_CYCLE.indexOf(mode) + 1) % CLOUD_MODE_CYCLE.length];
    setCloudMode(next);
    return next;
}

if (typeof document !== "undefined") {
    //Nothing drifts in a tab nobody is looking at, and the clock is reset on the way back in so
    //the sky picks up where it left off instead of lurching forward by however long you were away.
    document.addEventListener("visibilitychange", () => {
        if (document.hidden) {
            stopLoop();
        } else {
            lastFrameAt = 0;
            schedule();
        }
    });
}
