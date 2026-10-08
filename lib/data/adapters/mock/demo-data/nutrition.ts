import {
  createFoodItem,
  type CatalogFood,
  type MacroTargets,
  type Meal,
  type Menu,
  type MenuBody,
  type MenuTemplate,
} from "@/lib/domain";
import { CLIENT_IDS, TRAINER_ID, ts, type DemoDates } from "./common";
import { OTHER_FOODS, OWN_FOODS } from "./foods";

/**
 * Un alimento del menú: de texto libre si lleva el nombre, de la biblioteca si lleva el alimento.
 * Los de la biblioteca salen de `createFoodItem`, con su copia congelada (I29).
 */
type Item = [food: string | Pick<CatalogFood, "id" | "name" | "composition">, grams: number];

function meal(prefix: string, name: string, items: Item[]): Meal {
  return {
    id: `${prefix}-${name.toLowerCase()}`,
    name,
    items: items.map(([food, grams], i) => {
      const id = `${prefix}-${name.toLowerCase()}-${i + 1}`;
      return typeof food === "string"
        ? { id, name: food, grams }
        : createFoodItem(food, grams, () => id);
    }),
  };
}

/**
 * "Menu A — Home style" from client screen, meal by meal. Its food comes from the library (Adrián's
 * own and someone else's from the shared catalog) except the vegetables, which stay free text and
 * do not add up (I30).
 */
function homeStyleMenuBody(prefix: string): MenuBody {
  return {
    name: "Menú A — Casero",
    dayType: "entrenamiento",
    suggested: true,
    macros: { kcal: 2348, proteinG: 165, carbsG: 260, fatG: 72 },
    note: "Puedes intercambiar merluza por cualquier pescado blanco al mismo peso. La fruta de la merienda es libre hasta 150 g.",
    meals: [
      meal(prefix, "Desayuno", [
        [OWN_FOODS.avena, 80],
        [OWN_FOODS.claras, 200],
        [OWN_FOODS.platano, 120],
      ]),
      meal(prefix, "Comida", [
        [OWN_FOODS.arroz, 110],
        [OWN_FOODS.pollo, 180],
        [OWN_FOODS.aceite, 10],
        ["Verduras variadas", 200],
      ]),
      meal(prefix, "Merienda", [
        [OTHER_FOODS.yogur, 250],
        [OTHER_FOODS.nueces, 25],
      ]),
      meal(prefix, "Cena", [
        [OWN_FOODS.merluza, 200],
        [OWN_FOODS.patata, 300],
        [OWN_FOODS.aceite, 10],
      ]),
    ],
  };
}

/**
 * Menu B declares macros that match neither the client's target (165/260/72) nor the sum of its food:
 * the trainer writes and decides them (§5). By design, so the menu screen showcases the case
 * that its labeling must make clear.
 */
function quickTupperMenuBody(prefix: string): MenuBody {
  return {
    name: "Menú B — Rápido / Tupper",
    dayType: "entrenamiento",
    suggested: false,
    macros: { kcal: 2240, proteinG: 150, carbsG: 230, fatG: 80 },
    note: "",
    meals: [
      meal(prefix, "Desayuno", [
        ["Pan integral", 100],
        ["Pavo", 100],
        ["Fruta", 150],
      ]),
      meal(prefix, "Comida", [
        ["Pasta (en seco)", 120],
        ["Atún al natural", 160],
        ["Aceite de oliva", 10],
      ]),
      meal(prefix, "Cena", [
        ["Tortilla (huevos)", 150],
        ["Patata", 250],
        ["Ensalada", 150],
      ]),
    ],
  };
}

function restDayMenuBody(prefix: string): MenuBody {
  return {
    name: "Menú descanso",
    dayType: "descanso",
    suggested: true,
    macros: { kcal: 1945, proteinG: 150, carbsG: 190, fatG: 65 },
    note: "",
    meals: [
      meal(prefix, "Desayuno", [
        ["Copos de avena", 50],
        ["Claras de huevo", 200],
        ["Fruta", 150],
      ]),
      meal(prefix, "Comida", [
        ["Arroz basmati (en seco)", 80],
        ["Pechuga de pollo", 180],
        ["Verduras variadas", 250],
      ]),
      meal(prefix, "Cena", [
        ["Merluza", 200],
        ["Patata cocida", 200],
        ["Aceite de oliva", 10],
      ]),
    ],
  };
}

/**
 * Kcal que NO cuadran con 4/4/9, a propósito: 160/280/70 g darían 2.390 y el entrenador escribe
 * 2.500 redondeando. Las kcal son suyas y la app no las corrige ni avisa (§5); este caso lo
 * cubre el test del adaptador y se ve en el editor de plantillas.
 */
function roundedKcalMenuBody(prefix: string): MenuBody {
  return {
    name: "Mantenimiento — kcal redondeadas",
    dayType: "entrenamiento",
    suggested: true,
    macros: { kcal: 2500, proteinG: 160, carbsG: 280, fatG: 70 },
    note: "",
    meals: [
      meal(prefix, "Comida", [
        ["Arroz basmati (en seco)", 100],
        ["Pechuga de pollo", 200],
        ["Aceite de oliva", 10],
      ]),
    ],
  };
}

export function buildNutrition(d: DemoDates): {
  menus: Menu[];
  macroTargets: MacroTargets[];
  menuTemplates: MenuTemplate[];
} {
  const clientMenu = (id: string, body: MenuBody): Menu => ({
    id,
    trainerId: TRAINER_ID,
    clientId: CLIENT_IDS.marta,
    ...body,
    status: "activo",
    sourceTemplateName: "Definición 2.400",
    createdAt: ts(d.martaStart),
    updatedAt: ts(d.martaStart),
  });

  const menus: Menu[] = [
    clientMenu("mn-marta-a", homeStyleMenuBody("mn-marta-a")),
    clientMenu("mn-marta-b", quickTupperMenuBody("mn-marta-b")),
    clientMenu("mn-marta-descanso", restDayMenuBody("mn-marta-descanso")),
  ];

  const targets = (
    id: string,
    dayType: MacroTargets["dayType"],
    macros: MacroTargets["macros"],
  ): MacroTargets => ({
    id,
    trainerId: TRAINER_ID,
    clientId: CLIENT_IDS.marta,
    dayType,
    macros,
    status: "activo",
    createdAt: ts(d.martaStart),
    updatedAt: ts(d.martaStart),
  });

  /**
   * Macros del "Editor de plan": 165/260/72 entrenamiento, 150/190/65 descanso. Las kcal son las
   * que la pantalla enseñaba cuando se derivaban, para que las capturas sigan cuadrando.
   */
  const macroTargets: MacroTargets[] = [
    targets("mt-marta-entrenamiento", "entrenamiento", {
      kcal: 2348,
      proteinG: 165,
      carbsG: 260,
      fatG: 72,
    }),
    targets("mt-marta-descanso", "descanso", { kcal: 1945, proteinG: 150, carbsG: 190, fatG: 65 }),
  ];

  const menuTemplates: MenuTemplate[] = [
    {
      id: "mnt-definicion-2400",
      trainerId: TRAINER_ID,
      name: "Definición 2.400",
      description: "",
      menus: [
        { id: "mnt1-a", ...homeStyleMenuBody("mnt1-a") },
        { id: "mnt1-b", ...quickTupperMenuBody("mnt1-b") },
        { id: "mnt1-d", ...restDayMenuBody("mnt1-d") },
        { id: "mnt1-d2", ...restDayMenuBody("mnt1-d2"), name: "Menú descanso B", suggested: false },
      ],
      createdAt: ts(d.daysAgo(180)),
      updatedAt: ts(d.daysAgo(9)),
    },
    {
      id: "mnt-volumen-3000",
      trainerId: TRAINER_ID,
      name: "Volumen 3.000",
      description: "",
      menus: [
        {
          id: "mnt2-a",
          ...homeStyleMenuBody("mnt2-a"),
          name: "Volumen A",
          macros: { kcal: 3090, proteinG: 190, carbsG: 380, fatG: 90 },
        },
        {
          id: "mnt2-d",
          ...restDayMenuBody("mnt2-d"),
          name: "Volumen descanso",
          macros: { kcal: 2685, proteinG: 180, carbsG: 300, fatG: 85 },
        },
      ],
      createdAt: ts(d.daysAgo(150)),
      updatedAt: ts(d.daysAgo(32)),
    },
    {
      id: "mnt-mantenimiento-2500",
      trainerId: TRAINER_ID,
      name: "Mantenimiento 2.500",
      description: "",
      menus: [{ id: "mnt3-a", ...roundedKcalMenuBody("mnt3-a") }],
      createdAt: ts(d.daysAgo(60)),
      updatedAt: ts(d.daysAgo(20)),
    },
  ];
  return { menus, macroTargets, menuTemplates };
}
