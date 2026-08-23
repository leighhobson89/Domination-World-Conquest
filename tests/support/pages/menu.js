import { menu, containers } from "../selectors.js";

/** The main menu: New Game, Toggle Music, Help. */
export class MenuPage {
    constructor(page) {
        this.page = page;
        this.container = page.locator(containers.menu);
        this.newGame = page.locator(menu.newGame);
        this.toggleMusic = page.locator(menu.toggleMusic);
    }

    /** True once the territory model is built -- the button starts disabled. */
    async newGameEnabled() {
        return this.newGame.isEnabled();
    }

    async waitForEnabled() {
        await this.page.waitForFunction((selector) => {
            const button = document.querySelector(selector);
            return !!button && !button.disabled;
        }, menu.newGame);
    }

    async isVisible() {
        return (await this.container.evaluate((el) => getComputedStyle(el).display)) !== "none";
    }

    async start() {
        await this.newGame.click();
    }
}
