import { MembershipScreen } from "@/components/client/membership/membership-screen";
import { es } from "@/lib/i18n/es";

export const metadata = { title: es.pages.client.membresia };

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ payment?: string }>;
}) {
  // Al volver del pago en línea (tarjeta 125): la pantalla dice cómo fue, sin crear nada.
  const { payment } = await searchParams;
  return <MembershipScreen paymentResult={payment ?? null} />;
}
