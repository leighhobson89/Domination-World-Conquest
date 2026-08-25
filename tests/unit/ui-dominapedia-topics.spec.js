// The Dominapedia's table of contents, and the two navigation buttons under it.
//
// Phase 7.6. The panel is a browser over a fixed catalogue: a list of sections,
// each holding sub-topics, and a Previous / Next pair that walks every sub-topic
// in the whole book in reading order and WRAPS at both ends. That walk is the one
// part of the feature that is pure -- it is a function from a topic id to another
// topic id -- so it lives in `src/ui/dominapedia/topics.js` with no DOM anywhere
// near it and is pinned here rather than by clicking Next eleven times in a
// browser.
//
// The wrap is what these tests exist for. "Next from the last topic" and
// "Previous from the first" are the two cases nobody exercises by hand, and both
// were asked for explicitly.

import { describe, expect, it } from "vitest";

import {
    DOMINAPEDIA_SECTIONS,
    allTopics,
    firstTopicId,
    nextTopicId,
    previousTopicId,
    sectionForTopic,
    topicById,
    topicCount,
    topicIndex,
} from "../../src/ui/dominapedia/topics.js";

const ids = () => allTopics().map((topic) => topic.id);

describe("the catalogue", () => {
    it("has sections, and every section has at least one sub-topic", () => {
        expect(DOMINAPEDIA_SECTIONS.length).toBeGreaterThan(1);
        for (const section of DOMINAPEDIA_SECTIONS) {
            expect(section.topics.length, `${section.id} has no sub-topics`).toBeGreaterThan(0);
        }
    });

    it("gives every section and every sub-topic a unique id", () => {
        const sectionIds = DOMINAPEDIA_SECTIONS.map((section) => section.id);
        expect(new Set(sectionIds).size).toBe(sectionIds.length);
        expect(new Set(ids()).size).toBe(ids().length);
    });

    it("gives every sub-topic a title and a body", () => {
        for (const topic of allTopics()) {
            expect(topic.title, `${topic.id} has no title`).toBeTruthy();
            expect(Array.isArray(topic.body), `${topic.id} has no body blocks`).toBe(true);
            expect(topic.body.length, `${topic.id} has an empty body`).toBeGreaterThan(0);
        }
    });

    it("flattens the sections in reading order", () => {
        const expected = DOMINAPEDIA_SECTIONS.flatMap((section) =>
            section.topics.map((topic) => topic.id)
        );
        expect(ids()).toEqual(expected);
        expect(topicCount()).toBe(expected.length);
    });

    it("looks a sub-topic up by id, and reports the section holding it", () => {
        const [section] = DOMINAPEDIA_SECTIONS;
        const [topic] = section.topics;

        // Not the same object: a looked-up topic carries the section it belongs to
        // as well, which is what lets the content pane print a breadcrumb without
        // asking a second question.
        expect(topicById(topic.id)).toMatchObject({
            id: topic.id,
            title: topic.title,
            sectionId: section.id,
            sectionTitle: section.title,
        });
        expect(sectionForTopic(topic.id)).toBe(section);

        expect(topicById("no-such-topic")).toBeNull();
        expect(sectionForTopic("no-such-topic")).toBeNull();
    });

    it("opens on the first sub-topic of the first section", () => {
        expect(firstTopicId()).toBe(ids()[0]);
    });
});

describe("walking the book", () => {
    it("moves forward one sub-topic at a time, across a section boundary", () => {
        const order = ids();
        for (let index = 0; index < order.length - 1; index += 1) {
            expect(nextTopicId(order[index])).toBe(order[index + 1]);
        }
    });

    it("moves backward one sub-topic at a time", () => {
        const order = ids();
        for (let index = order.length - 1; index > 0; index -= 1) {
            expect(previousTopicId(order[index])).toBe(order[index - 1]);
        }
    });

    it("wraps from the end to the start, and from the start to the end", () => {
        const order = ids();
        const first = order[0];
        const last = order[order.length - 1];

        expect(nextTopicId(last)).toBe(first);
        expect(previousTopicId(first)).toBe(last);
    });

    it("walks the whole book and comes back to where it started", () => {
        const order = ids();
        let id = order[0];
        for (let step = 0; step < order.length; step += 1) id = nextTopicId(id);
        expect(id).toBe(order[0]);
    });

    it("treats an unknown id as being before the first topic", () => {
        // Not a throw: the panel asks for `next` from whatever it is showing, and
        // a topic that has been renamed out of the catalogue must not dead-end the
        // buttons. Forward lands on the first topic, backward on the last, which is
        // the same answer as "the cursor is not in the book yet".
        expect(nextTopicId("no-such-topic")).toBe(firstTopicId());
        expect(previousTopicId("no-such-topic")).toBe(ids()[ids().length - 1]);
        expect(topicIndex("no-such-topic")).toBe(-1);
    });
});
