import { expect, test } from "@playwright/test";
import { E2E_TEMPLATE_NAME } from "@/lib/data/adapters/supabase/seed/e2e";
import { POSES } from "@/lib/domain";
import { es, makePng, readSeed, removeObject, signIn } from "./support";

/**
 * Los tres recorridos de humo de la tarjeta 130, contra Supabase local. Van en orden: el tercero
 * parte de la revisión que abre el cliente de la semilla.
 */
test.describe.configure({ mode: "serial" });

test("el entrenador da de alta a un cliente", async ({ page }) => {
  const t = es.screensClientSignup;
  const data = es.clientData;
  const email = `alta-${Date.now().toString(36)}@e2e.hector.test`;

  await signIn(page, "trainer");
  await page.goto("/clients/new");
  await page.getByLabel(data.firstName).fill("Alta");
  await page.getByLabel(data.lastName).fill("De humo");
  await page.getByLabel(data.email).fill(email);
  await page.getByRole("button", { name: t.actions.submit }).first().click();

  // Cliente creado, membresía inicial e invitación enviada: la pantalla lleva a su ficha.
  await expect(page).toHaveURL(/\/clients\/[0-9a-f-]{36}$/);
  await expect(page.getByRole("heading", { name: /Alta De humo/i })).toBeVisible();
  await expect(page.getByText(es.status.client.invitado).first()).toBeVisible();

  await page.goto("/clients");
  await expect(page.getByText("Alta De humo")).toBeVisible();
});

test("el entrenador asigna una rutina desde una plantilla y la publica", async ({
  page,
  browser,
}) => {
  const seed = readSeed();
  const t = es.screensAssignment;

  await signIn(page, "trainer");
  await page.goto(`/assignment?clientId=${seed.clientId}`);
  await page.getByText(E2E_TEMPLATE_NAME).click();
  await page.getByRole("button", { name: t.assignAndAdjust }).first().click();

  await expect(page).toHaveURL(new RegExp(`/clients/${seed.clientId}/editor`));
  const editor = es.screensPlanEditor;
  await page.getByRole("button", { name: editor.publish }).click();
  await expect(page.getByText(editor.published)).toBeVisible();

  // El cliente ve la rutina publicada.
  const clientContext = await browser.newContext();
  const clientPage = await clientContext.newPage();
  await signIn(clientPage, "client");
  await expect(clientPage.getByText("Press de humo").first()).toBeVisible();
  await clientContext.close();
});

test("el cliente envía una revisión con fotos y el entrenador la abre", async ({
  page,
  browser,
}) => {
  const seed = readSeed();
  const r = es.screensReview;

  await signIn(page, "client");
  await page.goto("/review");
  // Una foto grande por pose: la app la reduce a 1600 px y la sube en JPEG (T3a, T3b).
  const colors: [number, number, number][] = [
    [190, 80, 60],
    [60, 160, 90],
    [60, 90, 180],
  ];
  const inputs = page.locator('input[type="file"]');
  await expect(inputs).toHaveCount(POSES.length);
  for (const [i, pose] of POSES.entries()) {
    await inputs.nth(i).setInputFiles({
      name: `${pose}.png`,
      mimeType: "image/png",
      buffer: makePng(2400, 3200, colors[i]!),
    });
    await expect(page.getByText(`${i + 1} ${r.photos.uploaded}`)).toBeVisible();
  }

  await page.getByRole("button", { name: r.actions.submit }).click();
  // Sin peso ni cuestionario está incompleta: se avisa y se envía igualmente (I5).
  const confirm = page.getByRole("button", { name: r.dialog.confirm });
  if (await confirm.isVisible().catch(() => false)) await confirm.click();
  await expect(page.getByRole("button", { name: r.actions.submit })).toHaveCount(0);

  // El entrenador la abre desde Revisiones y ve las tres fotos con su URL firmada, ya reducidas.
  const trainerContext = await browser.newContext();
  const trainerPage = await trainerContext.newPage();
  await signIn(trainerPage, "trainer");
  await trainerPage.goto("/reviews");
  await trainerPage.getByText(seed.clientName).first().click();
  await expect(trainerPage).toHaveURL(new RegExp(`/clients/${seed.clientId}/review`));
  // Una pose cada vez, en sus pestañas; la foto lleva el nombre de la pose y de la semana.
  for (const pose of POSES) {
    await trainerPage.getByRole("tab", { name: es.status.pose[pose], exact: true }).click();
    const photo = trainerPage.getByRole("img", {
      name: new RegExp(`^${es.review.photos.poseLabel} ${es.status.pose[pose].toLowerCase()}`),
    });
    await expect(photo).toBeVisible();
    await expect
      .poll(() => photo.evaluate((img: HTMLImageElement) => img.complete && img.naturalWidth))
      .toBe(1200);
  }
  await expect(trainerPage.getByText(es.review.photos.missing)).toHaveCount(0);

  // Si el objeto falta en Storage, la pantalla dice «No disponible» en su sitio, nunca un hueco roto
  // (§9.4). Se borra el de la pose que está a la vista, con la clave de servicio de la instancia local.
  const shown = trainerPage.getByRole("img", {
    name: new RegExp(`^${es.review.photos.poseLabel}`),
  });
  const src = await shown.getAttribute("src");
  const storagePath = decodeURIComponent(
    new URL(src!).pathname.replace(/^.*\/object\/sign\/review-photos\//, ""),
  );
  await removeObject(storagePath);
  await trainerPage.reload();
  await trainerPage.getByRole("tab", { name: es.status.pose.espalda, exact: true }).click();
  await expect(trainerPage.getByText(es.review.photos.missing)).toBeVisible();
  await expect(trainerPage.getByText(es.review.photos.missingHint)).toBeVisible();
  await trainerContext.close();
});
