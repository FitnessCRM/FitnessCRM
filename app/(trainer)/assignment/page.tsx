import { AssignmentScreen } from "@/components/trainer/assignment/assignment-screen";
import { es } from "@/lib/i18n/es";

const title = es.pages.trainer.asignacion;

export const metadata = { title };

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ clientId?: string | string[] }>;
}) {
  const { clientId } = await searchParams;
  return <AssignmentScreen clientId={typeof clientId === "string" ? clientId : undefined} />;
}
