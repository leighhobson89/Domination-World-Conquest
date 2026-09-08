// The cloud artwork, generated once into a texture rather than drawn by the browser every frame.
//
// The obvious way to make clouds in SVG is `feTurbulence`, and it is the wrong way here. A
// filter is re-rasterised by the renderer, the map is a full-screen document that pans and
// zooms, and the blanket forms have to be several hundred user units across -- so the browser
// would be regenerating fractal noise over a large area on a layer that is moving. Baking the
// same noise into an `<image>` once costs a few milliseconds at startup and reduces every later
// frame to a translate, which is the cheapest thing a compositor does.
//
// It is VALUE NOISE and not Perlin, because the difference is invisible at this scale and value
// noise is a dozen lines. Several octaves are summed with halving amplitude, which is what turns
// a smooth blur into something with the self-similar detail that reads as weather.
//
// **THE ALPHA IS SHAPED TWICE AND BOTH MATTER.** A threshold curve turns a continuous field into
// distinct cloud masses with clear sky between them -- without it the whole texture is a uniform
// haze. Then a radial falloff takes the alpha to zero at the edges, which is what lets a handful
// of these be scattered over the world as separate weather systems: a texture with a hard edge
// would show its own rectangle the moment it was placed on the map.
//
// **WHITE AND SILVER, not white and grey.** Leigh asked for silver, and the difference is a
// blue cast: the shaded parts of these run toward `rgb(198, 206, 216)` rather than toward a
// neutral grey, which is what stops a cloud over the ocean reading as dirt on the screen.
//
// Pure apart from the canvas it draws into, and it takes its randomness as an argument so the
// caller can keep it off the game's seeded stream -- a cloud is decoration, and anything
// decorative drawing from `Math.random` would make two runs of one seed diverge.

/** The texture is square and tiles nothing: it is one soft-edged mass with transparent corners. */
export const CLOUD_TEXTURE_SIZE = 256;

/** How many octaves of noise are summed. Four is where extra detail stops being visible. */
const OCTAVES = 4;

/** The lattice of the first octave. Higher means smaller, busier forms. */
const BASE_LATTICE = 4;

/** Below this the field is clear sky; above it, cloud. The knob that makes masses rather than haze. */
const CLOUD_FLOOR = 0.36;

/** Where the field is fully opaque cloud. Between the two the alpha ramps. */
const CLOUD_CEILING = 0.66;

/**
 * How far out the mass stays at full strength before the edge fade begins, as a fraction of the
 * radius.
 *
 * **A PLATEAU AND NOT A CONE.** The first version faded from the very centre, which is the
 * obvious way to hide a texture's rectangle and dims the whole thing on the way: over half the
 * pixels came out at less than half strength and the weather read as a faint smudge rather than
 * as cloud. Holding full strength across the middle and spending the outer third on the fade
 * gives a mass with a body and an edge you still cannot see.
 */
const EDGE_PLATEAU = 0.62;

/** The lit face of a cloud. */
const CLOUD_LIT = [255, 255, 255];

/** Its shaded side: silver, which is a blue cast rather than a neutral grey. */
const CLOUD_SHADE = [198, 206, 216];

/** A lattice of random values, wrapping, so the field has no seam. */
function lattice(size, random) {
    const values = new Float32Array(size * size);
    for (let index = 0; index < values.length; index++) {
        values[index] = random();
    }
    return { size, values };
}

function sampleLattice({ size, values }, x, y) {
    //Bilinear between four lattice points, with a smoothstep on the fraction -- linear
    //interpolation alone leaves visible creases along the lattice lines.
    const gx = x * size;
    const gy = y * size;
    const x0 = Math.floor(gx);
    const y0 = Math.floor(gy);
    const fx = gx - x0;
    const fy = gy - y0;
    const sx = fx * fx * (3 - 2 * fx);
    const sy = fy * fy * (3 - 2 * fy);
    const at = (ix, iy) =>
        values[(((iy % size) + size) % size) * size + (((ix % size) + size) % size)];

    const top = at(x0, y0) * (1 - sx) + at(x0 + 1, y0) * sx;
    const bottom = at(x0, y0 + 1) * (1 - sx) + at(x0 + 1, y0 + 1) * sx;
    return top * (1 - sy) + bottom * sy;
}

/**
 * A field of summed octaves at (x, y), both in 0..1. Returns roughly 0..1.
 */
function fractalNoise(octaves, x, y) {
    let total = 0;
    let amplitude = 1;
    let sum = 0;
    for (let index = 0; index < octaves.length; index++) {
        total += sampleLattice(octaves[index], x, y) * amplitude;
        sum += amplitude;
        amplitude /= 2;
    }
    return total / sum;
}

const clamp01 = (value) => Math.min(1, Math.max(0, value));

/**
 * One cloud texture, as a data URL.
 *
 * @param {() => number} random  the source of randomness -- pass `cosmeticRandom`, never
 *        `Math.random`, or the clouds move every seeded outcome in the game
 * @param {object} [options]
 * @param {number} [options.stretch]  how much wider than tall the forms are. Above 1 the noise
 *        is squashed horizontally before sampling, which shears the masses into the banded,
 *        streaked shapes a weather system has rather than the round puffs a fair-weather sky has
 * @param {number} [options.softness]  0..1; higher pushes the alpha ramp wider, giving thinner,
 *        wispier cloud
 * @returns {string} a `data:image/png` URL, or "" where there is no canvas (Node, a test)
 */
export function cloudTextureUrl(random, { stretch = 1, softness = 0 } = {}) {
    if (typeof document === "undefined") {
        return "";
    }
    const canvas = document.createElement("canvas");
    canvas.width = CLOUD_TEXTURE_SIZE;
    canvas.height = CLOUD_TEXTURE_SIZE;
    const context = canvas.getContext("2d");
    if (!context) {
        return "";
    }

    const octaves = [];
    for (let index = 0; index < OCTAVES; index++) {
        octaves.push(lattice(BASE_LATTICE * Math.pow(2, index), random));
    }

    const image = context.createImageData(CLOUD_TEXTURE_SIZE, CLOUD_TEXTURE_SIZE);
    const floor = CLOUD_FLOOR - softness * 0.12;
    const ceiling = CLOUD_CEILING + softness * 0.15;

    for (let y = 0; y < CLOUD_TEXTURE_SIZE; y++) {
        for (let x = 0; x < CLOUD_TEXTURE_SIZE; x++) {
            const u = x / CLOUD_TEXTURE_SIZE;
            const v = y / CLOUD_TEXTURE_SIZE;
            const field = fractalNoise(octaves, u / stretch, v);

            //The mass: clear below the floor, solid above the ceiling, a ramp between.
            let alpha = clamp01((field - floor) / (ceiling - floor));

            //THE SOFT EDGE. Without this the texture shows its own rectangle wherever it is
            //placed. Full strength inside the plateau, then a smoothstep to nothing at the rim.
            const dx = (u - 0.5) * 2;
            const dy = (v - 0.5) * 2;
            const radius = Math.sqrt(dx * dx + dy * dy);
            const fade = clamp01((1 - radius) / (1 - EDGE_PLATEAU));
            alpha *= fade * fade * (3 - 2 * fade);

            //Shading from the field itself: the densest parts read as lit, the thin parts as
            //the silver underside. Cheap, and it is what stops the mass looking like a decal.
            const lit = clamp01((field - floor) / Math.max(0.001, 1 - floor));
            const offset = (y * CLOUD_TEXTURE_SIZE + x) * 4;
            for (let channel = 0; channel < 3; channel++) {
                image.data[offset + channel] = Math.round(
                    CLOUD_SHADE[channel] + (CLOUD_LIT[channel] - CLOUD_SHADE[channel]) * lit
                );
            }
            image.data[offset + 3] = Math.round(alpha * 255);
        }
    }

    context.putImageData(image, 0, 0);
    return canvas.toDataURL("image/png");
}
