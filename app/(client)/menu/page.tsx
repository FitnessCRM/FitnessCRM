import { MenuScreen } from "@/components/client/menu/menu-screen";
import { es } from "@/lib/i18n/es";

export const metadata = { title: es.pages.client.menu };

export default function Page() {
  return <MenuScreen />;
}
