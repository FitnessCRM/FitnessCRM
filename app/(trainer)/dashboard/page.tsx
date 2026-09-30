import { DashboardScreen } from "@/components/trainer/dashboard/dashboard-screen";
import { es } from "@/lib/i18n/es";

const title = es.pages.trainer.dashboard;

export const metadata = { title };

export default function Page() {
  return <DashboardScreen />;
}
