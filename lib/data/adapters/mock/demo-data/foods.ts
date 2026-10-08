import type { CatalogFood, Composition, Food } from "@/lib/domain";
import { TRAINER_ID, ts, type DemoDates } from "./common";

/** Otro entrenador de la plataforma: solo existe como autor de alimentos del catálogo común. */
export const OTHER_TRAINER_ID = "t-otro";

type FoodSeed = { id: string; name: string; composition: Composition };

const seed = (
  id: string,
  name: string,
  [kcal, proteinG, carbsG, fatG]: [number, number, number, number],
): FoodSeed => ({ id, name, composition: { kcal, proteinG, carbsG, fatG } });

/**
 * Alimentos de Adrián, con su composición por 100 g. Los nombres son los de los menús de la demo,
 * para que los alimentos del menú que salen de aquí se lean igual que antes.
 */
export const OWN_FOODS = {
  avena: seed("food-avena", "Copos de avena", [372, 13.5, 58.7, 7]),
  claras: seed("food-claras", "Claras de huevo", [52, 10.9, 0.7, 0.2]),
  platano: seed("food-platano", "Plátano", [94, 1.2, 20, 0.3]),
  arroz: seed("food-arroz-basmati", "Arroz basmati (en seco)", [354, 8, 77, 0.9]),
  pollo: seed("food-pollo", "Pechuga de pollo", [113, 23, 0, 1.9]),
  aceite: seed("food-aceite-oliva", "Aceite de oliva", [899, 0, 0, 99.9]),
  patata: seed("food-patata-cocida", "Patata cocida", [77, 1.9, 16, 0.1]),
  // Corregida hace poco y aún sin publicar: el catálogo sirve la versión anterior.
  merluza: seed("food-merluza", "Merluza", [71, 15.9, 0, 0.9]),
  // Recién creada y aún sin publicar: no está en el catálogo.
  requeson: seed("food-requeson", "Requesón", [98, 11, 3.4, 4.3]),
} as const;

/** Archivado y publicado: no sale de ningún sitio. */
const AVENA_MIEL = seed("food-avena-miel", "Avena con miel", [389, 11, 66, 6.5]);

/** Alimentos de otro entrenador: Adrián solo los ve en el catálogo común, como «de otro». */
export const OTHER_FOODS = {
  yogur: seed("food-yogur-griego-0", "Yogur griego 0%", [59, 10.3, 3.6, 0.4]),
  nueces: seed("food-nueces", "Nueces", [654, 15.2, 13.7, 65.2]),
  pan: seed("food-pan-integral", "Pan integral", [247, 13, 41, 3.4]),
  atun: seed("food-atun-natural", "Atún al natural", [116, 25.5, 0, 1]),
} as const;

/** Entrada del catálogo común en el adaptador en memoria: guarda el autor para I28, nunca lo da. */
export interface CatalogEntry {
  authorId: string;
  food: CatalogFood;
}

export function buildFoods(d: DemoDates): { foods: Food[]; catalogFoods: CatalogEntry[] } {
  const own = (
    s: FoodSeed,
    over: Partial<Pick<Food, "status" | "publishStatus" | "createdAt" | "updatedAt">> = {},
  ): Food => ({
    ...s,
    trainerId: TRAINER_ID,
    status: "activo",
    publishStatus: "publicado",
    createdAt: ts(d.daysAgo(120)),
    updatedAt: ts(d.daysAgo(120)),
    ...over,
  });

  const foods: Food[] = [
    own(OWN_FOODS.avena),
    own(OWN_FOODS.claras),
    own(OWN_FOODS.platano),
    own(OWN_FOODS.arroz),
    own(OWN_FOODS.pollo),
    own(OWN_FOODS.aceite),
    own(OWN_FOODS.patata),
    own(OWN_FOODS.merluza, { publishStatus: "pendiente", updatedAt: ts(d.yesterday) }),
    own(OWN_FOODS.requeson, {
      publishStatus: "pendiente",
      createdAt: ts(d.yesterday, "19:30:00"),
      updatedAt: ts(d.yesterday, "19:30:00"),
    }),
    own(AVENA_MIEL, {
      status: "archivado",
      updatedAt: ts(d.daysAgo(40)),
    }),
  ];

  // Solo lo que lleva el catálogo: nada del autor ni del estado de publicación.
  const published = (
    s: FoodSeed,
    authorId = TRAINER_ID,
    status: CatalogFood["status"] = "activo",
  ): CatalogEntry => ({
    authorId,
    food: { id: s.id, name: s.name, composition: { ...s.composition }, status },
  });

  const catalogFoods: CatalogEntry[] = [
    ...foods
      .filter((f) => f.publishStatus === "publicado" && f.status === "activo")
      .map((f) => published(f)),
    // La versión de la merluza anterior a la corrección de ayer.
    published(seed(OWN_FOODS.merluza.id, OWN_FOODS.merluza.name, [64, 11.8, 0, 1.8])),
    published(AVENA_MIEL, TRAINER_ID, "archivado"),
    ...Object.values(OTHER_FOODS).map((s) => published(s, OTHER_TRAINER_ID)),
  ];

  return { foods, catalogFoods };
}
