import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { AlertCircle, AlertTriangle, CheckCircle, Info } from 'lucide-react';
import { cn } from '@/lib/utils';

const alertVariants = cva(
  'relative flex gap-3 rounded-lg border p-4 text-sm [&>svg]:shrink-0',
  {
    variants: {
      variant: {
        info: 'border-blue-500/50 bg-blue-500/10 text-blue-800 dark:text-blue-200 [&>svg]:text-blue-600 dark:[&>svg]:text-blue-400',
        warning:
          'border-yellow-500/50 bg-yellow-500/10 text-yellow-800 dark:text-yellow-200 [&>svg]:text-yellow-600 dark:[&>svg]:text-yellow-400',
        success:
          'border-green-500/50 bg-green-500/10 text-green-800 dark:text-green-200 [&>svg]:text-green-600 dark:[&>svg]:text-green-400',
        destructive:
          'border-destructive/50 bg-destructive/10 text-destructive dark:text-red-200 [&>svg]:text-destructive dark:[&>svg]:text-red-400',
      },
    },
    defaultVariants: {
      variant: 'info',
    },
  },
);

const variantIcons = {
  info: Info,
  warning: AlertTriangle,
  success: CheckCircle,
  destructive: AlertCircle,
};

export interface AlertProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof alertVariants> {
  hideIcon?: boolean;
  action?: React.ReactNode;
}

function Alert({
  className,
  variant = 'info',
  hideIcon = false,
  action,
  children,
  ...props
}: AlertProps) {
  const Icon = variant ? variantIcons[variant] : variantIcons.info;

  return (
    <div
      role="alert"
      className={cn(alertVariants({ variant }), className)}
      {...props}
    >
      {!hideIcon && <Icon className="mt-0.5 h-5 w-5" />}
      <div className="flex-1">{children}</div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}

function AlertTitle({ className, children, ...props }: React.HTMLAttributes<HTMLHeadingElement>) {
  return <h5 className={cn('font-medium leading-tight', className)} {...props}>{children}</h5>;
}

function AlertDescription({ className, ...props }: React.HTMLAttributes<HTMLParagraphElement>) {
  return <p className={cn('text-sm opacity-90', className)} {...props} />;
}

export { Alert, AlertTitle, AlertDescription, alertVariants };
