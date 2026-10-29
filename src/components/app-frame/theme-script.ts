/** The viewer's theme choice lives in this browser; no value = follow the device (G3b, 29. 10. 2026). */
export const THEME_KEY = "sfz-theme";

/**
 * Runs before the first paint (root layout <head>), so a chosen theme never flashes:
 * sets data-theme on <html>, which the design-system tokens and the `dark:` variant follow.
 */
export const THEME_SCRIPT = `try{var t=localStorage.getItem("${THEME_KEY}");if(t==="light"||t==="dark")document.documentElement.dataset.theme=t}catch(e){}`;
