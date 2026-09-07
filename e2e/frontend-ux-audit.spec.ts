import { expect, test, type Page } from "@playwright/test";

const routes = [
  "/", "/diagnostico", "/jornada", "/onboarding", "/metas", "/plano-acao", "/gargalos", "/pilares",
  "/sala-guerra", "/universidade", "/playbooks", "/socio-ia", "/relatorios", "/relatorio-see4x",
  "/certificados", "/notificacoes", "/crm", "/mentor", "/estrategista", "/admin/usuarios",
  "/admin/produtos", "/empresas", "/admin/universidade",
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
    return route.fulfill({ status: 200, contentType: "application/json", headers: { "content-range": "0-0/0" }, body: "[]" });
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

function slug(route: string) {
  return route === "/" ? "dashboard" : route.replace(/^\//, "").replaceAll("/", "-");
}

test.describe("frontend UX audit", () => {
  test("desktop: inventory usability/accessibility findings across all routes", async ({ page }) => {
    await isolateNetwork(page);
    await page.setViewportSize({ width: 1440, height: 1100 });
    await loginSuperAdmin(page);

    const findings: Finding[] = [];
    const pageErrors: string[] = [];
    page.on("pageerror", (error) => pageErrors.push(error.message));

    for (const route of routes) {
      await page.goto(route);
      await expect(page.locator("main")).toBeVisible();

      const overflow = await page.evaluate(() => Math.max(0, document.documentElement.scrollWidth - document.documentElement.clientWidth));
      if (overflow > 2) findings.push({ route, issue: "horizontal-overflow-px", value: overflow });

      const headingCount = await page.locator("main h1, main h2").count();
      if (headingCount === 0) findings.push({ route, issue: "missing-primary-heading" });

      const unnamedButtons = await page.locator("button").evaluateAll((buttons) =>
        buttons.filter((button) => {
          const text = (button.textContent || "").trim();
          const aria = button.getAttribute("aria-label") || "";
          const labelledBy = button.getAttribute("aria-labelledby") || "";
          const title = button.getAttribute("title") || "";
          return !text && !aria && !labelledBy && !title;
        }).length,
      );
      if (unnamedButtons) findings.push({ route, issue: "unnamed-buttons", value: unnamedButtons });

      const deadLinks = await page.locator("a").evaluateAll((links) =>
        links.filter((link) => {
          const href = link.getAttribute("href");
          return href === "#" || href === "";
        }).length,
      );
      if (deadLinks) findings.push({ route, issue: "dead-links", value: deadLinks });

      const unlabeledInputs = await page.locator("input:not([type='hidden']), textarea").evaluateAll((inputs) =>
        inputs.filter((input) => {
          const id = input.getAttribute("id");
          const aria = input.getAttribute("aria-label") || input.getAttribute("aria-labelledby");
          const placeholder = input.getAttribute("placeholder");
          const label = id ? document.querySelector(`label[for="${CSS.escape(id)}"]`) : null;
          return !aria && !label && !placeholder;
        }).length,
      );
      if (unlabeledInputs) findings.push({ route, issue: "weakly-labeled-inputs", value: unlabeledInputs });

      await page.screenshot({ path: `test-results/ux-audit/desktop-${slug(route)}.png`, fullPage: true });
    }

    console.log(`UX_AUDIT_FINDINGS=${JSON.stringify(findings)}`);
    console.log(`UX_AUDIT_PAGE_ERRORS=${JSON.stringify(pageErrors)}`);
    expect(pageErrors).toEqual([]);
    expect(findings, "See UX_AUDIT_FINDINGS in job log for the complete route inventory").toEqual([]);
  });

  test("mobile: critical journeys fit small screens and keep navigation usable", async ({ page }) => {
    await isolateNetwork(page);
    await page.setViewportSize({ width: 390, height: 844 });
    await loginSuperAdmin(page);

    const critical = ["/", "/diagnostico", "/jornada", "/onboarding", "/metas", "/plano-acao", "/gargalos", "/empresas", "/admin/produtos"] as const;
    const findings: Finding[] = [];
    for (const route of critical) {
      await page.goto(route);
      await expect(page.locator("main")).toBeVisible();
      const overflow = await page.evaluate(() => Math.max(0, document.documentElement.scrollWidth - document.documentElement.clientWidth));
      if (overflow > 2) findings.push({ route, issue: "mobile-horizontal-overflow-px", value: overflow });
      await page.screenshot({ path: `test-results/ux-audit/mobile-${slug(route)}.png`, fullPage: true });
    }

    await page.goto("/");
    await page.getByRole("button", { name: "Abrir menu" }).click();
    await expect(page.getByRole("link", { name: "Dashboard" })).toBeVisible();
    await page.getByRole("link", { name: "Onboarding" }).click();
    await expect(page).toHaveURL(/\/onboarding$/);

    console.log(`UX_AUDIT_MOBILE_FINDINGS=${JSON.stringify(findings)}`);
    expect(findings).toEqual([]);
  });
});
