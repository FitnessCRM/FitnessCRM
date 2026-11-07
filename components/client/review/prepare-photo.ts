import { REVIEW_PHOTO_FORMAT, REVIEW_PHOTO_QUALITY, reviewPhotoSize } from "@/lib/domain";

/**
 * Prepara una foto de revisión en el navegador antes de subirla (T3a y T3b, `docs/dominio.md` §9):
 * el lado largo, a 1600 px como mucho y sin ampliar, y siempre JPEG con calidad 0,8. Respeta la
 * orientación que trae la foto. Devuelve `null` si el navegador no sabe leer el archivo: la pantalla
 * lo dice en vez de subir algo que nadie podrá ver.
 */
export async function prepareReviewPhoto(file: Blob): Promise<Blob | null> {
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
  } catch {
    return null;
  }
  try {
    const { width, height } = reviewPhotoSize(bitmap.width, bitmap.height);
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext("2d");
    if (!context) return null;
    context.imageSmoothingQuality = "high";
    context.drawImage(bitmap, 0, 0, width, height);
    return await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, REVIEW_PHOTO_FORMAT, REVIEW_PHOTO_QUALITY),
    );
  } finally {
    bitmap.close();
  }
}
