// The spectator log's country filter, as a rule rather than as an event handler.
//
// Separate from `AiGameConsole.js` for the same reason `deriveMoveButtonState()` is
// separate from the move button and `describeActivity()` from the activity feed: the
// judgement is in the rule and the DOM is not. What counts as a match, and when a
// filter counts at all, are decisions worth holding still in a unit test; showing and
// hiding rows is not.
//
// The rule is three sentences.
//
// **Fewer than three characters is no filter.** Two characters match half the map --
// "an" is in Canada, France, Germany, Iran, Poland, Thailand and eighty more -- so a
// filter that took effect at one or two would flicker the whole log away and back on
// the way to a real search. Three is where a country's name starts to mean something,
// and it is also what makes clearing the field the way to get everything back: an
// empty string is simply below the threshold, not a special case.
//
// **A match is a substring, anywhere, ignoring case.** "rus" finds Russia, Belarus and
// Cyprus, and that is wanted -- somebody watching a border does not know in advance
// which of the two names they half-remember is the one in the log.
//
// **Matching is on the country alone.** Not on the leader, the posture or the text of
// the report: a filter that also matched the body would show France because Spain was
// mentioned in its plan, which is the opposite of narrowing.

/** How short a filter is ignored. See the note above. */
export const MIN_FILTER_LENGTH = 3;

/**
 * The stored form of what was typed: trimmed and lower-cased.
 *
 * Normalising once, here, is what lets `matchesCountryFilter()` be a plain
 * `includes()` rather than a case fold per row per keystroke.
 */
export function normaliseFilter(text) {
    return String(text ?? "").trim().toLowerCase();
}

/** Is a normalised filter long enough to take effect? */
export function filterIsActive(normalised) {
    return normaliseFilter(normalised).length >= MIN_FILTER_LENGTH;
}

/**
 * Does this country pass the filter?
 *
 * @param {string} country     a `dataName`, as stored on a log block
 * @param {string} normalised  the filter, already through `normaliseFilter()`
 */
export function matchesCountryFilter(country, normalised) {
    // Normalised again rather than trusted. The console does normalise once at the
    // keystroke -- but a comparison that silently answers "no match" when handed the
    // raw text is the kind of asymmetry that survives review and then explains a
    // filter that "only works sometimes".
    const filter = normaliseFilter(normalised);
    if (filter.length < MIN_FILTER_LENGTH) return true;
    return String(country ?? "").toLowerCase().includes(filter);
}
