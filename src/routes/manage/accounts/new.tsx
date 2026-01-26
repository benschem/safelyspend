import { useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ArrowLeft } from 'lucide-react';
import { useAccounts } from '@/hooks/use-accounts';

export function AccountNewPage() {
  const navigate = useNavigate();
  const { addAccount } = useAccounts();

  const [name, setName] = useState('');
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!name.trim()) {
      setError('Name is required');
      return;
    }

    const account = addAccount({
      name: name.trim(),
      isArchived: false,
    });

    navigate(`/manage/accounts/${account.id}`);
  };

  return (
    <div className="max-w-xl">
      <div className="mb-6">
        <Button variant="ghost" size="sm" asChild>
          <Link to="/manage/accounts">
            <ArrowLeft className="h-4 w-4" />
            Back to Accounts
          </Link>
        </Button>
      </div>

      <h1 className="text-2xl font-bold">New Account</h1>
      <p className="text-muted-foreground">Add a new bank account.</p>

      {error && <div className="mt-4 rounded-lg bg-red-100 p-3 text-red-800">{error}</div>}

      <form onSubmit={handleSubmit} className="mt-6 space-y-4">
        <div className="space-y-2">
          <Label htmlFor="name">Account Name</Label>
          <Input
            id="name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g., Everyday, Savings, Credit Card"
          />
        </div>

        <div className="flex gap-2 pt-4">
          <Button type="submit">Create Account</Button>
          <Button type="button" variant="outline" asChild>
            <Link to="/manage/accounts">Cancel</Link>
          </Button>
        </div>
      </form>
    </div>
  );
}
