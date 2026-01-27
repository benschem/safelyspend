import { useOutletContext, Link } from 'react-router';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Plus } from 'lucide-react';
import { useSavingsGoals } from '@/hooks/use-savings-goals';
import { useTransactions } from '@/hooks/use-transactions';
import { formatCents, formatDate } from '@/lib/utils';

interface OutletContext {
  activeScenarioId: string | null;
  startDate: string;
  endDate: string;
}

export function SavingsIndexPage() {
  const { startDate, endDate } = useOutletContext<OutletContext>();
  const { savingsGoals } = useSavingsGoals();
  const { savingsTransactions } = useTransactions(startDate, endDate);

  const getSavedAmount = (goalId: string) =>
    savingsTransactions
      .filter((t) => t.savingsGoalId === goalId)
      .reduce((sum, t) => sum + t.amountCents, 0);

  const getProgress = (current: number, target: number) => {
    if (target === 0) return 100;
    return Math.min(Math.round((current / target) * 100), 100);
  };

  return (
    <div>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Savings Goals</h1>
          <p className="text-muted-foreground">Track progress toward your savings targets.</p>
        </div>
        <Button asChild>
          <Link to="/savings/new">
            <Plus className="h-4 w-4" />
            Add Goal
          </Link>
        </Button>
      </div>

      {savingsGoals.length === 0 ? (
        <div className="mt-8 rounded-lg border border-dashed p-8 text-center">
          <p className="text-muted-foreground">No savings goals yet.</p>
          <Button asChild className="mt-4">
            <Link to="/savings/new">Create your first goal</Link>
          </Button>
        </div>
      ) : (
        <Table className="mt-6">
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Deadline</TableHead>
              <TableHead className="text-right">Progress</TableHead>
              <TableHead className="text-right">Saved</TableHead>
              <TableHead className="text-right">Goal</TableHead>
              <TableHead className="w-20"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {savingsGoals.map((goal) => {
              const savedAmount = getSavedAmount(goal.id);
              const progress = getProgress(savedAmount, goal.targetAmountCents);
              return (
                <TableRow key={goal.id}>
                  <TableCell className="font-medium">{goal.name}</TableCell>
                  <TableCell>{goal.deadline ? formatDate(goal.deadline) : '-'}</TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-2">
                      <div className="h-2 w-24 rounded-full bg-gray-200 dark:bg-gray-700">
                        <div
                          className="h-2 rounded-full bg-blue-600"
                          style={{ width: `${progress}%` }}
                        />
                      </div>
                      <span className="text-sm text-muted-foreground">{progress}%</span>
                    </div>
                  </TableCell>
                  <TableCell className="text-right font-mono">
                    {formatCents(savedAmount)}
                  </TableCell>
                  <TableCell className="text-right font-mono">
                    {formatCents(goal.targetAmountCents)}
                  </TableCell>
                  <TableCell>
                    <Button variant="outline" size="sm" asChild>
                      <Link to={`/savings/${goal.id}`}>View</Link>
                    </Button>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      )}
    </div>
  );
}
