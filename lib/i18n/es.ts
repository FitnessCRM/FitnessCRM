/**
 * Todos los literales visibles de la aplicación.
 * El nombre de marca sale ÚNICAMENTE de APP_NAME: cambiar la marca es cambiar esta línea.
 */
export const APP_NAME = "HECTOR";

export const es = {
  dev: {
    kitchenSink: {
      eyebrow: "Solo en desarrollo",
      title: "Kitchen sink",
      palette: "Paleta",
      typography: "Escala tipográfica",
      buttons: "Botones",
      badges: "Insignias",
      forms: "Formulario",
      tabs: "Pestañas",
      cards: "Tarjetas",
      table: "Tabla",
      overlays: "Capas",
      data: "Datos por el puerto",
    },
    clientsProbe: {
      title: "Clientes de la cartera",
      hint: "Lista leída por useClients(); el componente no sabe qué adaptador hay detrás.",
      loading: "Cargando clientes…",
      error: "No se han podido cargar los clientes.",
      retry: "Reintentar",
      empty: "Sin clientes todavía.",
      status: {
        invitado: "Invitado",
        activo: "Activo",
        dado_de_baja: "Baja",
      },
    },
  },
} as const;
