import { expect, test, type Page } from "@playwright/test";

type Role = "super_admin" | "mentor" | "estrategista" | "company_responsible" | "company_leader" | "cliente_dono" | "gestor_cliente" | "colaborador_cliente";

const labels: Record<Role, string> = {
  super_admin: "Super Admin",
  mentor: "Consultor 4X",
  estrategista: "Estrategista 4X",
  company_responsible: "Responsável da empresa (Dono/Gestor)",
  company_leader: "Líder da empresa (Gerente/Coordenador)",
  cliente_dono: "Cliente 4X (Dono)",
  gestor_cliente: "Gestor",
  colaborador_cliente: "Colaborador",
};

const reservedRoutes = ["/estrategista", "/admin/usuarios", "/admin/produtos", "/empresas", "/admin/universidade"] as const;
const commonRoutes = ["/", "/diagnostico", "/jornada", "/onboarding", "/metas", "/plano-acao", "/gargalos", "/pilares", "/sala-guerra", "/universidade", "/playbooks", "/socio-ia", "/relatorios", "/relatorio-see4x", "/certificados", "/notificacoes"];

const allowedReservedRoutes: Record<Role, readonly string[]> = {
  super_admin: reservedRoutes,
  mentor: ["/estrategista", "/empresas"],
  estrategista: ["/estrategista"],
  company_responsible: [],
  company_leader: [],
  cliente_dono: [],
  gestor_cliente: [],
  colaborador_cliente: [],
};

async function isolateNetwork(page: Page) {
  const forbidden: string[] = [];
  page.on("request", (request) => {
    if (/ai\.gateway\.lovable\.dev|lovable\.dev\/api/i.test(request.url())) forbidden.push(request.url());
  });
  await page.route("**/rest/v1/**", async (route) => {
    await route.fulfill({ status: 200, contentType: "application/json", headers: { "content-range": "0-0/0" }, body: "[]" });
  });
  await page.route("**/functions/v1/**", async (route) => {
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ users: [], companies: [], audit: [] }) });
  });
  await page.route(/ai\.gateway\.lovable\.dev|lovable\.dev\/api/i, (route) => route.abort("blockedbyclient"));
  return forbidden;
}

async function loginAs(page: Page, role: Role) {
  await page.addInitScript((selectedRole) => localStorage.setItem("m4x.e2eRole", selectedRole), role);
  await page.goto("/");
  await expect(page.getByText("Empresa E2E RC360").first()).toBeVisible();
  await expect(page.getByText(labels[role], { exact: true })).toBeVisible();
}

test("usuário não autenticado é direcionado para login", async ({ page }) => {
  const forbidden = await isolateNetwork(page);
  await page.goto("/metas");
  await expect(page).toHaveURL(/\/auth$/);
  await expect(page.getByRole("button", { name: "Entrar", exact: true })).toBeVisible();
  expect(forbidden).toEqual([]);
});

for (const role of Object.keys(labels) as Role[]) {
  test.describe(role, () => {
    test("abre o sistema e percorre todos os módulos comuns", async ({ page }) => {
      const forbidden = await isolateNetwork(page);
      await loginAs(page, role);
      for (const route of commonRoutes) {
        await page.goto(route);
        await expect(page).toHaveURL(new RegExp(`${route === "/" ? "/$" : route.replace("/", "\\/")}$`));
        await expect(page.locator("main")).toBeVisible();
      }
      expect(forbidden).toEqual([]);
    });

    test("respeita as áreas reservadas por perfil", async ({ page }) => {
      const forbidden = await isolateNetwork(page);
      await loginAs(page, role);

      for (const route of reservedRoutes) {
        await page.goto(route);
        if (allowedReservedRoutes[role].includes(route)) {
          await expect(page).toHaveURL(new RegExp(`${route.replace("/", "\\/")}$`));
        } else {
          await expect(page).toHaveURL(/\/$/);
        }
      }

      await page.goto("/mentor");
      if (["super_admin", "mentor"].includes(role)) await expect(page).toHaveURL(/\/mentor$/);
      else await expect(page).toHaveURL(/\/$/);
      expect(forbidden).toEqual([]);
    });
  });
}
