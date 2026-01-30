import { useMemo } from 'react';
import { formatCents } from '@/lib/utils';
import type { Transaction } from '@/lib/types';

interface DescriptionBreakdownProps {
  transactions: Transaction[];
  totalSpent: number;
}

interface DescriptionGroup {
  description: string;
  count: number;
  total: number;
  percentage: number;
}

export function DescriptionBreakdown({ transactions, totalSpent }: DescriptionBreakdownProps) {
  const breakdown = useMemo(() => {
    if (transactions.length === 0) return { items: [], other: null };

    // Group by normalised description
    const groups: Record<string, { description: string; count: number; total: number }> = {};
    for (const tx of transactions) {
      const key = tx.description.trim().toLowerCase();
      if (!groups[key]) {
        groups[key] = { description: tx.description.trim(), count: 0, total: 0 };
      }
      groups[key].count++;
      groups[key].total += tx.amountCents;
    }

    // Sort by total descending
    const sorted = Object.values(groups)
      .map((g) => ({
        ...g,
        percentage: totalSpent > 0 ? Math.round((g.total / totalSpent) * 100) : 0,
      }))
      .sort((a, b) => b.total - a.total);

    // Take top 8, collapse rest into "Other"
    const topItems = sorted.slice(0, 8);
    const remaining = sorted.slice(8);

    let other: DescriptionGroup | null = null;
    if (remaining.length > 0) {
      const otherTotal = remaining.reduce((sum, g) => sum + g.total, 0);
      const otherCount = remaining.reduce((sum, g) => sum + g.count, 0);
      other = {
        description: `Other (${remaining.length})`,
        count: otherCount,
        total: otherTotal,
        percentage: totalSpent > 0 ? Math.round((otherTotal / totalSpent) * 100) : 0,
      };
    }

    return { items: topItems, other };
  }, [transactions, totalSpent]);

  if (transactions.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">No transactions in this period.</p>
    );
  }

  const allItems = breakdown.other
    ? [...breakdown.items, breakdown.other]
    : breakdown.items;

  return (
    <div className="space-y-3">
      {allItems.map((item, index) => (
        <BreakdownRow key={index} item={item} />
      ))}
    </div>
  );
}

function BreakdownRow({ item }: { item: DescriptionGroup }) {
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-sm">
        <span className="truncate font-medium" title={item.description}>
          {item.description}
        </span>
        <div className="ml-4 flex items-center gap-2">
          <span className="font-mono text-muted-foreground">
            {formatCents(item.total)}
          </span>
          <span className="w-10 text-right text-muted-foreground">
            {item.percentage}%
          </span>
        </div>
      </div>
      <div className="h-1.5 rounded-full bg-muted">
        <div
          className="h-1.5 rounded-full bg-red-500"
          style={{ width: `${item.percentage}%` }}
        />
      </div>
    </div>
  );
}
