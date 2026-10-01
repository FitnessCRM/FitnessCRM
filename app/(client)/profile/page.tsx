import { ProfileScreen } from "@/components/client/profile/profile-screen";
import { es } from "@/lib/i18n/es";

export const metadata = { title: es.pages.client.perfil };

export default function Page() {
  return <ProfileScreen />;
}
