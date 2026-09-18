import { redirect } from "next/navigation";

/** Sin auth todavía: la raíz manda al acceso. */
export default function HomePage() {
  redirect("/login");
}
