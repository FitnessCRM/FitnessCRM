import { createClient } from "@supabase/supabase-js";
import { deflateSync } from "node:zlib";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { DataPorts } from "@/lib/data/ports";
import { POSES, type Pose } from "@/lib/domain";
import { createSupabasePorts } from "./ports";

/**
 * Fotos de revisión de punta a punta contra el stack local de Supabase (tarjeta 17, §9): el cliente
 * sube las tres poses, el cliente y el entrenador las ven con URL firmada, un objeto que falta se lee
 * como «no disponible», y quitar o sustituir una foto borra su objeto de Storage. Necesita las mismas
 * variables que `contract.test.ts` (las da `supabase status -o env`); sin ellas se salta.
 *
 * Las imágenes se generan aquí: PNG de unos píxeles, nunca fotos reales.
 */
const url = process.env.SUPABASE_TEST_URL ?? "";
const anonKey = process.env.SUPABASE_TEST_ANON_KEY ?? "";
const serviceKey = process.env.SUPABASE_TEST_SERVICE_ROLE_KEY ?? "";
const ready = Boolean(url && anonKey && serviceKey);
const PASSWORD = "fotos-1";
const BUCKET = "review-photos";

/** PNG de `width` × `height` de un solo color, válido para cualquier lector de imágenes. */
function makePng(
  width: number,
  height: number,
  rgb: [number, number, number],
): Uint8Array<ArrayBuffer> {
  const crcTable = Array.from({ length: 256 }, (_, n) => {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    return c >>> 0;
  });
  const crc = (bytes: Buffer) => {
    let c = 0xffffffff;
    for (const b of bytes) c = crcTable[(c ^ b) & 0xff]! ^ (c >>> 8);
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
  header[8] = 8; // bits por canal
  header[9] = 2; // RGB
  const row = Buffer.concat([Buffer.from([0]), Buffer.from(Array(width).fill(rgb).flat())]);
  const pixels = deflateSync(Buffer.concat(Array(height).fill(row)));
  const png = Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", header),
    chunk("IDAT", pixels),
    chunk("IEND", Buffer.alloc(0)),
  ]);
  const bytes = new Uint8Array(new ArrayBuffer(png.length));
  bytes.set(png);
  return bytes;
}

const admin = (path: string, init: RequestInit = {}) =>
  fetch(`${url}${path}`, {
    ...init,
    headers: {
      apikey: serviceKey,
      Authorization: `Bearer ${serviceKey}`,
      "Content-Type": "application/json",
      ...init.headers,
    },
  });

async function createAccount(email: string): Promise<string> {
  const response = await admin("/auth/v1/admin/users", {
    method: "POST",
    body: JSON.stringify({ email, password: PASSWORD, email_confirm: true }),
  });
  const body = (await response.json()) as { id?: string; msg?: string };
  if (!response.ok || !body.id) throw new Error(`No se pudo crear ${email}: ${body.msg}`);
  return body.id;
}

async function insertRows(table: string, rows: object[]): Promise<void> {
  const response = await admin(`/rest/v1/${table}`, {
    method: "POST",
    headers: { Prefer: "return=minimal" },
    body: JSON.stringify(rows),
  });
  if (!response.ok) throw new Error(`No se pudo insertar en ${table}: ${await response.text()}`);
}

/** Si el objeto está en el bucket, mirado con la clave de servicio y no con la sesión de nadie. */
async function objectExists(path: string): Promise<boolean> {
  const response = await admin(`/storage/v1/object/info/${BUCKET}/${path}`);
  return response.ok;
}

async function removeObjects(paths: string[]): Promise<void> {
  if (paths.length === 0) return;
  const response = await admin(`/storage/v1/object/${BUCKET}`, {
    method: "DELETE",
    body: JSON.stringify({ prefixes: paths }),
  });
  if (!response.ok) throw new Error(`No se pudieron borrar los objetos: ${await response.text()}`);
}

const suite = ready ? describe : describe.skip;

suite("fotos de revisión · supabase (stack local)", () => {
  let ports: DataPorts;
  let trainerId: string;
  let clientId: string;
  let clientUserId: string;
  let reviewId: string;
  const uploaded: string[] = [];
  const accounts = { trainer: "", client: "" };
  const as = async (who: keyof typeof accounts) => {
    await ports.session.logout();
    await ports.session.login(accounts[who], PASSWORD);
  };
  const pathOf = async (pose: Pose) => {
    const review = await ports.reviews.getReview(trainerId, reviewId);
    return review?.media.find((m) => m.pose === pose)?.url;
  };
  const upload = async (pose: Pose, rgb: [number, number, number]) => {
    const path = await ports.reviews.uploadReviewPhoto({
      trainerId,
      clientId,
      reviewId,
      file: new Blob([makePng(4, 6, rgb)], { type: "image/png" }),
      contentType: "image/png",
    });
    uploaded.push(path);
    await ports.reviews.attachReviewMedia(trainerId, reviewId, pose, path);
    return path;
  };

  beforeAll(async () => {
    const stamp = Date.now().toString(36);
    accounts.trainer = `fotos-entrenador-${stamp}@hector.test`;
    accounts.client = `fotos-cliente-${stamp}@hector.test`;
    trainerId = await createAccount(accounts.trainer);
    clientUserId = await createAccount(accounts.client);
    clientId = crypto.randomUUID();
    await insertRows("trainers", [
      { id: trainerId, name: "Entrenador de fotos", email: accounts.trainer, time_zone: "UTC" },
    ]);
    // Alta hace unas semanas: el cliente tiene semana actual y puede abrir su revisión.
    const start = new Date(Date.now() - 20 * 86_400_000).toISOString().slice(0, 10);
    await insertRows("clients", [
      {
        id: clientId,
        trainer_id: trainerId,
        first_name: "Cliente",
        last_name: "Fotos",
        email: accounts.client,
        status: "activo",
        start_date: start,
        review_every_days: 7,
        macros_visible: true,
      },
    ]);
    await insertRows("profiles", [
      { user_id: trainerId, role: "trainer", trainer_id: trainerId, client_id: null },
      { user_id: clientUserId, role: "client", trainer_id: trainerId, client_id: clientId },
    ]);
    ports = createSupabasePorts({
      config: { url, anonKey },
      passwordResetRedirect: "http://localhost:3000/reset-password",
      client: createClient(url, anonKey, {
        auth: { persistSession: false, autoRefreshToken: false },
      }),
    });
    await as("client");
    reviewId = (await ports.reviews.openCurrentReview(trainerId, clientId)).id;
  });

  afterAll(async () => {
    if (!ready) return;
    await removeObjects(uploaded);
    await Promise.all(
      [trainerId, clientUserId].map((id) =>
        admin(`/auth/v1/admin/users/${id}`, { method: "DELETE" }),
      ),
    );
  });

  it("the client uploads the three poses into their own folder", async () => {
    await upload("frente", [200, 60, 40]);
    await upload("perfil", [40, 200, 60]);
    await upload("espalda", [40, 60, 200]);
    const review = await ports.reviews.getReview(trainerId, reviewId);
    expect(review?.media.map((m) => m.pose).sort()).toEqual([...POSES].sort());
    for (const m of review!.media) {
      expect(m.url.startsWith(`${trainerId}/${clientId}/${reviewId}/`)).toBe(true);
      expect(await objectExists(m.url)).toBe(true);
    }
  });

  it("the client sees them through a signed URL", async () => {
    for (const pose of POSES) {
      const signed = await ports.reviews.reviewPhotoUrl((await pathOf(pose))!);
      expect(signed).toContain("token=");
      const response = await fetch(signed!);
      expect(response.status).toBe(200);
      expect(new Uint8Array(await response.arrayBuffer()).slice(1, 4)).toEqual(
        new Uint8Array([0x50, 0x4e, 0x47]),
      );
    }
    await ports.reviews.submitReview(trainerId, reviewId);
  });

  it("the trainer sees them through a signed URL once the review is sent", async () => {
    await as("trainer");
    for (const pose of POSES) {
      const signed = await ports.reviews.reviewPhotoUrl((await pathOf(pose))!);
      expect((await fetch(signed!)).status).toBe(200);
    }
  });

  it("a missing object reads as unavailable, never as a broken URL (§9.4)", async () => {
    const espalda = (await pathOf("espalda"))!;
    await removeObjects([espalda]);
    expect(await ports.reviews.reviewPhotoUrl(espalda)).toBeNull();
    // La revisión sigue apuntando a la foto: la completitud es la del envío (I5).
    expect(await pathOf("espalda")).toBe(espalda);
  });

  it("removing a photo takes its object out of Storage", async () => {
    await as("client");
    const perfil = (await pathOf("perfil"))!;
    const review = await ports.reviews.detachReviewMedia(trainerId, reviewId, "perfil");
    expect(review.media.map((m) => m.pose)).not.toContain("perfil");
    expect(await objectExists(perfil)).toBe(false);
  });

  it("replacing a photo takes the old object out of Storage too", async () => {
    const before = (await pathOf("frente"))!;
    const after = await upload("frente", [10, 10, 10]);
    expect(await pathOf("frente")).toBe(after);
    expect(await objectExists(before)).toBe(false);
    expect(await objectExists(after)).toBe(true);
  });

  it("the trainer cannot remove a photo of the client", async () => {
    await as("trainer");
    await expect(
      ports.reviews.detachReviewMedia(trainerId, reviewId, "frente"),
    ).rejects.toBeDefined();
    await as("client");
  });
});
