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
import { useAccounts } from '@/hooks/use-accounts';

export function AccountsIndexPage() {
  const { accounts, updateAccount } = useAccounts();

  const activeAccounts = accounts.filter((a) => !a.isArchived);
  const archivedAccounts = accounts.filter((a) => a.isArchived);

  return (
    <div>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Accounts</h1>
          <p className="text-muted-foreground">Manage your bank accounts.</p>
        </div>
        <Button asChild>
          <Link to="/manage/accounts/new">
            <Plus className="h-4 w-4" />
            Add Account
          </Link>
        </Button>
      </div>

      {accounts.length === 0 ? (
        <div className="mt-8 rounded-lg border border-dashed p-8 text-center">
          <p className="text-muted-foreground">No accounts yet.</p>
          <Button asChild className="mt-4">
            <Link to="/manage/accounts/new">Create your first account</Link>
          </Button>
        </div>
      ) : (
        <>
          {activeAccounts.length > 0 && (
            <Table className="mt-6">
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {activeAccounts.map((account) => (
                  <TableRow key={account.id}>
                    <TableCell className="font-medium">
                      <Link to={`/manage/accounts/${account.id}`} className="hover:underline">
                        {account.name}
                      </Link>
                    </TableCell>
                    <TableCell>
                      <Badge variant="success">Active</Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => updateAccount(account.id, { isArchived: true })}
                        >
                          Archive
                        </Button>
                        <Button variant="outline" size="sm" asChild>
                          <Link to={`/manage/accounts/${account.id}`}>View</Link>
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}

          {archivedAccounts.length > 0 && (
            <>
              <h2 className="mt-8 text-lg font-semibold text-muted-foreground">
                Archived Accounts
              </h2>
              <Table className="mt-4">
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {archivedAccounts.map((account) => (
                    <TableRow key={account.id} className="opacity-60">
                      <TableCell className="font-medium">
                        <Link to={`/manage/accounts/${account.id}`} className="hover:underline">
                          {account.name}
                        </Link>
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary">Archived</Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => updateAccount(account.id, { isArchived: false })}
                          >
                            Restore
                          </Button>
                          <Button variant="outline" size="sm" asChild>
                            <Link to={`/manage/accounts/${account.id}`}>View</Link>
                          </Button>
                        </div>
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
