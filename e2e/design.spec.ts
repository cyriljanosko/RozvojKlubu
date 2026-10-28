import { expect, test } from "@playwright/test";

/**
 * Screenshots of the SFZ design layer and the app frame (R3.4). A failing comparison means the
 * look changed – either fix the code, or, when the change is intended (e.g. a new design-system
 * version), update the baselines on Linux (see RUNBOOK).
 */
for (const colorScheme of ["light", "dark"] as const) {
  test.describe(`${colorScheme} theme`, () => {
    test.use({ colorScheme });

    test("design layer showcase", async ({ page }) => {
      await page.goto("/dev/ukazky");
      await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
      await expect(page).toHaveScreenshot(`ukazky-${colorScheme}.png`, { fullPage: true });
    });

    // R4 G1a – the sign-in needs no database; Hub and Oblasti need test data (they read MongoDB)
    test("sign-in", async ({ page }) => {
      await page.goto("/prihlasenie");
      await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
      await expect(page).toHaveScreenshot(`prihlasenie-${colorScheme}.png`, { fullPage: true });
    });
  });
}

test("app frame shows the visitor navigation", async ({ page, isMobile }) => {
  await page.goto("/dev/ukazky");
  const nav = isMobile
    ? page.getByRole("navigation", { name: "Navigácia", exact: true })
    : page.getByRole("navigation", { name: "Hlavná navigácia" });
  for (const label of ["Akadémia", "Oblasti", "Kompas", "Kluby"]) {
    await expect(nav.getByRole("link", { name: label, exact: true })).toBeVisible();
  }
});
