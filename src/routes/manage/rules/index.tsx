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
import { Badge } from '@/components/ui/badge';
import { Plus } from 'lucide-react';
import { useScenarios } from '@/hooks/use-scenarios';
import { useForecasts } from '@/hooks/use-forecasts';
import { useCategories } from '@/hooks/use-categories';
import { useSavingsGoals } from '@/hooks/use-savings-goals';
import { formatCents } from '@/lib/utils';

interface OutletContext {
  activeScenarioId: string | null;
  startDate: string;
  endDate: string;
}

const CADENCE_LABELS: Record<string, string> = {
  weekly: 'Weekly',
  fortnightly: 'Fortnightly',
  monthly: 'Monthly',
  quarterly: 'Quarterly',
  yearly: 'Yearly',
};

export function RulesIndexPage() {
  const { activeScenarioId } = useOutletContext<OutletContext>();
  const { activeScenario } = useScenarios();
  const { rules } = useForecasts(activeScenarioId);
  const { categories } = useCategories();
  const { savingsGoals } = useSavingsGoals();

  if (!activeScenarioId || !activeScenario) {
    return (
      <div className="flex flex-col items-center justify-center py-12">
        <h2 className="text-lg font-semibold">No scenario selected</h2>
        <p className="text-muted-foreground">Select a scenario to manage forecast rules.</p>
      </div>
    );
  }

  const getCategoryName = (id: string | null) =>
    id ? (categories.find((c) => c.id === id)?.name ?? 'Unknown') : '-';
  const getSavingsGoalName = (id: string | null) =>
    id ? (savingsGoals.find((g) => g.id === id)?.name ?? 'Unknown') : '-';

  const incomeRules = rules.filter((r) => r.type === 'income');
  const expenseRules = rules.filter((r) => r.type === 'expense');
  const savingsRules = rules.filter((r) => r.type === 'savings');

  return (
    <div>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Forecast Rules</h1>
          <p className="text-muted-foreground">
            Recurring income, expense, and savings patterns for {activeScenario.name}.
          </p>
        </div>
        <Button asChild>
          <Link to="/manage/rules/new">
            <Plus className="h-4 w-4" />
            Add Rule
          </Link>
        </Button>
      </div>

      {rules.length === 0 ? (
        <div className="mt-8 rounded-lg border border-dashed p-8 text-center">
          <p className="text-muted-foreground">No forecast rules yet.</p>
          <Button asChild className="mt-4">
            <Link to="/manage/rules/new">Create your first rule</Link>
          </Button>
        </div>
      ) : (
        <>
          {incomeRules.length > 0 && (
            <>
              <h2 className="mt-8 text-lg font-semibold">Income</h2>
              <Table className="mt-4">
                <TableHeader>
                  <TableRow>
                    <TableHead>Description</TableHead>
                    <TableHead>Cadence</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                    <TableHead className="w-20"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {incomeRules.map((rule) => (
                    <TableRow key={rule.id}>
                      <TableCell className="font-medium">{rule.description}</TableCell>
                      <TableCell>
                        <Badge variant="outline">{CADENCE_LABELS[rule.cadence]}</Badge>
                      </TableCell>
                      <TableCell className="text-right font-mono text-green-600">
                        +{formatCents(rule.amountCents)}
                      </TableCell>
                      <TableCell>
                        <Button variant="outline" size="sm" asChild>
                          <Link to={`/manage/rules/${rule.id}`}>Edit</Link>
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </>
          )}

          {expenseRules.length > 0 && (
            <>
              <h2 className="mt-8 text-lg font-semibold">Expenses</h2>
              <Table className="mt-4">
                <TableHeader>
                  <TableRow>
                    <TableHead>Description</TableHead>
                    <TableHead>Category</TableHead>
                    <TableHead>Cadence</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                    <TableHead className="w-20"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {expenseRules.map((rule) => (
                    <TableRow key={rule.id}>
                      <TableCell className="font-medium">{rule.description}</TableCell>
                      <TableCell>{getCategoryName(rule.categoryId)}</TableCell>
                      <TableCell>
                        <Badge variant="outline">{CADENCE_LABELS[rule.cadence]}</Badge>
                      </TableCell>
                      <TableCell className="text-right font-mono text-red-600">
                        -{formatCents(rule.amountCents)}
                      </TableCell>
                      <TableCell>
                        <Button variant="outline" size="sm" asChild>
                          <Link to={`/manage/rules/${rule.id}`}>Edit</Link>
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </>
          )}

          {savingsRules.length > 0 && (
            <>
              <h2 className="mt-8 text-lg font-semibold">Savings</h2>
              <Table className="mt-4">
                <TableHeader>
                  <TableRow>
                    <TableHead>Description</TableHead>
                    <TableHead>Savings Goal</TableHead>
                    <TableHead>Cadence</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                    <TableHead className="w-20"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {savingsRules.map((rule) => (
                    <TableRow key={rule.id}>
                      <TableCell className="font-medium">{rule.description}</TableCell>
                      <TableCell>{getSavingsGoalName(rule.savingsGoalId)}</TableCell>
                      <TableCell>
                        <Badge variant="outline">{CADENCE_LABELS[rule.cadence]}</Badge>
                      </TableCell>
                      <TableCell className="text-right font-mono text-blue-600">
                        -{formatCents(rule.amountCents)}
                      </TableCell>
                      <TableCell>
                        <Button variant="outline" size="sm" asChild>
                          <Link to={`/manage/rules/${rule.id}`}>Edit</Link>
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </>
          )}
        </>
      )}
    </div>
  );
}
