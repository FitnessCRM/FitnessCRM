import { FoodsScreen } from "@/components/trainer/foods/foods-screen";
import { es } from "@/lib/i18n/es";

export const metadata = { title: es.pages.trainer.alimentos };

export default function Page() {
  return <FoodsScreen />;
}
