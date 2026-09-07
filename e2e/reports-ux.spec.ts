import { expect, test, type Page } from "@playwright/test";

async function isolateNetwork(page: Page) {
  await page.route("**/rest/v1/**", async (route) => {
    await route.fulfill({ status: 200, contentType: "application/json", headers: { "content-range": "0-0/0" }, body: "[]" });
  });
  await page.route("**/functions/v1/**", async (route) => {
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ users: [], companies: [], audit: [] }) });
  });
}

async function loginSuperAdmin(page: Page) {
  await page.addInitScript(() => localStorage.setItem("m4x.e2eRole", "super_admin"));
  await page.goto("/");
  await expect(page.locator("main")).toBeVisible();
}

test.describe("unified reports experience", () => {
  test.beforeEach(async ({ page }) => {
    await isolateNetwork(page);
    await loginSuperAdmin(page);
  });

  test("menu exposes a single Reports entry and the page separates report types", async ({ page }) => {
    await page.goto("/relatorios");

    await expect(page.getByRole("link", { name: "Relatórios" })).toHaveCount(1);
    await expect(page.getByRole("link", { name: "Antes e Depois SEE_4X" })).toHaveCount(0);

    await expect(page.getByRole("heading", { name: "Relatório mensal" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Antes e Depois SEE_4X" })).toBeVisible();
    await expect(page.getByRole("button", { name: /Abrir comparativo/i })).toBeVisible();
  });
});
