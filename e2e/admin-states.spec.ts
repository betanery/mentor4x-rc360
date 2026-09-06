import { expect, test, type Page } from "@playwright/test";

async function isolateNetwork(page: Page) {
  await page.route("**/rest/v1/**", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      headers: { "content-range": "0-0/0" },
      body: "[]",
    });
  });
  await page.route("**/functions/v1/**", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ users: [], companies: [], audit: [] }),
    });
  });
}

async function loginAsSuperAdmin(page: Page) {
  await page.addInitScript(() => localStorage.setItem("m4x.e2eRole", "super_admin"));
  await page.goto("/");
  await expect(page.getByText("Empresa E2E RC360").first()).toBeVisible();
}

test.describe("admin states", () => {
  test.beforeEach(async ({ page }) => {
    await isolateNetwork(page);
    await loginAsSuperAdmin(page);
  });

  test("usuários informa quando não há registros", async ({ page }) => {
    await page.goto("/admin/usuarios");
    await expect(page.getByRole("heading", { name: "Gerenciar Usuários" })).toBeVisible();
    await expect(page.getByText("Nenhum usuário encontrado.")).toBeVisible();
  });

  test("produtos informa quando o catálogo está vazio", async ({ page }) => {
    await page.goto("/admin/produtos");
    await expect(page.getByRole("heading", { name: "Produtos e Contratações" })).toBeVisible();
    await expect(page.getByText("Nenhum produto cadastrado.")).toBeVisible();
    await expect(page.getByRole("button", { name: "Novo produto" })).toBeVisible();
  });

  test("empresas mantém CTA mesmo sem registros", async ({ page }) => {
    await page.goto("/empresas");
    await expect(page.getByRole("heading", { name: "Empresas" })).toBeVisible();
    await expect(page.getByText("Nenhuma empresa encontrada.")).toBeVisible();
    await expect(page.getByRole("button", { name: "Nova empresa" })).toBeVisible();
  });

  test("universidade admin oferece próximo passo no estado vazio", async ({ page }) => {
    await page.goto("/admin/universidade");
    await expect(page.getByRole("heading", { name: "Universidade 4X (Admin)" })).toBeVisible();
    await expect(page.getByText(/Nenhum curso ainda/)).toBeVisible();
    await expect(page.getByRole("button", { name: "Novo curso" })).toBeVisible();
  });
});
