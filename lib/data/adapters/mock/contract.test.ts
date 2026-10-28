import { runWriteContract } from "../contract/write-contract";
import { createMockPorts } from "./index";

const TODAY = "2026-08-29";

/** El adaptador en memoria: la sesión es el estado mutable que lee cada puerto. */
runWriteContract("mock", async () => {
  const ports = createMockPorts({ today: TODAY, now: () => `${TODAY}T10:00:00Z` });
  const { state } = ports;
  const trainer = state.session.trainerId;
  const client = "c-marta";
  const otherTrainer = "t-otro";
  const own = state.trainers.find((t) => t.id === trainer);
  if (!own) throw new Error("La demo no tiene el entrenador de la sesión");
  state.trainers.push({ ...own, id: otherTrainer, email: "otro-entrenador@hector.test" });

  return {
    ports,
    ids: { trainer, otherTrainer, client },
    as: async (actor) => {
      state.session =
        actor === "client"
          ? { trainerId: trainer, clientId: client, role: "client" }
          : {
              trainerId: actor === "trainer" ? trainer : otherTrainer,
              clientId: null,
              role: "trainer",
            };
    },
    dispose: async () => {},
  };
});
