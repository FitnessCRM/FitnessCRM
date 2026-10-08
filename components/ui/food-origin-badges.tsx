import { Badge } from "@/components/ui/badge";
import type { LibraryFood } from "@/lib/domain";
import { es } from "@/lib/i18n/es";
import { cn } from "@/lib/utils";

const t = es.status;

/** El origen de un alimento como se lee (§4): tuyo, de otra cuenta o la fuente del sembrado. */
export function foodOriginLabel(food: LibraryFood): string {
  if (food.origin === "own") return t.foodOrigin.own;
  if (food.origin === "other") return t.foodOrigin.other;
  return t.foodOrigin[food.source];
}

/**
 * Píldoras del origen de un alimento y, si es tuyo y aún no está en el catálogo, «Pendiente de
 * publicar». Siempre visibles: en táctil no hay `title`. Neutras las dos: el acento es rojo y
 * «pendiente» no es un error.
 */
export function FoodOriginBadges({ food, className }: { food: LibraryFood; className?: string }) {
  return (
    <span className={cn("flex flex-wrap gap-1.5", className)}>
      <Badge variant="outline">{foodOriginLabel(food)}</Badge>
      {food.origin === "own" && food.publishStatus === "pendiente" ? (
        <Badge variant="secondary">{t.foodPublish.pendiente}</Badge>
      ) : null}
    </span>
  );
}
