import { describe, expect, it } from "vitest";
import { REVIEW_PHOTO_CONTENT_TYPES, toReviewPhotoContentType } from "./reviews";

describe("toReviewPhotoContentType", () => {
  it.each(REVIEW_PHOTO_CONTENT_TYPES)("admits %s, the types the bucket accepts", (type) => {
    expect(toReviewPhotoContentType(type)).toBe(type);
  });

  it.each(["image/heic", "image/gif", "application/pdf", ""])(
    "refuses %j, which the bucket would reject",
    (type) => {
      expect(toReviewPhotoContentType(type)).toBeUndefined();
    },
  );
});
