/**
 * Iconos de la app (tarjetas 19 y 145): la inicial de `APP_NAME` en Oswald Bold, en el color de texto
 * sobre acento (`tokens.color.onAccent`), sobre el acento (`tokens.color.accent`).
 *
 * CUÁNDO SE EJECUTA
 *
 *   A mano, cuando cambia `APP_NAME` (lib/i18n/es.ts) o uno de esos dos colores, y se commitean los
 *   archivos que escribe. Ni el build ni la CI lo ejecutan: los iconos generados viven en el repo.
 *     pnpm icons:generate
 *
 * QUÉ GENERA (y sobrescribe)
 *
 *   public/icons/icon-192.png           192 px, esquinas redondeadas sobre transparente (manifest)
 *   public/icons/icon-512.png           512 px, igual (manifest)
 *   public/icons/icon-512-maskable.png  512 px, a sangre: el sistema recorta la forma (manifest)
 *   app/apple-icon.png                  180 px, a sangre: iOS redondea las esquinas
 *   app/favicon.ico                     16, 32 y 48 px, redondeados, en PNG dentro del ICO
 *
 * EL DISEÑO
 *
 *   Medido el 07-11-2026 en los iconos de la «H» que había: radio de esquina 0,18 del lado; la letra
 *   mide 0,551 del lado y su centro cae en 0,511 de alto en los redondeados, y 0,405 y 0,5 en los de a
 *   sangre (así queda dentro de la zona segura del maskable, el círculo central del 80 %). La letra se
 *   centra en horizontal por su caja, y su línea base se ajusta al píxel entero más cercano.
 *
 *   Sin dependencias ni archivo de fuente: las mayúsculas de Oswald Bold que hay en `GLYPHS` son uniones
 *   de rectángulos. Se midieron con la Oswald que carga la app, en un canvas a 648 px de altura, y
 *   coinciden píxel a píxel con sus rectángulos; la «H» medida así es la de los iconos anteriores. Si la
 *   inicial no está en `GLYPHS`, el script falla: hay que medirla igual y añadirla. Una letra con curvas
 *   o diagonales no se puede describir así y pediría la fuente.
 */
import { writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { crc32, deflateSync } from "node:zlib";
import { tokens } from "@/lib/design/tokens";
import { APP_NAME } from "@/lib/i18n/es";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

/** [x0, y0, x1, y1] en unidades de altura de mayúscula, con el origen arriba a la izquierda. */
type Rect = readonly [number, number, number, number];

/** Rectángulos que no se solapan: la cobertura de un píxel es la suma de sus áreas. */
type Glyph = { width: number; rects: readonly Rect[] };

const GLYPHS: Record<string, Glyph> = {
  F: {
    width: 0.432,
    rects: [
      [0, 0, 0.221, 1],
      [0.221, 0, 0.432, 0.149],
      [0.221, 0.401, 0.405, 0.555],
    ],
  },
  H: {
    width: 0.598,
    rects: [
      [0, 0, 0.221, 1],
      [0.377, 0, 0.598, 1],
      [0.221, 0.405, 0.377, 0.563],
    ],
  },
};

type Shape = { cornerRadius: number; capHeight: number; centerY: number };

const ROUNDED: Shape = { cornerRadius: 0.18, capHeight: 0.551, centerY: 0.511 };
const FULL_BLEED: Shape = { cornerRadius: 0, capHeight: 0.405, centerY: 0.5 };

type Rgb = readonly [number, number, number];

function parseHex(color: string): Rgb {
  const match = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(color);
  if (!match) throw new Error(`Color no admitido: «${color}». Se espera #rrggbb.`);
  return [parseInt(match[1]!, 16), parseInt(match[2]!, 16), parseInt(match[3]!, 16)];
}

/** oklch → sRGB, recortando lo que cae fuera de la gama, que es lo que da el acento en pantalla. */
function parseOklch(color: string): Rgb {
  const match = /^oklch\(\s*([\d.]+)\s+([\d.]+)\s+([\d.]+)\s*\)$/.exec(color);
  if (!match) throw new Error(`Color no admitido: «${color}». Se espera oklch(L C H) sin alfa.`);
  const [lightness, chroma, hue] = [Number(match[1]), Number(match[2]), Number(match[3])];
  const a = chroma * Math.cos((hue * Math.PI) / 180);
  const b = chroma * Math.sin((hue * Math.PI) / 180);
  const l = (lightness + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const m = (lightness - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const s = (lightness - 0.0894841775 * a - 1.291485548 * b) ** 3;
  const linear = [
    4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s,
  ];
  const [r, g, bl] = linear.map((v) => {
    const c = Math.min(1, Math.max(0, v));
    const encoded = c <= 0.0031308 ? 12.92 * c : 1.055 * c ** (1 / 2.4) - 0.055;
    return Math.round(encoded * 255);
  });
  return [r!, g!, bl!];
}

function glyphFor(name: string): Glyph {
  const initial = name.trim().charAt(0).toUpperCase();
  const glyph = GLYPHS[initial];
  if (!glyph) {
    throw new Error(
      `No hay glifo para «${initial}», la inicial de APP_NAME («${name}»). Mídelo en Oswald Bold y ` +
        "añádelo a GLYPHS (ver la cabecera del script).",
    );
  }
  return glyph;
}

/** Área de un píxel [px, px+1] × [py, py+1] que cae dentro del rectángulo. */
function overlap(px: number, py: number, [x0, y0, x1, y1]: Rect): number {
  const w = Math.min(px + 1, x1) - Math.max(px, x0);
  const h = Math.min(py + 1, y1) - Math.max(py, y0);
  return w > 0 && h > 0 ? w * h : 0;
}

/** Parte del píxel dentro del cuadrado redondeado de lado `size`, muestreando solo en las esquinas. */
function shapeCoverage(px: number, py: number, size: number, radius: number): number {
  if (radius === 0) return 1;
  const inCorner = (v: number) => v < radius || v + 1 > size - radius;
  if (!inCorner(px) || !inCorner(py)) return 1;
  const samples = 16;
  let inside = 0;
  for (let i = 0; i < samples; i++) {
    for (let j = 0; j < samples; j++) {
      const x = px + (i + 0.5) / samples;
      const y = py + (j + 0.5) / samples;
      const dx = Math.max(radius - x, x - (size - radius), 0);
      const dy = Math.max(radius - y, y - (size - radius), 0);
      if (dx * dx + dy * dy <= radius * radius) inside++;
    }
  }
  return inside / (samples * samples);
}

type Image = { size: number; alpha: boolean; data: Buffer };

function render(size: number, shape: Shape, glyph: Glyph, background: Rgb, ink: Rgb): Image {
  const cap = shape.capHeight * size;
  const left = (size - glyph.width * cap) / 2;
  // La línea base cae en un píxel entero, como en los iconos anteriores: el pie de la letra queda nítido.
  const top = Math.round(shape.centerY * size + cap / 2) - cap;
  const rects = glyph.rects.map(
    ([x0, y0, x1, y1]) =>
      [left + x0 * cap, top + y0 * cap, left + x1 * cap, top + y1 * cap] as const,
  );
  const alpha = shape.cornerRadius > 0;
  const channels = alpha ? 4 : 3;
  const data = Buffer.alloc(size * size * channels);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const shapeCover = shapeCoverage(x, y, size, shape.cornerRadius * size);
      const ink01 = Math.min(
        1,
        rects.reduce((sum, rect) => sum + overlap(x, y, rect), 0),
      );
      const offset = (y * size + x) * channels;
      if (shapeCover === 0) continue; // transparente: 0, 0, 0, 0
      for (let c = 0; c < 3; c++) {
        data[offset + c] = Math.round(background[c]! + (ink[c]! - background[c]!) * ink01);
      }
      if (alpha) data[offset + 3] = Math.round(shapeCover * 255);
    }
  }
  return { size, alpha, data };
}

function chunk(type: string, body: Buffer): Buffer {
  const head = Buffer.alloc(8);
  head.writeUInt32BE(body.length, 0);
  head.write(type, 4, "ascii");
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([head.subarray(4), body])), 0);
  return Buffer.concat([head, body, crc]);
}

function encodePng({ size, alpha, data }: Image): Buffer {
  const header = Buffer.alloc(13);
  header.writeUInt32BE(size, 0);
  header.writeUInt32BE(size, 4);
  header[8] = 8; // bits por canal
  header[9] = alpha ? 6 : 2; // RGBA o RGB
  const stride = size * (alpha ? 4 : 3);
  const raw = Buffer.alloc(size * (stride + 1));
  for (let y = 0; y < size; y++) data.copy(raw, y * (stride + 1) + 1, y * stride, (y + 1) * stride);
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", header),
    chunk("IDAT", deflateSync(raw, { level: 9 })),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

/** ICO con un PNG por tamaño, que es lo que leen todos los navegadores actuales. */
function encodeIco(images: readonly { size: number; png: Buffer }[]): Buffer {
  const header = Buffer.alloc(6 + 16 * images.length);
  header.writeUInt16LE(1, 2);
  header.writeUInt16LE(images.length, 4);
  let offset = header.length;
  images.forEach(({ size, png }, i) => {
    const entry = 6 + 16 * i;
    header[entry] = size % 256;
    header[entry + 1] = size % 256;
    header.writeUInt16LE(1, entry + 4);
    header.writeUInt16LE(32, entry + 6);
    header.writeUInt32LE(png.length, entry + 8);
    header.writeUInt32LE(offset, entry + 12);
    offset += png.length;
  });
  return Buffer.concat([header, ...images.map(({ png }) => png)]);
}

function main() {
  const glyph = glyphFor(APP_NAME);
  const background = parseOklch(tokens.color.accent);
  const ink = parseHex(tokens.color.onAccent);
  const png = (size: number, shape: Shape) =>
    encodePng(render(size, shape, glyph, background, ink));

  const files: [string, Buffer][] = [
    ["public/icons/icon-192.png", png(192, ROUNDED)],
    ["public/icons/icon-512.png", png(512, ROUNDED)],
    ["public/icons/icon-512-maskable.png", png(512, FULL_BLEED)],
    ["app/apple-icon.png", png(180, FULL_BLEED)],
    ["app/favicon.ico", encodeIco([16, 32, 48].map((size) => ({ size, png: png(size, ROUNDED) })))],
  ];
  for (const [file, bytes] of files) {
    writeFileSync(path.join(repoRoot, file), bytes);
    console.log(`${file}  ${bytes.length} B`);
  }
}

main();
