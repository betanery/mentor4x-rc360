import { expect, test, type Page } from "@playwright/test";

async function setup(page: Page, role = "cliente_dono", options: { conflict?: boolean; denied?: boolean } = {}) {
  const requests: Record<string, any>[] = [];
  await page.addInitScript((role) => localStorage.setItem("m4x.e2eRole", role), role);
  await page.route("**/rest/v1/**", (route) => route.fulfill({ contentType: "application/json", body: "[]" }));
  await page.route("**/functions/v1/**", async (route) => {
    const body = route.request().postDataJSON();
    requests.push(body);
    let payload: unknown = {};
    let status = 200;
    if (body.action === "organizers") payload = { organizers: [{ id: "mentor-1", display_name: "Consultora Teste", slot_duration_min: 60, timezone: "America/Sao_Paulo" }] };
    if (body.action === "availability") {
      if (options.denied) { status = 500; payload = { error: "A conexão Outlook no Lovable não autorizou o acesso." }; }
      else payload = { slots: options.conflict && requests.some((r) => r.action === "book") ? [] : [{ start_at: "2026-09-10T12:00:00Z", end_at: "2026-09-10T13:00:00Z", local_date: "2026-09-10", local_time: "09:00" }] };
    }
    if (body.action === "book") {
      if (options.conflict) { status = 409; payload = { error: "Este horário acabou de ficar indisponível. Escolha outro horário." }; }
      else payload = { meeting: { id: "meeting-1", title: "Sala de Guerra 4X · Empresa E2E RC360", scheduled_at: "2026-09-10T12:00:00Z", meeting_url: "https://teams.microsoft.com/l/meetup-join/test" }, teams_join_url: "https://teams.microsoft.com/l/meetup-join/test", organizer: "Consultora Teste" };
    }
    await route.fulfill({ status, contentType: "application/json", body: JSON.stringify(payload) });
  });
  await page.route("https://connector-gateway.lovable.dev/**", (route) => route.abort());
  await page.goto("/sala-guerra/agendar");
  await expect(page.getByRole("heading", { name: "Agendar Sala de Guerra" })).toBeVisible();
  return requests;
}

for (const mobile of [false, true]) {
  test(`confirma reserva e mostra convite e Teams (${mobile ? "mobile" : "desktop"})`, async ({ page }) => {
    if (mobile) await page.setViewportSize({ width: 390, height: 844 });
    const requests = await setup(page);
    await page.getByRole("button", { name: "09:00", exact: true }).click();
    await page.getByLabel("Pauta inicial").fill("Revisar metas e indicadores");
    await page.getByRole("button", { name: "Confirmar e gerar link do Teams" }).click();
    await expect(page.getByText("Encontro confirmado", { exact: true })).toBeVisible();
    await expect(page.getByRole("link", { name: "Abrir Microsoft Teams" })).toHaveAttribute("href", "https://teams.microsoft.com/l/meetup-join/test");
    expect(requests.find((r) => r.action === "book")).toMatchObject({ organizer_id: "mentor-1", attendee_email: "cliente_dono@e2e.mentor4x.local", agenda: "Revisar metas e indicadores", company_id: "10000000-0000-4000-8000-000000000001" });
    await expect(page.getByRole("button", { name: "Validar e habilitar minha agenda" })).toHaveCount(0);
  });
}
test("exibe conflito e remove horário indisponível", async ({ page }) => {
  await setup(page, "cliente_dono", { conflict: true });
  await page.getByRole("button", { name: "09:00", exact: true }).click();
  await page.getByRole("button", { name: "Confirmar e gerar link do Teams" }).click();
  await expect(page.getByText("Este horário acabou de ficar indisponível. Escolha outro horário.", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "09:00", exact: true })).toHaveCount(0);
  await expect(page.getByText("Encontro confirmado", { exact: true })).toHaveCount(0);
});
test("mostra erro de conexão sem oferecer horários", async ({ page }) => {
  await setup(page, "cliente_dono", { denied: true });
  await expect(page.getByText("A conexão Outlook no Lovable não autorizou o acesso.", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "09:00", exact: true })).toHaveCount(0);
});
test("equipe cadastra agenda e recebe orientação da conexão Lovable", async ({ page }) => {
  const requests = await setup(page, "mentor");
  await expect(page.getByRole("heading", { name: "Configurar minha agenda Outlook via Lovable" })).toBeVisible();
  await page.getByLabel("Nome exibido", { exact: true }).fill("Consultora Teste");
  await page.getByLabel("E-mail Microsoft 365", { exact: true }).fill("mentor@example.com");
  await page.getByRole("button", { name: "Validar e habilitar minha agenda" }).click();
  await expect(page.getByText("Sua agenda Outlook foi validada via Lovable e habilitada para reservas.", { exact: true })).toBeVisible();
  expect(requests.find((r) => r.action === "upsert_my_host")).toMatchObject({ microsoft_email: "mentor@example.com", display_name: "Consultora Teste" });
});
