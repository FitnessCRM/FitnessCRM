import { MembershipScreen } from "@/components/cliente/membership/membership-screen";
import { es } from "@/lib/i18n/es";

export const metadata = { title: es.pages.client.membresia };

export default function Page() {
  return <MembershipScreen />;
}
