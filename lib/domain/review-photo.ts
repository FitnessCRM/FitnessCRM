/**
 * Cómo se prepara una foto de revisión antes de subirla (T3a y T3b, `docs/dominio.md` §9). Es puro:
 * calcula el tamaño y fija el formato; quien dibuja la imagen es el navegador.
 */

/** T3a: el lado largo de una foto subida mide como mucho esto, en píxeles. */
export const REVIEW_PHOTO_MAX_SIDE = 1600;

/** T3b: toda foto se sube como JPEG, con esta calidad (de 0 a 1). */
export const REVIEW_PHOTO_FORMAT = "image/jpeg" as const;
export const REVIEW_PHOTO_QUALITY = 0.8;

/**
 * Tamaño con el que se sube una foto de `width` × `height` píxeles: el lado largo, a
 * `REVIEW_PHOTO_MAX_SIDE` como mucho, conservando la proporción y en píxeles enteros. Una foto más
 * pequeña no se amplía (T3a). Un lado nunca baja de 1 px, por estrecha que sea la foto.
 */
export function reviewPhotoSize(width: number, height: number): { width: number; height: number } {
  if (!(width > 0) || !(height > 0)) {
    throw new RangeError("Una foto necesita ancho y alto mayores que cero.");
  }
  const scale = Math.min(1, REVIEW_PHOTO_MAX_SIDE / Math.max(width, height));
  if (scale === 1) return { width: Math.round(width), height: Math.round(height) };
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
  };
}
