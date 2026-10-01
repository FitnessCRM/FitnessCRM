import { MembershipsScreen } from "@/components/trainer/memberships/memberships-screen";
import { es } from "@/lib/i18n/es";

export const metadata = { title: es.pages.trainer.membresias };

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ clientId?: string | string[] }>;
}) {
  const { clientId } = await searchParams;
  return (
    <MembershipsScreen initialClientId={typeof clientId === "string" ? clientId : undefined} />
  );
}
