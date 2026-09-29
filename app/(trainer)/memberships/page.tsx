import { MembershipsScreen } from "@/components/trainer/memberships/memberships-screen";
import { es } from "@/lib/i18n/es";

export const metadata = { title: es.pages.trainer.membresias };

export default function Page() {
  return <MembershipsScreen />;
}
