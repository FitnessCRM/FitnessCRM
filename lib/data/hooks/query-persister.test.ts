import type { Query } from "@tanstack/react-query";
import { describe, expect, it } from "vitest";
import { queryKeys, REVIEW_PHOTO_URL_KEY } from "./query-keys";
import { shouldPersistQuery } from "./query-persister";

/** Solo lo que mira el persistidor: la clave y el estado. */
function query(queryKey: readonly unknown[], status: "success" | "pending" = "success") {
  return { queryKey, state: { status } } as unknown as Query;
}

describe("shouldPersistQuery", () => {
  it("keeps successful reads of the trainer's data", () => {
    expect(shouldPersistQuery(query(queryKeys.clients("trainer-1")))).toBe(true);
  });

  it("never keeps the session", () => {
    expect(shouldPersistQuery(query(queryKeys.session))).toBe(false);
  });

  it("never keeps signed photo URLs, which expire", () => {
    expect(queryKeys.reviewPhotoUrl("trainer-1/client-1/review-1/a.jpg")[0]).toBe(
      REVIEW_PHOTO_URL_KEY,
    );
    expect(
      shouldPersistQuery(query(queryKeys.reviewPhotoUrl("trainer-1/client-1/review-1/a.jpg"))),
    ).toBe(false);
  });

  it("skips queries that have not succeeded yet", () => {
    expect(shouldPersistQuery(query(queryKeys.clients("trainer-1"), "pending"))).toBe(false);
  });
});
