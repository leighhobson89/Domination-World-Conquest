// The step multiplier on an army-allocation cell: All, x1, x10, x100, x1k, x10k.
//
// Phase 6.5. The mapping between the label the player sees and the number the plus
// and minus buttons step by was written out six times inside
// `drawAndHandleTransferAttackTable()` -- twice as a parse (`"x1k"` to 1000), four
// times as a six-branch `if` chain writing the label back. They were not quite
// copies: two of the four handled `"All"` and two did not, so a cell stepped down
// from `All` showed a stale label in one mode and not the other.
//
// One table, read in both directions.

/** Cycle order, which is what the cycler button walks. `All` is first. */
export const MULTIPLE_LABELS = ["All", "x1", "x10", "x100", "x1k", "x10k"];

/**
 * "All" as a number.
 *
 * It is a sentinel, not a quantity: the plus button tests for exactly this value and
 * fills the cell with the territory's whole holding of that unit type instead of
 * adding. 100,000,000 is larger than any army the game can produce.
 */
export const ALL = 100000000;

const VALUE_BY_LABEL = new Map([
    ["All", ALL],
    ["x1", 1],
    ["x10", 10],
    ["x100", 100],
    ["x1k", 1000],
    ["x10k", 10000]
]);

const LABEL_BY_VALUE = new Map([...VALUE_BY_LABEL].map(([label, value]) => [value, label]));

/** The next label in the cycle, wrapping round. */
export function nextMultipleLabel(currentLabel) {
    const index = MULTIPLE_LABELS.indexOf(currentLabel);
    return MULTIPLE_LABELS[(index + 1) % MULTIPLE_LABELS.length];
}

/** The number a label steps by. Unknown labels fall back to 1, never to NaN. */
export function multipleValueOf(label) {
    return VALUE_BY_LABEL.get(label) ?? 1;
}

/**
 * The label for a number, or `null` when there is none.
 *
 * The minus button divides the multiplier down and can land on a value that has no
 * label -- 100000 is reachable. Returning null lets the caller leave the box alone,
 * which is what the original `if` chains did by falling off the end.
 */
export function multipleLabelOf(value) {
    return LABEL_BY_VALUE.get(value) ?? null;
}

/** Write `value`'s label into a multiple text box, if it has one. */
export function showMultiple(textBox, value) {
    const label = multipleLabelOf(value);
    if (label !== null) {
        textBox.value = label;
    }
}
