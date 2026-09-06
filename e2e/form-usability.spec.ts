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

async function expectDialogFitsViewport(page: Page) {
  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();
  const box = await dialog.boundingBox();
  expect(box).not.toBeNull();
  expect(box!.x).toBeGreaterThanOrEqual(0);
  expect(box!.y).toBeGreaterThanOrEqual(0);
  expect(box!.x + box!.width).toBeLessThanOrEqual(390);
  expect(box!.height).toBeLessThanOrEqual(844);
  await expect(page.getByRole("button", { name: "Fechar janela" })).toBeVisible();
}

test.describe("form usability on mobile", () => {
  test.beforeEach(async ({ page }) => {
    await isolateNetwork(page);
    await page.setViewportSize({ width: 390, height: 844 });
    await loginSuperAdmin(page);
  });

  test("Meta Crítica abre, permite digitação e mantém CTA alcançável", async ({ page }) => {
    await page.goto("/metas");
    await page.getByRole("button", { name: "Nova meta" }).click();
    await expectDialogFitsViewport(page);

    const title = page.getByPlaceholder("Ex.: Fechar 5 contratos novos");
    await title.fill("Aumentar conversão de propostas");
    await expect(title).toHaveValue("Aumentar conversão de propostas");

    const dialog = page.getByRole("dialog");
    await dialog.evaluate((el) => { el.scrollTop = el.scrollHeight; });
    await expect(page.getByRole("button", { name: "Criar meta" })).toBeVisible();
  });

  test("Gargalo abre, permite digitação e pode ser fechado sem perder controle da tela", async ({ page }) => {
    await page.goto("/gargalos");
    await page.getByRole("button", { name: "Novo gargalo" }).click();
    await expectDialogFitsViewport(page);

    const dialog = page.getByRole("dialog");
    const nameInput = dialog.locator("input").first();
    await nameInput.fill("Baixa previsibilidade comercial");
    await expect(nameInput).toHaveValue("Baixa previsibilidade comercial");

    await page.getByRole("button", { name: "Fechar janela" }).click();
    await expect(dialog).not.toBeVisible();
  });
});