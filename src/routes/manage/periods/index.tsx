import { Link } from 'react-router';
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
import { Plus, Check } from 'lucide-react';
import { usePeriods } from '@/hooks/use-periods';

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-AU', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

export function PeriodsIndexPage() {
  const { periods, activePeriodId, setActivePeriodId } = usePeriods();

  const sortedPeriods = [...periods].sort(
    (a, b) => new Date(b.startDate).getTime() - new Date(a.startDate).getTime(),
  );

  return (
    <div>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Periods</h1>
          <p className="text-muted-foreground">
            Manage budget periods (e.g., financial years, months).
          </p>
        </div>
        <Button asChild>
          <Link to="/manage/periods/new">
            <Plus className="h-4 w-4" />
            Add Period
          </Link>
        </Button>
      </div>

      {periods.length === 0 ? (
        <div className="mt-8 rounded-lg border border-dashed p-8 text-center">
          <p className="text-muted-foreground">No periods yet.</p>
          <Button asChild className="mt-4">
            <Link to="/manage/periods/new">Create your first period</Link>
          </Button>
        </div>
      ) : (
        <Table className="mt-6">
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Start Date</TableHead>
              <TableHead>End Date</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sortedPeriods.map((period) => {
              const isActive = period.id === activePeriodId;
              return (
                <TableRow key={period.id}>
                  <TableCell className="font-medium">
                    <Link to={`/manage/periods/${period.id}`} className="hover:underline">
                      {period.name}
                    </Link>
                  </TableCell>
                  <TableCell>{formatDate(period.startDate)}</TableCell>
                  <TableCell>{formatDate(period.endDate)}</TableCell>
                  <TableCell>
                    {isActive ? (
                      <Badge variant="success">Active</Badge>
                    ) : (
                      <Badge variant="secondary">Inactive</Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      {!isActive && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setActivePeriodId(period.id)}
                        >
                          <Check className="h-4 w-4" />
                          Set Active
                        </Button>
                      )}
                      <Button variant="outline" size="sm" asChild>
                        <Link to={`/manage/periods/${period.id}`}>View</Link>
                      </Button>
                    </div>
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
