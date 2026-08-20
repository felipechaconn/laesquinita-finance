import { redirect } from "next/navigation";

import { MobileSalesEntry } from "@/components/finance/mobile-sales-entry";
import { getCurrentUser } from "@/lib/auth";

export default async function VentasPage() {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/login");
  }

  return <MobileSalesEntry user={user} />;
}
