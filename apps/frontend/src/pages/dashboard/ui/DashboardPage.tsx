import { DashboardOverview } from '@/features/dashboard';
import { UptimeSummaryCard } from '@/features/uptime';

export function DashboardPage() {
  return <DashboardOverview summary={<UptimeSummaryCard />} />;
}
