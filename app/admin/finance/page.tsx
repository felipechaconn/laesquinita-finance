import { redirect } from "next/navigation";

import { FinanceDashboard } from "@/components/finance/finance-dashboard";
import { getCurrentUser } from "@/lib/auth";

export default async function AdminFinancePage() {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/login");
  }

  return <FinanceDashboard />;
}
