import { describe, expect, it } from "vitest";
import {
  REVIEW_PHOTO_FORMAT,
  REVIEW_PHOTO_MAX_SIDE,
  REVIEW_PHOTO_QUALITY,
  reviewPhotoSize,
} from "./review-photo";

describe("T3a · reviewPhotoSize", () => {
  it("shrinks a portrait photo to a long side of 1600 px, keeping the proportion", () => {
    expect(reviewPhotoSize(3024, 4032)).toEqual({ width: 1200, height: 1600 });
  });

  it("shrinks a landscape photo by its width", () => {
    expect(reviewPhotoSize(4000, 3000)).toEqual({ width: 1600, height: 1200 });
  });

  it("does not upscale a smaller photo", () => {
    expect(reviewPhotoSize(800, 1200)).toEqual({ width: 800, height: 1200 });
  });

  it("leaves a photo whose long side is exactly 1600 px as it is", () => {
    expect(reviewPhotoSize(1600, 900)).toEqual({ width: 1600, height: 900 });
  });

  it("rounds to whole pixels and never drops a side below 1 px", () => {
    expect(reviewPhotoSize(5000, 3)).toEqual({ width: 1600, height: 1 });
    expect(reviewPhotoSize(4001, 3001)).toEqual({ width: 1600, height: 1200 });
  });

  it("refuses a photo without size", () => {
    expect(() => reviewPhotoSize(0, 100)).toThrow(RangeError);
    expect(() => reviewPhotoSize(100, Number.NaN)).toThrow(RangeError);
  });
});

describe("T3b · format", () => {
  it("uploads JPEG at quality 0.8, with the 1600 px cap", () => {
    expect(REVIEW_PHOTO_FORMAT).toBe("image/jpeg");
    expect(REVIEW_PHOTO_QUALITY).toBe(0.8);
    expect(REVIEW_PHOTO_MAX_SIDE).toBe(1600);
  });
});
