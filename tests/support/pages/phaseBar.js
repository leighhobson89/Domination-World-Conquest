import { phaseBar, Phase, phaseButtonLabel, phaseTitle } from "../selectors.js";

/**
 * The bottom-left popup. It is one button doing two jobs: CONFIRM on the
 * country-selection screen, and the phase advance for the rest of the game.
 * Refactor Phase 6.3 splits it into CountrySelect and PhaseBar components.
 */
export class PhaseBarPage {
    constructor(page) {
        this.page = page;
        this.title = page.locator(phaseBar.title);
        this.body = page.locator(phaseBar.body);
        this.confirm = page.locator(phaseBar.confirm);
        this.colourLabel = page.locator(phaseBar.colourLabel);
        this.colourPicker = page.locator(phaseBar.colourPicker);
    }

    async label() {
        return (await this.confirm.innerText()).trim();
    }

    async titleText() {
        return (await this.title.innerText()).trim();
    }

    async isEnabled() {
        return this.confirm.isEnabled();
    }

    /** Advance one phase and wait until the button reflects the new one. */
    async advanceTo(phase) {
        await this.confirm.click();
        await this.page.waitForFunction(
            ({ selector, label }) => document.querySelector(selector)?.innerText.trim() === label,
            { selector: phaseBar.confirm, label: phaseButtonLabel[phase] },
            { timeout: 120_000 }
        );
    }

    static Phase = Phase;
    static label = phaseButtonLabel;
    static title = phaseTitle;
}
