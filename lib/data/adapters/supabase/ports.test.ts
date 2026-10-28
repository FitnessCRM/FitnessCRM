import type { SupabaseClient } from "@supabase/supabase-js";
import { describe, expect, it, vi } from "vitest";
import { createSupabasePorts } from "./ports";

vi.mock("./client", () => ({
  createSupabaseClient: vi.fn(() => ({}) as SupabaseClient),
}));

describe("createSupabasePorts", () => {
  it("builds every port the app asks for", () => {
    const ports = createSupabasePorts({
      config: { url: "http://127.0.0.1:54321", anonKey: "anon-key" },
      passwordResetRedirect: "http://localhost:3000/reset-password",
    });

    expect(Object.keys(ports).sort()).toEqual(
      [
        "clients",
        "exercises",
        "foodCatalog",
        "invitations",
        "macroTargets",
        "measurementTypes",
        "memberships",
        "menus",
        "ownFoods",
        "passwordReset",
        "questionnaire",
        "reviews",
        "routines",
        "session",
        "templates",
        "trainer",
        "weightLogs",
        "workoutLogs",
      ].sort(),
    );
  });
});
