// Tests del CORS de las funciones que llama el navegador (tarjeta 139). Sin red y sin claves: el
// manejador es una función de prueba.
import { describe, expect, it, vi } from "vitest";
import { CORS_ALLOW_HEADERS, originOf, serveBrowserFunction } from "./cors";

const APP = "https://app.example.com";
const URL_ = "https://fn.example.com/functions/v1/stripe-connect";

const request = (method: string) =>
  new Request(URL_, {
    method,
    headers: { Origin: APP },
    body: method === "POST" ? "{}" : undefined,
  });

const options = (configured: boolean, origin: string | null = APP) => ({
  origin,
  config: configured ? { app: APP } : null,
  misconfiguredCode: "payment.misconfigured",
  failureCode: "payment.connect_failed",
});

function expectCors(response: Response, origin: string) {
  expect(response.headers.get("Access-Control-Allow-Origin")).toBe(origin);
  expect(response.headers.get("Access-Control-Allow-Headers")).toBe(CORS_ALLOW_HEADERS);
  expect(response.headers.get("Access-Control-Allow-Methods")).toBe("POST, OPTIONS");
}

describe("serveBrowserFunction", () => {
  it("answers OPTIONS with CORS when everything is configured, without running the handler", async () => {
    const handle = vi.fn();
    const response = await serveBrowserFunction(request("OPTIONS"), options(true), handle);
    expect(response.status).toBe(200);
    expectCors(response, APP);
    expect(handle).not.toHaveBeenCalled();
  });

  it("answers OPTIONS with CORS even when the configuration is missing", async () => {
    const handle = vi.fn();
    const keyMissing = await serveBrowserFunction(request("OPTIONS"), options(false), handle);
    expect(keyMissing.status).toBe(200);
    expectCors(keyMissing, APP);

    const appUrlMissing = await serveBrowserFunction(
      request("OPTIONS"),
      options(false, null),
      handle,
    );
    expect(appUrlMissing.status).toBe(200);
    expectCors(appUrlMissing, "*");
    expect(handle).not.toHaveBeenCalled();
  });

  it("returns the misconfigured code with CORS, so the app can read it", async () => {
    const handle = vi.fn();
    const keyMissing = await serveBrowserFunction(request("POST"), options(false), handle);
    expect(keyMissing.status).toBe(500);
    expectCors(keyMissing, APP);
    expect(await keyMissing.json()).toEqual({ code: "payment.misconfigured" });

    const appUrlMissing = await serveBrowserFunction(request("POST"), options(false, null), handle);
    expect(appUrlMissing.status).toBe(500);
    expectCors(appUrlMissing, "*");
    expect(await appUrlMissing.json()).toEqual({ code: "payment.misconfigured" });
    expect(handle).not.toHaveBeenCalled();
  });

  it("allows only the app origin once configured, never *", async () => {
    const response = await serveBrowserFunction(request("POST"), options(true), (_config, reply) =>
      Promise.resolve(reply(200, { url: "https://stripe.example.com" })),
    );
    expect(response.status).toBe(200);
    expectCors(response, APP);
  });

  it("passes the configuration to the handler", async () => {
    const handle = vi.fn((config: { app: string }, reply) => Promise.resolve(reply(200, config)));
    const response = await serveBrowserFunction(request("POST"), options(true), handle);
    expect(await response.json()).toEqual({ app: APP });
  });

  it("refuses other methods with CORS", async () => {
    const response = await serveBrowserFunction(request("GET"), options(true), vi.fn());
    expect(response.status).toBe(405);
    expectCors(response, APP);
  });

  it("turns a throw in the handler into the failure code, with CORS", async () => {
    const response = await serveBrowserFunction(request("POST"), options(true), () =>
      Promise.reject(new Error("network down")),
    );
    expect(response.status).toBe(500);
    expectCors(response, APP);
    expect(await response.json()).toEqual({ code: "payment.connect_failed" });
  });
});

describe("originOf", () => {
  it("keeps only the origin of the app URL", () => {
    expect(originOf("https://fitness-crm-dun.vercel.app/accept-invite")).toBe(
      "https://fitness-crm-dun.vercel.app",
    );
  });

  it("gives null when the secret is missing or is not a URL", () => {
    expect(originOf(undefined)).toBeNull();
    expect(originOf("")).toBeNull();
    expect(originOf("not a url")).toBeNull();
  });
});
