import { createPortal } from 'react-dom';
import { formatCompactDate, formatDuration } from '@/lib/utils';

interface StickyDateBarProps {
  startDate: string;
  endDate: string;
}

export function StickyDateBar({ startDate, endDate }: StickyDateBarProps) {
  const startYear = new Date(startDate).getFullYear();
  const endYear = new Date(endDate).getFullYear();
  const currentYear = new Date().getFullYear();
  const showYear = startYear !== endYear || startYear !== currentYear;

  const portalTarget = document.getElementById('sticky-header-portal');
  if (!portalTarget) return null;

  return createPortal(
    <div className="border-b border-yellow-500/30 bg-yellow-50 px-4 py-2 dark:bg-yellow-950/30 sm:px-6">
      <div className="text-right text-sm font-medium text-yellow-800 dark:text-yellow-200">
        {formatCompactDate(startDate, showYear)} → {formatCompactDate(endDate, showYear)}
        <span className="ml-2 font-normal text-yellow-700 dark:text-yellow-300">
          ({formatDuration(startDate, endDate)})
        </span>
      </div>
    </div>,
    portalTarget,
  );
}
