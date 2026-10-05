import { doc, setDoc, type Firestore } from "firebase/firestore";
import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import {
  menuBodySchema,
  routineBodySchema,
  type Menu,
  type Routine,
  type RoutineBody,
} from "@/lib/domain";
import { createDemoState, createMockPorts, type MockState } from "../mock";
import { CLIENT_IDS, TRAINER_ID } from "../mock/demo-data/common";
import { createFirestore } from "./config";
import { createFirebaseContext, type FirebaseContext } from "./context";
import { COLLECTIONS } from "./helpers";
import { createMacroTargetsPort, createMenuPort, createRoutinePort } from "./plans";
import { createTemplatePort } from "./templates";

/**
 * Contra el emulador de Firestore (`pnpm test:firebase`). Las lecturas se comparan con el adaptador
 * en memoria sobre los mismos datos de demo; las escrituras comprueban cada regla de §7 e I4 que el
 * adaptador tiene que defender, porque Firestore no la defiende solo.
 */
const emulatorHost = process.env.FIRESTORE_EMULATOR_HOST;
const TODAY = "2026-10-03";
const NOW = "2026-10-03T10:00:00.000Z";
const STRANGER = "t-otra";

describe.skipIf(!emulatorHost)("adaptador de Firebase · planes y plantillas", () => {
  let db: Firestore;
  let ctx: FirebaseContext;
  let state: MockState;

  beforeAll(() => {
    const [host = "127.0.0.1", port = "8080"] = (emulatorHost as string).split(":");
    db = createFirestore(
      { projectId: "demo-hector" },
      { appName: "firebase-plans-test", emulator: { host, port: Number(port) } },
    );
  });

  beforeEach(async () => {
    await fetch(
      `http://${emulatorHost}/emulator/v1/projects/demo-hector/databases/(default)/documents`,
      { method: "DELETE" },
    );
    ctx = createFirebaseContext(db, { now: () => NOW });
    state = createDemoState(TODAY);
    const seed = (name: string, items: { id: string }[]) =>
      Promise.all(items.map((item) => setDoc(doc(db, name, item.id), item)));
    await seed(COLLECTIONS.trainers, state.trainers);
    await seed(COLLECTIONS.clients, state.clients);
    await seed(COLLECTIONS.exercises, state.exercises);
    await seed(COLLECTIONS.routines, state.routines);
    await seed(COLLECTIONS.macroTargets, state.macroTargets);
    await seed(COLLECTIONS.menus, state.menus);
    await seed(COLLECTIONS.routineTemplates, state.routineTemplates);
    await seed(COLLECTIONS.menuTemplates, state.menuTemplates);
  });

  const mock = () => createMockPorts({ state: structuredClone(state), today: TODAY });
  const byId = <T extends { id: string }>(items: T[]) =>
    [...items].sort((a, b) => a.id.localeCompare(b.id));
  const clientIds = Object.values(CLIENT_IDS);

  /** El cuerpo de la rutina activa de Marta, listo para volver a guardarse. */
  const martaBody = (): RoutineBody => {
    const routine = state.routines.find(
      (r) => r.clientId === CLIENT_IDS.marta && r.status === "activo",
    )!;
    return routineBodySchema.parse(routine);
  };
  const activeRoutine = () =>
    state.routines.find((r) => r.clientId === CLIENT_IDS.marta && r.status === "activo")!;

  describe("lecturas iguales que la referencia", () => {
    it("routines, macros and menus of every client", async () => {
      const routines = createRoutinePort(ctx);
      const macros = createMacroTargetsPort(ctx);
      const menus = createMenuPort(ctx);
      const ref = mock();
      for (const clientId of clientIds) {
        expect(await routines.getActiveRoutine(TRAINER_ID, clientId), `activa ${clientId}`).toEqual(
          await ref.routines.getActiveRoutine(TRAINER_ID, clientId),
        );
        expect(
          byId(await routines.listRoutines(TRAINER_ID, clientId)),
          `rutinas ${clientId}`,
        ).toEqual(byId(await ref.routines.listRoutines(TRAINER_ID, clientId)));
        expect(
          byId(await macros.listMacroTargets(TRAINER_ID, clientId)),
          `macros ${clientId}`,
        ).toEqual(byId(await ref.macroTargets.listMacroTargets(TRAINER_ID, clientId)));
        expect(
          byId(await menus.listActiveMenus(TRAINER_ID, clientId)),
          `activos ${clientId}`,
        ).toEqual(byId(await ref.menus.listActiveMenus(TRAINER_ID, clientId)));
        expect(byId(await menus.listMenus(TRAINER_ID, clientId)), `menús ${clientId}`).toEqual(
          byId(await ref.menus.listMenus(TRAINER_ID, clientId)),
        );
      }
      // Que no sea trivial: la demo tiene plan de verdad.
      expect(await routines.getActiveRoutine(TRAINER_ID, CLIENT_IDS.marta)).not.toBeNull();
      expect((await macros.listMacroTargets(TRAINER_ID, CLIENT_IDS.marta)).length).toBeGreaterThan(
        0,
      );
      expect((await menus.listActiveMenus(TRAINER_ID, CLIENT_IDS.marta)).length).toBeGreaterThan(0);
    });

    it("templates with their usage count", async () => {
      const templates = createTemplatePort(ctx);
      const ref = mock();
      const routineTemplates = await templates.listRoutineTemplates(TRAINER_ID);
      expect(byId(routineTemplates)).toEqual(
        byId(await ref.templates.listRoutineTemplates(TRAINER_ID)),
      );
      expect(byId(await templates.listMenuTemplates(TRAINER_ID))).toEqual(
        byId(await ref.templates.listMenuTemplates(TRAINER_ID)),
      );
      expect(routineTemplates.length).toBeGreaterThan(0);
      expect(routineTemplates.some((t) => t.usageCount > 0)).toBe(true);
      expect(await templates.listRoutineTemplates(STRANGER)).toEqual([]);
    });
  });

  describe("rutinas", () => {
    it("creates a draft only for an own client and only with library exercises (I3)", async () => {
      const routines = createRoutinePort(ctx);
      const draft = await routines.createRoutine(TRAINER_ID, CLIENT_IDS.marta, martaBody());
      expect(draft).toMatchObject({
        status: "borrador",
        sourceTemplateName: null,
        clientId: CLIENT_IDS.marta,
      });
      await expect(
        routines.createRoutine(STRANGER, CLIENT_IDS.marta, martaBody()),
      ).rejects.toMatchObject({
        code: "not_found",
      });
      const body = martaBody();
      const foreign: RoutineBody = {
        ...body,
        days: [
          {
            ...body.days[0]!,
            exercises: [{ ...body.days[0]!.exercises[0]!, exerciseId: "no-esta" }],
          },
        ],
      };
      await expect(
        routines.createRoutine(TRAINER_ID, CLIENT_IDS.marta, foreign),
      ).rejects.toMatchObject({
        code: "routine.exercise_not_in_library",
      });
    });

    it("edits a draft in place and refuses to edit an active routine (§7)", async () => {
      const routines = createRoutinePort(ctx);
      const draft = await routines.createRoutine(TRAINER_ID, CLIENT_IDS.marta, martaBody());
      const edited = await routines.updateRoutine(TRAINER_ID, draft.id, {
        ...martaBody(),
        name: "Otra",
      });
      expect(edited).toMatchObject({ id: draft.id, name: "Otra" });
      await expect(
        routines.updateRoutine(TRAINER_ID, activeRoutine().id, martaBody()),
      ).rejects.toMatchObject({ code: "routine.not_draft" });
      await expect(routines.updateRoutine(STRANGER, draft.id, martaBody())).rejects.toMatchObject({
        code: "not_found",
      });
    });

    it("revising the active routine makes a new draft that keeps the template name", async () => {
      const routines = createRoutinePort(ctx);
      const active = activeRoutine();
      const draft = await routines.reviseRoutine(TRAINER_ID, active.id, {
        ...martaBody(),
        name: "Nueva versión",
      });
      expect(draft).toMatchObject({
        status: "borrador",
        clientId: CLIENT_IDS.marta,
        sourceTemplateName: active.sourceTemplateName,
      });
      expect(draft.id).not.toBe(active.id);
      // La activa no cambia hasta que se active el borrador.
      expect((await routines.getActiveRoutine(TRAINER_ID, CLIENT_IDS.marta))?.id).toBe(active.id);
      await expect(routines.reviseRoutine(TRAINER_ID, draft.id, martaBody())).rejects.toMatchObject(
        {
          code: "routine.not_active",
        },
      );
    });

    it("activating leaves one active routine per client and archives the previous (I4)", async () => {
      const routines = createRoutinePort(ctx);
      const previous = activeRoutine();
      const draft = await routines.createRoutine(TRAINER_ID, CLIENT_IDS.marta, martaBody());
      const activated = await routines.activateRoutine(TRAINER_ID, draft.id);
      expect(activated.status).toBe("activo");
      const all = await routines.listRoutines(TRAINER_ID, CLIENT_IDS.marta);
      expect(all.filter((r) => r.status === "activo").map((r) => r.id)).toEqual([draft.id]);
      expect(all.find((r) => r.id === previous.id)?.status).toBe("archivado");
      // Otro cliente no se toca.
      expect((await routines.getActiveRoutine(TRAINER_ID, CLIENT_IDS.jorge))?.id).toBe(
        state.routines.find((r) => r.clientId === CLIENT_IDS.jorge && r.status === "activo")?.id,
      );
      await expect(routines.activateRoutine(TRAINER_ID, previous.id)).rejects.toMatchObject({
        code: "routine.archived",
      });
      await expect(routines.activateRoutine(STRANGER, draft.id)).rejects.toMatchObject({
        code: "not_found",
      });
    });
  });

  describe("macros", () => {
    it("setting a day type archives the previous set of that day type only (I4)", async () => {
      const macros = createMacroTargetsPort(ctx);
      const before = await macros.listMacroTargets(TRAINER_ID, CLIENT_IDS.marta);
      const dayType = before[0]!.dayType;
      const other = before.find((m) => m.dayType !== dayType);
      const created = await macros.setMacroTargets(TRAINER_ID, CLIENT_IDS.marta, dayType, {
        kcal: 2500,
        proteinG: 180,
        carbsG: 280,
        fatG: 70,
      });
      expect(created).toMatchObject({ status: "activo", dayType, macros: { kcal: 2500 } });
      const after = await macros.listMacroTargets(TRAINER_ID, CLIENT_IDS.marta);
      expect(after.filter((m) => m.dayType === dayType).map((m) => m.id)).toEqual([created.id]);
      if (other) expect(after.some((m) => m.id === other.id)).toBe(true);
      await expect(
        macros.setMacroTargets(STRANGER, CLIENT_IDS.marta, dayType, {
          kcal: 1,
          proteinG: 1,
          carbsG: 1,
          fatG: 1,
        }),
      ).rejects.toMatchObject({ code: "not_found" });
    });
  });

  describe("menús", () => {
    const body = (menu: Menu) => menuBodySchema.parse(menu);
    const activeMenu = () =>
      state.menus.find((m) => m.clientId === CLIENT_IDS.marta && m.status === "activo")!;

    it("creates a draft, edits it in place and refuses to edit an active menu (§7)", async () => {
      const menus = createMenuPort(ctx);
      const draft = await menus.createMenu(TRAINER_ID, CLIENT_IDS.marta, body(activeMenu()));
      expect(draft.status).toBe("borrador");
      expect(
        (await menus.updateMenu(TRAINER_ID, draft.id, { ...body(activeMenu()), name: "Otro" }))
          .name,
      ).toBe("Otro");
      await expect(
        menus.updateMenu(TRAINER_ID, activeMenu().id, body(activeMenu())),
      ).rejects.toMatchObject({
        code: "menu.not_draft",
      });
      await expect(
        menus.reviseMenu(TRAINER_ID, draft.id, body(activeMenu())),
      ).rejects.toMatchObject({
        code: "menu.not_active",
      });
    });

    it("activating a day type archives its whole active set and activates the drafts (I4)", async () => {
      const menus = createMenuPort(ctx);
      const active = activeMenu();
      const revised = await menus.reviseMenu(TRAINER_ID, active.id, {
        ...body(active),
        name: "Versión 2",
      });
      expect(revised).toMatchObject({
        status: "borrador",
        sourceTemplateName: active.sourceTemplateName,
      });
      const activated = await menus.activateMenus(TRAINER_ID, CLIENT_IDS.marta, active.dayType);
      expect(activated.map((m) => m.id)).toEqual([revised.id]);
      expect(activated.every((m) => m.status === "activo")).toBe(true);
      const live = await menus.listMenus(TRAINER_ID, CLIENT_IDS.marta);
      expect(live.find((m) => m.id === active.id)).toBeUndefined(); // archivado: ya no sale
      expect(
        live.filter((m) => m.dayType === active.dayType && m.status === "activo").map((m) => m.id),
      ).toEqual([revised.id]);
      await expect(
        menus.activateMenus(TRAINER_ID, CLIENT_IDS.marta, active.dayType),
      ).rejects.toMatchObject({
        code: "menu.no_drafts",
      });
      await expect(
        menus.activateMenus(STRANGER, CLIENT_IDS.marta, active.dayType),
      ).rejects.toMatchObject({
        code: "not_found",
      });
    });

    it("archiving removes a menu from the live ones", async () => {
      const menus = createMenuPort(ctx);
      const active = activeMenu();
      await menus.archiveMenu(TRAINER_ID, active.id);
      expect(
        (await menus.listActiveMenus(TRAINER_ID, CLIENT_IDS.marta)).some((m) => m.id === active.id),
      ).toBe(false);
      await expect(menus.archiveMenu(STRANGER, active.id)).rejects.toMatchObject({
        code: "not_found",
      });
    });
  });

  describe("plantillas", () => {
    const firstRoutineTemplate = () => state.routineTemplates[0]!;
    const firstMenuTemplate = () => state.menuTemplates[0]!;
    const stripRoutineTemplate = (template: (typeof state.routineTemplates)[number]) =>
      Object.fromEntries(
        Object.entries(template).filter(([key]) => !["id", "createdAt", "updatedAt"].includes(key)),
      ) as Omit<typeof template, "id" | "createdAt" | "updatedAt">;

    it("saves a new template, edits it keeping its creation date, and checks the library (I3)", async () => {
      const templates = createTemplatePort(ctx);
      const input = { ...stripRoutineTemplate(firstRoutineTemplate()), name: "Mía" };
      const created = await templates.saveRoutineTemplate(input);
      expect(created).toMatchObject({ name: "Mía", createdAt: NOW, updatedAt: NOW });
      const edited = await templates.saveRoutineTemplate({
        ...input,
        id: created.id,
        name: "Mía v2",
      });
      expect(edited).toMatchObject({ id: created.id, name: "Mía v2", createdAt: NOW });
      const day = input.days[0]!;
      await expect(
        templates.saveRoutineTemplate({
          ...input,
          days: [{ ...day, exercises: [{ ...day.exercises[0]!, exerciseId: "no-esta" }] }],
        }),
      ).rejects.toMatchObject({ code: "routine.exercise_not_in_library" });
      await expect(
        templates.saveRoutineTemplate({ ...input, id: "no-existe" }),
      ).rejects.toMatchObject({ code: "not_found" });
    });

    it("duplicates with a new id and name, and counts no use for the copy", async () => {
      const templates = createTemplatePort(ctx);
      const copy = await templates.duplicateRoutineTemplate(
        TRAINER_ID,
        firstRoutineTemplate().id,
        "Copia",
      );
      expect(copy).toMatchObject({ name: "Copia" });
      expect(copy.id).not.toBe(firstRoutineTemplate().id);
      const listed = (await templates.listRoutineTemplates(TRAINER_ID)).find(
        (t) => t.id === copy.id,
      );
      expect(listed?.usageCount).toBe(0);
      const menuCopy = await templates.duplicateMenuTemplate(
        TRAINER_ID,
        firstMenuTemplate().id,
        "Copia menú",
      );
      expect(menuCopy.name).toBe("Copia menú");
      await expect(
        templates.duplicateRoutineTemplate(STRANGER, firstRoutineTemplate().id, "x"),
      ).rejects.toMatchObject({ code: "not_found" });
    });

    it("assigning clones the template into drafts of the client, not a link (§4)", async () => {
      const templates = createTemplatePort(ctx);
      const routine: Routine = await templates.assignRoutineTemplate(
        TRAINER_ID,
        CLIENT_IDS.jorge,
        firstRoutineTemplate().id,
      );
      expect(routine).toMatchObject({
        status: "borrador",
        clientId: CLIENT_IDS.jorge,
        sourceTemplateName: firstRoutineTemplate().name,
      });
      const menus = await templates.assignMenuTemplate(
        TRAINER_ID,
        CLIENT_IDS.jorge,
        firstMenuTemplate().id,
      );
      expect(menus.length).toBe(firstMenuTemplate().menus.length);
      expect(menus.every((m) => m.status === "borrador" && m.clientId === CLIENT_IDS.jorge)).toBe(
        true,
      );
      // La plantilla no cambia.
      expect(
        (await templates.listRoutineTemplates(TRAINER_ID)).find(
          (t) => t.id === firstRoutineTemplate().id,
        )?.name,
      ).toBe(firstRoutineTemplate().name);
      await expect(
        templates.assignRoutineTemplate(STRANGER, CLIENT_IDS.jorge, firstRoutineTemplate().id),
      ).rejects.toMatchObject({ code: "not_found" });
      await expect(
        templates.assignMenuTemplate(TRAINER_ID, "no-existe", firstMenuTemplate().id),
      ).rejects.toMatchObject({ code: "not_found" });
    });

    it("deletes a template, and only the trainer's own", async () => {
      const templates = createTemplatePort(ctx);
      await expect(
        templates.deleteRoutineTemplate(STRANGER, firstRoutineTemplate().id),
      ).rejects.toMatchObject({
        code: "not_found",
      });
      await templates.deleteRoutineTemplate(TRAINER_ID, firstRoutineTemplate().id);
      expect(
        (await templates.listRoutineTemplates(TRAINER_ID)).some(
          (t) => t.id === firstRoutineTemplate().id,
        ),
      ).toBe(false);
      await templates.deleteMenuTemplate(TRAINER_ID, firstMenuTemplate().id);
      expect(
        (await templates.listMenuTemplates(TRAINER_ID)).some(
          (t) => t.id === firstMenuTemplate().id,
        ),
      ).toBe(false);
    });
  });
});
