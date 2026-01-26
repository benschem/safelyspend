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
import { formatCents, formatDate } from '@/lib/utils';

interface OutletContext {
  activePeriodId: string | null;
}

export function SavingsIndexPage() {
  const { activePeriodId } = useOutletContext<OutletContext>();
  const { savingsGoals, globalGoals, periodGoals } = useSavingsGoals(activePeriodId);

  if (!activePeriodId) {
    return (
      <div className="flex flex-col items-center justify-center py-12">
        <h2 className="text-lg font-semibold">No period selected</h2>
        <p className="text-muted-foreground">Select a period to view savings goals.</p>
      </div>
    );
  }

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
        <>
          {periodGoals.length > 0 && (
            <>
              <h2 className="mt-6 text-lg font-semibold">Period Goals</h2>
              <Table className="mt-4">
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Deadline</TableHead>
                    <TableHead className="text-right">Progress</TableHead>
                    <TableHead className="text-right">Target</TableHead>
                    <TableHead className="w-20"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {periodGoals.map((goal) => {
                    const progress = getProgress(goal.currentAmountCents, goal.targetAmountCents);
                    return (
                      <TableRow key={goal.id}>
                        <TableCell className="font-medium">{goal.name}</TableCell>
                        <TableCell>{goal.deadline ? formatDate(goal.deadline) : '-'}</TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-2">
                            <div className="h-2 w-24 rounded-full bg-gray-200">
                              <div
                                className="h-2 rounded-full bg-green-500"
                                style={{ width: `${progress}%` }}
                              />
                            </div>
                            <span className="text-sm text-muted-foreground">{progress}%</span>
                          </div>
                        </TableCell>
                        <TableCell className="text-right font-mono">
                          {formatCents(goal.currentAmountCents)} /{' '}
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
            </>
          )}

          {globalGoals.length > 0 && (
            <>
              <h2 className="mt-8 text-lg font-semibold">Global Goals</h2>
              <p className="text-sm text-muted-foreground">
                These goals are not tied to any specific period.
              </p>
              <Table className="mt-4">
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Deadline</TableHead>
                    <TableHead className="text-right">Progress</TableHead>
                    <TableHead className="text-right">Target</TableHead>
                    <TableHead className="w-20"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {globalGoals.map((goal) => {
                    const progress = getProgress(goal.currentAmountCents, goal.targetAmountCents);
                    return (
                      <TableRow key={goal.id}>
                        <TableCell className="font-medium">{goal.name}</TableCell>
                        <TableCell>{goal.deadline ? formatDate(goal.deadline) : '-'}</TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-2">
                            <div className="h-2 w-24 rounded-full bg-gray-200">
                              <div
                                className="h-2 rounded-full bg-green-500"
                                style={{ width: `${progress}%` }}
                              />
                            </div>
                            <span className="text-sm text-muted-foreground">{progress}%</span>
                          </div>
                        </TableCell>
                        <TableCell className="text-right font-mono">
                          {formatCents(goal.currentAmountCents)} /{' '}
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
            </>
          )}
        </>
      )}
    </div>
  );
}
