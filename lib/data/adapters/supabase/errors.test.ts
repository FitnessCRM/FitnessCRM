import { describe, expect, it } from "vitest";
import { DomainError } from "@/lib/domain";
import { notFoundError, raise, toDomainError } from "./errors";

describe("toDomainError", () => {
  it("turns a business raise (P0001) into a domain error with its code", () => {
    const error = toDomainError({ code: "P0001", message: "client.not_writable" });
    expect(error).toBeInstanceOf(DomainError);
    expect((error as DomainError).code).toBe("client.not_writable");
  });

  it("maps every function's *.not_found to the not_found code the ports promise", () => {
    const error = toDomainError({ code: "P0001", message: "exercise.not_found" });
    expect((error as DomainError).code).toBe("not_found");
  });

  it("keeps any other backend error as a plain error with its SQLSTATE", () => {
    const error = toDomainError({ code: "42501", message: "new row violates row-level security" });
    expect(error).not.toBeInstanceOf(DomainError);
    expect(error.message).toBe("new row violates row-level security");
    expect((error as Error & { code?: string }).code).toBe("42501");
  });
});

describe("raise", () => {
  it("does nothing without an error", () => {
    expect(() => raise(null)).not.toThrow();
  });

  it("throws the mapped error when the query failed", () => {
    expect(() => raise({ code: "P0001", message: "membership.overlap" })).toThrow(DomainError);
  });
});

describe("notFoundError", () => {
  it("carries the not_found code the ports promise", () => {
    expect(notFoundError("Cliente").code).toBe("not_found");
  });
});
