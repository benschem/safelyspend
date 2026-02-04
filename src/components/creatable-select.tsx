import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
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
  onCreateNew?: (name: string) => string | Promise<string>; // Returns the new item's value/id
  placeholder?: string;
  allowNone?: boolean;
  noneLabel?: string;
  createLabel?: string;
  disabled?: boolean;
  error?: boolean;
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
  error = false,
}: CreatableSelectProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const selectedOption = options.find((opt) => opt.value === value);
  const displayValue = selectedOption?.label ?? (value ? value : '');

  // Filter options based on search
  const filteredOptions = options.filter((opt) =>
    opt.label.toLowerCase().includes(search.toLowerCase()),
  );

  // Check if search matches any existing option exactly (case-insensitive)
  const exactMatch = options.some((opt) => opt.label.toLowerCase() === search.toLowerCase());

  // Show create option if there's search text and no exact match
  const showCreateOption = onCreateNew && search.trim() && !exactMatch;

  // Build list of all selectable items for keyboard navigation
  const selectableItems = useMemo(() => {
    const items: Array<{ type: 'none' | 'option' | 'create'; value?: string }> = [];
    if (allowNone) items.push({ type: 'none' });
    filteredOptions.forEach((opt) => items.push({ type: 'option', value: opt.value }));
    if (showCreateOption) items.push({ type: 'create' });
    return items;
  }, [allowNone, filteredOptions, showCreateOption]);

  const handleSelect = useCallback(
    (newValue: string) => {
      onChange(newValue);
      setSearch('');
      setOpen(false);
      setHighlightedIndex(-1);
    },
    [onChange],
  );

  const handleCreateNew = useCallback(async () => {
    if (onCreateNew && search.trim()) {
      const result = onCreateNew(search.trim());
      const newId = result instanceof Promise ? await result : result;
      onChange(newId);
      setSearch('');
      setOpen(false);
      setHighlightedIndex(-1);
    }
  }, [onCreateNew, search, onChange]);

  // Keyboard navigation
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (selectableItems.length === 0) return;

      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault();
          setHighlightedIndex((prev) => (prev < selectableItems.length - 1 ? prev + 1 : 0));
          break;
        case 'ArrowUp':
          e.preventDefault();
          setHighlightedIndex((prev) => (prev > 0 ? prev - 1 : selectableItems.length - 1));
          break;
        case 'Enter':
          e.preventDefault();
          if (highlightedIndex >= 0 && highlightedIndex < selectableItems.length) {
            const item = selectableItems[highlightedIndex];
            if (item) {
              if (item.type === 'none') handleSelect('');
              else if (item.type === 'option' && item.value) handleSelect(item.value);
              else if (item.type === 'create') handleCreateNew();
            }
          } else if (showCreateOption) {
            handleCreateNew();
          }
          break;
        case 'Escape':
          e.preventDefault();
          setOpen(false);
          setHighlightedIndex(-1);
          break;
      }
    },
    [selectableItems, highlightedIndex, handleSelect, handleCreateNew, showCreateOption],
  );

  // Reset highlight when search changes
  useEffect(() => {
    setHighlightedIndex(-1);
  }, [search]);

  // Focus input when popover opens
  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 0);
    } else {
      setSearch('');
      setHighlightedIndex(-1);
    }
  }, [open]);

  // Scroll highlighted item into view
  useEffect(() => {
    if (highlightedIndex >= 0 && listRef.current) {
      const items = listRef.current.querySelectorAll('[role="option"]');
      items[highlightedIndex]?.scrollIntoView({ block: 'nearest' });
    }
  }, [highlightedIndex]);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          aria-haspopup="listbox"
          disabled={disabled}
          className={cn(
            'h-10 w-full justify-between font-normal',
            error && 'border-destructive focus-visible:ring-destructive',
          )}
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
            onKeyDown={handleKeyDown}
            placeholder="Search or type to create..."
            className="border-b bg-transparent px-3 py-2.5 text-sm outline-none placeholder:text-muted-foreground"
            aria-label="Search options"
            aria-autocomplete="list"
            aria-controls="select-listbox"
          />
          <div
            ref={listRef}
            id="select-listbox"
            role="listbox"
            className="max-h-60 overflow-y-auto py-1"
          >
            {allowNone && (
              <button
                type="button"
                role="option"
                aria-selected={!value}
                onClick={() => handleSelect('')}
                className={cn(
                  'flex w-full cursor-pointer items-center px-3 py-2 text-sm transition-colors hover:bg-accent focus:bg-accent focus:outline-none',
                  !value && 'bg-accent',
                  highlightedIndex === 0 && 'bg-accent',
                )}
              >
                <Check
                  className={cn('mr-2 h-4 w-4 shrink-0', value ? 'opacity-0' : 'opacity-100')}
                />
                <span className="text-muted-foreground">{noneLabel}</span>
              </button>
            )}
            {filteredOptions.map((option, index) => {
              const itemIndex = allowNone ? index + 1 : index;
              return (
                <button
                  key={option.value}
                  type="button"
                  role="option"
                  aria-selected={value === option.value}
                  onClick={() => handleSelect(option.value)}
                  className={cn(
                    'flex w-full cursor-pointer items-center px-3 py-2 text-sm transition-colors hover:bg-accent focus:bg-accent focus:outline-none',
                    value === option.value && 'bg-accent',
                    highlightedIndex === itemIndex && 'bg-accent',
                  )}
                >
                  <Check
                    className={cn(
                      'mr-2 h-4 w-4 shrink-0',
                      value === option.value ? 'opacity-100' : 'opacity-0',
                    )}
                  />
                  {option.label}
                </button>
              );
            })}
            {filteredOptions.length === 0 && !showCreateOption && (
              <div className="px-3 py-2 text-sm text-muted-foreground">
                {options.length === 0 && onCreateNew ? 'Type to create one...' : 'No options found'}
              </div>
            )}
            {showCreateOption && (
              <button
                type="button"
                role="option"
                aria-selected={false}
                onClick={handleCreateNew}
                className={cn(
                  'flex w-full cursor-pointer items-center px-3 py-2 text-sm text-primary transition-colors hover:bg-accent focus:bg-accent focus:outline-none',
                  highlightedIndex === selectableItems.length - 1 && 'bg-accent',
                )}
              >
                <Plus className="mr-2 h-4 w-4 shrink-0" />
                {createLabel} &quot;{search.trim()}&quot;
              </button>
            )}
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
