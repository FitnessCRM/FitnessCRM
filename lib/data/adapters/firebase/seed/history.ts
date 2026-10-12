import {
  addCivilDays,
  assertExercisesInLibrary,
  assertWeightLogDate,
  cloneMenuTemplate,
  cloneRoutineTemplate,
  macroTargetsSchema,
  menuSchema,
  round1,
  routineSchema,
  setFoodItemGrams,
  weightLogSchema,
  workoutLogSchema,
  type Client,
  type DayType,
  type Exercise,
  type MacroTargets,
  type Macros,
  type Menu,
  type MenuTemplate,
  type Routine,
  type RoutineTemplate,
  type WeightLog,
  type WorkoutLog,
} from "@/lib/domain";
import { weightLogDocId, workoutLogDocId } from "../logs";
import { sequence } from "./ids";
import { EXERCISE_IDS, type ExerciseKey, type SeedContext } from "./library";
import type { ClientKey } from "./people";
import { at, seededRandom } from "./time";

/* ---------- Pesajes ---------- */

/**
 * Días desde el alta en que cada cliente se pesó: cada 2–3 días, con una laguna de una semana. El
 * último es el ancla («hoy»), y cada semana con revisión tiene al menos un pesaje en su ventana (I9).
 */
export const WEIGHT_OFFSETS: Record<ClientKey, readonly number[]> = {
  lucas: [0, 2, 5, 7, 9, 12, 14, 17, 19, 26, 28, 30, 33, 35, 37, 40],
  irene: [
    0, 3, 5, 7, 10, 12, 14, 16, 19, 21, 29, 31, 33, 35, 38, 40, 42, 45, 47, 49, 52, 54, 56, 58, 61,
    63,
  ],
};

/** Peso de partida y tendencia: Lucas sube unos 0,2 kg por semana; Irene baja unos 0,4. */
const WEIGHT_TREND: Record<ClientKey, { startKg: number; kgPerWeek: number; seed: number }> = {
  lucas: { startKg: 74, kgPerWeek: 0.2, seed: 104 },
  irene: { startKg: 64, kgPerWeek: -0.4, seed: 401 },
};

/** Cuánto se aparta un pesaje de la tendencia, como mucho: ±0,2 kg. */
const WEIGHT_NOISE_KG = 0.4;

/**
 * Un pesaje por fecha (I23: el id es `{clientId}_{fecha}`), ninguno anterior al alta ni posterior
 * al ancla (I27, con la misma función que usa el adaptador).
 */
export function buildWeightLogs(ctx: SeedContext, key: ClientKey, client: Client): WeightLog[] {
  const { startKg, kgPerWeek, seed } = WEIGHT_TREND[key];
  const random = seededRandom(seed);
  const offsets = WEIGHT_OFFSETS[key];
  return offsets.map((offset, i) => {
    const date = addCivilDays(client.startDate, offset);
    assertWeightLogDate(date, { today: ctx.anchor, startDate: client.startDate });
    const previous = offsets[i - 1];
    const backAfterGap = previous !== undefined && offset - previous > 4;
    return weightLogSchema.parse({
      id: weightLogDocId(client.id, date),
      trainerId: ctx.trainerId,
      clientId: client.id,
      date,
      weightKg: round1(startKg + (kgPerWeek * offset) / 7 + (random() - 0.5) * WEIGHT_NOISE_KG),
      note: offset === 0 ? "Peso de partida" : backAfterGap ? "Vuelta de viaje" : "",
      createdAt: at(ctx.clock, date, "07:40"),
    });
  });
}

/* ---------- Rutina ---------- */

/**
 * La rutina activa del cliente: la plantilla clonada con `cloneRoutineTemplate` (§4: copia, no
 * enlace) y publicada. El clon nace `borrador`; la nota es lo que el entrenador escribe antes de
 * activarla. Solo ejercicios activos de la biblioteca (I3).
 */
export function buildRoutine(
  ctx: SeedContext,
  client: Client,
  template: RoutineTemplate,
  library: readonly Exercise[],
  note: string,
): Routine {
  const draft = cloneRoutineTemplate(template, {
    trainerId: ctx.trainerId,
    clientId: client.id,
    newId: sequence(`${client.id}-rt`),
    now: at(ctx.clock, client.startDate, "11:00"),
  });
  const active = routineSchema.parse({
    ...draft,
    note,
    status: "activo",
    updatedAt: at(ctx.clock, client.startDate, "11:10"),
  });
  assertExercisesInLibrary(active, library);
  return active;
}

/* ---------- Macros objetivo y menús ---------- */

export function buildMacroTargets(
  ctx: SeedContext,
  client: Client,
  targets: Record<DayType, Macros>,
): MacroTargets[] {
  const createdAt = at(ctx.clock, client.startDate, "11:20");
  return (Object.keys(targets) as DayType[]).map((dayType) =>
    macroTargetsSchema.parse({
      id: `${client.id}-macros-${dayType}`,
      trainerId: ctx.trainerId,
      clientId: client.id,
      dayType,
      macros: targets[dayType],
      status: "activo",
      createdAt,
      updatedAt: createdAt,
    }),
  );
}

/** Lo que el entrenador retoca en el borrador clonado antes de publicarlo. */
export interface MenuAdjustment {
  /** Multiplica los gramos de los alimentos de la biblioteca, redondeados a 5 g. */
  gramsFactor: number;
  /** Macros declaradas de cada menú, en el orden de la plantilla. */
  macros: readonly Macros[];
}

/**
 * Los menús activos del cliente: la plantilla clonada con `cloneMenuTemplate`, que conserva la copia
 * congelada de cada alimento (I29), y publicada. Con `adjustment`, los gramos cambian con
 * `setFoodItemGrams` —sin perder el vínculo con la biblioteca— y las macros son las que el
 * entrenador declara para ese cliente.
 */
export function buildMenus(
  ctx: SeedContext,
  client: Client,
  template: MenuTemplate,
  adjustment?: MenuAdjustment,
): Menu[] {
  const drafts = cloneMenuTemplate(template, {
    trainerId: ctx.trainerId,
    clientId: client.id,
    newId: sequence(`${client.id}-mn`),
    now: at(ctx.clock, client.startDate, "11:30"),
  });
  return drafts.map((draft, i) => {
    const adjusted = adjustment
      ? {
          ...draft,
          macros: adjustment.macros[i] ?? draft.macros,
          meals: draft.meals.map((meal) => ({
            ...meal,
            items: meal.items.map((item) =>
              item.foodId === undefined
                ? item
                : setFoodItemGrams(item, Math.round((item.grams * adjustment.gramsFactor) / 5) * 5),
            ),
          })),
        }
      : draft;
    return menuSchema.parse({
      ...adjusted,
      status: "activo",
      updatedAt: at(ctx.clock, client.startDate, "11:40"),
    });
  });
}

/* ---------- Entrenos registrados ---------- */

/** Un entreno: hace cuántos días fue y qué día de la rutina se hizo. */
export type Session = [daysAgo: number, dayNumber: number];

/** Lucas: tres semanas, tres días por semana. Irene: la última semana, sus cuatro días. */
export const SESSIONS: Record<ClientKey, readonly Session[]> = {
  lucas: [
    [20, 1],
    [18, 2],
    [16, 3],
    [13, 1],
    [11, 2],
    [9, 3],
    [6, 1],
    [4, 2],
    [2, 3],
  ],
  irene: [
    [6, 1],
    [5, 2],
    [3, 3],
    [2, 4],
  ],
};

/** Carga de partida en kg y lo que sube cada vez que se repite el día. Las dominadas, sin lastre. */
const LOADS: Record<ExerciseKey, [startKg: number, stepKg: number]> = {
  squat: [80, 2.5],
  bench: [65, 2.5],
  pullup: [0, 0],
  rdl: [85, 2.5],
  bulgarian: [16, 1],
  row: [60, 2.5],
  legPress: [140, 5],
  legCurl: [35, 2.5],
  ohp: [40, 2.5],
  inclineDb: [22, 1],
  latPulldown: [55, 2.5],
  lateralRaise: [8, 0],
};

/** Las cargas de Irene son una fracción de las de la tabla. */
const LOAD_FACTOR: Record<ClientKey, number> = { lucas: 1, irene: 0.6 };

const EXERCISE_KEY_BY_ID = new Map(
  (Object.entries(EXERCISE_IDS) as [ExerciseKey, string][]).map(([key, id]) => [id, key]),
);

/** Discos de 1,25 kg en barra y máquina; mancuernas de kilo en kilo. */
const roundLoad = (kg: number): number => (kg >= 20 ? Math.round(kg / 2.5) * 2.5 : Math.round(kg));

/**
 * Series registradas sobre la rutina activa: todas las prescritas de cada ejercicio del día. El id
 * es el del adaptador (`{clientId}_{línea}_{fecha}_{serie}`), así que una serie es única por línea,
 * fecha y número.
 */
export function buildWorkoutLogs(
  ctx: SeedContext,
  key: ClientKey,
  client: Client,
  routine: Routine,
): WorkoutLog[] {
  const timesDone = new Map<number, number>();
  return SESSIONS[key].flatMap(([daysAgo, dayNumber]) => {
    const routineDay = routine.days.find((d) => d.dayNumber === dayNumber);
    if (!routineDay) throw new Error(`La rutina de ${client.id} no tiene día ${dayNumber}`);
    const repeat = timesDone.get(dayNumber) ?? 0;
    timesDone.set(dayNumber, repeat + 1);
    const date = addCivilDays(ctx.anchor, -daysAgo);
    let minute = 0;
    return routineDay.exercises.flatMap((line) => {
      const exercise = EXERCISE_KEY_BY_ID.get(line.exerciseId);
      if (!exercise) throw new Error(`Ejercicio ${line.exerciseId} fuera de la siembra`);
      const [startKg, stepKg] = LOADS[exercise];
      const weightKg = roundLoad(startKg * LOAD_FACTOR[key]) + repeat * stepKg;
      const { sets, repsMin, repsMax } = line.prescription;
      return Array.from({ length: sets }, (_, i) => {
        const setNumber = i + 1;
        return workoutLogSchema.parse({
          id: workoutLogDocId(client.id, line.id, date, setNumber),
          trainerId: ctx.trainerId,
          clientId: client.id,
          exerciseId: line.exerciseId,
          routineId: routine.id,
          routineDayExerciseId: line.id,
          date,
          setNumber,
          weightKg,
          // De la primera serie a la última se pierde una repetición, sin bajar del mínimo.
          reps: Math.max(repsMin, (repsMax ?? repsMin) - i),
          createdAt: at(ctx.clock, date, "18:00", minute++ * 3),
        });
      });
    });
  });
}
