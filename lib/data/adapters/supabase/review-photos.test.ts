import { describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "./client";
import { createReviewPort } from "./reviews";

const TRAINER = "11111111-1111-4111-8111-111111111111";
const CLIENT = "22222222-2222-4222-8222-222222222222";
const REVIEW = "33333333-3333-4333-8333-333333333333";
const PATH_PATTERN = new RegExp(`^${TRAINER}/${CLIENT}/${REVIEW}/[0-9a-f-]{36}\\.jpg$`);

interface FakeStorage {
  upload: ReturnType<typeof vi.fn>;
  info: ReturnType<typeof vi.fn>;
  createSignedUrl: ReturnType<typeof vi.fn>;
}

/** Un cliente de Supabase con solo la parte de Storage, RPC y funciones que usa el puerto. */
function fakeClient(
  storage: Partial<FakeStorage>,
  extra: { rpc?: ReturnType<typeof vi.fn>; invoke?: ReturnType<typeof vi.fn> } = {},
) {
  const bucket = {
    upload: vi.fn(async () => ({ data: { path: "" }, error: null })),
    info: vi.fn(async () => ({ data: {}, error: null })),
    createSignedUrl: vi.fn(async () => ({ data: { signedUrl: "https://signed" }, error: null })),
    ...storage,
  };
  const client = {
    storage: { from: vi.fn(() => bucket) },
    rpc: extra.rpc ?? vi.fn(async () => ({ data: null, error: null })),
    functions: {
      invoke: extra.invoke ?? vi.fn(async () => ({ data: { removed: [] }, error: null })),
    },
  };
  return { bucket, client, port: createReviewPort(client as unknown as SupabaseClient) };
}

const photo = () => new Blob(["jpeg"], { type: "image/jpeg" });

describe("uploadReviewPhoto", () => {
  it("uploads into the review folder of the bucket, with the MIME type and no overwrite", async () => {
    const { bucket, port } = fakeClient({});
    const path = await port.uploadReviewPhoto({
      trainerId: TRAINER,
      clientId: CLIENT,
      reviewId: REVIEW,
      file: photo(),
      contentType: "image/jpeg",
    });
    expect(path).toMatch(PATH_PATTERN);
    const [sent, , options] = bucket.upload.mock.calls[0] as unknown as [string, Blob, object];
    expect(sent).toBe(path);
    expect(options).toEqual({ contentType: "image/jpeg", upsert: false });
  });

  it("gives every photo its own path, so a replacement never overwrites the old object", async () => {
    const { port } = fakeClient({});
    const input = {
      trainerId: TRAINER,
      clientId: CLIENT,
      reviewId: REVIEW,
      file: photo(),
      contentType: "image/jpeg" as const,
    };
    const first = await port.uploadReviewPhoto(input);
    const second = await port.uploadReviewPhoto(input);
    expect(first).not.toBe(second);
  });

  it("refuses with the storage error when the upload fails", async () => {
    const { port } = fakeClient({
      upload: vi.fn(async () => ({ data: null, error: { message: "payload too large" } })),
    });
    await expect(
      port.uploadReviewPhoto({
        trainerId: TRAINER,
        clientId: CLIENT,
        reviewId: REVIEW,
        file: photo(),
        contentType: "image/jpeg",
      }),
    ).rejects.toThrow("payload too large");
  });
});

describe("reviewPhotoUrl", () => {
  it("returns a signed URL for a photo that exists", async () => {
    const { bucket, port } = fakeClient({});
    await expect(port.reviewPhotoUrl(`${TRAINER}/${CLIENT}/${REVIEW}/a.jpg`)).resolves.toBe(
      "https://signed",
    );
    expect(bucket.createSignedUrl).toHaveBeenCalledWith(
      `${TRAINER}/${CLIENT}/${REVIEW}/a.jpg`,
      600,
    );
  });

  it("returns null, not an error, when the photo no longer exists", async () => {
    const { bucket, port } = fakeClient({
      info: vi.fn(async () => ({
        data: null,
        error: { message: "Object not found", statusCode: "404" },
      })),
    });
    await expect(port.reviewPhotoUrl("gone.jpg")).resolves.toBeNull();
    expect(bucket.createSignedUrl).not.toHaveBeenCalled();
  });

  it("raises other storage errors instead of hiding them as a missing photo", async () => {
    const { port } = fakeClient({
      info: vi.fn(async () => ({
        data: null,
        error: { message: "network down", statusCode: "500" },
      })),
    });
    await expect(port.reviewPhotoUrl("a.jpg")).rejects.toThrow("network down");
  });
});

describe("attachReviewMedia", () => {
  const OLD = `${TRAINER}/${CLIENT}/${REVIEW}/old.jpg`;
  const NEW = `${TRAINER}/${CLIENT}/${REVIEW}/new.jpg`;

  // El puerto relee la revisión al final, y el fake no la tiene: esa lectura falla después de lo que
  // interesa. Aquí importa la sustitución y la petición de borrado, no la revisión devuelta.
  const attach = (port: ReturnType<typeof createReviewPort>) =>
    port.attachReviewMedia(TRAINER, REVIEW, "frente", NEW).catch(() => undefined);

  it("asks the function to remove the photo the replacement left unused", async () => {
    const invoke = vi.fn(async () => ({ data: { removed: [OLD] }, error: null }));
    const rpc = vi.fn(async () => ({ data: OLD, error: null }));
    const { port } = fakeClient({}, { rpc, invoke });
    await attach(port);
    expect(invoke).toHaveBeenCalledWith("delete-review-photos", { body: { paths: [OLD] } });
  });

  it("asks for nothing when the pose had no photo to replace", async () => {
    const invoke = vi.fn(async () => ({ data: { removed: [] }, error: null }));
    const rpc = vi.fn(async () => ({ data: null, error: null }));
    const { port } = fakeClient({}, { rpc, invoke });
    await attach(port);
    expect(invoke).not.toHaveBeenCalled();
  });
});
