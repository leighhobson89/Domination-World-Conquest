// The relation rows on the territory tooltip.
//
// Pure, so the wording is pinned here rather than in an e2e spec: no e2e spec in
// this suite asserts prose, and the tooltip is rebuilt dozens of times a second by
// a `mousemove` listener, which is the last place to be discovering a wording bug.
//
// The two rules being defended are Leigh's, and they are deliberately different
// from each other: on your OWN territory the list is everybody you have a relation
// with and no-contact is filtered out; on somebody else's it leads with the state
// between them and YOU, always, even when that state is no contact.

import { describe, expect, it } from "vitest";

import { DiplomaticState } from "../../src/state/diplomacy.js";
import {
    diplomacyTooltipRows,
    TOOLTIP_RELATION_ROWS
} from "../../src/ui/map/diplomacyTooltip.js";

const relation = (country, state, until = null) => ({ country, state, until });

describe("hovering your own territory", () => {
    const input = {
        country: "France",
        playerCountry: "France",
        relations: [
            relation("Spain", DiplomaticState.PEACE),
            relation("Germany", DiplomaticState.WAR),
            relation("Belgium", DiplomaticState.NO_CONTACT)
        ]
    };

    it("lists every country it has a relation with", () => {
        const { rows } = diplomacyTooltipRows(input);
        expect(rows.map((row) => row.country)).toEqual(["Germany", "Spain"]);
    });

    it("leaves out anybody still at no contact", () => {
        //Not a relationship, and a list of the 206 countries you have never met is
        //not a list.
        const { rows } = diplomacyTooltipRows(input);
        expect(rows.some((row) => row.country === "Belgium")).toBe(false);
    });

    it("adds no row about the player, because the player is the one hovering", () => {
        const { rows } = diplomacyTooltipRows(input);
        expect(rows.some((row) => row.isPlayerRow)).toBe(false);
    });
});

describe("hovering somebody else's territory", () => {
    it("leads with the state towards the player", () => {
        const { rows } = diplomacyTooltipRows({
            country: "Germany",
            playerCountry: "France",
            relations: [
                relation("Poland", DiplomaticState.WAR),
                relation("France", DiplomaticState.PEACE)
            ]
        });
        expect(rows[0]).toMatchObject({ country: "France", isPlayerRow: true });
        expect(rows.map((row) => row.country)).toEqual(["France", "Poland"]);
    });

    it("leads with the player even when the two have never met", () => {
        //The row that would otherwise be missing exactly when it is most
        //informative: a country on the far side of the map you cannot reach.
        const { rows } = diplomacyTooltipRows({
            country: "Chile",
            playerCountry: "France",
            relations: [relation("Argentina", DiplomaticState.WAR)]
        });
        expect(rows[0]).toMatchObject({
            country: "France",
            state: DiplomaticState.NO_CONTACT,
            isPlayerRow: true
        });
        expect(rows[0].label).toBe("France — No contact");
    });

    it("does not repeat the player further down the list", () => {
        const { rows } = diplomacyTooltipRows({
            country: "Germany",
            playerCountry: "France",
            relations: [relation("France", DiplomaticState.ALLIANCE)]
        });
        expect(rows.filter((row) => row.country === "France")).toHaveLength(1);
    });

    it("has no player row at all in spectator mode", () => {
        const { rows } = diplomacyTooltipRows({
            country: "Germany",
            playerCountry: null,
            relations: [relation("Poland", DiplomaticState.WAR)]
        });
        expect(rows.map((row) => row.country)).toEqual(["Poland"]);
    });
});

describe("the order and the wording", () => {
    it("puts war first and the alliance last", () => {
        const { rows } = diplomacyTooltipRows({
            country: "France",
            playerCountry: "France",
            relations: [
                relation("Italy", DiplomaticState.ALLIANCE),
                relation("Spain", DiplomaticState.PEACE),
                relation("Poland", DiplomaticState.CEASEFIRE, 30),
                relation("Germany", DiplomaticState.WAR)
            ]
        });
        expect(rows.map((row) => row.state)).toEqual([
            DiplomaticState.WAR,
            DiplomaticState.CEASEFIRE,
            DiplomaticState.PEACE,
            DiplomaticState.ALLIANCE
        ]);
    });

    it("sorts alphabetically inside one state", () => {
        const { rows } = diplomacyTooltipRows({
            country: "France",
            playerCountry: "France",
            relations: [
                relation("Zambia", DiplomaticState.WAR),
                relation("Andorra", DiplomaticState.WAR)
            ]
        });
        expect(rows.map((row) => row.country)).toEqual(["Andorra", "Zambia"]);
    });

    it("says when a ceasefire runs out, because otherwise it reads as a peace", () => {
        const { rows } = diplomacyTooltipRows({
            country: "France",
            playerCountry: "France",
            relations: [relation("Poland", DiplomaticState.CEASEFIRE, 30)]
        });
        expect(rows[0].label).toBe("Poland — Ceasefire until turn 30");
    });

    it("lists a neutral country, because meeting somebody is a relation", () => {
        //Neutral is filtered by nothing: the pair have met, war has simply not been
        //declared. It is no contact -- never having met at all -- that is left out.
        const { rows } = diplomacyTooltipRows({
            country: "France",
            playerCountry: "France",
            relations: [
                relation("Belgium", DiplomaticState.NEUTRAL),
                relation("Germany", DiplomaticState.WAR)
            ]
        });
        expect(rows.map((row) => row.country)).toEqual(["Germany", "Belgium"]);
        expect(rows[1].label).toBe("Belgium — Neutral");
    });

    it("does not dress neutral up as peace", () => {
        //A player who could not tell them apart at a glance would think an
        //undeclared neighbour safe. Peace was agreed; neutral is only the absence of
        //a declaration, so it reads as the quiet state rather than the friendly one.
        const { rows } = diplomacyTooltipRows({
            country: "France",
            playerCountry: "France",
            relations: [
                relation("Belgium", DiplomaticState.NEUTRAL),
                relation("Spain", DiplomaticState.PEACE)
            ]
        });
        const tones = Object.fromEntries(rows.map((row) => [row.country, row.tone]));
        expect(tones).toEqual({ Belgium: "muted", Spain: "friendly" });
    });

    it("gives war, truce and friendship three different tones", () => {
        const { rows } = diplomacyTooltipRows({
            country: "France",
            playerCountry: "France",
            relations: [
                relation("Germany", DiplomaticState.WAR),
                relation("Poland", DiplomaticState.CEASEFIRE, 30),
                relation("Italy", DiplomaticState.ALLIANCE)
            ]
        });
        expect(rows.map((row) => row.tone)).toEqual(["hostile", "caution", "friendly"]);
    });

    it("uses no country name as an adjective", () => {
        //There are no demonyms for 207 countries, so every phrasing here has to be
        //built to avoid the construction -- the same rule the activity feed follows.
        const { rows } = diplomacyTooltipRows({
            country: "France",
            playerCountry: "France",
            relations: [relation("Germany", DiplomaticState.WAR)]
        });
        expect(rows[0].label).toBe("Germany — At war");
    });
});

describe("the cap", () => {
    const many = Array.from({ length: 12 }, (unused, index) =>
        relation("Country " + String(index).padStart(2, "0"), DiplomaticState.WAR));

    it("stops at the cap and counts the rest", () => {
        const { rows, more } = diplomacyTooltipRows({
            country: "France",
            playerCountry: "France",
            relations: many
        });
        expect(rows).toHaveLength(TOOLTIP_RELATION_ROWS);
        expect(more).toBe(12 - TOOLTIP_RELATION_ROWS);
    });

    it("counts the player's row against the cap, because it is as tall as any other", () => {
        const { rows, more } = diplomacyTooltipRows({
            country: "Germany",
            playerCountry: "France",
            relations: many
        });
        expect(rows).toHaveLength(TOOLTIP_RELATION_ROWS);
        expect(rows[0].isPlayerRow).toBe(true);
        expect(more).toBe(12 - (TOOLTIP_RELATION_ROWS - 1));
    });

    it("says nothing at all about a country with no relations", () => {
        expect(diplomacyTooltipRows({ country: "France", playerCountry: "France" }))
            .toEqual({ rows: [], more: 0 });
        expect(diplomacyTooltipRows({ country: null, playerCountry: "France" }))
            .toEqual({ rows: [], more: 0 });
    });
});
