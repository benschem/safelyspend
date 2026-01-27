import { type ReactNode, type ReactElement, Children, cloneElement, isValidElement } from 'react';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';

interface FieldState {
  value: unknown;
  meta: {
    errors: Array<string | { message?: string } | undefined>;
    isTouched: boolean;
    isValidating?: boolean;
  };
}

interface FormFieldProps {
  field: { name: string; state: FieldState };
  label: string;
  children: ReactNode;
  description?: string;
  optional?: boolean;
}

export function FormField({
  field,
  label,
  children,
  description,
  optional,
}: FormFieldProps) {
  const errors = field.state.meta.errors;
  // Filter to get actual error messages
  const errorMessages = errors
    .map((error) => {
      if (!error) return null;
      if (typeof error === 'string') return error;
      return error.message;
    })
    .filter((msg): msg is string => Boolean(msg));

  // Show errors if there are actual error messages
  // Errors are only populated after validation runs, so if they exist we should show them
  const hasError = errorMessages.length > 0;

  const errorId = hasError ? `${field.name}-error` : undefined;
  const descriptionId = description ? `${field.name}-description` : undefined;

  // Clone children to pass error prop and aria attributes
  const enhancedChildren = Children.map(children, (child) => {
    if (isValidElement(child)) {
      return cloneElement(child as ReactElement<Record<string, unknown>>, {
        error: hasError,
        'aria-describedby': [descriptionId, errorId].filter(Boolean).join(' ') || undefined,
      });
    }
    return child;
  });

  return (
    <div className="space-y-1.5">
      <Label
        htmlFor={field.name}
        className={cn('text-sm font-medium', hasError && 'text-destructive')}
      >
        {label}
        {optional && <span className="ml-1 font-normal text-muted-foreground">(optional)</span>}
      </Label>
      {enhancedChildren}
      {description && !hasError && (
        <p id={descriptionId} className="text-[13px] text-muted-foreground">
          {description}
        </p>
      )}
      {hasError && (
        <p id={errorId} className="text-[13px] font-medium text-destructive" role="alert">
          {errorMessages.join('. ')}
        </p>
      )}
    </div>
  );
}

interface FormErrorProps {
  error: string | null;
}

export function FormError({ error }: FormErrorProps) {
  if (!error) return null;
  return (
    <div
      className="rounded-lg bg-destructive/10 p-3 text-sm font-medium text-destructive"
      role="alert"
    >
      {error}
    </div>
  );
}
