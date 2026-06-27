import { prisma } from "@/lib/prisma";
import DashboardClient from "./DashboardClient";

export const dynamic = 'force-dynamic';

export default async function DashboardPage() {
  const entries = await prisma.trackerEntry.findMany({
    orderBy: { createdAt: 'desc' }
  });

  const premiumAgg = await prisma.premiumCreditLog.aggregate({
    _sum: { amount: true }
  });

  return (
    <DashboardClient
      initialEntries={entries}
      premiumTotal={premiumAgg._sum.amount || 0}
    />
  );
}