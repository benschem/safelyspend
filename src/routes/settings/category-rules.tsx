import { useState } from 'react';
import { Link } from 'react-router';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Switch } from '@/components/ui/switch';
import { ArrowLeft, Plus, Pencil, Trash2, GripVertical } from 'lucide-react';
import { useCategoryRules } from '@/hooks/use-category-rules';
import { useCategories } from '@/hooks/use-categories';
import type { CategoryRuleMatchType } from '@/lib/types';

export function CategoryRulesPage() {
  const { rules, addRule, updateRule, deleteRule, getNextPriority } = useCategoryRules();
  const { activeCategories } = useCategories();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingRuleId, setEditingRuleId] = useState<string | null>(null);
  const [deletingRuleId, setDeletingRuleId] = useState<string | null>(null);

  // Form state
  const [ruleName, setRuleName] = useState('');
  const [matchType, setMatchType] = useState<CategoryRuleMatchType>('contains');
  const [matchValue, setMatchValue] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [transactionType, setTransactionType] = useState<'income' | 'expense' | ''>('');
  const [formError, setFormError] = useState<string | null>(null);

  const getCategoryName = (id: string) =>
    activeCategories.find((c) => c.id === id)?.name ?? 'Unknown';

  const openAddRule = () => {
    setEditingRuleId(null);
    setRuleName('');
    setMatchType('contains');
    setMatchValue('');
    setCategoryId('');
    setTransactionType('');
    setFormError(null);
    setDialogOpen(true);
  };

  const openEditRule = (rule: (typeof rules)[0]) => {
    setEditingRuleId(rule.id);
    setRuleName(rule.name);
    setMatchType(rule.matchType);
    setMatchValue(rule.matchValue);
    setCategoryId(rule.categoryId);
    setTransactionType(rule.transactionType ?? '');
    setFormError(null);
    setDialogOpen(true);
  };

  const handleSaveRule = () => {
    setFormError(null);

    if (!ruleName.trim()) {
      setFormError('Please enter a rule name');
      return;
    }
    if (!matchValue.trim()) {
      setFormError('Please enter a match value');
      return;
    }
    if (!categoryId) {
      setFormError('Please select a category');
      return;
    }

    if (editingRuleId) {
      const updates: Parameters<typeof updateRule>[1] = {
        name: ruleName.trim(),
        matchType,
        matchValue: matchValue.trim(),
        categoryId,
      };
      if (transactionType) {
        updates.transactionType = transactionType;
      }
      updateRule(editingRuleId, updates);
    } else {
      const data: Parameters<typeof addRule>[0] = {
        name: ruleName.trim(),
        matchField: 'description',
        matchType,
        matchValue: matchValue.trim(),
        categoryId,
        priority: getNextPriority(),
        enabled: true,
      };
      if (transactionType) {
        data.transactionType = transactionType;
      }
      addRule(data);
    }
    setDialogOpen(false);
  };

  const handleDeleteRule = (id: string) => {
    if (deletingRuleId !== id) {
      setDeletingRuleId(id);
      return;
    }
    deleteRule(id);
    setDeletingRuleId(null);
  };

  const handleToggleEnabled = (id: string, enabled: boolean) => {
    updateRule(id, { enabled });
  };

  return (
    <div className="max-w-2xl">
      <div className="mb-6">
        <Button variant="ghost" size="sm" className="-ml-2" asChild>
          <Link to="/settings">
            <ArrowLeft className="h-4 w-4" />
            Back to Settings
          </Link>
        </Button>
      </div>

      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold">Category Rules</h1>
          <p className="text-muted-foreground">
            Auto-categorize imported transactions based on description matching.
          </p>
        </div>
        <Button onClick={openAddRule}>
          <Plus className="h-4 w-4" />
          Add Rule
        </Button>
      </div>

      {rules.length === 0 ? (
        <div className="mt-8 rounded-lg border border-dashed p-8 text-center">
          <p className="text-muted-foreground">No category rules yet.</p>
          <p className="mt-2 text-sm text-muted-foreground">
            Rules are applied automatically when you import transactions.
          </p>
          <Button className="mt-4" onClick={openAddRule}>
            Create your first rule
          </Button>
        </div>
      ) : (
        <div className="mt-6 space-y-2">
          {rules.map((rule) => (
            <div
              key={rule.id}
              className={`flex items-center gap-3 rounded-lg border p-4 ${
                !rule.enabled ? 'opacity-50' : ''
              }`}
            >
              <GripVertical className="h-4 w-4 text-muted-foreground" />

              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <p className="font-medium">{rule.name}</p>
                  {rule.transactionType && (
                    <span className="rounded bg-muted px-1.5 py-0.5 text-xs">
                      {rule.transactionType}
                    </span>
                  )}
                </div>
                <p className="text-sm text-muted-foreground">
                  {rule.matchType === 'contains' && 'Contains'}
                  {rule.matchType === 'startsWith' && 'Starts with'}
                  {rule.matchType === 'equals' && 'Equals'}
                  {' "'}
                  {rule.matchValue}
                  {'" → '}
                  {getCategoryName(rule.categoryId)}
                </p>
              </div>

              <Switch
                checked={rule.enabled}
                onCheckedChange={(enabled) => handleToggleEnabled(rule.id, enabled)}
              />

              <Button variant="ghost" size="sm" onClick={() => openEditRule(rule)}>
                <Pencil className="h-4 w-4" />
              </Button>

              {deletingRuleId === rule.id ? (
                <>
                  <Button variant="outline" size="sm" onClick={() => setDeletingRuleId(null)}>
                    Cancel
                  </Button>
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={() => handleDeleteRule(rule.id)}
                  >
                    Confirm
                  </Button>
                </>
              ) : (
                <Button variant="ghost" size="sm" onClick={() => handleDeleteRule(rule.id)}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              )}
            </div>
          ))}
        </div>
      )}

      <p className="mt-4 text-xs text-muted-foreground">
        Rules are applied in order (top to bottom). The first matching rule wins.
      </p>

      {/* Add/Edit Rule Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingRuleId ? 'Edit' : 'Add'} Category Rule</DialogTitle>
            <DialogDescription>
              Create a rule to automatically categorize imported transactions.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {formError && (
              <div className="rounded-lg bg-destructive/10 p-3 text-sm text-destructive">
                {formError}
              </div>
            )}

            <div className="space-y-2">
              <label htmlFor="rule-name" className="text-sm font-medium">Rule Name</label>
              <Input
                id="rule-name"
                placeholder="e.g., Rent payments"
                value={ruleName}
                onChange={(e) => setRuleName(e.target.value)}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <span id="match-type-label" className="text-sm font-medium">Match Type</span>
                <Select value={matchType} onValueChange={(v) => setMatchType(v as CategoryRuleMatchType)}>
                  <SelectTrigger aria-labelledby="match-type-label">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="contains">Contains</SelectItem>
                    <SelectItem value="startsWith">Starts with</SelectItem>
                    <SelectItem value="equals">Equals</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <label htmlFor="match-value" className="text-sm font-medium">Match Value</label>
                <Input
                  id="match-value"
                  placeholder="e.g., WOOLWORTHS"
                  value={matchValue}
                  onChange={(e) => setMatchValue(e.target.value)}
                />
              </div>
            </div>

            <div className="space-y-2">
              <span id="category-label" className="text-sm font-medium">Assign Category</span>
              <Select value={categoryId} onValueChange={setCategoryId}>
                <SelectTrigger aria-labelledby="category-label">
                  <SelectValue placeholder="Select category" />
                </SelectTrigger>
                <SelectContent>
                  {activeCategories.map((cat) => (
                    <SelectItem key={cat.id} value={cat.id}>
                      {cat.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {activeCategories.length === 0 && (
                <p className="text-xs text-muted-foreground">
                  No categories found.{' '}
                  <Link to="/categories/new" className="underline">
                    Create one first
                  </Link>
                  .
                </p>
              )}
            </div>

            <div className="space-y-2">
              <span id="tx-type-label" className="text-sm font-medium">Transaction Type (optional)</span>
              <Select
                value={transactionType || 'any'}
                onValueChange={(v) => setTransactionType(v === 'any' ? '' : (v as 'income' | 'expense'))}
              >
                <SelectTrigger aria-labelledby="tx-type-label">
                  <SelectValue placeholder="Any type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="any">Any type</SelectItem>
                  <SelectItem value="expense">Expenses only</SelectItem>
                  <SelectItem value="income">Income only</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <Button variant="outline" onClick={() => setDialogOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleSaveRule}>
                {editingRuleId ? 'Save' : 'Add'} Rule
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
