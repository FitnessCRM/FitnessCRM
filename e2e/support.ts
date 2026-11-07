import fs from "node:fs";
import { deflateSync } from "node:zlib";
import { expect, type Page } from "@playwright/test";
import { E2E_ACCOUNTS, type E2eSeed } from "@/lib/data/adapters/supabase/seed/e2e";
import { es } from "@/lib/i18n/es";
import { SEED_FILE } from "./global-setup";

export { E2E_ACCOUNTS, es };

export function readSeed(): E2eSeed {
  return JSON.parse(fs.readFileSync(SEED_FILE, "utf8")) as E2eSeed;
}

/** Entra con una de las cuentas de la semilla y espera a la primera pantalla de su área. */
export async function signIn(page: Page, who: keyof typeof E2E_ACCOUNTS): Promise<void> {
  const account = E2E_ACCOUNTS[who];
  const form = es.pages.login.form;
  await page.goto("/login");
  await page.getByLabel(form.email).fill(account.email);
  await page.getByLabel(form.password).fill(account.password);
  await page.getByRole("button", { name: form.submit }).click();
  await expect(page).toHaveURL(who === "trainer" ? /\/dashboard/ : /\/routine/);
}

/** Borra una foto de Storage como si se hubiera perdido: solo contra la instancia local. */
export async function removeObject(storagePath: string): Promise<void> {
  const url = process.env.SUPABASE_TEST_URL!;
  if (!/^http:\/\/(127\.0\.0\.1|localhost)(:\d+)?$/.test(url)) {
    throw new Error("Las pruebas de humo solo borran en la instancia local.");
  }
  const key = process.env.SUPABASE_TEST_SERVICE_ROLE_KEY!;
  const response = await fetch(`${url}/storage/v1/object/review-photos`, {
    method: "DELETE",
    headers: { apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({ prefixes: [storagePath] }),
  });
  if (!response.ok) throw new Error(`No se pudo borrar la foto: ${response.status}`);
}

/** PNG de `width` × `height` de un color, generado aquí: las pruebas nunca usan fotos reales. */
export function makePng(width: number, height: number, rgb: [number, number, number]): Buffer {
  const table = Array.from({ length: 256 }, (_, n) => {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    return c >>> 0;
  });
  const crc = (bytes: Buffer) => {
    let c = 0xffffffff;
    for (const b of bytes) c = table[(c ^ b) & 0xff]! ^ (c >>> 8);
    return (c ^ 0xffffffff) >>> 0;
  };
  const chunk = (type: string, data: Buffer) => {
    const length = Buffer.alloc(4);
    length.writeUInt32BE(data.length);
    const body = Buffer.concat([Buffer.from(type, "ascii"), data]);
    const sum = Buffer.alloc(4);
    sum.writeUInt32BE(crc(body));
    return Buffer.concat([length, body, sum]);
  };
  const header = Buffer.alloc(13);
  header.writeUInt32BE(width, 0);
  header.writeUInt32BE(height, 4);
  header[8] = 8;
  header[9] = 2;
  const row = Buffer.alloc(1 + width * 3);
  for (let x = 0; x < width; x++) row.set(rgb, 1 + x * 3);
  const raw = Buffer.alloc(row.length * height);
  for (let y = 0; y < height; y++) row.copy(raw, y * row.length);
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", header),
    chunk("IDAT", deflateSync(raw)),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}
