import { expect, test } from "@playwright/test";

for (const route of ["/", "/sala-guerra/agendar"]) {
  test(`compiled application initializes without runtime errors at ${route}`, async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.goto(route);
    await expect(page.getByRole("button", { name: "Entrar", exact: true })).toBeVisible();
    await expect(page).toHaveURL(/\/auth$/);
    expect(errors).toEqual([]);
  });
}
