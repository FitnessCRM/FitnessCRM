import { notFound } from "next/navigation";
import { es } from "@/lib/i18n/es";
import { KitchenSink } from "./kitchen-sink";

export const metadata = { title: es.dev.kitchenSink.title };

/** Solo en desarrollo: en producción la ruta no existe. */
export default function KitchenSinkPage() {
  if (process.env.NODE_ENV === "production") notFound();
  return <KitchenSink />;
}
