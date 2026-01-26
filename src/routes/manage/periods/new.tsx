import { useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ArrowLeft } from 'lucide-react';
import { usePeriods } from '@/hooks/use-periods';

export function PeriodNewPage() {
  const navigate = useNavigate();
  const { addPeriod } = usePeriods();

  const [name, setName] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!name.trim()) {
      setError('Name is required');
      return;
    }
    if (!startDate) {
      setError('Start date is required');
      return;
    }
    if (!endDate) {
      setError('End date is required');
      return;
    }
    if (startDate >= endDate) {
      setError('End date must be after start date');
      return;
    }

    const period = addPeriod({
      name: name.trim(),
      startDate,
      endDate,
    });

    navigate(`/manage/periods/${period.id}`);
  };

  return (
    <div className="max-w-xl">
      <div className="mb-6">
        <Button variant="ghost" size="sm" asChild>
          <Link to="/manage/periods">
            <ArrowLeft className="h-4 w-4" />
            Back to Periods
          </Link>
        </Button>
      </div>

      <h1 className="text-2xl font-bold">New Period</h1>
      <p className="text-muted-foreground">Create a new budget period.</p>

      {error && <div className="mt-4 rounded-lg bg-red-100 p-3 text-red-800">{error}</div>}

      <form onSubmit={handleSubmit} className="mt-6 space-y-4">
        <div className="space-y-2">
          <Label htmlFor="name">Name</Label>
          <Input
            id="name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g., FY 2025-26"
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="startDate">Start Date</Label>
            <Input
              id="startDate"
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="endDate">End Date</Label>
            <Input
              id="endDate"
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
            />
          </div>
        </div>

        <div className="flex gap-2 pt-4">
          <Button type="submit">Create Period</Button>
          <Button type="button" variant="outline" asChild>
            <Link to="/manage/periods">Cancel</Link>
          </Button>
        </div>
      </form>
    </div>
  );
}
