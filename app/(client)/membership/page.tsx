import { MembershipScreen } from "@/components/client/membership/membership-screen";
import { es } from "@/lib/i18n/es";

export const metadata = { title: es.pages.client.membresia };

export default function Page() {
  return <MembershipScreen />;
}
