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
import { Plus } from 'lucide-react';
import { useScenarios } from '@/hooks/use-scenarios';
import { formatDate } from '@/lib/utils';

export function ScenariosIndexPage() {
  const { scenarios } = useScenarios();

  return (
    <div>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Scenarios</h1>
          <p className="text-muted-foreground">
            Create and manage budget scenarios for what-if planning.
          </p>
        </div>
        <Button asChild>
          <Link to="/manage/scenarios/new">
            <Plus className="h-4 w-4" />
            New Scenario
          </Link>
        </Button>
      </div>

      {scenarios.length === 0 ? (
        <div className="mt-8 rounded-lg border border-dashed p-8 text-center">
          <p className="text-muted-foreground">No scenarios yet.</p>
          <Button asChild className="mt-4">
            <Link to="/manage/scenarios/new">Create your first scenario</Link>
          </Button>
        </div>
      ) : (
        <Table className="mt-6">
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Description</TableHead>
              <TableHead>Created</TableHead>
              <TableHead className="w-20"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {scenarios.map((scenario) => {
              const createdDate = scenario.createdAt.split('T')[0];
              return (
                <TableRow key={scenario.id}>
                  <TableCell className="font-medium">
                    <div className="flex items-center gap-2">
                      {scenario.name}
                      {scenario.isDefault && <Badge variant="secondary">Default</Badge>}
                    </div>
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {scenario.description || '-'}
                  </TableCell>
                  <TableCell>{createdDate ? formatDate(createdDate) : '-'}</TableCell>
                  <TableCell>
                    <Button variant="outline" size="sm" asChild>
                      <Link to={`/manage/scenarios/${scenario.id}`}>View</Link>
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
