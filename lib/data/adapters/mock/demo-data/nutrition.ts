import type { MacroTargets, Meal, Menu, MenuBody, MenuTemplate } from "@/lib/domain";
import { CLIENT_IDS, TRAINER_ID, ts, type DemoDates } from "./common";

type Food = [name: string, grams: number];

function meal(prefix: string, name: string, foods: Food[]): Meal {
  return {
    id: `${prefix}-${name.toLowerCase()}`,
    name,
    items: foods.map(([n, grams], i) => ({
      id: `${prefix}-${name.toLowerCase()}-${i + 1}`,
      name: n,
      grams,
    })),
  };
}

/** "Menu A — Home style" from client screen, meal by meal. */
function homeStyleMenuBody(prefix: string): MenuBody {
  return {
    name: "Menú A — Casero",
    dayType: "entrenamiento",
    suggested: true,
    macros: { proteinG: 165, carbsG: 260, fatG: 72 },
    note: "Puedes intercambiar merluza por cualquier pescado blanco al mismo peso. La fruta de la merienda es libre hasta 150 g.",
    meals: [
      meal(prefix, "Desayuno", [
        ["Copos de avena", 80],
        ["Claras de huevo", 200],
        ["Plátano", 120],
      ]),
      meal(prefix, "Comida", [
        ["Arroz basmati (en seco)", 110],
        ["Pechuga de pollo", 180],
        ["Aceite de oliva", 10],
        ["Verduras variadas", 200],
      ]),
      meal(prefix, "Merienda", [
        ["Yogur griego 0%", 250],
        ["Nueces", 25],
      ]),
      meal(prefix, "Cena", [
        ["Merluza", 200],
        ["Patata cocida", 300],
        ["Aceite de oliva", 10],
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
    macros: { proteinG: 150, carbsG: 230, fatG: 80 },
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
    macros: { proteinG: 150, carbsG: 190, fatG: 65 },
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

  /** Macros del "Editor de plan": 165/260/72 entrenamiento, 150/190/65 descanso. */
  const macroTargets: MacroTargets[] = [
    targets("mt-marta-entrenamiento", "entrenamiento", { proteinG: 165, carbsG: 260, fatG: 72 }),
    targets("mt-marta-descanso", "descanso", { proteinG: 150, carbsG: 190, fatG: 65 }),
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
          macros: { proteinG: 190, carbsG: 380, fatG: 90 },
        },
        {
          id: "mnt2-d",
          ...restDayMenuBody("mnt2-d"),
          name: "Volumen descanso",
          macros: { proteinG: 180, carbsG: 300, fatG: 85 },
        },
      ],
      createdAt: ts(d.daysAgo(150)),
      updatedAt: ts(d.daysAgo(32)),
    },
  ];
  return { menus, macroTargets, menuTemplates };
}
