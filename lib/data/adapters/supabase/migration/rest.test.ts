import { describe, expect, it } from "vitest";
import { insertRows, upsertRows } from "./rest";

function recorder(respond: (body: unknown[]) => unknown[]) {
  const calls: { url: string; prefer: string; size: number }[] = [];
  const fetch = (async (input: string, init: RequestInit) => {
    const body = JSON.parse(String(init.body)) as unknown[];
    calls.push({
      url: input,
      prefer: (init.headers as Record<string, string>).Prefer!,
      size: body.length,
    });
    return new Response(JSON.stringify(respond(body)), { status: 201 });
  }) as typeof globalThis.fetch;
  return { calls, target: { url: "http://127.0.0.1:54321", serviceKey: "clave", fetch } };
}

describe("migración · escritura REST", () => {
  it("insertRows never overwrites, asks only for the keys back and counts what was created", async () => {
    const rows = Array.from({ length: 700 }, (_, i) => ({ routine_id: "r", id: `l${i}` }));
    // Simula que la mitad ya existía: PostgREST devuelve solo las insertadas.
    const { calls, target } = recorder((body) => body.slice(0, Math.ceil(body.length / 2)));
    const created = await insertRows(target, "routine_day_exercises", "routine_id,id", rows);
    expect(created).toBe(250 + 100);
    expect(calls.map((c) => c.size)).toEqual([500, 200]);
    for (const call of calls) {
      expect(call.prefer).toBe("resolution=ignore-duplicates,return=representation");
      expect(call.url).toBe(
        "http://127.0.0.1:54321/rest/v1/routine_day_exercises?on_conflict=routine_id,id&select=routine_id,id",
      );
    }
  });

  it("upsertRows keeps merging, as the migration load expects", async () => {
    const { calls, target } = recorder(() => []);
    await upsertRows(target, "exercises", "id", [{ id: "a" }]);
    expect(calls).toEqual([
      {
        url: "http://127.0.0.1:54321/rest/v1/exercises?on_conflict=id",
        prefer: "resolution=merge-duplicates,return=minimal",
        size: 1,
      },
    ]);
  });
});
