import { expect, test, type Page } from "@playwright/test";

const protectedRoutes = [
  "/",
  "/onboarding",
  "/diagnostico",
  "/gargalos",
  "/metas",
  "/plano-acao",
  "/sala-guerra",
  "/pilares",
  "/relatorios",
  "/relatorio-see4x",
  "/jornada",
  "/universidade",
  "/playbooks",
  "/socio-ia",
  "/certificados",
  "/notificacoes",
  "/mentor",
  "/estrategista",
  "/admin/usuarios",
  "/admin/produtos",
  "/empresas",
  "/admin/universidade",
] as const;

type Finding = { route: string; issue: string; value?: number };

async function isolateNetwork(page: Page) {
  await page.route("**/rest/v1/**", async (route) => {
    const url = route.request().url();
    if (url.includes("companies")) {
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        headers: { "content-range": "0-0/1" },
        body: JSON.stringify([{
          id: "11111111-1111-1111-1111-111111111111",
          name: "Empresa E2E RC360",
          journey_stage: "ciclo_1",
          chaos_level: "moderado",
          overall_score: 52,
          owner_dependency: 68,
          projected_revenue: 1200000,
        }]),
      });
    }
    return route.fulfill({
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

async function loginSuperAdmin(page: Page) {
  await page.addInitScript(() => localStorage.setItem("m4x.e2eRole", "super_admin"));
  await page.goto("/");
  await expect(page.locator("main")).toBeVisible();
}

function slug(route: string) {
  return route === "/" ? "dashboard" : route.replace(/^\//, "").replaceAll("/", "-");
}

async function auditRoute(page: Page, route: string, mode: "desktop" | "mobile") {
  const findings: Finding[] = [];
  await page.goto(route);
  await expect(page.locator("main")).toBeVisible();

  const overflow = await page.evaluate(() =>
    Math.max(0, document.documentElement.scrollWidth - document.documentElement.clientWidth),
  );
  if (overflow > 2) findings.push({ route, issue: `${mode}-horizontal-overflow-px`, value: overflow });

  const headingCount = await page.locator("main h1, main h2").count();
  if (headingCount === 0) findings.push({ route, issue: "missing-primary-heading" });

  const unnamedButtons = await page.locator("main button").evaluateAll((buttons) =>
    buttons.filter((button) => {
      if (button.getAttribute("role") === "presentation") return false;
      if (button.hasAttribute("data-radix-collection-item")) return false;
      const text = (button.textContent || "").trim();
      const aria = button.getAttribute("aria-label") || "";
      const labelledBy = button.getAttribute("aria-labelledby") || "";
      const title = button.getAttribute("title") || "";
      return !text && !aria && !labelledBy && !title;
    }).length,
  );
  if (unnamedButtons) findings.push({ route, issue: "unnamed-action-buttons", value: unnamedButtons });

  const deadLinks = await page.locator("main a").evaluateAll((links) =>
    links.filter((link) => {
      const href = link.getAttribute("href");
      return href === "#" || href === "";
    }).length,
  );
  if (deadLinks) findings.push({ route, issue: "dead-links", value: deadLinks });

  const unlabeledFields = await page.locator("main input:not([type='hidden']), main textarea").evaluateAll((fields) =>
    fields.filter((field) => {
      const id = field.getAttribute("id");
      const aria = field.getAttribute("aria-label") || field.getAttribute("aria-labelledby");
      const placeholder = field.getAttribute("placeholder");
      const label = id ? document.querySelector(`label[for="${CSS.escape(id)}"]`) : null;
      return !aria && !label && !placeholder;
    }).length,
  );
  if (unlabeledFields) findings.push({ route, issue: "weakly-labeled-fields", value: unlabeledFields });

  if (mode === "mobile") {
    const tinyTargets = await page.locator("main button:visible, main a:visible").evaluateAll((els) =>
      els.filter((el) => {
        const rect = el.getBoundingClientRect();
        const text = (el.textContent || "").trim();
        if (!text && !el.getAttribute("aria-label")) return false;
        return rect.width > 0 && rect.height > 0 && rect.height < 36;
      }).length,
    );
    if (tinyTargets) findings.push({ route, issue: "small-touch-targets-under-36px", value: tinyTargets });
  }

  await page.screenshot({
    path: `test-results/final-audit/${mode}-${slug(route)}.png`,
    fullPage: true,
  });

  return findings;
}

test.describe("final desktop + mobile audit", () => {
  test("desktop: all Mentor 4X routes are usable and structurally coherent", async ({ page }) => {
    await isolateNetwork(page);
    await page.setViewportSize({ width: 1440, height: 1000 });
    await loginSuperAdmin(page);

    const findings: Finding[] = [];
    const pageErrors: string[] = [];
    page.on("pageerror", (error) => pageErrors.push(error.message));

    for (const route of protectedRoutes) {
      findings.push(...await auditRoute(page, route, "desktop"));
    }

    await page.goto("/");
    await expect(page.getByRole("link", { name: "Dashboard" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Relatórios" })).toHaveCount(1);
    await expect(page.getByRole("link", { name: /CRM/i })).toHaveCount(0);

    console.log(`FINAL_DESKTOP_FINDINGS=${JSON.stringify(findings)}`);
    console.log(`FINAL_DESKTOP_PAGE_ERRORS=${JSON.stringify(pageErrors)}`);
    expect(pageErrors).toEqual([]);
    expect(findings).toEqual([]);
  });

  test("mobile: all Mentor 4X routes fit 390px and keep primary navigation usable", async ({ page }) => {
    await isolateNetwork(page);
    await page.setViewportSize({ width: 390, height: 844 });
    await loginSuperAdmin(page);

    const findings: Finding[] = [];
    const pageErrors: string[] = [];
    page.on("pageerror", (error) => pageErrors.push(error.message));

    for (const route of protectedRoutes) {
      findings.push(...await auditRoute(page, route, "mobile"));
    }

    await page.goto("/");
    await page.getByRole("button", { name: "Abrir menu" }).click();
    await expect(page.getByRole("link", { name: "Onboarding" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Relatórios" })).toHaveCount(1);
    await expect(page.getByRole("link", { name: /CRM/i })).toHaveCount(0);
    await page.getByRole("link", { name: "Onboarding" }).click();
    await expect(page).toHaveURL(/\/onboarding$/);

    console.log(`FINAL_MOBILE_FINDINGS=${JSON.stringify(findings)}`);
    console.log(`FINAL_MOBILE_PAGE_ERRORS=${JSON.stringify(pageErrors)}`);
    expect(pageErrors).toEqual([]);
    expect(findings).toEqual([]);
  });
});
