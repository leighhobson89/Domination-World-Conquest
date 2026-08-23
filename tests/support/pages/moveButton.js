import { moveButton, containers } from "../selectors.js";

/**
 * The single button bottom-centre that carries the whole move-phase state
 * machine: TRANSFER / ATTACK / VIEW SIEGE (n) / DEACTIVATED (n), and then
 * CANCEL / CONFIRM / INVADE! once a window is open. Its state is encoded in a
 * background class, which is why `variant()` exists.
 *
 * Refactor Phase 6.6 replaces this with deriveMoveButtonState(state, selection).
 */
export class MoveButtonPage {
    constructor(page) {
        this.page = page;
        this.button = page.locator(moveButton.button);
        this.container = page.locator(containers.movePhaseButtons);
    }

    async isVisible() {
        return (await this.button.evaluate((el) => getComputedStyle(el).display)) !== "none";
    }

    async label() {
        return (await this.button.innerText()).trim();
    }

    async isEnabled() {
        return this.button.isEnabled();
    }

    /** "transfer" | "attack" | "viewSiege" | "disabled" | "open" | null */
    async variant() {
        const classes = (await this.button.getAttribute("class")) ?? "";
        for (const [name, className] of Object.entries(moveButton.classFor)) {
            if (classes.split(/\s+/).includes(className)) return name;
        }
        return null;
    }

    async click() {
        await this.button.click();
    }

    /** The "attacking X" banner shown once a target is picked. */
    async destinationText() {
        const locator = this.page.locator(moveButton.destinationText);
        return (await locator.count()) ? (await locator.innerText()).trim() : null;
    }
}
