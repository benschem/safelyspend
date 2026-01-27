import { useState, useRef, useEffect } from 'react';
import { Check, ChevronsUpDown, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';

export interface SelectOption {
  value: string;
  label: string;
}

interface CreatableSelectProps {
  options: SelectOption[];
  value: string;
  onChange: (value: string) => void;
  onCreateNew?: (name: string) => string; // Returns the new item's value/id
  placeholder?: string;
  allowNone?: boolean;
  noneLabel?: string;
  createLabel?: string;
  disabled?: boolean;
}

export function CreatableSelect({
  options,
  value,
  onChange,
  onCreateNew,
  placeholder = 'Select...',
  allowNone = false,
  noneLabel = 'None',
  createLabel = 'Create',
  disabled = false,
}: CreatableSelectProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  const selectedOption = options.find((opt) => opt.value === value);
  const displayValue = selectedOption?.label ?? (value ? value : '');

  // Filter options based on search
  const filteredOptions = options.filter((opt) =>
    opt.label.toLowerCase().includes(search.toLowerCase()),
  );

  // Check if search matches any existing option exactly (case-insensitive)
  const exactMatch = options.some(
    (opt) => opt.label.toLowerCase() === search.toLowerCase(),
  );

  // Show create option if there's search text and no exact match
  const showCreateOption = onCreateNew && search.trim() && !exactMatch;

  const handleSelect = (newValue: string) => {
    onChange(newValue);
    setSearch('');
    setOpen(false);
  };

  const handleCreateNew = () => {
    if (onCreateNew && search.trim()) {
      const newId = onCreateNew(search.trim());
      onChange(newId);
      setSearch('');
      setOpen(false);
    }
  };

  // Focus input when popover opens
  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 0);
    }
  }, [open]);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          disabled={disabled}
          className="w-full justify-between font-normal"
        >
          {displayValue || <span className="text-muted-foreground">{placeholder}</span>}
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
        <div className="flex flex-col">
          <input
            ref={inputRef}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search or type to create..."
            className="border-b px-3 py-2 text-sm outline-none placeholder:text-muted-foreground"
          />
          <div className="max-h-60 overflow-y-auto">
            {allowNone && (
              <button
                type="button"
                onClick={() => handleSelect('')}
                className={cn(
                  'flex w-full items-center px-3 py-2 text-sm hover:bg-accent',
                  !value && 'bg-accent',
                )}
              >
                <Check className={cn('mr-2 h-4 w-4', value ? 'opacity-0' : 'opacity-100')} />
                <span className="text-muted-foreground">{noneLabel}</span>
              </button>
            )}
            {filteredOptions.map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => handleSelect(option.value)}
                className={cn(
                  'flex w-full items-center px-3 py-2 text-sm hover:bg-accent',
                  value === option.value && 'bg-accent',
                )}
              >
                <Check
                  className={cn(
                    'mr-2 h-4 w-4',
                    value === option.value ? 'opacity-100' : 'opacity-0',
                  )}
                />
                {option.label}
              </button>
            ))}
            {filteredOptions.length === 0 && !showCreateOption && (
              <div className="px-3 py-2 text-sm text-muted-foreground">No options found</div>
            )}
            {showCreateOption && (
              <button
                type="button"
                onClick={handleCreateNew}
                className="flex w-full items-center px-3 py-2 text-sm text-primary hover:bg-accent"
              >
                <Plus className="mr-2 h-4 w-4" />
                {createLabel} &quot;{search.trim()}&quot;
              </button>
            )}
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
