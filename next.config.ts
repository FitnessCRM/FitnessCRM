import { spawnSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import type { NextConfig } from "next";
import withSerwistInit from "@serwist/next";

/** Misma versión para el precache del service worker y para invalidar la caché de datos. */
const revision =
  spawnSync("git", ["rev-parse", "HEAD"], { encoding: "utf-8" }).stdout?.trim() || randomUUID();

/**
 * Pantallas que se precachean al instalar el service worker, para que abran sin red aunque no se
 * hayan visitado antes. Son el armazón estático: los datos llegan por los hooks. El panel del
 * entrenador queda fuera por ahora (tarjeta 81: solo el área de cliente).
 */
const offlineRoutes = [
  "/~offline",
  "/login",
  "/routine",
  "/menu",
  "/weight",
  "/review",
  "/progress",
  "/view-review",
  "/membership",
];

const withSerwist = withSerwistInit({
  swSrc: "app/sw.ts",
  swDest: "public/sw.js",
  additionalPrecacheEntries: offlineRoutes.map((url) => ({ url, revision })),
  disable: process.env.NODE_ENV === "development",
});

const nextConfig: NextConfig = {
  reactStrictMode: true,
  env: { NEXT_PUBLIC_BUILD_ID: revision },
};

export default withSerwist(nextConfig);
